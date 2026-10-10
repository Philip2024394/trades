// src/lib/nex-agent/code-engine/capability-retained-knowledge-recall.ts
//
// NEX · M1 · Retained-Knowledge Recall · Phase 4 · 2026-09-21.
// Founder-authorised as part of the "Global Web Intelligence" programme.
//
// PURPOSE
//
//   Phase 3 built selective retention: NEX can WRITE useful external
//   knowledge to a JSONL store with mandatory provenance. What was
//   missing — and this module supplies — is the READ side that lets
//   retained knowledge influence subsequent answers.
//
//   The founder's requirement (verbatim from Phase 4 §3):
//
//     SELECTIVE RETENTION
//             ↓
//     RETAINED KNOWLEDGE
//             ↓
//     RELEVANCE FILTER
//             ↓
//     FRESHNESS CHECK
//             ↓
//     CURRENT QUESTION
//             ↓
//     USE / IGNORE
//             ↓
//     REASON
//
//   This module implements the middle four steps. It NEVER blindly
//   injects retained rows into a prompt. It returns a small set of
//   relevant + fresh + confident + on-provenance rows, and it also
//   returns a routing verdict that the KNOW-or-LOOK layer can consume:
//
//     - hit       → NEX has a usable retained fact for this question
//     - stale_hit → a retained fact exists but freshness policy says
//                   verify → caller should trigger LOOK_REQUIRED
//     - no_hit    → nothing relevant retained
//
// ANTI-CHEATING GUARANTEE
//
//   · Pure function of (question, retained store, freshness policy).
//     Zero LLM, zero network, zero embeddings.
//   · Relevance is deterministic token overlap · a rank function
//     bounded by min-overlap threshold. No magic scoring.
//   · Freshness is delegated to capability-freshness-policy · no
//     shadow TTL invented here.
//   · Every returned row carries its full provenance envelope · a
//     downstream reader cannot lose the source, retrieved_at, or
//     retention_reason.
//   · Stale rows are RETURNED for auditability but NEVER injected
//     as "current fact" — the verdict field flags stale_hit so the
//     caller CAN choose to trigger a fresh lookup instead.

import {
  readRetainedKnowledge,
  type RetainedKnowledgeRow,
} from "./capability-selective-retention";
import {
  assessFreshness,
  type FreshnessVerdict,
  type InformationClass,
} from "./capability-freshness-policy";

// ── Inputs ────────────────────────────────────────────────────────────

export interface RetainedRecallInputs {
  /** The user's message · used to score relevance via token overlap. */
  readonly user_message: string;
  /** Information class the question falls into · consulted for freshness. */
  readonly info_class: InformationClass | "unknown";
  /** Optional cap on rows scanned · defaults to store size · use for
   *  future scale. */
  readonly max_scan?: number;
  /** Test hook: substitute rows instead of reading from disk. */
  readonly rows_override?: readonly RetainedKnowledgeRow[];
  /** Test hook: substitute Date.now(). */
  readonly now_ms?: number;
}

// ── Output ────────────────────────────────────────────────────────────

export type RetainedRecallVerdict = "hit" | "stale_hit" | "no_hit";

export interface ScoredRetainedRow {
  readonly row: RetainedKnowledgeRow;
  readonly relevance_score: number; // 0..1 · token-overlap based
  readonly freshness_verdict: FreshnessVerdict;
  readonly freshness_age_ms: number | null;
}

export interface RetainedRecallResult {
  readonly verdict: RetainedRecallVerdict;
  readonly reason: string;
  readonly hits: readonly ScoredRetainedRow[];
  readonly consulted_rows: number;
}

// ── Relevance scoring ────────────────────────────────────────────────
//
// Deterministic token-Jaccard overlap between the user's question and
// the retained row's identifying fields (url_or_query + fact-derived
// tokens). Threshold is intentionally strict (≥0.20) so retention hits
// only surface for questions genuinely about the retained subject —
// not for arbitrary conversational overlap.

const STOPWORDS = new Set([
  "the", "and", "for", "with", "about", "what", "when", "where", "which", "who",
  "how", "why", "does", "did", "is", "are", "was", "were", "will", "can", "could",
  "should", "would", "have", "has", "had", "this", "that", "these", "those",
  "any", "all", "some", "one", "two", "in", "on", "at", "to", "of", "a", "an",
]);

