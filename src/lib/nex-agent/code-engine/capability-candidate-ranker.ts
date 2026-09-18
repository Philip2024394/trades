// src/lib/nex-agent/code-engine/capability-candidate-ranker.ts
//
// NEX1 · Deterministic Candidate Ranker · zero LLM · READ-ONLY.
//
// Fix 15 · 2026-09-17 · authorised after Test S RANKING_POLICY_ABSENT +
// founder-approved NEX1_RANKING_POLICY V1
// (docs/doctrine/nex1-ranking-policy-v1-founder-approved-2026-09-17.md).
//
// SCOPE (§2 · founder-locked · Q7 ONLY):
//   Given already-evaluated hypothesis evidence (Fix 13), order candidates
//   within the same source_file according to the founder-approved V1
//   lexicographic rule chain. Q8 root-cause selection remains OUT OF SCOPE.
//
// POLICY OBEYED (V1 · FOUNDER_APPROVED):
//   R-1 · CONTRADICTION_BLOCK      (§2.8)
//   R-2 · UNRESOLVED_BLOCK         (§2.10)  · UNRESOLVED ≠ CONTRADICTING
//   R-3 · INSUFFICIENT_BLOCK       (§2.9)
//   R-4 · SUPPORTING_MAJORITY      (§2.7)   · count-based · Δ ≥ 1 · unique + dedup'd
//   R-5 · TIE / UNRESOLVED_ORDER   (§2.16 · §2.18)
//
// EXPLICITLY EXCLUDED (V1 · defence-in-depth):
//   · numerical weights / composite scores  (§2.13)
//   · confidence as a ranking factor        (§2.15)
//   · provenance as a ranking factor        (§2.20)
//   · shared evidence advantage             (§2.11)  · pairwise cancels in count math
//   · hidden tie-breakers                   (§2.16 · §5)
//     - filename / candidate_id / array position / timestamp / hash /
//       alphabetical / creation / database / source / execution order
//
// ALGORITHM (auditable · deterministic):
//   For each source_file scope containing ≥2 candidates:
//     1. Per-candidate metrics · dedup evidence by relationship_id (§2.19):
//          contradicting_count · unresolved_count · insufficient_count · supporting_count
//     2. Build ranking tuple per candidate:
//          [ has_contradicting, has_unresolved, has_insufficient, -supporting_count ]
//          - R-1 dominates R-2 dominates R-3 dominates R-4 (lexicographic per §2.14)
//          - Boolean flags: 0 if none · 1 if any  (lower is better)
//          - Supporting count: negated so higher supporting sorts to lower tuple (better)
//        Correctness proof for §2.11 (shared evidence):
//          |uniqueSupporting(A)| − |uniqueSupporting(B)|
//            = (|supp(A)| − |shared|) − (|supp(B)| − |shared|)
//            = |supp(A)| − |supp(B)|
//          So per-candidate supporting_count comparison is identical to
//          pairwise unique-after-shared comparison. Shared cancels in every
//          pair regardless of whether we compute pairwise or aggregate.
//     3. Sort tuples ascending · group identical tuples into rank buckets ·
//        emit rank_position per bucket (ties share position · next distinct
//        position skips by bucket size per §2.16).
//     4. UNRESOLVED_ORDER (§2.18): every candidate has zero supporting AND
//        at least one blocking category AND all tuples equal. In this case
//        rank_position = null and ranking_state = UNRESOLVED_ORDER.
//     5. differentiating_rule per candidate = the first tuple axis at which
//        this candidate's tuple differs from the NEXT-lower-rank candidate.
//        null when TIED with the next candidate or when candidate is last.
//
// AUDITABILITY (§22):
//   Every ranking result carries deduplicated_relationship_ids with status ·
//   rule_trace records the differentiating rule per adjacent-rank pair.
//
// DETERMINISM (§23):
//   · Input-order independence: candidates are grouped by scope · then
//     sorted by (tuple, candidate_id) for stable output. rank_position
//     depends ONLY on tuple values · never on candidate_id or input order.
//     candidate_id is used ONLY for stable output ordering within a tie
//     bucket · which is auditable presentation · not ranking.
//   · No randomness · no time · no filesystem order · no external model.
//
// NO EXECUTION AUTHORITY (§31):
//   · Zero file writes · zero broker calls · zero WO-04 invocation.
//   · Ranking is an analytical operation.

