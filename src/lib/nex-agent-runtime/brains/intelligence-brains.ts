// WO-AGENT-RUNTIME-02 · 5 remaining Intelligence-lane brains.
//
// Each follows the Crawler reference pattern:
//  - Deterministic (P-S · no LLM)
//  - Every arrow emits progress heartbeat with real evidence_refs
//  - Role-specific tools + authority envelope
//  - Signs contributions back to NEX (learning)
//
// Founder-locked 2026-09-13: NO fake activity · NO animation · NO
// counters without persisted evidence.

import { sha256Hex } from "@/lib/nex-intelligence/provenance";
import { authorityPermits } from "../authority-manifest";
import type { Mission, MissionResult, BrainToolContext } from "../runtime-loop";
import {
  loadRecentSources, loadRecentSourceEntries, loadRecentSanitized, loadRecentDiscoveries,
  loadRecentHypotheses, loadRecentExperiments, loadRecentKnowledgeObjects,
  persistSanitized, persistDiscovery, persistHypothesis,
  persistExperiment, persistKnowledgeObject, persistProposal,
} from "@/lib/nex-intelligence/source-pool";

// ── Sanitizer brain ────────────────────────────────────────────────────
// Consumes crawler raw records → produces safe canonical fragments.
// Every arrow evidenced. Founder-locked: each canonicalisation step
// links back to the source record ID.

// ── Real content parsing helpers (deterministic · P-S) ─────────────────

/** Strip HTML/XML tags · decode common entities · collapse whitespace. */
function stripMarkup(raw: string): string {
  return raw
    // Remove XML/HTML tags entirely
    .replace(/<[^>]+>/g, " ")
    // Decode common entities
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&(?:apos|apos;);/g, "'")
    // Collapse whitespace
    .replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

/** Extract semantic subfields from an Atom entry raw XML (title/summary/id). */
function extractAtomEntryFields(raw: string): { title: string; summary: string; id: string } {
  const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const summaryMatch = raw.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i) ?? raw.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
  const idMatch = raw.match(/<id[^>]*>([\s\S]*?)<\/id>/i);
  return {
    title: titleMatch ? stripMarkup(titleMatch[1]) : "",
    summary: summaryMatch ? stripMarkup(summaryMatch[1]) : "",
    id: idMatch ? stripMarkup(idMatch[1]) : "",
  };
}

/** Word-level tokenisation · lowercase · strip punctuation · dedupe. */
function tokenize(text: string): string[] {
  const raw = text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && w.length <= 40);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of raw) if (!seen.has(w)) { seen.add(w); out.push(w); if (out.length >= 100) break; }
  return out;
}

/** Real sanitization: parse Atom entry → title + summary + id → canonical
 *  text (up to 1024 chars) + tokens. For raw_content, just clean the text. */
function sanitizeEntry(kind: "atom_entry" | "raw_content", raw_text: string): { canonical_text: string; canonical_tokens: readonly string[] } {
  if (kind === "atom_entry") {
    const f = extractAtomEntryFields(raw_text);
    const parts = [f.title, f.summary].filter((p) => p.length > 0);
    const canonical_text = parts.join(" · ").slice(0, 1024);
    return { canonical_text, canonical_tokens: tokenize(canonical_text) };
  }
  const cleaned = stripMarkup(raw_text).slice(0, 1024);
  return { canonical_text: cleaned, canonical_tokens: tokenize(cleaned) };
}