function tokenise(text: string): readonly string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function rowTokens(row: RetainedKnowledgeRow): readonly string[] {
  const parts: string[] = [];
  parts.push(row.url_or_query);
  if (row.info_class) parts.push(row.info_class);
  parts.push(row.source_identifier);
  // Fact payload · flatten string leaves. Bounded to avoid huge scans.
  const collect = (v: unknown, depth: number): void => {
    if (depth > 3) return;
    if (typeof v === "string") { parts.push(v); return; }
    if (typeof v === "number" || typeof v === "boolean") { parts.push(String(v)); return; }
    if (Array.isArray(v)) { for (const item of v.slice(0, 20)) collect(item, depth + 1); return; }
    if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v).slice(0, 20)) {
        parts.push(k);
        collect(val, depth + 1);
      }
    }
  };
  collect(row.fact, 0);
  return tokenise(parts.join(" "));
}

// Asymmetric containment · what fraction of QUERY tokens appear in the
// row? Jaccard was too strict when rows have many auxiliary tokens
// (fact keys, source identifier, class name). Containment is the
// correct semantic: "does the row cover what the user asked?".
// Denominator = query token count · numerator = query tokens present
// in the row's tokens.
function containment(query: readonly string[], row: readonly string[]): number {
  if (query.length === 0) return 0;
  const rowSet = new Set(row);
  let present = 0;
  for (const t of query) if (rowSet.has(t)) present += 1;
  return present / query.length;
}

const MIN_RELEVANCE = 0.5; // query tokens must be ≥50% present in the row
const TOP_K = 3;

// ── Decision function ────────────────────────────────────────────────

export function recallRetainedKnowledge(inputs: RetainedRecallInputs): RetainedRecallResult {
  const now = inputs.now_ms ?? Date.now();
  const rows = inputs.rows_override ?? readRetainedKnowledge();
  const scanCap = Math.min(rows.length, inputs.max_scan ?? rows.length);
  const scanned = rows.slice(0, scanCap);
  const qTokens = tokenise(inputs.user_message);
  if (qTokens.length === 0) {
    return {
      verdict: "no_hit",
      reason: "user message has no scoreable tokens after stopword removal",
      hits: [],
      consulted_rows: scanCap,
    };
  }
  const scored: ScoredRetainedRow[] = [];
  for (const row of scanned) {
    const rTokens = rowTokens(row);
    const rel = containment(qTokens, rTokens);
    if (rel < MIN_RELEVANCE) continue;
    // Only assess freshness if the class is a registered
    // InformationClass; unknown classes fail-safe to verify_always
    // per capability-freshness-policy.
    const freshness = assessFreshness({
      info_class: (row.info_class as InformationClass | "unknown" | null) ?? "unknown",
      retrieved_at_iso: row.retrieved_at_iso,
      now_ms: now,
    });
    scored.push({
      row,
      relevance_score: Number(rel.toFixed(3)),
      freshness_verdict: freshness.verdict,
      freshness_age_ms: freshness.age_ms,
    });
  }
  if (scored.length === 0) {
    return {
      verdict: "no_hit",
      reason: `no retained row scored above min_relevance=${MIN_RELEVANCE} on ${scanCap} scanned rows`,
      hits: [],
      consulted_rows: scanCap,
    };
  }
  // Sort: freshness first (fresh/no_expiry > verify_always > stale),
  // then relevance descending. This ordering is deterministic.
  const FRESHNESS_RANK: Record<FreshnessVerdict, number> = {
    fresh: 3,
    no_expiry: 3,
    verify_always: 1,
    stale: 0,
  };
  scored.sort((a, b) => {
    const rankDelta = FRESHNESS_RANK[b.freshness_verdict] - FRESHNESS_RANK[a.freshness_verdict];
    if (rankDelta !== 0) return rankDelta;
    return b.relevance_score - a.relevance_score;
  });
  const hits = scored.slice(0, TOP_K);
  const topFreshness = hits[0].freshness_verdict;
  if (topFreshness === "fresh" || topFreshness === "no_expiry") {
    return {
      verdict: "hit",
      reason: `retained knowledge hit · relevance=${hits[0].relevance_score} · freshness=${topFreshness} · source=${hits[0].row.source_identifier}`,
      hits,
      consulted_rows: scanCap,
    };
  }
  // stale or verify_always → the row EXISTS but should not be used as
  // current fact · caller should trigger LOOK_REQUIRED.
  return {
    verdict: "stale_hit",
    reason: `retained knowledge exists but freshness=${topFreshness} · caller should trigger a fresh lookup (relevance=${hits[0].relevance_score})`,
    hits,
    consulted_rows: scanCap,
  };
}

// ── Trace emitter ────────────────────────────────────────────────────

export function emitRetainedRecallTrace(result: RetainedRecallResult): string {
  const top = result.hits[0];
  return `retained_recall · verdict=${result.verdict} · consulted=${result.consulted_rows} · top_relevance=${top?.relevance_score ?? "n/a"} · top_freshness=${top?.freshness_verdict ?? "n/a"}${top ? ` · source=${top.row.source_identifier}` : ""}`;
}
