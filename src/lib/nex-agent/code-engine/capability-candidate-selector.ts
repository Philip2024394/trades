// src/lib/nex-agent/code-engine/capability-candidate-selector.ts
//
// NEX1 · Deterministic Candidate Selector (Q8) · zero LLM · READ-ONLY.
//
// Fix 16 · 2026-09-17 · authorised after NEX1_Q8_SELECTION_POLICY V1
// FOUNDER-APPROVED (2026-09-17 · docs/doctrine/nex1-q8-selection-policy-v1-founder-approved-2026-09-17.md)
// + founder ambiguity resolution (docs/doctrine/nex1-q8-founder-ambiguity-resolution-2026-09-17.md).
//
// SCOPE (V1 policy · Q8 ONLY):
//   Given Fix 13 hypothesis evaluations and Fix 15 candidate rankings ·
//   determine whether one candidate has sufficient evidence to be
//   designated SELECTED under the founder-approved Q8 policy.
//   Q7 ranking remains AUTHORITATIVE for ordering.
//   Q8 remains AUTHORITATIVE for selection.
//
// POLICY OBEYED (V1 · FOUNDER_APPROVED):
//   Selection-state precedence (Founder Decision 1 · APPROVED A):
//     1. Fix 15 scope_state == UNRESOLVED_ORDER  → REQUIRE_MORE_INVESTIGATION
//     2. rank-1 tied (bucket size > 1)           → TIE
//     3. rank-1 overall_status == CONTRADICTED   → NO_SELECTION (blocking)
//     4. rank-1 overall_status == INSUFFICIENT   → INSUFFICIENT_EVIDENCE
//     5. rank-1 overall_status == UNRESOLVED     → UNRESOLVED
//     6. rank-1 has ANY blocking counts (contra/unres/insuff > 0) → NO_SELECTION
//     7. rank-1 overall_status == SUPPORTED       → SELECTED
//     8. otherwise                               → NO_SELECTION
//
//   TIE + NO_SELECTION (Decision 2 · APPROVED A):
//     selection_state = "TIE" as single primary state · selected_candidate = null
//
//   candidate_rankings output (Decision 3 · APPROVED B):
//     lightweight reference · Q7 authoritative · no duplication of Q7 data
//
//   Confidence (Decision 4 · APPROVED B):
//     fixed constant 0.35 · INFORMATIONAL ONLY · never read by selector
//
//   Physical position (Decision 5 · APPROVED A):
//     called immediately after Fix 15 populates candidate_rankings
//
// EXPLICITLY EXCLUDED (V1 · defence-in-depth):
//   · numerical weights / composite scores       (§2.13)
//   · confidence as a selection factor           (§2.15 · Decision 11)
//   · provenance as a selection factor           (§2.20 · Decision 12 · except REQUIRED output)
//   · nex-debugger imports                       (Decision 2)
//   · external LLM                               (§2.13 · Decision 10)
//   · hidden tie-breakers                        (§2.16 · Decision 13)
//     - filename / candidate_id / array position / timestamp / hash /
//       alphabetical / creation / database / source / execution order
//   · code modification / execution / broker calls / WO-04            (§2.20 · Decision 17)
//
// SELECTED ≠ MODIFIED · SELECTED ≠ EXECUTED · SELECTED ≠ VERIFIED · SELECTED ≠ AUTHORIZED.

import type {
  HypothesisEvaluation,
  HypothesisEvidenceEvaluation,
} from "./capability-hypothesis-evidence-evaluator";
import type {
  CandidateRanking,
  RankingScope,
} from "./capability-candidate-ranker";

// ── Public shape ─────────────────────────────────────────────────────────

/** Q8 selection state per V1 policy §3 · six non-overlapping outcomes. */
export type SelectionState =
  | "SELECTED"
  | "NO_SELECTION"
  | "TIE"
  | "INSUFFICIENT_EVIDENCE"
  | "UNRESOLVED"
  | "REQUIRE_MORE_INVESTIGATION";

/** Reference to Q7 ranking (Decision 3 · lightweight · not a copy). */
export interface RankingReference {
  readonly policy_id: "NEX1_RANKING_POLICY";
  readonly policy_version: "V1";
  readonly source_file: string;
}