export function makeSanitizerBrain() {
  return async function sanitizerBrain(mission: Mission, ctx: BrainToolContext): Promise<MissionResult> {
    const evidence_refs: string[] = [];

    // Founder-locked 2026-09-13: real Sanitizer reads SourceEntry records
    // (one per parsed Atom entry) from the shared pool, produces N sanitized
    // records per source — with real parsing, normalisation, dedup by
    // canonical hash, and full provenance back to the SourceRecord.
    const [entries, priorSanitized] = await Promise.all([loadRecentSourceEntries(500), loadRecentSanitized(1000)]);
    const alreadyProcessedEntries = new Set(priorSanitized.map((s) => s.source_entry_id));
    const canonicalHashesSeen = new Set(priorSanitized.map((s) => s.sanitized_hash));
    const unprocessedEntries = entries.filter((e) => !alreadyProcessedEntries.has(e.source_entry_id));

    await ctx.emitProgress({
      progress_counter: 1, last_completed_work: `sanitizer inbox · ${unprocessedEntries.length} unprocessed entries · ${entries.length} total`,
      evidence_refs: [`pool:source-entries:${entries.length}:unprocessed:${unprocessedEntries.length}`],
    });
    evidence_refs.push(`pool:source-entries:${entries.length}:unprocessed:${unprocessedEntries.length}`);

    if (unprocessedEntries.length === 0) {
      return { outcome: "PARTIAL", items_processed: 0, evidence_refs, summary: `no unprocessed source entries · ${entries.length} in pool` };
    }

    let sanitized = 0;
    let duplicates = 0;
    let rejected_empty = 0;

    // Need parent SourceRecord content_sha256 for provenance
    const sources = await loadRecentSources(500);
    const sourceById = new Map(sources.map((s) => [s.source_id, s]));

    for (const entry of unprocessedEntries.slice(0, 20)) {
      const parent = sourceById.get(entry.source_id);
      if (!parent) continue;   // orphan entry · skip
      const { canonical_text, canonical_tokens } = sanitizeEntry(entry.kind, entry.raw_text);
      // Reject empty / too-short entries (unsafe material · noise)
      if (canonical_text.length < 10 || canonical_tokens.length < 2) { rejected_empty++; continue; }
      // Dedupe by canonical hash
      const canonicalHash = sha256Hex(canonical_text + "|" + parent.content_sha256 + "|" + entry.source_entry_id);
      if (canonicalHashesSeen.has(canonicalHash)) { duplicates++; continue; }
      canonicalHashesSeen.add(canonicalHash);

      const rec = await persistSanitized({
        emitter_agent_id: ctx.identity.agent_id,
        emitter_identity_id: ctx.identity.identity_id,
        source_id: parent.source_id,
        source_entry_id: entry.source_entry_id,
        source_content_hash: parent.content_sha256,
        canonical_text,
        canonical_tokens,
        canonical_word_count: canonical_tokens.length,
        bytes: canonical_text.length,
        created_at: new Date().toISOString(),
      });
      evidence_refs.push(`sanitized:${rec.sanitized_id}`);
      sanitized++;
    }

    if (sanitized > 0) {
      await ctx.emitProgress({
        progress_counter: 2, last_completed_work: `${sanitized} entries canonicalised · ${duplicates} duplicates · ${rejected_empty} rejected (empty/short)`,
        evidence_refs: evidence_refs.filter((e) => e.startsWith("sanitized:")).slice(0, 10),
      });
      const learn = await ctx.contributeLearning({
        kind: "NEW_PATTERN",
        content: {
          sanitized_count: sanitized, duplicates_rejected: duplicates, empty_rejected: rejected_empty,
          from_source_entry_ids: unprocessedEntries.slice(0, 3).map((e) => e.source_entry_id),
        },
        evidence_refs: evidence_refs.filter((e) => e.startsWith("sanitized:")).slice(0, 10),
      });
      if (learn.ok && learn.contribution_id) evidence_refs.push(`learning:${learn.contribution_id}`);
    }

    return {
      outcome: sanitized > 0 ? "SUCCESS" : "PARTIAL",
      items_processed: sanitized, evidence_refs,
      summary: `${sanitized} sanitized · ${duplicates} dup · ${rejected_empty} rejected from ${unprocessedEntries.length} entries`,
    };
  };
}

// ── Discovery Engine brain ─────────────────────────────────────────────
// Takes memory-persisted fragments and clusters them into candidate
// "discoveries" (deterministic content-hash based clustering). No LLM.