import type {
  HypothesisEvaluation,
  HypothesisEvidenceEvaluation,
  EvidenceStatus,
} from "./capability-hypothesis-evidence-evaluator";

// ── Public shape ─────────────────────────────────────────────────────────

export type RankingRule = "R-1" | "R-2" | "R-3" | "R-4" | "R-5";
export type RankingState = "RANKED" | "TIED" | "UNRESOLVED_ORDER";
export type ScopeState = "SINGLETON" | "RANKED" | "ALL_TIED" | "UNRESOLVED_ORDER";

export interface DeduplicatedRelationship {
  readonly relationship_id: string;
  readonly status: EvidenceStatus;
}

export interface CandidateRanking {
  readonly candidate_id: string;
  readonly source_file: string;
  /** 1 = highest position under V1 policy. Ties share position.
   *  null iff ranking_state === "UNRESOLVED_ORDER" (§2.18). */
  readonly rank_position: number | null;
  readonly ranking_state: RankingState;
  /** The first rule axis at which this candidate's tuple differs from the
   *  candidate at the next-lower rank position. null when tied with next
   *  candidate or when this is the last rank bucket. Enables §22 audit. */
  readonly differentiating_rule: RankingRule | null;
  readonly supporting_count: number;
  readonly contradicting_count: number;
  readonly insufficient_count: number;
  readonly unresolved_count: number;
  /** Every relationship_id that contributed to this candidate's counts ·
   *  deduplicated per §2.19 · with its Fix 13 status. */
  readonly deduplicated_relationship_ids: readonly DeduplicatedRelationship[];
  /** Type-locked to INFERRED · never PROVEN (§2.22 · rank 1 ≠ proven root cause). */
  readonly evidence_kind: "INFERRED";
  /** Bounded confidence · NOT used for ranking (§2.15) · reflects INFERENCE only. */
  readonly confidence: number;
  /** Explicit policy identity for the record. */
  readonly policy_id: "NEX1_RANKING_POLICY";
  readonly policy_version: "V1";
}

export interface RankingRuleTrace {
  readonly higher_rank_position: number;
  readonly lower_rank_position: number;
  readonly higher_representative_candidate_id: string;
  readonly lower_representative_candidate_id: string;
  readonly rule_fired: RankingRule;
}

export interface RankingScope {
  readonly source_file: string;
  readonly scope_state: ScopeState;
  readonly rankings: readonly CandidateRanking[];
  readonly rule_trace: readonly RankingRuleTrace[];
}

export interface RankCandidatesInput {
  readonly evaluations: readonly HypothesisEvaluation[];
  readonly evidence_records: readonly HypothesisEvidenceEvaluation[];
  readonly max_scopes?: number;
  readonly max_candidates_per_scope?: number;
}

export interface RankCandidatesResult {
  readonly ok: true;
  readonly policy_id: "NEX1_RANKING_POLICY";
  readonly policy_version: "V1";
  readonly scopes: readonly RankingScope[];
  readonly stats: {
    readonly candidates_seen: number;
    readonly evaluations_seen: number;
    readonly scopes_seen: number;
    readonly rankings_emitted: number;
    readonly scope_state_counts: Record<ScopeState, number>;
    readonly rule_fire_counts: Record<RankingRule, number>;
    readonly rejected_non_inferred: number;
    readonly capped_by: string;
  };
}

// ── Forbidden causal vocabulary (defence-in-depth · consistent with Fix 13/14) ──
const FORBIDDEN_CAUSAL_TOKENS = [
  "causes",
  "caused by",
  "therefore",
  "root cause is",
  "responsible for",
  "leads to",
  "results in",
  "because",
];

const DEFAULT_MAX_SCOPES = 100;
const HARD_MAX_SCOPES = 200;
const DEFAULT_MAX_CANDIDATES_PER_SCOPE = 50;
const HARD_MAX_CANDIDATES_PER_SCOPE = 100;
const CONFIDENCE_FIXED = 0.35; // bounded · not used for ranking · inference-only

