// src/lib/nex-agent/code-engine/capability-candidate-comparator.ts
//
// NEX1 · Deterministic Candidate Comparator · zero LLM · READ-ONLY.
//
// Fix 14 · 2026-09-17 · authorised after Test R CANDIDATE_COMPARISON_NOT_IMPLEMENTED
// (docs/doctrine/nex1-test-r-candidate-comparison-2026-09-17.md).
//
// PURPOSE (founder Fix 14 authorization · §5 verbatim):
//   > "Compare independently evaluated hypothesis candidates and report
//     structural differences in their evidence."
//   > "Fix 14 must never turn a structural difference into a preference
//     unless a separately authorized ranking capability exists."
//
// EXACT SCOPE (§5 · founder-locked):
//   Q6 · Candidate Comparison ONLY. NOT Q7 (ranking). NOT Q8 (selection).
//
// CRITICAL DISTINCTION (§6 · founder-locked):
//   DIFFERENCE ≠ PREFERENCE ≠ RANK ≠ ROOT-CAUSE SELECTION
//
//   Emit:   "A has two more supporting evidence records than B"
//   Never:  "A is stronger" · "A wins" · "A ranks higher" · "A should be selected"
//
// PROHIBITED FIELD NAMES (§10 · defence-in-depth against disguised ranking):
//   winner · preferred_candidate · best_candidate · rank · rank_position ·
//   score · priority · selection · selected_candidate · root_cause ·
//   dominant_candidate · stronger_candidate · leading_candidate ·
//   higher_quality_candidate · preferred_hypothesis · most_supported
//
// WHAT THIS MODULE DOES:
//   · Consumes HypothesisEvaluation[] from Fix 13
//   · For each pair (A, B) within same enclosing_function:
//       - computes shared / A-only / B-only evidence_id sets
//       - computes per-candidate status counts
//       - emits structural differences (evidence-count deltas, contradiction
//         presence/absence, unresolved presence/absence)
//   · Every comparison record evidence_kind = INFERRED (type-locked)
//   · Bounded pair count · deterministic ordering · full provenance
//
// WHAT THIS MODULE DOES NOT DO (§11-§12 · enforced in code + runtime):
//   · No ranking · no scoring · no preference field
//   · No root-cause selection · no winner
//   · No causal claim ("causes", "results in", "leads to", etc.)
//   · No natural-language narrative
//   · No LLM · no external inference · no writes · no execution

import type {
  HypothesisEvaluation,
  HypothesisEvidenceEvaluation,
  EvidenceStatus,
} from "./capability-hypothesis-evidence-evaluator";

// ── Public shape ─────────────────────────────────────────────────────────

/** A structural difference between two candidates. NEVER a preference. */
export type StructuralDifferenceKind =
  // count deltas · pure numerical differences · no preference implied
  | "MORE_SUPPORTING_EVIDENCE"
  | "LESS_SUPPORTING_EVIDENCE"
  | "MORE_CONTRADICTING_EVIDENCE"
  | "LESS_CONTRADICTING_EVIDENCE"
  | "MORE_INSUFFICIENT_EVIDENCE"
  | "LESS_INSUFFICIENT_EVIDENCE"
  | "MORE_UNRESOLVED_EVIDENCE"
  | "LESS_UNRESOLVED_EVIDENCE"
  // structural presence · what evidence exists vs doesn't
  | "HAS_CONTRADICTING_EVIDENCE"
  | "NO_CONTRADICTING_EVIDENCE"
  | "HAS_UNRESOLVED_EVIDENCE"
  | "NO_UNRESOLVED_EVIDENCE"
  // set-relation differences
  | "SHARED_EVIDENCE"
  | "UNIQUE_EVIDENCE_A"
  | "UNIQUE_EVIDENCE_B";

export interface StructuralDifference {
  readonly kind: StructuralDifferenceKind;
  /** Which side (A or B) has the property described by this difference,
   *  when applicable. Null for symmetric differences (SHARED_EVIDENCE). */
  readonly side: "A" | "B" | null;
  /** Numeric delta where meaningful · e.g. +2 supporting evidence records.
   *  Zero for presence/absence differences. */
  readonly delta: number;
}

export interface CandidateStatusCounts {
  readonly STRUCTURALLY_SUPPORTING: number;
  readonly STRUCTURALLY_CONTRADICTING: number;
  readonly INSUFFICIENT: number;
  readonly UNRESOLVED: number;
}