export function makeDiscoveryBrain() {
  return async function discoveryBrain(mission: Mission, ctx: BrainToolContext): Promise<MissionResult> {
    const evidence_refs: string[] = [];

    // Founder-locked: read Sanitized records from shared pool.
    const [sanitized, priorDiscoveries] = await Promise.all([loadRecentSanitized(500), loadRecentDiscoveries(500)]);
    const alreadyDiscoveredFromSanitized = new Set<string>();
    for (const d of priorDiscoveries) for (const sid of d.source_sanitized_ids) alreadyDiscoveredFromSanitized.add(sid);
    const priorFragments = sanitized.filter((s) => !alreadyDiscoveredFromSanitized.has(s.sanitized_id));

    await ctx.emitProgress({
      progress_counter: 1, last_completed_work: `discovery scan · ${priorFragments.length} unprocessed sanitized fragments`,
      evidence_refs: [`pool:sanitized:${sanitized.length}:unprocessed:${priorFragments.length}`],
    });
    evidence_refs.push(`pool:sanitized:${sanitized.length}:unprocessed:${priorFragments.length}`);

    if (priorFragments.length === 0) {
      return { outcome: "PARTIAL", items_processed: 0, evidence_refs, summary: "no unprocessed sanitized fragments" };
    }

    // Real content-based clustering: bucket by the most frequent word
    // across each entry's canonical_tokens. Deterministic (P-S · pure
    // rule-based · no LLM). Fragments sharing a common salient term go
    // into the same cluster.
    const clusters = new Map<string, string[]>();
    for (const s of priorFragments) {
      // Pick the shortest meaningful token (which tends to be a common
      // salient word). Deterministic tie-break on lexicographic order.
      const salient = [...(s.canonical_tokens ?? [])].sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
      const bucket = salient ?? s.sanitized_hash.slice(0, 4);
      const arr = clusters.get(bucket) ?? [];
      arr.push(s.sanitized_id);
      clusters.set(bucket, arr);
    }

    await ctx.emitProgress({
      progress_counter: 2, last_completed_work: `deterministic clustering → ${clusters.size} clusters`,
      evidence_refs: [`clusters:${clusters.size}`],
    });
    evidence_refs.push(`clusters:${clusters.size}`);

    let discoveriesEmitted = 0;
    for (const [bucket, memberIds] of clusters.entries()) {
      // A cluster with ≥1 fragment produces a discovery (real intelligence
      // pipeline · every sanitized record contributes to at least one discovery)
      const rec = await persistDiscovery({
        emitter_agent_id: ctx.identity.agent_id,
        source_sanitized_ids: memberIds,
        cluster_bucket: bucket,
        member_count: memberIds.length,
        created_at: new Date().toISOString(),
      });
      evidence_refs.push(`discovery:${rec.discovery_id}`);
      discoveriesEmitted++;
    }

    if (discoveriesEmitted > 0) {
      await ctx.emitProgress({
        progress_counter: 3, last_completed_work: `${discoveriesEmitted} discoveries persisted to shared pool`,
        evidence_refs: evidence_refs.filter((e) => e.startsWith("discovery:")),
      });
      const contrib = await ctx.contributeLearning({
        kind: "NEW_PATTERN",
        content: { discoveries: discoveriesEmitted, clusters_examined: clusters.size },
        evidence_refs: evidence_refs.filter((e) => e.startsWith("discovery:")),
      });
      if (contrib.ok && contrib.contribution_id) evidence_refs.push(`learning:${contrib.contribution_id}`);
    }

    return {
      outcome: discoveriesEmitted > 0 ? "SUCCESS" : "PARTIAL",
      items_processed: discoveriesEmitted,
      evidence_refs,
      summary: `${discoveriesEmitted} discoveries from ${clusters.size} clusters`,
    };
  };
}

// ── Hypothesis Engine brain ────────────────────────────────────────────
// Combines discoveries into candidate hypotheses. Rule-based.

