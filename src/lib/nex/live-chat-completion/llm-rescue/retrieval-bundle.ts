// src/lib/nex/live-chat-completion/llm-rescue/retrieval-bundle.ts
//
// Founder BEGIN Phase 3.4 · Retrieval bundle assembler.
//
// Given a turn where the deterministic path couldn't answer, gather
// EVIDENCE the LLM may cite from:
//   1. Hot-tier facts for the focus/candidate entity (if any).
//   2. Answered/partially_answered nex.question_variant rows tied to the
//      same entity or intent (small · capped).
//   3. Entity-index rows if the message mentions a name we can find.
//
// The bundle is ONLY hard facts. No unstructured text. The LLM cannot cite
// anything outside this bundle (Truth Engine gate rejects orphan claims).

import type { Pool } from "pg";
import { factHotAllNames, factHotGet } from "@/lib/nex/intelligence-storage-grid/accommodation/hot-tier-facts";
import type { StructuredFact } from "@/lib/nex/intelligence-storage-grid/accommodation/fact-computer";
import type { EvidenceItem, RetrievalBundle } from "./contract";
// Founder Doctrine #5 · UNTRUSTED EXTERNAL CONTENT NEVER BECOMES INSTRUCTIONS.
import { sanitiseUntrustedContent } from "@/lib/nex/live-chat-completion/safety/untrusted-content-sanitiser";
import { semanticSearch, type SemanticSearchResult } from "@/lib/nex/live-chat-completion/semantic/semantic-retriever";
import { makeDefaultEmbeddingProvider } from "@/lib/nex/live-chat-completion/semantic/embedding-provider";
// Founder BEGIN Phase 3.5 · web acquisition · fires when semantic+local yield nothing.
import { makeDefaultWebProvider } from "@/lib/nex/live-chat-completion/web-acquisition";
import { webResultToEvidence } from "@/lib/nex/live-chat-completion/web-acquisition/contract";

// Founder BEGIN Phase 3.4B · shared embedding provider (env-selected).
const _embeddingProvider = makeDefaultEmbeddingProvider();
// Founder BEGIN Phase 3.5 · shared web provider (env-selected, may be null).
const _webProvider = makeDefaultWebProvider();
const _WEB_BUDGET_MS = (() => {
  const raw = Number(process.env.NEX_WEB_ACQUISITION_BUDGET_MS ?? 5000);
  return Number.isFinite(raw) && raw >= 500 && raw <= 30_000 ? raw : 5000;
})();
// Founder rule: web acquisition only fires when nothing local + nothing
// semantic-significant has already qualified · avoids wasted external
// calls for questions we can already answer.
const _WEB_TRIGGER_MIN_LOCAL_ITEMS = 3;
const _WEB_TRIGGER_MIN_SEMANTIC_SIM = 0.35;

export interface AssembleBundleInput {
  message: string;
  language: "en" | "id";
  domain: string;
  entity_ref?: string | null;
  intent_slug?: string | null;
  kfPool: Pool;
  /** Founder Phase 3.4A · optional conversation-brain context for the LLM. */
  conversation_context?: readonly { role: "user" | "nex"; text: string }[];
  /**
   * Founder Phase 3.8 · pre-computed evidence items (e.g. from vision
   * extraction) that are prepended to the bundle BEFORE local semantic /
   * web acquisition. The LLM cites them via their ref_id like any other
   * evidence · the Fabrication Gate validates them like any other citation.
   */
  extra_items?: readonly EvidenceItem[];
  /**
   * Founder Phase 3.10 · Doctrine #4 (MEMORY IS NOT TRUTH).
   * Personalization signals + user-asserted context · surfaced to the LLM
   * as bundle.user_context. NEVER converted to EvidenceItem · NEVER
   * citeable · NEVER validated by the Fabrication Gate.
   */
  user_context?: RetrievalBundle["user_context"];
}

const MAX_ITEMS = 24;