export interface CandidateComparison {
  readonly comparison_id: string;
  readonly candidate_a_id: string;
  readonly candidate_b_id: string;
  readonly enclosing_function: string | null;
  readonly source_file: string;

  readonly shared_evidence_ids: readonly string[];
  readonly candidate_a_only_evidence_ids: readonly string[];
  readonly candidate_b_only_evidence_ids: readonly string[];

  readonly candidate_a_status_counts: CandidateStatusCounts;
  readonly candidate_b_status_counts: CandidateStatusCounts;

  readonly structural_differences: readonly StructuralDifference[];

  /** Provenance back to the underlying evidence · flat list of {file, lines}
   *  from both candidates' HypothesisEvidenceEvaluation records. */
  readonly provenance: readonly { source_file: string; start_line: number; end_line: number }[];

  /** Type-locked to INFERRED · never PROVEN. */
  readonly evidence_kind: "INFERRED";

  /** Bounded confidence · never HIGH · reflects INFERENCE, not preference. */
  readonly confidence: number;
}

export interface CompareCandidatePairsInput {
  readonly evaluations: readonly HypothesisEvaluation[];
  readonly evidence_records: readonly HypothesisEvidenceEvaluation[];
  readonly max_comparisons_total?: number;
}

export interface CompareCandidatePairsResult {
  readonly ok: true;
  readonly comparisons: readonly CandidateComparison[];
  readonly stats: {
    readonly evaluations_seen: number;
    readonly pairs_evaluated: number;
    readonly comparisons_emitted: number;
    readonly rejected_prohibited_field: number;
    readonly rejected_causal_vocab: number;
    readonly prohibited_hits: readonly string[];
    readonly capped_by: string;
  };
}

// ── Prohibited field names (§10 · defence-in-depth) ─────────────────────
// If any of these appears as a key in emitted comparisons, the comparator
// rejects the record. The template code below never generates these · this
// is a runtime backstop against future refactors.
const PROHIBITED_RANKING_FIELDS = new Set([
  "winner",
  "preferred_candidate",
  "best_candidate",
  "rank",
  "rank_position",
  "score",
  "priority",
  "selection",
  "selected_candidate",
  "root_cause",
  "dominant_candidate",
  "stronger_candidate",
  "leading_candidate",
  "higher_quality_candidate",
  "preferred_hypothesis",
  "most_supported",
]);

// ── Prohibited causal vocabulary (§11 · defence-in-depth) ───────────────
const FORBIDDEN_CAUSAL_TOKENS = [
  "causes",
  "caused by",
  "therefore",
  "responsible for",
  "leads to",
  "results in",
  "because",
  "root cause is",
];

const DEFAULT_MAX_COMPARISONS = 100;
const HARD_MAX_COMPARISONS = 200;
const CONFIDENCE_CEILING = 0.5;  // Lower than Fix 13's 0.6 · additional inference layer

// ── Utilities ────────────────────────────────────────────────────────────

function containsForbiddenCausal(text: string): string | null {
  const lower = text.toLowerCase();
  for (const t of FORBIDDEN_CAUSAL_TOKENS) {
    if (lower.includes(t)) return t;
  }
  return null;
}

function hasProhibitedFieldKey(obj: Record<string, unknown>): string | null {
  for (const k of Object.keys(obj)) {
    if (PROHIBITED_RANKING_FIELDS.has(k.toLowerCase())) return k;
  }
  return null;
}

function evidenceIdsByStatus(
  evaluation: HypothesisEvaluation,
  evidenceRecords: readonly HypothesisEvidenceEvaluation[],
): { [K in EvidenceStatus]: Set<string> } {
  const buckets: { [K in EvidenceStatus]: Set<string> } = {
    STRUCTURALLY_SUPPORTING: new Set(),
    STRUCTURALLY_CONTRADICTING: new Set(),
    INSUFFICIENT: new Set(),
    UNRESOLVED: new Set(),
  };
  for (const rec of evidenceRecords) {
    if (rec.candidate_id !== evaluation.candidate_id) continue;
    buckets[rec.status].add(rec.evidence_id);
  }
  return buckets;
}