function containsForbiddenCausal(text: string): string | null {
  const lower = text.toLowerCase();
  for (const t of FORBIDDEN_CAUSAL_TOKENS) {
    if (lower.includes(t)) return t;
  }
  return null;
}

// ── Per-candidate metrics · dedup by relationship_id (§2.19) ─────────────

interface CandidateMetrics {
  readonly candidate_id: string;
  readonly source_file: string;
  readonly supporting_count: number;
  readonly contradicting_count: number;
  readonly insufficient_count: number;
  readonly unresolved_count: number;
  readonly deduplicated_relationship_ids: DeduplicatedRelationship[];
  readonly tuple: readonly [number, number, number, number]; // [contra, unres, insuff, -supp]
}

function computeCandidateMetrics(
  candidateId: string,
  evidenceRecords: readonly HypothesisEvidenceEvaluation[],
): CandidateMetrics {
  // Bucket by (relationship_id → most severe status).
  // Deduplication rule (§2.19): multiple records with same relationship_id
  // collapse to a single contribution. When a rel_id has multiple statuses
  // (should be rare · usually impossible given Fix 13 emits one record per
  // rel_id per candidate) · take the most severe: CONTRADICTING > UNRESOLVED
  // > INSUFFICIENT > SUPPORTING. This is a DEDUP resolution rule · NOT a
  // ranking rule · and is symmetric across candidates.
  const severity: Record<EvidenceStatus, number> = {
    STRUCTURALLY_CONTRADICTING: 3,
    UNRESOLVED: 2,
    INSUFFICIENT: 1,
    STRUCTURALLY_SUPPORTING: 0,
  };
  const byRel = new Map<string, EvidenceStatus>();
  let sourceFile = "";
  for (const rec of evidenceRecords) {
    if (rec.candidate_id !== candidateId) continue;
    if (!sourceFile) sourceFile = candidateId.split("::")[0];
    const existing = byRel.get(rec.relationship_id);
    if (!existing || severity[rec.status] > severity[existing]) {
      byRel.set(rec.relationship_id, rec.status);
    }
  }
  if (!sourceFile) sourceFile = candidateId.split("::")[0];

  let supp = 0, contra = 0, insuff = 0, unres = 0;
  const dedup: DeduplicatedRelationship[] = [];
  for (const [relId, status] of byRel) {
    dedup.push({ relationship_id: relId, status });
    switch (status) {
      case "STRUCTURALLY_SUPPORTING": supp++; break;
      case "STRUCTURALLY_CONTRADICTING": contra++; break;
      case "INSUFFICIENT": insuff++; break;
      case "UNRESOLVED": unres++; break;
    }
  }
  dedup.sort((a, b) => a.relationship_id.localeCompare(b.relationship_id));

  // Tuple: (contradicting_flag, unresolved_flag, insufficient_flag, -supporting_count)
  // Lower tuple = better rank (per V1 lexicographic chain).
  const tuple: readonly [number, number, number, number] = [
    contra > 0 ? 1 : 0,
    unres > 0 ? 1 : 0,
    insuff > 0 ? 1 : 0,
    -supp,
  ];

  return {
    candidate_id: candidateId,
    source_file: sourceFile,
    supporting_count: supp,
    contradicting_count: contra,
    insufficient_count: insuff,
    unresolved_count: unres,
    deduplicated_relationship_ids: dedup,
    tuple,
  };
}