/** Q8 output per scope · matches V1 policy §2.19 · 17 minimum fields. */
export interface CandidateSelection {
  readonly investigation_id: string | null;
  readonly trace_id: string | null;
  readonly source_file: string;
  readonly selection_state: SelectionState;
  /** null unless selection_state === "SELECTED" (Decision 2). */
  readonly selected_candidate: string | null;
  /** Q7 authority reference · not a data copy (Decision 3). */
  readonly rankings_reference: RankingReference;
  readonly candidates_considered: readonly string[];
  readonly supporting_evidence_ids: readonly string[];
  readonly contradicting_evidence_ids: readonly string[];
  readonly insufficient_evidence_ids: readonly string[];
  readonly unresolved_evidence_ids: readonly string[];
  /** Deterministic templated reason · no natural-language prose. */
  readonly decision_reason: string;
  /** Fixed constant · never affects selection · Decision 4. */
  readonly confidence: number;
  readonly provenance: readonly { source_file: string; start_line: number; end_line: number }[];
  readonly policy_id: "NEX1_Q8_SELECTION_POLICY";
  readonly policy_version: "V1";
  readonly uncertainty: string | null;
  readonly recommended_next_action: string;
  /** Type-locked · never PROVEN · never OBSERVED (V1 §2.17 · Decision 14). */
  readonly evidence_kind: "INFERRED";
}

export interface SelectCandidatesInput {
  readonly evaluations: readonly HypothesisEvaluation[];
  readonly evidence_records: readonly HypothesisEvidenceEvaluation[];
  readonly rankings: readonly RankingScope[];
  readonly investigation_id?: string | null;
  readonly trace_id?: string | null;
  readonly max_scopes?: number;
}

export interface SelectCandidatesResult {
  readonly ok: true;
  readonly policy_id: "NEX1_Q8_SELECTION_POLICY";
  readonly policy_version: "V1";
  readonly selections: readonly CandidateSelection[];
  readonly stats: {
    readonly scopes_seen: number;
    readonly selections_emitted: number;
    readonly state_counts: Record<SelectionState, number>;
    readonly rejected_non_inferred: number;
    readonly rejected_forbidden_word: number;
    readonly rejected_missing_provenance: number;
    readonly capped_by: string;
  };
}

// ── Constants ────────────────────────────────────────────────────────────

/** Decision 4 · APPROVED B · fixed informational constant. Never affects selection. */
const CONFIDENCE_FIXED = 0.35;

const DEFAULT_MAX_SCOPES = 100;
const HARD_MAX_SCOPES = 200;

/** Defence-in-depth · reject decision_reason / uncertainty / recommended
 *  containing causal vocabulary (Q8 is INFERRED · not a causal claim engine). */
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

function containsForbiddenCausal(text: string): string | null {
  const lower = text.toLowerCase();
  for (const t of FORBIDDEN_CAUSAL_TOKENS) {
    if (lower.includes(t)) return t;
  }
  return null;
}

// ── Selection-state determination (Decision 1 · APPROVED A · 8-step precedence) ─

interface SelectionDecision {
  readonly state: SelectionState;
  readonly selected: string | null;
  readonly reason: string;
  readonly uncertainty: string | null;
  readonly recommended: string;
}