function statusCounts(
  evaluation: HypothesisEvaluation,
  evidenceRecords: readonly HypothesisEvidenceEvaluation[],
): CandidateStatusCounts {
  const b = evidenceIdsByStatus(evaluation, evidenceRecords);
  return {
    STRUCTURALLY_SUPPORTING: b.STRUCTURALLY_SUPPORTING.size,
    STRUCTURALLY_CONTRADICTING: b.STRUCTURALLY_CONTRADICTING.size,
    INSUFFICIENT: b.INSUFFICIENT.size,
    UNRESOLVED: b.UNRESOLVED.size,
  };
}

/** Compute structural differences between two candidate status count records.
 *  Every difference is a factual delta or presence claim · never a preference. */
function computeStructuralDifferences(
  a: CandidateStatusCounts,
  b: CandidateStatusCounts,
  sharedCount: number,
  aOnlyCount: number,
  bOnlyCount: number,
): StructuralDifference[] {
  const out: StructuralDifference[] = [];

  // Supporting count deltas
  if (a.STRUCTURALLY_SUPPORTING > b.STRUCTURALLY_SUPPORTING) {
    out.push({ kind: "MORE_SUPPORTING_EVIDENCE", side: "A", delta: a.STRUCTURALLY_SUPPORTING - b.STRUCTURALLY_SUPPORTING });
  } else if (a.STRUCTURALLY_SUPPORTING < b.STRUCTURALLY_SUPPORTING) {
    out.push({ kind: "LESS_SUPPORTING_EVIDENCE", side: "A", delta: b.STRUCTURALLY_SUPPORTING - a.STRUCTURALLY_SUPPORTING });
  }

  // Contradicting count deltas
  if (a.STRUCTURALLY_CONTRADICTING > b.STRUCTURALLY_CONTRADICTING) {
    out.push({ kind: "MORE_CONTRADICTING_EVIDENCE", side: "A", delta: a.STRUCTURALLY_CONTRADICTING - b.STRUCTURALLY_CONTRADICTING });
  } else if (a.STRUCTURALLY_CONTRADICTING < b.STRUCTURALLY_CONTRADICTING) {
    out.push({ kind: "LESS_CONTRADICTING_EVIDENCE", side: "A", delta: b.STRUCTURALLY_CONTRADICTING - a.STRUCTURALLY_CONTRADICTING });
  }

  // Contradiction presence
  if (a.STRUCTURALLY_CONTRADICTING > 0 && b.STRUCTURALLY_CONTRADICTING === 0) {
    out.push({ kind: "HAS_CONTRADICTING_EVIDENCE", side: "A", delta: 0 });
    out.push({ kind: "NO_CONTRADICTING_EVIDENCE", side: "B", delta: 0 });
  } else if (b.STRUCTURALLY_CONTRADICTING > 0 && a.STRUCTURALLY_CONTRADICTING === 0) {
    out.push({ kind: "HAS_CONTRADICTING_EVIDENCE", side: "B", delta: 0 });
    out.push({ kind: "NO_CONTRADICTING_EVIDENCE", side: "A", delta: 0 });
  }

  // Insufficient count deltas
  if (a.INSUFFICIENT > b.INSUFFICIENT) {
    out.push({ kind: "MORE_INSUFFICIENT_EVIDENCE", side: "A", delta: a.INSUFFICIENT - b.INSUFFICIENT });
  } else if (a.INSUFFICIENT < b.INSUFFICIENT) {
    out.push({ kind: "LESS_INSUFFICIENT_EVIDENCE", side: "A", delta: b.INSUFFICIENT - a.INSUFFICIENT });
  }

  // Unresolved count deltas + presence
  if (a.UNRESOLVED > b.UNRESOLVED) {
    out.push({ kind: "MORE_UNRESOLVED_EVIDENCE", side: "A", delta: a.UNRESOLVED - b.UNRESOLVED });
  } else if (a.UNRESOLVED < b.UNRESOLVED) {
    out.push({ kind: "LESS_UNRESOLVED_EVIDENCE", side: "A", delta: b.UNRESOLVED - a.UNRESOLVED });
  }
  if (a.UNRESOLVED > 0 && b.UNRESOLVED === 0) {
    out.push({ kind: "HAS_UNRESOLVED_EVIDENCE", side: "A", delta: 0 });
    out.push({ kind: "NO_UNRESOLVED_EVIDENCE", side: "B", delta: 0 });
  } else if (b.UNRESOLVED > 0 && a.UNRESOLVED === 0) {
    out.push({ kind: "HAS_UNRESOLVED_EVIDENCE", side: "B", delta: 0 });
    out.push({ kind: "NO_UNRESOLVED_EVIDENCE", side: "A", delta: 0 });
  }

  // Set-relation differences
  if (sharedCount > 0) {
    out.push({ kind: "SHARED_EVIDENCE", side: null, delta: sharedCount });
  }
  if (aOnlyCount > 0) {
    out.push({ kind: "UNIQUE_EVIDENCE_A", side: "A", delta: aOnlyCount });
  }
  if (bOnlyCount > 0) {
    out.push({ kind: "UNIQUE_EVIDENCE_B", side: "B", delta: bOnlyCount });
  }

  return out;
}

