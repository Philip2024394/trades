// src/lib/nex-agent/code-engine/capability-hypothesis-evidence-evaluator.ts
//
// NEX1 · Structural Hypothesis Evidence Evaluator · deterministic · zero LLM · READ-ONLY.
//
// Fix 13 · 2026-09-17 · authorised after Test Q HYPOTHESES_GENERATED_NO_EVIDENCE_EVALUATION
// (docs/doctrine/nex1-test-q-evidence-evaluation-2026-09-17.md).
//
// PURPOSE (founder Fix 13 authorization · verbatim):
//   > "Fix 13 exists to establish exactly one new bridge:
//     VERIFIED STRUCTURAL EVIDENCE → HYPOTHESIS EVIDENCE STATUS
//     Nothing beyond that bridge is authorized."
//
// EXACT SCOPE (§4 · founder-locked):
//   Four evidence states over each candidate's supporting_relationship_ids:
//     · STRUCTURALLY_SUPPORTING
//     · STRUCTURALLY_CONTRADICTING
//     · INSUFFICIENT
//     · UNRESOLVED
//   These describe the relationship between a HYPOTHESIS candidate and
//   verified structural evidence. They are NOT causal claims. They are NOT
//   root-cause conclusions. They are NOT PROVEN.
//
// CRITICAL DISCIPLINE (founder §7 / §11 / §12):
//   · Do NOT rank hypotheses (Q7 · out of scope)
//   · Do NOT compare candidates (Q6 · out of scope)
//   · Do NOT select a root cause (Q8 · out of scope)
//   · Do NOT emit causal narrative
//   · Do NOT promote HYPOTHESIS → PROVEN
//   · Do NOT treat NOT_FOUND as CONTRADICTED (§9 · founder-locked)
//
// PRE-BUILD AUDIT (2026-09-17):
//   Truth Engine at src/lib/nex/truth-engine/verifier/ has surface
//   similarity (rules, verdicts, evidence_refs) but is domain-mismatched:
//   its VerifierInput operates on LAM authority-model rows with opaque
//   UUIDs, and its verdicts are PASS/FAIL/UNKNOWN/CANDIDATE_FLAG · not the
//   four evidence states Fix 13 requires. Additionally Truth Engine is
//   Track A infrastructure · coupling would violate the freeze.
//   Zero existing consumer of root_cause_candidates[] · zero existing
//   hypothesis-evaluation primitive. Classification: BUILD (scoped).

import type {
  RootCauseCandidate,
} from "./capability-root-cause-hypothesis-generator";
import type {
  InferredRelationship,
} from "./capability-chain-relationship-detector";
import type {
  ComposedArgument,
} from "./capability-chain-relationship-composer";

// ── Public shape ─────────────────────────────────────────────────────────

export type EvidenceStatus =
  | "STRUCTURALLY_SUPPORTING"
  | "STRUCTURALLY_CONTRADICTING"
  | "INSUFFICIENT"
  | "UNRESOLVED";

export interface HypothesisEvidenceEvaluation {
  readonly candidate_id: string;
  readonly evidence_id: string;                         // deterministic · candidate_id + relationship_id
  readonly relationship_id: string;
  readonly composition_id: string;
  readonly status: EvidenceStatus;
  readonly rule_fired: string;                          // deterministic rule identifier
  /** evidence_kind is TYPE-LOCKED to "INFERRED" · never PROVEN · never OBSERVED.
   *  The individual source facts are OBSERVED · the classification of
   *  a relationship w.r.t. a hypothesis is INFERRED. */
  readonly evidence_kind: "INFERRED";
  readonly provenance: readonly { source_file: string; start_line: number; end_line: number }[];
  /** Bounded confidence · never HIGH · never PROVEN.
   *  This is evaluation confidence, not root-cause confidence. */
  readonly confidence: number;
}