/** Apply V1 §7 selection-state precedence · deterministic · no hidden rules. */
function determineSelectionState(
  rankingScope: RankingScope,
  evaluationsById: Map<string, HypothesisEvaluation>,
): SelectionDecision {
  // Step 1 · scope-level UNRESOLVED_ORDER → REQUIRE_MORE_INVESTIGATION
  if (rankingScope.scope_state === "UNRESOLVED_ORDER") {
    return {
      state: "REQUIRE_MORE_INVESTIGATION",
      selected: null,
      reason:
        "Fix 15 emitted scope_state UNRESOLVED_ORDER for this source_file. " +
        "Q7 could not legitimately order candidates. " +
        "Q8 declines selection per V1 Decision 18 (require more investigation).",
      uncertainty:
        "ranking policy produced no legitimate ordering · Q8 requires additional evidence",
      recommended:
        "gather additional evidence for this source_file · re-run investigation with expanded corpus",
    };
  }

  // Identify rank-1 candidates. Fix 15 sorts by tuple + candidate_id.
  const rank1 = rankingScope.rankings.filter((r) => r.rank_position === 1);

  if (rank1.length === 0) {
    // Edge case: no rank-1 (should not happen for RANKED/SINGLETON/ALL_TIED scopes · defensive)
    return {
      state: "NO_SELECTION",
      selected: null,
      reason:
        "no candidate at rank_position 1 in this scope · Q8 declines selection · " +
        "structural precondition violated",
      uncertainty: "ranker did not produce a rank-1 candidate",
      recommended: "review ranker output · re-run investigation",
    };
  }

  // Step 2 · rank-1 tied (bucket size > 1) → TIE
  // Per Decision 2 · APPROVED A · single primary state · selected_candidate = null implies NO_SELECTION.
  if (rank1.length > 1) {
    const tiedIds = rank1
      .map((r) => r.candidate_id)
      .sort()
      .slice(0, 3)
      .join(", ");
    return {
      state: "TIE",
      selected: null,
      reason:
        `${rank1.length} candidates share rank_position 1 (representatives: ${tiedIds}${rank1.length > 3 ? ", ..." : ""}) · ` +
        "V1 Decision 5 requires TIE + NO_SELECTION · no hidden tie-breaker permitted",
      uncertainty:
        "multiple candidates share highest ranking position · authorized evidence cannot differentiate them",
      recommended:
        "gather additional evidence that could differentiate tied candidates · re-run investigation",
    };
  }

  // Single rank-1 candidate · deep-inspect Fix 13 evaluation.
  const rank1Cand: CandidateRanking = rank1[0];
  const rank1Eval = evaluationsById.get(rank1Cand.candidate_id);

  // Step 3-5 · overall_status precedence (blocking states first)
  if (rank1Eval) {
    if (rank1Eval.overall_status === "STRUCTURALLY_CONTRADICTED") {
      return {
        state: "NO_SELECTION",
        selected: null,
        reason:
          `rank-1 candidate ${rank1Cand.candidate_id} has overall_status STRUCTURALLY_CONTRADICTED. ` +
          `V1 Decision 4/6 blocks selection when contradicting evidence is present at rank 1.`,
        uncertainty:
          "contradicting evidence present at rank 1 · V1 policy prohibits selection with blocking evidence",
        recommended:
          `resolve contradicting evidence for candidate ${rank1Cand.candidate_id} · gather additional evidence`,
      };
    }
    if (rank1Eval.overall_status === "INSUFFICIENT") {
      return {
        state: "INSUFFICIENT_EVIDENCE",
        selected: null,
        reason:
          `rank-1 candidate ${rank1Cand.candidate_id} has overall_status INSUFFICIENT. ` +
          `V1 Decision 15 defines INSUFFICIENT_EVIDENCE as blocking · distinct from UNRESOLVED.`,
        uncertainty:
          "not enough evidence available to make the required selection decision (V1 Decision 15)",
        recommended:
          `gather additional evidence for candidate ${rank1Cand.candidate_id} · specifically evidence that could raise overall_status to SUPPORTED`,
      };
    }
    if (rank1Eval.overall_status === "UNRESOLVED") {
      return {
        state: "UNRESOLVED",
        selected: null,
        reason:
          `rank-1 candidate ${rank1Cand.candidate_id} has overall_status UNRESOLVED. ` +
          `V1 Decision 15 defines UNRESOLVED as blocking · relevant evidence exists but competing possibilities remain.`,
        uncertainty:
          "relevant evidence exists but the investigation has not resolved competing possibilities (V1 Decision 15)",
        recommended:
          `resolve competing evidence for candidate ${rank1Cand.candidate_id} · consult upstream Fix 13 evidence classifications`,
      };
    }
  }

  // Step 6 · any blocking counts at rank 1 → NO_SELECTION
  // Even if overall_status is SUPPORTED, if any individual evidence is
  // blocking on rank 1, V1 Decision 6 prohibits selection.
  if (
    rank1Cand.contradicting_count > 0 ||
    rank1Cand.unresolved_count > 0 ||
    rank1Cand.insufficient_count > 0
  ) {
    return {
      state: "NO_SELECTION",
      selected: null,
      reason:
        `rank-1 candidate ${rank1Cand.candidate_id} has blocking evidence ` +
        `(contradicting=${rank1Cand.contradicting_count} · unresolved=${rank1Cand.unresolved_count} · insufficient=${rank1Cand.insufficient_count}). ` +
        `V1 Decision 4/6 blocks selection when any blocking evidence is present at rank 1.`,
      uncertainty:
        "blocking evidence present at rank 1 · V1 policy prohibits selection despite ranking position",
      recommended:
        `resolve blocking evidence for candidate ${rank1Cand.candidate_id} · V1 requires zero blocking evidence for selection`,
    };
  }

  // Step 7 · STRUCTURALLY_SUPPORTED → SELECTED
  if (rank1Eval && rank1Eval.overall_status === "STRUCTURALLY_SUPPORTED") {
    return {
      state: "SELECTED",
      selected: rank1Cand.candidate_id,
      reason:
        `rank-1 candidate ${rank1Cand.candidate_id} satisfies V1 Q8 policy: ` +
        `overall_status STRUCTURALLY_SUPPORTED · zero blocking evidence · not tied · scope RANKED or SINGLETON. ` +
        `V1 Decision 3 permits selection under these conditions.`,
      uncertainty: null,
      recommended:
        "candidate selected under V1 policy · downstream verification required before any modification / execution / authorization",
    };
  }

  // Step 8 · otherwise → NO_SELECTION
  return {
    state: "NO_SELECTION",
    selected: null,
    reason:
      `rank-1 candidate ${rank1Cand.candidate_id} does not satisfy V1 Q8 policy conditions ` +
      `(evaluation missing OR overall_status not STRUCTURALLY_SUPPORTED). Honest uncertainty preferred over forced selection per V1 Decision 8.`,
    uncertainty: "unable to determine sufficient evidence for selection",
    recommended:
      `review candidate ${rank1Cand.candidate_id} evidence completeness · confirm Fix 13 evaluation was produced · gather additional evidence`,
  };
}