export async function assembleRetrievalBundle(input: AssembleBundleInput): Promise<RetrievalBundle> {
  const items: EvidenceItem[] = [];
  const seenRefs = new Set<string>();
  // Founder Doctrine #5 · sanitiser applied to every UNTRUSTED source
  // (web_search · vision · file) before they enter the bundle. Trusted
  // internal sources (canonical_fact · question_variant) pass through.
  const _sanitiserCounters = { total_neutralised: 0, rejected_items: 0, sources_scanned: 0 };
  const add = (it: EvidenceItem) => {
    if (items.length >= MAX_ITEMS) return;
    if (seenRefs.has(it.ref_id)) return;
    // Sanitise untrusted origins.
    if (it.source_type === "web_search" || it.source_type === "vision" || it.source_type === "file") {
      _sanitiserCounters.sources_scanned += 1;
      const verdict = sanitiseUntrustedContent({
        text: it.text,
        source_kind: it.source_type === "web_search" ? "web" : it.source_type,
        source_url: it.source_reference ?? null,
      });
      _sanitiserCounters.total_neutralised += verdict.neutralised_count;
      if (!verdict.safe_to_cite) {
        _sanitiserCounters.rejected_items += 1;
        return; // hostile-content-rejection · never enters bundle
      }
      if (verdict.had_signal) {
        // Replace item text with the sanitised version so the LLM never
        // sees the raw injection payload.
        it = { ...it, text: verdict.clean_text };
      }
    }
    seenRefs.add(it.ref_id);
    items.push(it);
  };

  // Founder BEGIN Phase 3.8 · vision-extracted items are prepended so the
  // LLM sees them among the earliest evidence · Fabrication Gate validates
  // their citations exactly like any other source.
  if (input.extra_items) for (const it of input.extra_items) add(it);

  // ── 1. Focus entity's fact bundle from hot-tier ────────────────────
  let focusRef = input.entity_ref ?? null;
  if (!focusRef) {
    // Try to name-match against hot-tier canonical names.
    const raw = String(input.message ?? "").toLowerCase();
    const knownNames = factHotAllNames();
    let best: { listing_ref: string; business_name: string; span_len: number } | null = null;
    for (const cand of knownNames) {
      const nameLower = String(cand.business_name).toLowerCase().trim();
      if (nameLower.length < 4) continue;
      if (raw.includes(nameLower)) {
        if (!best || nameLower.length > best.span_len) {
          best = { listing_ref: cand.listing_ref, business_name: cand.business_name, span_len: nameLower.length };
        }
      }
    }
    if (best) focusRef = best.listing_ref;
  }
  if (focusRef) {
    const hit = factHotGet(focusRef);
    if (hit) {
      const b = hit.bundle;
      const facts: Record<string, StructuredFact> = b.facts as unknown as Record<string, StructuredFact>;
      for (const [slug, fact] of Object.entries(facts)) {
        if (!fact) continue;
        if (fact.unknown) continue;
        const val = renderFactValue(fact.value);
        if (!val) continue;
        add({
          ref_id: `fact:${focusRef}:${slug}`,
          source_type: "canonical_fact",
          entity_ref: focusRef,
          intent_slug: slug,
          text: `${b.business_name} · ${slug} = ${val}`,
          confidence: trustToConfidence(fact.trust),
          verified_at: null,
          source_reference: `nex.accommodation_business:${focusRef}`,
        });
      }
    }
  }

  // ── 2. Answered question_variants for same entity or intent ────────
  try {
    if (focusRef || input.intent_slug) {
      const conds: string[] = ["domain = $1", "answer_status IN ('answered','partially_answered')"];
      const params: unknown[] = [input.domain];
      let p = params.length;
      if (focusRef) { params.push(focusRef); conds.push(`entity_ref = $${++p}`); }
      if (input.intent_slug) { params.push(input.intent_slug); conds.push(`intent_slug = $${++p}`); }
      const res = await input.kfPool.query(
        `SELECT fingerprint, entity_ref, intent_slug, raw_text, trust, last_verified_at
           FROM nex.question_variant
           WHERE ${conds.join(" AND ")}
           ORDER BY last_verified_at DESC NULLS LAST
           LIMIT 12`,
        params,
      );
      for (const r of res.rows) {
        add({
          ref_id: `qv:${String(r.fingerprint).slice(0, 16)}`,
          source_type: "question_variant",
          entity_ref: r.entity_ref ? String(r.entity_ref) : null,
          intent_slug: r.intent_slug ? String(r.intent_slug) : null,
          text: `Answered variant: "${String(r.raw_text)}"`,
          confidence: trustToConfidence(String(r.trust ?? "unknown")),
          verified_at: r.last_verified_at instanceof Date ? r.last_verified_at.toISOString() : (r.last_verified_at ? String(r.last_verified_at) : null),
          source_reference: `nex.question_variant:${String(r.fingerprint).slice(0, 16)}`,
        });
      }
    }
  } catch { /* evidence assembly must not block rescue · continues with what we have */ }

  // ── 3. Semantic hits · L3 · Founder Phase 3.4B ───────────────────
  //     Pull top-K by cosine similarity from the semantic index. Feeds
  //     both entity name-paraphrase matches AND answered question
  //     paraphrase matches into the evidence bundle. These are CANDIDATES
  //     for the LLM to cite · the gate rejects any orphan citation.
  let semantic: SemanticSearchResult | null = null;
  try {
    semantic = await semanticSearch({
      kfPool: input.kfPool,
      provider: _embeddingProvider,
      domain: input.domain,
      query: input.message,
      top_k_entities: 4,
      top_k_questions: 6,
      min_similarity: 0.2,
    });
    for (const e of semantic.entity_hits) {
      add({
        ref_id: `sem_ent:${e.entity_ref}`,
        source_type: "canonical_fact",
        entity_ref: e.entity_ref,
        intent_slug: null,
        text: `Semantic entity match: ${e.canonical_name} (similarity=${e.similarity.toFixed(3)})`,
        confidence: Math.min(0.95, 0.4 + e.similarity * 0.5),
        source_reference: `nex.semantic_entity_index:${e.entity_ref}`,
      });
    }
    for (const q of semantic.question_hits) {
      add({
        ref_id: `sem_qv:${String(q.fingerprint).slice(0, 16)}`,
        source_type: "question_variant",
        entity_ref: q.entity_ref,
        intent_slug: q.intent_slug,
        text: `Similar answered variant: "${q.source_text}" (similarity=${q.similarity.toFixed(3)})`,
        confidence: Math.min(0.85, 0.3 + q.similarity * 0.5),
        source_reference: `nex.semantic_question_index:${String(q.fingerprint).slice(0, 16)}`,
      });
    }
    // Promote the top entity match as focusRef if we didn't have one.
    if (!focusRef && semantic.entity_hits.length > 0 && semantic.entity_hits[0].similarity >= 0.35) {
      focusRef = semantic.entity_hits[0].entity_ref;
    }
  } catch { /* semantic degraded · continue with structured evidence */ }

  // ── 4. Entity-index rows for likely name matches ───────────────────
  try {
    const raw = String(input.message ?? "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
    const tokens = raw.split(/\s+/).filter((t) => t.length >= 4).slice(0, 3);
    if (tokens.length > 0) {
      const like = "%" + tokens.join("%") + "%";
      const res = await input.kfPool.query(
        `SELECT entity_ref, canonical_name, city, source_table
           FROM nex.entity_index
           WHERE domain = $1 AND lower(canonical_name) LIKE $2
           LIMIT 6`,
        [input.domain, like],
      );
      for (const r of res.rows) {
        add({
          ref_id: `ent:${String(r.entity_ref)}`,
          source_type: "canonical_fact",
          entity_ref: String(r.entity_ref),
          intent_slug: null,
          text: `Entity ${String(r.canonical_name)} (${String(r.entity_ref)})${r.city ? ` in ${String(r.city)}` : ""}`,
          confidence: 0.9,
          source_reference: `nex.entity_index:${String(r.entity_ref)}`,
        });
      }
    }
  } catch { /* non-fatal */ }

  // ── 5. Founder BEGIN Phase 3.5 · web acquisition fallback ────────
  //     Only fires when the local + semantic evidence pool is thin.
  //     Web evidence is CANDIDATE only — the Fabrication Gate rejects
  //     any LLM claim whose source_ref isn't among these bundle items.
  const topSemanticEntity = semantic?.entity_hits?.[0]?.similarity ?? 0;
  const topSemanticQuestion = semantic?.question_hits?.[0]?.similarity ?? 0;
  const bestSemanticSim = Math.max(topSemanticEntity, topSemanticQuestion);
  const webShouldFire = _webProvider
    && items.length < _WEB_TRIGGER_MIN_LOCAL_ITEMS
    && bestSemanticSim < _WEB_TRIGGER_MIN_SEMANTIC_SIM;
  let webAcquired = 0;
  let webNote: string | undefined = undefined;
  if (webShouldFire) {
    try {
      const res = await _webProvider!.acquire({
        query: input.message,
        budget_ms: _WEB_BUDGET_MS,
        language: input.language,
        entity_name: null,
      });
      for (const w of res.results) {
        add(webResultToEvidence(w));
        webAcquired++;
      }
      webNote = `web(${res.provider_meta.provider}) · ${res.provider_meta.result_count} results in ${res.provider_meta.request_ms}ms${res.provider_meta.error ? ` · error=${res.provider_meta.error}` : ""}`;
    } catch (e) {
      webNote = `web_error:${e instanceof Error ? e.message.slice(0, 100) : String(e)}`;
    }
  }

  return {
    message: input.message,
    language: input.language,
    entity_ref: focusRef,
    intent_slug: input.intent_slug ?? null,
    items,
    context_note: items.length === 0
      ? "no evidence found · you MUST respond with answered=false"
      : `evidence bundle has ${items.length} item(s)${semantic ? ` · semantic top sim=${bestSemanticSim.toFixed(3)}` : ""}${webNote ? ` · ${webNote}` : ""}`,
    conversation_context: input.conversation_context,
    allowed_answer_mode: "cite_or_abstain",
    user_context: input.user_context,
  };
}

function renderFactValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.filter(Boolean).map(String).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function trustToConfidence(t: string): number {
  switch (t) {
    case "canonical_verified":  return 0.95;
    case "evidence_verified":   return 0.85;
    case "canonical_unverified": return 0.65;
    case "evidence_provisional": return 0.55;
    default: return 0.3;
  }
}