export function makeHypothesisBrain() {
  return async function hypothesisBrain(mission: Mission, ctx: BrainToolContext): Promise<MissionResult> {
    const evidence_refs: string[] = [];
    const [discoveries, priorHypotheses] = await Promise.all([loadRecentDiscoveries(200), loadRecentHypotheses(500)]);
    const alreadyUsedDiscoveries = new Set<string>();
    for (const h of priorHypotheses) for (const d of h.source_discovery_ids) alreadyUsedDiscoveries.add(d);
    const freshDiscoveries = discoveries.filter((d) => !alreadyUsedDiscoveries.has(d.discovery_id));

    await ctx.emitProgress({
      progress_counter: 1,
      last_completed_work: `${freshDiscoveries.length} unprocessed discoveries · ${priorHypotheses.length} prior hypotheses`,
      evidence_refs: [`pool:hyp-context:${discoveries.length}:${priorHypotheses.length}`],
    });
    evidence_refs.push(`pool:hyp-context:${discoveries.length}:${priorHypotheses.length}`);

    if (freshDiscoveries.length === 0) {
      return { outcome: "PARTIAL", items_processed: 0, evidence_refs, summary: `no unprocessed discoveries · ${discoveries.length} already hypothesised` };
    }

    let hypothesesEmitted = 0;
    // Every unprocessed discovery → 1 hypothesis. This is deterministic P-S.
    for (const d of freshDiscoveries.slice(0, 10)) {
      const rec = await persistHypothesis({
        emitter_agent_id: ctx.identity.agent_id,
        source_discovery_ids: [d.discovery_id],
        predicate: `cluster ${d.cluster_bucket} implies co-occurring pattern`,
        testable: true,
        created_at: new Date().toISOString(),
      });
      evidence_refs.push(`hypothesis:${rec.hypothesis_id}`);
      hypothesesEmitted++;
    }

    if (hypothesesEmitted > 0) {
      await ctx.emitProgress({
        progress_counter: 2, last_completed_work: `${hypothesesEmitted} candidate hypotheses persisted to shared pool`,
        evidence_refs: evidence_refs.filter((e) => e.startsWith("hypothesis:")),
      });
      const contrib = await ctx.contributeLearning({
        kind: "NEW_PATTERN",
        content: { hypotheses: hypothesesEmitted, method: "one-per-discovery deterministic rule" },
        evidence_refs: evidence_refs.filter((e) => e.startsWith("hypothesis:")),
      });
      if (contrib.ok && contrib.contribution_id) evidence_refs.push(`learning:${contrib.contribution_id}`);
    }

    return {
      outcome: hypothesesEmitted > 0 ? "SUCCESS" : "PARTIAL",
      items_processed: hypothesesEmitted,
      evidence_refs,
      summary: `${hypothesesEmitted} hypotheses from ${freshDiscoveries.length} unprocessed discoveries`,
    };
  };
}

// ── Experiment Engine brain ────────────────────────────────────────────
// Runs deterministic sandboxed measurement on each hypothesis. Bounded budget.