export interface HypothesisEvaluation {
  readonly candidate_id: string;
  readonly evidence_evaluations: readonly HypothesisEvidenceEvaluation[];
  /** Aggregate status derived from evidence_evaluations · never a ranking. */
  readonly overall_status:
    | "STRUCTURALLY_SUPPORTED"
    | "STRUCTURALLY_CONTRADICTED"
    | "INSUFFICIENT"
    | "UNRESOLVED";
  readonly supporting_evidence_ids: readonly string[];
  readonly contradicting_evidence_ids: readonly string[];
  readonly insufficient_evidence_ids: readonly string[];
  readonly unresolved_evidence_ids: readonly string[];
  readonly provenance: readonly { source_file: string; start_line: number; end_line: number }[];
  readonly evidence_kind: "INFERRED";
  readonly confidence: number;
}

export interface EvaluateHypothesesInput {
  readonly candidates: readonly RootCauseCandidate[];
  readonly relationships: readonly InferredRelationship[];
  readonly compositions: readonly ComposedArgument[];
  readonly max_evaluations_total?: number;
}

export interface EvaluateHypothesesResult {
  readonly ok: true;
  readonly evaluations: readonly HypothesisEvaluation[];
  readonly evidence_records: readonly HypothesisEvidenceEvaluation[];
  readonly stats: {
    readonly candidates_seen: number;
    readonly evaluations_emitted: number;
    readonly evidence_records_emitted: number;
    readonly by_status: {
      STRUCTURALLY_SUPPORTING: number;
      STRUCTURALLY_CONTRADICTING: number;
      INSUFFICIENT: number;
      UNRESOLVED: number;
    };
    readonly by_overall_status: {
      STRUCTURALLY_SUPPORTED: number;
      STRUCTURALLY_CONTRADICTED: number;
      INSUFFICIENT: number;
      UNRESOLVED: number;
    };
    readonly rejected_forbidden_word: number;
    readonly forbidden_hits: readonly string[];
    readonly capped_by: string;
  };
}

// ── Forbidden causal vocabulary (§12 defence-in-depth) ──────────────────
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

const DEFAULT_MAX_EVALUATIONS = 200;
const HARD_MAX_EVALUATIONS = 500;
const CONFIDENCE_CEILING = 0.6;  // Never HIGH · lower than Fix 12's 0.7 to reflect additional inference layer

// ── Rules (§9-§10 · discipline) ─────────────────────────────────────────
//
// R-1 · STRUCTURALLY_SUPPORTING
//   Relationship exists in packet.inferred_relationships AND its endpoints
//   structurally appear (start_line + end_line + fact_kind match) in the
//   composition's endpoint_chain. This means the relationship is a genuine
//   member of the chain that produced the candidate.
//
// R-2 · STRUCTURALLY_CONTRADICTING
//   Relationship exists AND its endpoints violate direction · endpoint_A.end_line
//   > endpoint_B.start_line without shared-span exception. This would be an
//   invalid relationship shape (Fix 10 shouldn't emit such records, but the
//   evaluator checks defensively).
//
// R-3 · INSUFFICIENT
//   Relationship exists in packet.inferred_relationships AND is listed as
//   supporting_relationship_id BUT its endpoints do not match any consecutive
//   pair in the composition's endpoint_chain. Relationship exists but does
//   not span the required region.
//
// R-4 · UNRESOLVED
//   Relationship_id listed as supporting_relationship_id CANNOT BE FOUND in
//   packet.inferred_relationships. Missing data · deterministic classification
//   impossible.
//
// R-5 · UNRESOLVED
//   Composition_id listed on candidate CANNOT BE FOUND in packet.composed_arguments.
//   Structural context missing.

function containsForbiddenCausal(text: string): string | null {
  const lower = text.toLowerCase();
  for (const t of FORBIDDEN_CAUSAL_TOKENS) {
    if (lower.includes(t)) return t;
  }
  return null;
}

/** Structural endpoint match key · same shape as Fix 11 composer uses. */
function endpointsMatch(
  aFile: string, aStart: number, aEnd: number, aKind: string,
  bFile: string, bStart: number, bEnd: number, bKind: string,
): boolean {
  return aFile === bFile && aStart === bStart && aEnd === bEnd && aKind === bKind;
}