function compareTuples(
  a: readonly [number, number, number, number],
  b: readonly [number, number, number, number],
): number {
  for (let i = 0; i < 4; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

/** Return the rule that first differentiates two tuples · null if identical. */
function firstDifferentiatingAxis(
  a: readonly [number, number, number, number],
  b: readonly [number, number, number, number],
): RankingRule | null {
  if (a[0] !== b[0]) return "R-1";
  if (a[1] !== b[1]) return "R-2";
  if (a[2] !== b[2]) return "R-3";
  if (a[3] !== b[3]) {
    // R-4 requires Δ ≥ 1 which is guaranteed by integer inequality
    return "R-4";
  }
  return null;
}

// ── Entry point ──────────────────────────────────────────────────────────

export function rankCandidates(
  input: RankCandidatesInput,
): RankCandidatesResult {
  const maxScopes = Math.min(
    input.max_scopes ?? DEFAULT_MAX_SCOPES,
    HARD_MAX_SCOPES,
  );
  const maxPerScope = Math.min(
    input.max_candidates_per_scope ?? DEFAULT_MAX_CANDIDATES_PER_SCOPE,
    HARD_MAX_CANDIDATES_PER_SCOPE,
  );

  // Group evaluations by scope (source_file · same convention as Fix 14).
  const byScope = new Map<string, HypothesisEvaluation[]>();
  for (const e of input.evaluations) {
    const scope = e.candidate_id.split("::")[0];
    let bucket = byScope.get(scope);
    if (!bucket) { bucket = []; byScope.set(scope, bucket); }
    bucket.push(e);
  }

  const scopeKeys = [...byScope.keys()].sort();
  const scopes: RankingScope[] = [];
  const scopeStateCounts: Record<ScopeState, number> = {
    SINGLETON: 0,
    RANKED: 0,
    ALL_TIED: 0,
    UNRESOLVED_ORDER: 0,
  };
  const ruleFireCounts: Record<RankingRule, number> = {
    "R-1": 0, "R-2": 0, "R-3": 0, "R-4": 0, "R-5": 0,
  };
  let rejectedNonInferred = 0;
  let cappedBy = `hard_cap_scopes=${maxScopes}`;

  for (const scopeKey of scopeKeys) {
    if (scopes.length >= maxScopes) {
      cappedBy = `hit_hard_cap_scopes=${maxScopes}`;
      break;
    }
    const evals = byScope.get(scopeKey)!;
    const evalSubset = evals.slice(0, maxPerScope);

    // Compute per-candidate metrics · dedup by relationship_id.
    const metrics: CandidateMetrics[] = evalSubset.map((e) =>
      computeCandidateMetrics(e.candidate_id, input.evidence_records),
    );

    // Sort candidates by (tuple ascending, candidate_id ascending).
    // NOTE: candidate_id secondary sort is for STABLE OUTPUT PRESENTATION
    // within a tie bucket · it does NOT alter rank_position. All members of
    // a tie bucket share the same rank_position (§2.16). This is auditable
    // presentation · not ranking · per policy §5 no-hidden-ranking invariant.
    metrics.sort((a, b) => {
      const t = compareTuples(a.tuple, b.tuple);
      if (t !== 0) return t;
      return a.candidate_id.localeCompare(b.candidate_id);
    });

    // Handle singleton scope · no ranking meaningful.
    if (metrics.length === 0) continue;
    if (metrics.length === 1) {
      const m = metrics[0];
      const record = buildRankingRecord(m, 1, "RANKED", null);
      if (record) scopes.push({
        source_file: scopeKey,
        scope_state: "SINGLETON",
        rankings: [record],
        rule_trace: [],
      });
      scopeStateCounts.SINGLETON++;
      continue;
    }

    // Group into rank buckets by identical tuple.
    const buckets: CandidateMetrics[][] = [];
    for (const m of metrics) {
      const last = buckets[buckets.length - 1];
      if (last && compareTuples(last[0].tuple, m.tuple) === 0) {
        last.push(m);
      } else {
        buckets.push([m]);
      }
    }

    // Determine UNRESOLVED_ORDER (§2.18):
    // Scope has NO legitimate basis for ranking iff:
    //   all candidates share the same tuple (single bucket) AND
    //   every candidate has supporting_count = 0 AND
    //   at least one blocking category is non-zero for at least one candidate.
    // Rationale: with zero supporting evidence and blocking-only signals ·
    // the policy declines to rank per §2.18 · rather than producing an
    // artificial TIED-at-rank-1 outcome (§1 honest-uncertainty bias).
    const singleBucket = buckets.length === 1;
    const allZeroSupporting = metrics.every((m) => m.supporting_count === 0);
    const anyBlocking = metrics.some((m) =>
      m.contradicting_count > 0 || m.unresolved_count > 0 || m.insufficient_count > 0,
    );
    const scopeUnresolvedOrder = singleBucket && allZeroSupporting && anyBlocking;

    // Emit rankings.
    const rankings: CandidateRanking[] = [];
    const ruleTrace: RankingRuleTrace[] = [];

    if (scopeUnresolvedOrder) {
      for (const m of metrics) {
        const rec = buildRankingRecord(m, null, "UNRESOLVED_ORDER", null);
        if (rec) rankings.push(rec);
      }
      scopeStateCounts.UNRESOLVED_ORDER++;
      ruleFireCounts["R-5"]++;
    } else {
      // Assign rank positions per bucket. Ties share position · next
      // distinct position increments by 1 (dense rank · not standard rank).
      // Founder V1 §2.16: "Equal candidates share the same rank position.
      // The next distinct rank position skips accordingly."
      // Standard sports competition rank ("1224"): next skips by tie size.
      // We use STANDARD (competition) rank to match §2.16 wording.
      let rankPos = 1;
      for (let b = 0; b < buckets.length; b++) {
        const bucket = buckets[b];
        const state: RankingState = bucket.length === 1 ? "RANKED" : "TIED";
        const nextBucket = buckets[b + 1] ?? null;
        const diffRule = nextBucket
          ? firstDifferentiatingAxis(bucket[0].tuple, nextBucket[0].tuple)
          : null;
        for (const m of bucket) {
          const rec = buildRankingRecord(m, rankPos, state, diffRule);
          if (rec) rankings.push(rec);
        }
        if (nextBucket && diffRule) {
          ruleTrace.push({
            higher_rank_position: rankPos,
            lower_rank_position: rankPos + bucket.length,
            higher_representative_candidate_id: bucket[0].candidate_id,
            lower_representative_candidate_id: nextBucket[0].candidate_id,
            rule_fired: diffRule,
          });
          ruleFireCounts[diffRule]++;
        }
        rankPos += bucket.length;
      }
      if (buckets.length === 1) {
        scopeStateCounts.ALL_TIED++;
        ruleFireCounts["R-5"]++;
      } else {
        scopeStateCounts.RANKED++;
      }
    }

    const scopeState: ScopeState = scopeUnresolvedOrder
      ? "UNRESOLVED_ORDER"
      : buckets.length === 1
        ? "ALL_TIED"
        : "RANKED";

    scopes.push({
      source_file: scopeKey,
      scope_state: scopeState,
      rankings,
      rule_trace: ruleTrace,
    });
  }

  const rankingsEmitted = scopes.reduce((n, s) => n + s.rankings.length, 0);

  return {
    ok: true,
    policy_id: "NEX1_RANKING_POLICY",
    policy_version: "V1",
    scopes,
    stats: {
      candidates_seen: input.evaluations.length,
      evaluations_seen: input.evaluations.length,
      scopes_seen: scopeKeys.length,
      rankings_emitted: rankingsEmitted,
      scope_state_counts: scopeStateCounts,
      rule_fire_counts: ruleFireCounts,
      rejected_non_inferred: rejectedNonInferred,
      capped_by: cappedBy,
    },
  };

  // ── Local helpers ──────────────────────────────────────────────────────

  function buildRankingRecord(
    m: CandidateMetrics,
    rankPos: number | null,
    state: RankingState,
    diffRule: RankingRule | null,
  ): CandidateRanking | null {
    const record: CandidateRanking = {
      candidate_id: m.candidate_id,
      source_file: m.source_file,
      rank_position: rankPos,
      ranking_state: state,
      differentiating_rule: diffRule,
      supporting_count: m.supporting_count,
      contradicting_count: m.contradicting_count,
      insufficient_count: m.insufficient_count,
      unresolved_count: m.unresolved_count,
      deduplicated_relationship_ids: m.deduplicated_relationship_ids,
      evidence_kind: "INFERRED",
      confidence: CONFIDENCE_FIXED,
      policy_id: "NEX1_RANKING_POLICY",
      policy_version: "V1",
    };
    // Type-lock backstop (§2.22 rank 1 ≠ proven root cause).
    if ((record.evidence_kind as string) !== "INFERRED") {
      rejectedNonInferred++;
      return null;
    }
    // Defence-in-depth · reject if any string field contains causal vocab.
    const scanText = `${record.candidate_id} ${record.source_file}`;
    if (containsForbiddenCausal(scanText) !== null) {
      rejectedNonInferred++;
      return null;
    }
    return record;
  }
}