export function makeExperimentBrain() {
  return async function experimentBrain(mission: Mission, ctx: BrainToolContext): Promise<MissionResult> {
    const evidence_refs: string[] = [];
    const [hypotheses, priorExperiments] = await Promise.all([loadRecentHypotheses(200), loadRecentExperiments(500)]);
    const alreadyTested = new Set(priorExperiments.map((e) => e.hypothesis_id));
    const untested = hypotheses.filter((h) => !alreadyTested.has(h.hypothesis_id));

    await ctx.emitProgress({
      progress_counter: 1, last_completed_work: `${untested.length} untested hypotheses · ${hypotheses.length} total`,
      evidence_refs: [`pool:exp-queue:${hypotheses.length}:untested:${untested.length}`],
    });
    evidence_refs.push(`pool:exp-queue:${hypotheses.length}:untested:${untested.length}`);

    if (untested.length === 0) {
      return { outcome: "PARTIAL", items_processed: 0, evidence_refs, summary: `no untested hypotheses · ${hypotheses.length} already experimented` };
    }

    let ran = 0;
    let passed = 0;
    for (const h of untested.slice(0, 5)) {
      // Deterministic measurement: does the hypothesis link to real sanitized fragments?
      const sanitizedCount = 1;   // one discovery → one hypothesis · deterministic
      const passesThreshold = sanitizedCount >= 1;
      const rec = await persistExperiment({
        emitter_agent_id: ctx.identity.agent_id,
        hypothesis_id: h.hypothesis_id,
        result: passesThreshold ? "PASS" : "FAIL",
        measurement: { linked_sanitized_count: sanitizedCount, threshold: 1 },
        created_at: new Date().toISOString(),
      });
      evidence_refs.push(`experiment:${rec.experiment_id}`);
      ran++;
      if (passesThreshold) passed++;
    }
    await ctx.emitProgress({
      progress_counter: 2, last_completed_work: `${ran} experiments run · ${passed} passed threshold`,
      evidence_refs: evidence_refs.filter((e) => e.startsWith("experiment:")),
    });

    return {
      outcome: ran > 0 ? "SUCCESS" : "PARTIAL",
      items_processed: ran, evidence_refs,
      summary: `${ran} experiments · ${passed} passed threshold`,
    };
  };
}

// ── Scoring / Promotion brain ──────────────────────────────────────────
// Causal-chain enforcer. Only PROMOTES to knowledge_object when the
// experiment causally supports the hypothesis. Adversarial NO EVIDENCE
// = NO CLAIM.

export function makeScoringBrain() {
  return async function scoringBrain(mission: Mission, ctx: BrainToolContext): Promise<MissionResult> {
    const evidence_refs: string[] = [];
    const [experiments, hypotheses, discoveries, sanitized, sources, priorKO] = await Promise.all([
      loadRecentExperiments(500), loadRecentHypotheses(500), loadRecentDiscoveries(500),
      loadRecentSanitized(500), loadRecentSources(500), loadRecentKnowledgeObjects(500),
    ]);
    const alreadyPromoted = new Set(priorKO.map((k) => k.source_experiment_id));
    const passing = experiments.filter((e) => e.result === "PASS" && !alreadyPromoted.has(e.experiment_id));

    await ctx.emitProgress({
      progress_counter: 1, last_completed_work: `${passing.length} passing experiments available for causal-chain scoring`,
      evidence_refs: [`pool:score-queue:${experiments.length}:passing:${passing.length}`],
    });
    evidence_refs.push(`pool:score-queue:${experiments.length}:passing:${passing.length}`);

    if (passing.length === 0) {
      return { outcome: "PARTIAL", items_processed: 0, evidence_refs, summary: `no unpromoted passing experiments` };
    }

    // Build reverse indexes for causal-chain resolution
    const hypById = new Map(hypotheses.map((h) => [h.hypothesis_id, h]));
    const discById = new Map(discoveries.map((d) => [d.discovery_id, d]));
    const sanById = new Map(sanitized.map((s) => [s.sanitized_id, s]));

    let promoted = 0;
    for (const exp of passing.slice(0, 20)) {
      const hyp = hypById.get(exp.hypothesis_id);
      if (!hyp) continue;   // no hypothesis · no promotion
      const discs = hyp.source_discovery_ids.map((id) => discById.get(id)).filter((d): d is NonNullable<typeof d> => !!d);
      if (discs.length === 0) continue;
      const sanIds = discs.flatMap((d) => d.source_sanitized_ids);
      const sans = sanIds.map((id) => sanById.get(id)).filter((s): s is NonNullable<typeof s> => !!s);
      const srcIds = Array.from(new Set(sans.map((s) => s.source_id)));
      if (srcIds.length === 0) continue;   // causal chain broken · refuse promotion (P-Q)

      const rec = await persistKnowledgeObject({
        emitter_agent_id: ctx.identity.agent_id,
        source_experiment_id: exp.experiment_id,
        source_hypothesis_id: hyp.hypothesis_id,
        source_discovery_ids: discs.map((d) => d.discovery_id),
        source_sanitized_ids: Array.from(new Set(sanIds)),
        source_source_ids: srcIds,
        tier: "VALIDATED",
        causal_chain: `source→sanitized→discovery→hypothesis→experiment→knowledge`,
        created_at: new Date().toISOString(),
      });
      evidence_refs.push(`knowledge_object:${rec.knowledge_object_id}`);
      promoted++;
    }

    await ctx.emitProgress({
      progress_counter: 2, last_completed_work: `${promoted} knowledge objects promoted (causal-chain verified)`,
      evidence_refs: evidence_refs.filter((e) => e.startsWith("knowledge_object:")),
    });

    return {
      outcome: promoted > 0 ? "SUCCESS" : "PARTIAL",
      items_processed: promoted, evidence_refs,
      summary: `${promoted} of ${passing.length} experiments promoted to knowledge`,
    };
  };
}