/** Check whether relationship R is structurally a member of composition C.
 *  R is a member if R's endpoint_A matches some step S_i in C.endpoint_chain
 *  AND R's endpoint_B matches the NEXT step S_{i+1} · i.e. R spans a
 *  consecutive pair in the chain. */
function relationshipIsMemberOfComposition(
  rel: InferredRelationship,
  comp: ComposedArgument,
): boolean {
  const chain = comp.endpoint_chain;
  for (let i = 0; i < chain.length - 1; i++) {
    const stepA = chain[i];
    const stepB = chain[i + 1];
    const aMatch = endpointsMatch(
      rel.source_file, rel.endpoint_A.start_line, rel.endpoint_A.end_line, rel.endpoint_A.fact_kind,
      stepA.source_file, stepA.start_line, stepA.end_line, stepA.fact_kind,
    );
    const bMatch = endpointsMatch(
      rel.source_file, rel.endpoint_B.start_line, rel.endpoint_B.end_line, rel.endpoint_B.fact_kind,
      stepB.source_file, stepB.start_line, stepB.end_line, stepB.fact_kind,
    );
    if (aMatch && bMatch) return true;
  }
  return false;
}

/** Check whether relationship R violates direction (§9). */
function relationshipViolatesDirection(rel: InferredRelationship): boolean {
  const aEnd = rel.endpoint_A.end_line;
  const bStart = rel.endpoint_B.start_line;
  const aStart = rel.endpoint_A.start_line;
  const bEnd = rel.endpoint_B.end_line;
  // Selector_literal_mapping legitimately shares span · exempt.
  if (aStart === bStart && aEnd === bEnd) return false;
  return aEnd > bStart;
}

function stepToProvenance(step: {
  source_file: string; start_line: number; end_line: number;
}): { source_file: string; start_line: number; end_line: number } {
  return {
    source_file: step.source_file,
    start_line: step.start_line,
    end_line: step.end_line,
  };
}

// ── Entry point ──────────────────────────────────────────────────────────

