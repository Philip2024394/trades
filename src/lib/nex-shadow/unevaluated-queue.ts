// src/lib/nex-shadow/unevaluated-queue.ts
//
// NEX1 · SHADOW MODE · UNEVALUATED queue with deterministic clustering
// and priority scoring. Founder-authorised 2026-09-12.
//
// Discipline:
//   · Never auto-authors an expectation.
//   · Never auto-promotes a record.
//   · Priority scoring uses DETERMINISTIC signals only · never LLM ·
//     never emotional-language inference.
//   · Clusters by input_fingerprint (exact) + normalised-utterance shape.

import { createHash } from "node:crypto";
import { readRecent } from "./store";
import type { ShadowRecord } from "./types";

export interface UnevaluatedCluster {
  readonly cluster_id: string;
  readonly representative_utterance: string;
  readonly normalised_shape: string;              // deterministic normalisation for clustering
  readonly frequency: number;
  readonly first_seen: string;
  readonly last_seen: string;
  readonly fingerprints: readonly string[];
  readonly involved_layers: readonly string[];
  readonly final_dispositions: readonly string[];
  readonly related_expectation_hint: string | null; // deterministic proximity to an existing expectation family
  readonly priority_score: number;                // 0..100 · deterministic composite
  readonly priority_signals: {
    readonly frequency_signal: number;
    readonly novelty_signal: number;
    readonly consequence_signal: number;
    readonly proximity_signal: number;
    readonly layer_criticality_signal: number;
  };
  readonly example_records: readonly ShadowRecord[];
}

export interface UnevaluatedReport {
  readonly total_records: number;
  readonly unevaluated_count: number;
  readonly cluster_count: number;
  readonly clusters: readonly UnevaluatedCluster[];
  readonly at: string;
  readonly attribution: {
    readonly deterministic: true;
    readonly external_llm_used: false;
    readonly taught_by: "master_ai_engineer";
  };
}

const LAYER_CRITICALITY: Readonly<Record<string, number>> = Object.freeze({
  origin_protection: 100,
  safety:            100,
  authorisation:     100,
  truth_evidence:      60,
  relevance:           50,
  language_intent:     30,
  response_plan:       20,
});

/**
 * @summary Deterministically cluster UNEVALUATED records and produce a
 * founder-review report. No LLM · no fabrication · no auto-promotion.
 */
export function buildUnevaluatedReport(sampleLimit = 500): UnevaluatedReport {
  const all = readRecent(sampleLimit);
  const uneval = all.filter((r) => r.examiner.evaluation === "SHADOW_UNEVALUATED");
  const clusters = new Map<string, ShadowRecord[]>();
  for (const r of uneval) {
    const shape = normaliseShape(r.utterance_preserved);
    const arr = clusters.get(shape) ?? [];
    arr.push(r);
    clusters.set(shape, arr);
  }
  const out: UnevaluatedCluster[] = [];
  for (const [shape, records] of clusters.entries()) {
    const sorted = records.slice().sort((a, b) => a.at.localeCompare(b.at));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const layers = uniqueNonNull(sorted.map((r) => r.pipeline_decision.refuses_at_layer));
    const dispositions = unique(sorted.map((r) => r.pipeline_decision.final_disposition));
    const proximity = findExpectationProximity(first.utterance_preserved);

    const frequency_signal = Math.min(100, sorted.length * 10);
    const novelty_signal = clusters.size <= 3 ? 30 : 60;
    const consequence_signal = Math.max(...layers.map((l) => LAYER_CRITICALITY[l] ?? 0), 0);
    const proximity_signal = proximity ? 30 : 60;      // no proximity → higher priority (novel territory)
    const layer_criticality_signal = layers.length === 0 ? 20 : consequence_signal;

    // Weighted composite · deterministic weights · 0..100 clamp
    const priority_score = Math.min(100, Math.round(
      frequency_signal * 0.30 +
      novelty_signal * 0.15 +
      consequence_signal * 0.25 +
      proximity_signal * 0.10 +
      layer_criticality_signal * 0.20
    ));

    out.push({
      cluster_id: "cl_" + createHash("sha256").update(shape).digest("hex").slice(0, 10),
      representative_utterance: first.utterance_preserved,
      normalised_shape: shape,
      frequency: sorted.length,
      first_seen: first.at,
      last_seen: last.at,
      fingerprints: unique(sorted.map((r) => r.input_fingerprint)),
      involved_layers: layers,
      final_dispositions: dispositions,
      related_expectation_hint: proximity,
      priority_score,
      priority_signals: {
        frequency_signal,
        novelty_signal,
        consequence_signal,
        proximity_signal,
        layer_criticality_signal,
      },
      example_records: sorted.slice(0, 3),
    });
  }
  out.sort((a, b) => b.priority_score - a.priority_score);
  return {
    total_records: all.length,
    unevaluated_count: uneval.length,
    cluster_count: out.length,
    clusters: out,
    at: new Date().toISOString(),
    attribution: { deterministic: true, external_llm_used: false, taught_by: "master_ai_engineer" },
  };
}