// ── Entry point ──────────────────────────────────────────────────────────

export function selectCandidates(
  input: SelectCandidatesInput,
): SelectCandidatesResult {
  // Group evaluations by candidate_id for O(1) lookup
  const evaluationsById = new Map<string, HypothesisEvaluation>();
  for (const e of input.evaluations) evaluationsById.set(e.candidate_id, e);

  const maxScopes = Math.min(
    input.max_scopes ?? DEFAULT_MAX_SCOPES,
    HARD_MAX_SCOPES,
  );

  // Bound iteration but preserve full input for stats
  const scopesToProcess = input.rankings.slice(0, maxScopes);

  const selections: CandidateSelection[] = [];
  const stateCounts: Record<SelectionState, number> = {
    SELECTED: 0,
    NO_SELECTION: 0,
    TIE: 0,
    INSUFFICIENT_EVIDENCE: 0,
    UNRESOLVED: 0,
    REQUIRE_MORE_INVESTIGATION: 0,
  };
  let rejectedNonInferred = 0;
  let rejectedForbidden = 0;
  let rejectedMissingProvenance = 0;

  for (const rankingScope of scopesToProcess) {
    // Determine selection state via V1 precedence
    const decision = determineSelectionState(rankingScope, evaluationsById);

    // Gather evidence lists for candidates in scope · deduplicated + sorted
    const candidatesConsidered = [
      ...new Set(rankingScope.rankings.map((r) => r.candidate_id)),
    ].sort();

    const supportingSet = new Set<string>();
    const contradictingSet = new Set<string>();
    const insufficientSet = new Set<string>();
    const unresolvedSet = new Set<string>();
    for (const candId of candidatesConsidered) {
      const evaluation = evaluationsById.get(candId);
      if (!evaluation) continue;
      for (const id of evaluation.supporting_evidence_ids) supportingSet.add(id);
      for (const id of evaluation.contradicting_evidence_ids) contradictingSet.add(id);
      for (const id of evaluation.insufficient_evidence_ids) insufficientSet.add(id);
      for (const id of evaluation.unresolved_evidence_ids) unresolvedSet.add(id);
    }

    // Aggregate provenance from all candidates considered
    const provMap = new Map<string, { source_file: string; start_line: number; end_line: number }>();
    for (const candId of candidatesConsidered) {
      const evaluation = evaluationsById.get(candId);
      if (!evaluation) continue;
      for (const p of evaluation.provenance) {
        const key = `${p.source_file}:${p.start_line}:${p.end_line}`;
        if (!provMap.has(key)) provMap.set(key, p);
      }
    }
    const provenance = [...provMap.values()].sort((a, b) =>
      a.source_file.localeCompare(b.source_file) ||
      a.start_line - b.start_line ||
      a.end_line - b.end_line,
    );

    // Q8-N11 provenance-completeness gate:
    // If SELECTED but provenance is empty, downgrade to NO_SELECTION.
    // Missing provenance cannot silently become valid evidence for selection.
    let effectiveState = decision.state;
    let effectiveSelected = decision.selected;
    let effectiveReason = decision.reason;
    let effectiveUncertainty = decision.uncertainty;
    let effectiveRecommended = decision.recommended;
    if (decision.state === "SELECTED" && provenance.length === 0) {
      rejectedMissingProvenance++;
      effectiveState = "NO_SELECTION";
      effectiveSelected = null;
      effectiveReason =
        `SELECTED downgraded to NO_SELECTION: candidate ${decision.selected} lacks provenance records · ` +
        `V1 Decision 12 requires reconstructable provenance for every selection · missing provenance cannot silently become valid`;
      effectiveUncertainty = "candidate has no traceable provenance to source evidence";
      effectiveRecommended =
        `restore provenance chain for candidate ${decision.selected} · Fix 13 evaluator must emit provenance-bearing evidence records`;
    }

    const rankings_reference: RankingReference = {
      policy_id: "NEX1_RANKING_POLICY",
      policy_version: "V1",
      source_file: rankingScope.source_file,
    };

    const selection: CandidateSelection = {
      investigation_id: input.investigation_id ?? null,
      trace_id: input.trace_id ?? null,
      source_file: rankingScope.source_file,
      selection_state: effectiveState,
      selected_candidate: effectiveSelected,
      rankings_reference,
      candidates_considered: candidatesConsidered,
      supporting_evidence_ids: [...supportingSet].sort(),
      contradicting_evidence_ids: [...contradictingSet].sort(),
      insufficient_evidence_ids: [...insufficientSet].sort(),
      unresolved_evidence_ids: [...unresolvedSet].sort(),
      decision_reason: effectiveReason,
      confidence: CONFIDENCE_FIXED,
      provenance,
      policy_id: "NEX1_Q8_SELECTION_POLICY",
      policy_version: "V1",
      uncertainty: effectiveUncertainty,
      recommended_next_action: effectiveRecommended,
      evidence_kind: "INFERRED",
    };

    // Type-lock backstop (V1 §2.17 · Decision 14 · never PROVEN)
    if ((selection.evidence_kind as string) !== "INFERRED") {
      rejectedNonInferred++;
      continue;
    }

    // Defence-in-depth: reject if templated strings contain causal vocab
    const scanText = `${selection.decision_reason} ${selection.uncertainty ?? ""} ${selection.recommended_next_action}`;
    const forbiddenHit = containsForbiddenCausal(scanText);
    if (forbiddenHit !== null) {
      rejectedForbidden++;
      continue;
    }

    selections.push(selection);
    stateCounts[effectiveState]++;
  }

  // Deterministic sort by source_file (stable presentation · not ranking)
  selections.sort((a, b) => a.source_file.localeCompare(b.source_file));

  const cappedBy = scopesToProcess.length < input.rankings.length
    ? `hit_hard_cap_scopes=${maxScopes}`
    : `hard_cap_scopes=${maxScopes}`;

  return {
    ok: true,
    policy_id: "NEX1_Q8_SELECTION_POLICY",
    policy_version: "V1",
    selections,
    stats: {
      scopes_seen: input.rankings.length,
      selections_emitted: selections.length,
      state_counts: stateCounts,
      rejected_non_inferred: rejectedNonInferred,
      rejected_forbidden_word: rejectedForbidden,
      rejected_missing_provenance: rejectedMissingProvenance,
      capped_by: cappedBy,
    },
  };
}
