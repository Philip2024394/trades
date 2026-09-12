// src/lib/nex/research-brain/search-worker.ts
//
// Founder Path A · Phase A2 · Search Worker.
//
// Fans a sub-question out to multiple sources and returns ranked
// SearchHits. Sources:
//   1. Local knowledge factory (nex.question_variant + nex.entity_index)
//      · zero cost · zero latency · authoritative when hit
//   2. Web acquisition (DuckDuckGo Instant + Wikipedia via existing
//      Phase 3.5 provider) · bounded by per-step budget
//
// Composition-first discipline: local KF is queried FIRST and web is
// only fired when local returns fewer than MIN_LOCAL_HITS. This mirrors
// the LLM-rescue web-trigger rule (only when local is insufficient).

import type { Pool } from "pg";
import type { WebProvider } from "@/lib/nex/live-chat-completion/web-acquisition/contract";
import type { ResearchStep, SearchHit } from "./contract";
// Founder Phase 4 · P4-2 · retrieval telemetry.
import { writeRetrievalEvent } from "@/lib/nex/observatory-brain/retrieval-telemetry";

export interface SearchWorkerInput {
  step: ResearchStep;
  budget_ms: number;
  language: "en" | "id";
  kfPool?: Pool;
  webProvider?: WebProvider | null;
  domain_hint?: string;
  entity_hint?: string;
  signal?: AbortSignal;
}

export interface SearchWorkerOutput {
  step_id: string;
  hits: SearchHit[];
  stage_ms: { local: number; web: number };
  provider_meta: {
    local_hit_count: number;
    web_hit_count: number;
    web_provider?: string;
    web_completed?: boolean;
    web_error?: string;
  };
}

const MIN_LOCAL_HITS_BEFORE_WEB = 2;
const LOCAL_LIMIT = 6;
const WEB_LIMIT = 6;