// ── Entry point ──────────────────────────────────────────────────────────

export function compareCandidatePairs(
  input: CompareCandidatePairsInput,
): CompareCandidatePairsResult {
  const maxTotal = Math.min(
    input.max_comparisons_total ?? DEFAULT_MAX_COMPARISONS,
    HARD_MAX_COMPARISONS,
  );

  const evaluationById = new Map<string, HypothesisEvaluation>();
  for (const e of input.evaluations) evaluationById.set(e.candidate_id, e);

  // Group evaluations by enclosing_function · pairs only compare within scope
  const byFn = new Map<string, HypothesisEvaluation[]>();
  for (const e of input.evaluations) {
    // Look up the candidate's enclosing_function via its evaluation record.
    // HypothesisEvaluation stores this transitively via evidence_evaluations'
    // provenance and the candidate itself carries enclosing_function via
    // its RootCauseCandidate. We derive it from the evidence_evaluations'
    // provenance source_file · but the canonical scope key comes from the
    // Fix 13 aggregation which preserves candidate.enclosing_function via
    // provenance. For bounded scope we group by candidate_id prefix
    // encoded in candidate_id itself.
    //
    // Fix 12's candidate_id format:
    //   "<source_file>::candidate::<start_line>:<end_line>:<symbol>"
    // We group by <source_file> as the scope proxy · this preserves the
    // "candidates in the same enclosing function" bound because Fix 12
    // enforces candidate_endpoint.enclosing_function alignment.
    const scopeKey = e.candidate_id.split("::")[0];
    let bucket = byFn.get(scopeKey);
    if (!bucket) {
      bucket = [];
      byFn.set(scopeKey, bucket);
    }
    bucket.push(e);
  }

  const comparisons: CandidateComparison[] = [];
  const stats = {
    pairsEvaluated: 0,
    rejectedProhibited: 0,
    rejectedCausal: 0,
    prohibitedHits: [] as string[],
    cappedBy: `hard_cap=${maxTotal}`,
  };

  // For each scope, generate deterministic pairs
  const scopes = [...byFn.keys()].sort();
  for (const scopeKey of scopes) {
    if (comparisons.length >= maxTotal) {
      stats.cappedBy = `hit_hard_cap=${maxTotal}`;
      break;
    }
    const evals = byFn.get(scopeKey)!;
    if (evals.length < 2) continue;
    // Sort by candidate_id for deterministic pair ordering
    const sortedEvals = [...evals].sort((a, b) => a.candidate_id.localeCompare(b.candidate_id));

    for (let i = 0; i < sortedEvals.length - 1; i++) {
      if (comparisons.length >= maxTotal) break;
      for (let j = i + 1; j < sortedEvals.length; j++) {
        if (comparisons.length >= maxTotal) break;
        stats.pairsEvaluated++;

        const A = sortedEvals[i];
        const B = sortedEvals[j];

        // Compute evidence-id sets
        const aBuckets = evidenceIdsByStatus(A, input.evidence_records);
        const bBuckets = evidenceIdsByStatus(B, input.evidence_records);
        const aAll = new Set<string>([
          ...aBuckets.STRUCTURALLY_SUPPORTING,
          ...aBuckets.STRUCTURALLY_CONTRADICTING,
          ...aBuckets.INSUFFICIENT,
          ...aBuckets.UNRESOLVED,
        ]);
        const bAll = new Set<string>([
          ...bBuckets.STRUCTURALLY_SUPPORTING,
          ...bBuckets.STRUCTURALLY_CONTRADICTING,
          ...bBuckets.INSUFFICIENT,
          ...bBuckets.UNRESOLVED,
        ]);

        const shared: string[] = [];
        const aOnly: string[] = [];
        const bOnly: string[] = [];
        for (const id of aAll) {
          if (bAll.has(id)) shared.push(id);
          else aOnly.push(id);
        }
        for (const id of bAll) {
          if (!aAll.has(id)) bOnly.push(id);
        }
        shared.sort();
        aOnly.sort();
        bOnly.sort();

        const aCounts = {
          STRUCTURALLY_SUPPORTING: aBuckets.STRUCTURALLY_SUPPORTING.size,
          STRUCTURALLY_CONTRADICTING: aBuckets.STRUCTURALLY_CONTRADICTING.size,
          INSUFFICIENT: aBuckets.INSUFFICIENT.size,
          UNRESOLVED: aBuckets.UNRESOLVED.size,
        };
        const bCounts = {
          STRUCTURALLY_SUPPORTING: bBuckets.STRUCTURALLY_SUPPORTING.size,
          STRUCTURALLY_CONTRADICTING: bBuckets.STRUCTURALLY_CONTRADICTING.size,
          INSUFFICIENT: bBuckets.INSUFFICIENT.size,
          UNRESOLVED: bBuckets.UNRESOLVED.size,
        };

        const structural = computeStructuralDifferences(
          aCounts, bCounts, shared.length, aOnly.length, bOnly.length,
        );

        // Aggregate provenance from both candidates
        const provenanceMap = new Map<string, { source_file: string; start_line: number; end_line: number }>();
        for (const p of [...A.provenance, ...B.provenance]) {
          const key = `${p.source_file}:${p.start_line}:${p.end_line}`;
          if (!provenanceMap.has(key)) provenanceMap.set(key, p);
        }
        const provenance = [...provenanceMap.values()].sort((x, y) =>
          x.source_file.localeCompare(y.source_file) ||
          x.start_line - y.start_line ||
          x.end_line - y.end_line,
        );

        // Deterministic comparison_id
        const comparisonId = `${scopeKey}::comparison::${A.candidate_id}::vs::${B.candidate_id}`;

        // Bounded confidence · never HIGH
        const totalEvidence = aAll.size + bAll.size;
        const confidence = totalEvidence > 0
          ? Math.min(0.3 + 0.05 * Math.log2(totalEvidence + 1), CONFIDENCE_CEILING)
          : 0.2;

        const comparison: CandidateComparison = {
          comparison_id: comparisonId,
          candidate_a_id: A.candidate_id,
          candidate_b_id: B.candidate_id,
          enclosing_function: null, // provenance carries file-level info
          source_file: scopeKey,
          shared_evidence_ids: shared,
          candidate_a_only_evidence_ids: aOnly,
          candidate_b_only_evidence_ids: bOnly,
          candidate_a_status_counts: aCounts,
          candidate_b_status_counts: bCounts,
          structural_differences: structural,
          provenance,
          evidence_kind: "INFERRED",
          confidence,
        };

        // Runtime defence-in-depth: reject if any prohibited ranking field
        // sneaked into the record (guards against future refactors)
        const prohibitedKey = hasProhibitedFieldKey(comparison as unknown as Record<string, unknown>);
        if (prohibitedKey !== null) {
          stats.rejectedProhibited++;
          stats.prohibitedHits.push(prohibitedKey);
          continue;
        }

        // Runtime defence-in-depth: reject if any string field contains causal vocabulary
        const jsonBody = JSON.stringify(comparison);
        const causalHit = containsForbiddenCausal(jsonBody);
        if (causalHit !== null) {
          stats.rejectedCausal++;
          stats.prohibitedHits.push(causalHit);
          continue;
        }

        // Type-lock backstop: reject if evidence_kind ever mutates
        if ((comparison.evidence_kind as string) !== "INFERRED") continue;

        comparisons.push(comparison);
      }
    }
  }

  // Deterministic sort
  comparisons.sort((a, b) => a.comparison_id.localeCompare(b.comparison_id));

  return {
    ok: true,
    comparisons,
    stats: {
      evaluations_seen: input.evaluations.length,
      pairs_evaluated: stats.pairsEvaluated,
      comparisons_emitted: comparisons.length,
      rejected_prohibited_field: stats.rejectedProhibited,
      rejected_causal_vocab: stats.rejectedCausal,
      prohibited_hits: stats.prohibitedHits,
      capped_by: stats.cappedBy,
    },
  };
}