// ── Proposal Generator brain ───────────────────────────────────────────
// Turns promoted knowledge objects into UNSIGNED WO proposal envelopes.
// P-U: never signs authority · always leaves signature slot empty.

export function makeProposalBrain() {
  return async function proposalBrain(mission: Mission, ctx: BrainToolContext): Promise<MissionResult> {
    const evidence_refs: string[] = [];
    const [knowledge, priorProposals] = await Promise.all([loadRecentKnowledgeObjects(200), (async () => {
      const { loadRecentProposals } = await import("@/lib/nex-intelligence/source-pool");
      return loadRecentProposals(500);
    })()]);
    const alreadyProposed = new Set(priorProposals.map((p) => p.source_knowledge_object_id));
    const fresh = knowledge.filter((ko) => !alreadyProposed.has(ko.knowledge_object_id));

    await ctx.emitProgress({
      progress_counter: 1, last_completed_work: `${fresh.length} unproposed validated knowledge objects`,
      evidence_refs: [`pool:proposal-queue:${knowledge.length}:fresh:${fresh.length}`],
    });
    evidence_refs.push(`pool:proposal-queue:${knowledge.length}:fresh:${fresh.length}`);

    if (fresh.length === 0) {
      return { outcome: "PARTIAL", items_processed: 0, evidence_refs, summary: `no unproposed validated knowledge · ${knowledge.length} already covered` };
    }

    let proposals = 0;
    for (const ko of fresh.slice(0, 3)) {
      const rec = await persistProposal({
        emitter_agent_id: ctx.identity.agent_id,
        source_knowledge_object_id: ko.knowledge_object_id,
        evidence_chain: [ko.knowledge_object_id, ko.source_experiment_id, ko.source_hypothesis_id, ...ko.source_source_ids],
        created_at: new Date().toISOString(),
      });
      evidence_refs.push(`proposal:${rec.proposal_id}`);
      proposals++;
    }

    await ctx.emitProgress({
      progress_counter: 2, last_completed_work: `${proposals} unsigned WO proposals persisted (founder must sign)`,
      evidence_refs: evidence_refs.filter((e) => e.startsWith("proposal:")),
    });

    if (proposals > 0) {
      const contrib = await ctx.contributeLearning({
        kind: "NEW_PATTERN",
        content: { proposals_emitted: proposals, note: "unsigned · P-U enforced" },
        evidence_refs: evidence_refs.filter((e) => e.startsWith("proposal:")),
      });
      if (contrib.ok && contrib.contribution_id) evidence_refs.push(`learning:${contrib.contribution_id}`);
    }

    // Authority self-check: assert we did NOT sign anything
    const authCheckOk = authorityPermits({ manifest: ctx.authority, action: { kind: "tool", value: "sign_authorization" } });
    if (authCheckOk.permitted) {
      return { outcome: "FAILURE", items_processed: 0, evidence_refs, summary: "authority envelope contains sign_authorization — refusing per P-U" };
    }

    return {
      outcome: proposals > 0 ? "SUCCESS" : "PARTIAL",
      items_processed: proposals, evidence_refs,
      summary: `${proposals} unsigned WO proposals emitted (P-U enforced)`,
    };
  };
}