export async function searchStep(input: SearchWorkerInput): Promise<SearchWorkerOutput> {
  const localT0 = performance.now();
  const localHits = await searchLocal(input);
  const localMs = Math.round(performance.now() - localT0);

  // Composition-first: only escalate to web if local was thin.
  let webHits: SearchHit[] = [];
  let webMeta: { provider?: string; completed?: boolean; error?: string } = {};
  const webT0 = performance.now();
  if (input.webProvider && localHits.length < MIN_LOCAL_HITS_BEFORE_WEB) {
    try {
      const wOut = await input.webProvider.acquire({
        query: input.step.question,
        budget_ms: Math.max(1000, Math.floor(input.budget_ms * 0.6)),
        language: input.language,
        entity_name: input.entity_hint ?? null,
        signal: input.signal,
      });
      webMeta = { provider: wOut.provider_meta.provider, completed: wOut.provider_meta.completed, error: wOut.provider_meta.error };
      for (let i = 0; i < wOut.results.length && webHits.length < WEB_LIMIT; i++) {
        const r = wOut.results[i];
        webHits.push({
          hit_id: `${input.step.step_id}:web:${i}`,
          step_id: input.step.step_id,
          source_kind: providerToKind(r.provider),
          url: r.url,
          title: r.title,
          snippet: r.snippet,
          authority: authorityFor(r.provider),
          raw: r,
        });
      }
    } catch (e) {
      webMeta = { error: e instanceof Error ? e.message.slice(0, 100) : "search_web_error" };
    }
  }
  const webMs = Math.round(performance.now() - webT0);

  const merged = [...localHits, ...webHits];
  // Rank: authority desc · then by rough freshness (unknown freshness = older).
  merged.sort((a, b) => {
    if (b.authority !== a.authority) return b.authority - a.authority;
    const af = a.freshness_days ?? 10_000;
    const bf = b.freshness_days ?? 10_000;
    return af - bf;
  });

  // Founder Phase 4 · P4-2 · emit retrieval telemetry per research step.
  writeRetrievalEvent({
    retriever_path: "research_brain",
    domain: input.domain_hint ?? null,
    query_length_chars: input.step.question.length,
    hit_count: merged.length,
    top_hit_similarity: merged[0]?.authority ?? null,
    latency_ms: localMs + webMs,
    error: webMeta.error ?? null,
    sub_provider_meta: {
      step_id: input.step.step_id,
      local_hit_count: localHits.length,
      web_hit_count: webHits.length,
      web_provider: webMeta.provider,
    },
  });

  return {
    step_id: input.step.step_id,
    hits: merged,
    stage_ms: { local: localMs, web: webMs },
    provider_meta: {
      local_hit_count: localHits.length,
      web_hit_count: webHits.length,
      web_provider: webMeta.provider,
      web_completed: webMeta.completed,
      web_error: webMeta.error,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// Local KF lookup · question_variant + entity_index
// ═══════════════════════════════════════════════════════════════════

async function searchLocal(input: SearchWorkerInput): Promise<SearchHit[]> {
  if (!input.kfPool) return [];
  const q = input.step.question;
  const hits: SearchHit[] = [];
  try {
    // Prefer answered question_variants matching keywords in the question.
    const params: unknown[] = [];
    const conds: string[] = ["answer_status IN ('answered','partially_answered')"];
    // Simple ILIKE fanout on the raw_text · Postgres FTS could replace later.
    const kwTerms = extractKeywords(q).slice(0, 4);
    if (kwTerms.length > 0) {
      const orParts: string[] = [];
      for (const t of kwTerms) { params.push(`%${t}%`); orParts.push(`raw_text ILIKE $${params.length}`); }
      conds.push(`(${orParts.join(" OR ")})`);
    }
    if (input.domain_hint) {
      params.push(input.domain_hint);
      conds.push(`domain = $${params.length}`);
    }
    const res = await input.kfPool.query(
      `SELECT fingerprint, entity_ref, intent_slug, raw_text, trust, last_verified_at
         FROM nex.question_variant
         WHERE ${conds.join(" AND ")}
         ORDER BY last_verified_at DESC NULLS LAST
         LIMIT $${params.length + 1}`,
      [...params, LOCAL_LIMIT],
    );
    for (let i = 0; i < res.rows.length; i++) {
      const r = res.rows[i];
      hits.push({
        hit_id: `${input.step.step_id}:kf:${i}`,
        step_id: input.step.step_id,
        source_kind: "local_kf",
        title: r.intent_slug ? `${r.intent_slug} · ${r.entity_ref ?? ""}` : `KF fact`,
        snippet: String(r.raw_text ?? "").slice(0, 400),
        authority: r.trust === "canonical_verified" ? 0.95 : 0.75,
        freshness_days: r.last_verified_at ? Math.round((Date.now() - new Date(r.last_verified_at).getTime()) / 86_400_000) : undefined,
        url: undefined,
        raw: r,
      });
    }
  } catch {
    // Non-fatal: KF query error just means zero local hits.
  }
  return hits;
}

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function providerToKind(provider: string): SearchHit["source_kind"] {
  const p = provider.toLowerCase();
  if (p.includes("wikipedia")) return "wikipedia";
  if (p.includes("ddg") || p.includes("duckduckgo")) return "duckduckgo";
  return "web";
}

function authorityFor(provider: string): number {
  const p = provider.toLowerCase();
  if (p.includes("wikipedia")) return 0.85;
  if (p.includes("ddg") || p.includes("duckduckgo")) return 0.65;
  if (p.includes("mock")) return 0.5;
  return 0.6;
}

const STOP = new Set([
  "the","a","an","of","and","or","in","on","for","to","is","are","was","were","be","been",
  "with","that","this","those","these","how","what","when","where","why","which","many",
  "compare","between","and","vs","versus","tell","me","about","details","key","facts",
]);

function extractKeywords(q: string): string[] {
  return q.toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^['-]+|['-]+$/g, ""))
    .filter((t) => t.length >= 3 && !STOP.has(t));
}