export function evaluateHypothesisEvidence(
  input: EvaluateHypothesesInput,
): EvaluateHypothesesResult {
  const maxTotal = Math.min(
    input.max_evaluations_total ?? DEFAULT_MAX_EVALUATIONS,
    HARD_MAX_EVALUATIONS,
  );

  // Index relationships and compositions for O(1) lookup
  const relIndex = new Map<string, InferredRelationship>();
  for (const r of input.relationships) relIndex.set(r.relationship_id, r);
  const compIndex = new Map<string, ComposedArgument>();
  for (const c of input.compositions) compIndex.set(c.composition_id, c);

  const evidenceRecords: HypothesisEvidenceEvaluation[] = [];
  const perCandidateEvaluations: HypothesisEvaluation[] = [];
  const stats = {
    STRUCTURALLY_SUPPORTING: 0,
    STRUCTURALLY_CONTRADICTING: 0,
    INSUFFICIENT: 0,
    UNRESOLVED: 0,
    STRUCTURALLY_SUPPORTED: 0,
    STRUCTURALLY_CONTRADICTED: 0,
    INSUFFICIENT_agg: 0,
    UNRESOLVED_agg: 0,
    rejectedForbidden: 0,
    forbiddenHits: [] as string[],
    cappedBy: `hard_cap=${maxTotal}`,
  };

  for (const candidate of input.candidates) {
    if (evidenceRecords.length >= maxTotal) {
      stats.cappedBy = `hit_hard_cap=${maxTotal}`;
      break;
    }

    // R-5 · composition not found → all evidence UNRESOLVED
    const composition = compIndex.get(candidate.composition_id);

    const perCandidateRecords: HypothesisEvidenceEvaluation[] = [];

    for (const relId of candidate.supporting_relationship_ids) {
      if (evidenceRecords.length >= maxTotal) break;

      let status: EvidenceStatus;
      let ruleFired: string;
      let provenance: { source_file: string; start_line: number; end_line: number }[] = [];

      const rel = relIndex.get(relId);
      if (!rel) {
        // R-4 · UNRESOLVED
        status = "UNRESOLVED";
        ruleFired = "R-4_relationship_id_not_in_inferred_relationships";
      } else if (!composition) {
        // R-5 · UNRESOLVED (composition missing)
        status = "UNRESOLVED";
        ruleFired = "R-5_composition_id_not_in_composed_arguments";
        provenance = [{
          source_file: rel.source_file,
          start_line: rel.endpoint_A.start_line,
          end_line: rel.endpoint_B.end_line,
        }];
      } else if (relationshipViolatesDirection(rel)) {
        // R-2 · STRUCTURALLY_CONTRADICTING
        status = "STRUCTURALLY_CONTRADICTING";
        ruleFired = "R-2_direction_violation";
        provenance = [
          { source_file: rel.source_file, start_line: rel.endpoint_A.start_line, end_line: rel.endpoint_A.end_line },
          { source_file: rel.source_file, start_line: rel.endpoint_B.start_line, end_line: rel.endpoint_B.end_line },
        ];
      } else if (relationshipIsMemberOfComposition(rel, composition)) {
        // R-1 · STRUCTURALLY_SUPPORTING
        status = "STRUCTURALLY_SUPPORTING";
        ruleFired = "R-1_endpoints_match_consecutive_composition_steps";
        provenance = [
          { source_file: rel.source_file, start_line: rel.endpoint_A.start_line, end_line: rel.endpoint_A.end_line },
          { source_file: rel.source_file, start_line: rel.endpoint_B.start_line, end_line: rel.endpoint_B.end_line },
        ];
      } else {
        // R-3 · INSUFFICIENT
        status = "INSUFFICIENT";
        ruleFired = "R-3_relationship_endpoints_do_not_match_composition_chain";
        provenance = [
          { source_file: rel.source_file, start_line: rel.endpoint_A.start_line, end_line: rel.endpoint_A.end_line },
          { source_file: rel.source_file, start_line: rel.endpoint_B.start_line, end_line: rel.endpoint_B.end_line },
        ];
      }

      const evidenceId = `${candidate.candidate_id}::${relId}`;

      // Forbidden causal vocab check (defence-in-depth · §12)
      const scanText = `${candidate.candidate_id} ${relId} ${ruleFired}`;
      const forbiddenHit = containsForbiddenCausal(scanText);
      if (forbiddenHit !== null) {
        stats.rejectedForbidden++;
        stats.forbiddenHits.push(forbiddenHit);
        continue;
      }

      const record: HypothesisEvidenceEvaluation = {
        candidate_id: candidate.candidate_id,
        evidence_id: evidenceId,
        relationship_id: relId,
        composition_id: candidate.composition_id,
        status,
        rule_fired: ruleFired,
        evidence_kind: "INFERRED",
        provenance,
        confidence: Math.min(0.4, CONFIDENCE_CEILING),
      };

      // Runtime defence-in-depth: reject if evidence_kind somehow mutated
      if ((record.evidence_kind as string) !== "INFERRED") continue;

      evidenceRecords.push(record);
      perCandidateRecords.push(record);
      stats[status]++;
    }

    // Aggregate per-candidate overall_status
    // Rule: any CONTRADICTING → overall CONTRADICTED
    //       else if all SUPPORTING → overall SUPPORTED
    //       else if any INSUFFICIENT and no CONTRADICTING/only SUPPORTING+INSUFFICIENT → INSUFFICIENT
    //       else UNRESOLVED
    let overallStatus: HypothesisEvaluation["overall_status"];
    const anyContra = perCandidateRecords.some((r) => r.status === "STRUCTURALLY_CONTRADICTING");
    const anyUnres = perCandidateRecords.some((r) => r.status === "UNRESOLVED");
    const anyInsuff = perCandidateRecords.some((r) => r.status === "INSUFFICIENT");
    const anySupp = perCandidateRecords.some((r) => r.status === "STRUCTURALLY_SUPPORTING");
    const allSupp = perCandidateRecords.length > 0 &&
      perCandidateRecords.every((r) => r.status === "STRUCTURALLY_SUPPORTING");

    if (anyContra) {
      overallStatus = "STRUCTURALLY_CONTRADICTED";
      stats.STRUCTURALLY_CONTRADICTED++;
    } else if (allSupp) {
      overallStatus = "STRUCTURALLY_SUPPORTED";
      stats.STRUCTURALLY_SUPPORTED++;
    } else if (anyUnres && !anySupp && !anyInsuff) {
      overallStatus = "UNRESOLVED";
      stats.UNRESOLVED_agg++;
    } else if (anyInsuff || (anySupp && anyUnres)) {
      overallStatus = "INSUFFICIENT";
      stats.INSUFFICIENT_agg++;
    } else {
      overallStatus = "UNRESOLVED";
      stats.UNRESOLVED_agg++;
    }

    const supporting_ids = perCandidateRecords.filter((r) => r.status === "STRUCTURALLY_SUPPORTING").map((r) => r.evidence_id);
    const contra_ids = perCandidateRecords.filter((r) => r.status === "STRUCTURALLY_CONTRADICTING").map((r) => r.evidence_id);
    const insuff_ids = perCandidateRecords.filter((r) => r.status === "INSUFFICIENT").map((r) => r.evidence_id);
    const unres_ids = perCandidateRecords.filter((r) => r.status === "UNRESOLVED").map((r) => r.evidence_id);

    const provenanceAggregated = perCandidateRecords.flatMap((r) => r.provenance);

    // Confidence: proportional to fraction supporting, capped
    const suppFraction = perCandidateRecords.length > 0
      ? supporting_ids.length / perCandidateRecords.length
      : 0;
    const perCandidateConfidence = Math.min(0.4 * suppFraction + 0.2, CONFIDENCE_CEILING);

    perCandidateEvaluations.push({
      candidate_id: candidate.candidate_id,
      evidence_evaluations: perCandidateRecords,
      overall_status: overallStatus,
      supporting_evidence_ids: supporting_ids,
      contradicting_evidence_ids: contra_ids,
      insufficient_evidence_ids: insuff_ids,
      unresolved_evidence_ids: unres_ids,
      provenance: provenanceAggregated,
      evidence_kind: "INFERRED",
      confidence: perCandidateConfidence,
    });
  }

  // Deterministic sort
  evidenceRecords.sort((a, b) => a.evidence_id.localeCompare(b.evidence_id));
  perCandidateEvaluations.sort((a, b) => a.candidate_id.localeCompare(b.candidate_id));

  return {
    ok: true,
    evaluations: perCandidateEvaluations,
    evidence_records: evidenceRecords,
    stats: {
      candidates_seen: input.candidates.length,
      evaluations_emitted: perCandidateEvaluations.length,
      evidence_records_emitted: evidenceRecords.length,
      by_status: {
        STRUCTURALLY_SUPPORTING: stats.STRUCTURALLY_SUPPORTING,
        STRUCTURALLY_CONTRADICTING: stats.STRUCTURALLY_CONTRADICTING,
        INSUFFICIENT: stats.INSUFFICIENT,
        UNRESOLVED: stats.UNRESOLVED,
      },
      by_overall_status: {
        STRUCTURALLY_SUPPORTED: stats.STRUCTURALLY_SUPPORTED,
        STRUCTURALLY_CONTRADICTED: stats.STRUCTURALLY_CONTRADICTED,
        INSUFFICIENT: stats.INSUFFICIENT_agg,
        UNRESOLVED: stats.UNRESOLVED_agg,
      },
      rejected_forbidden_word: stats.rejectedForbidden,
      forbidden_hits: stats.forbiddenHits,
      capped_by: stats.cappedBy,
    },
  };
}