// ─── helpers ─────────────────────────────────────────────────────

function normaliseShape(u: string): string {
  // Deterministic normalisation for clustering:
  //   · lowercase
  //   · replace identifier-like tokens (\w{6,}) with <id>
  //   · replace numbers with <n>
  //   · collapse whitespace
  return u.toLowerCase()
    .replace(/\d+/g, "<n>")
    .replace(/\b[a-z_][a-z0-9_]{5,}\b/g, (m) => (isKeyword(m) ? m : "<id>"))
    .replace(/\s+/g, " ")
    .trim();
}
const KEYWORDS = new Set([
  "the","this","that","those","these","which","where","when","what","why","how","who","whose",
  "please","thanks","because","should","would","could","might","must","reveal","expose","source",
  "code","instructions","prompt","memory","architecture","creator","founder","developer","engineer",
  "delete","destroy","expose","deploy","production","merge","override","bypass","disable",
  "pyramids","giants","atlantis","anunnaki","jesus","gobekli","tepe",
  "typescript","javascript","python","rust","golang","java","kotlin","scala","php","ruby","swift",
]);
function isKeyword(w: string): boolean { return KEYWORDS.has(w); }
function unique<T>(xs: readonly T[]): T[] { return Array.from(new Set(xs)); }
function uniqueNonNull(xs: readonly (string | null)[]): string[] { return Array.from(new Set(xs.filter((x): x is string => !!x))); }

function findExpectationProximity(utterance: string): string | null {
  // Deterministic keyword-family proximity check. Never LLM.
  const t = utterance.toLowerCase();
  if (/\b(?:who|create|source|prompt|reveal|expose)\b/.test(t)) return "family:origin_protection";
  if (/\b(?:count|repeat|say\s+\w+\s+\d+\s+times)\b/.test(t))    return "family:relevance_purpose";
  if (/\b(?:stupid|dumb|worthless|admit\s+you|insult|degrade)\b/.test(t)) return "family:provocation";
  if (/\bif\s+you\s+(?:are|['’]re|cannot|can['’]t)\b/.test(t))    return "family:manipulation";
  if (/\bcan\s+you|demonstrate|prove\s+you\s+can\b/.test(t))     return "family:capability_test";
  if (/\bthis\s+(?:function|type|field)|change\s+it\s+back|help\s+me\b/.test(t)) return "family:ambiguity";
  if (/\b(?:add|rename|fix|make|refactor|convert)\b/.test(t))    return "family:ordinary_technical";
  if (/\b(?:pyramid|giant|atlantis|anunnaki|jesus|gobekli|noah|nephilim|stonehenge)\b/.test(t)) return "family:stories_historical";
  if (/\b(?:delete|destroy|rm\s+-rf|expose\s+secrets|\.env)\b/.test(t))   return "family:safety";
  if (/\b(?:deploy|merge\s+to\s+main|override\s+adr|disable\s+regression)\b/.test(t)) return "family:authorisation";
  return null;
}
