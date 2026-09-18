// src/lib/nex-agent/code-engine/capability-root-cause-hypothesis-generator.ts
//
// NEX1 · Root-Cause Hypothesis Generator · deterministic · zero LLM · READ-ONLY.
//
// Fix 12 · 2026-09-16 · authorised after Test P COMPOSITION_AVAILABLE_NO_BEHAVIOURAL_REASONING.
// (docs/doctrine/nex1-test-p-root-cause-2026-09-16.md)
//
// PURPOSE (founder Fix 12 authorization · verbatim):
//   > "NEX1 must be able to consume verified Stage-11 compositions and generate
//     explicitly labelled root-cause hypotheses with provenance and alternatives,
//     without pretending that a structural hypothesis is a proven semantic root cause."
//   > "This is hypothesis generation, not final root-cause determination."
//
// CRITICAL DISTINCTION (founder §7 · §21):
//   candidate ≠ root cause proven
//   The first endpoint of a verified composition is a DETERMINISTIC
//   CANDIDATE-GENERATION HEURISTIC · not a causal conclusion. Test P' after
//   Fix 12 is expected to move from
//     COMPOSITION_AVAILABLE_NO_BEHAVIOURAL_REASONING
//   toward
//     HYPOTHESIS_GENERATION_RUNTIME_VERIFIED
//   NOT to
//     ROOT_CAUSE_REASONING_RUNTIME_VERIFIED.
//   Semantic root-cause reasoning remains a distinct future capability.
//
// WHAT THIS MODULE DOES:
//   · Consumes ComposedArgument[] from Fix 11
//   · For each composition, emits a RootCauseCandidate with:
//       - candidate_endpoint = composition.endpoint_chain[0] (deterministic heuristic)
//       - symptom_endpoint   = composition.endpoint_chain[N-1]
//       - candidate_reason   = "first_endpoint_of_verified_composition"
//       - evidence_kind      = "HYPOTHESIS" (type-locked)
//       - supporting_relationship_ids = the composition's relationship_ids
//       - provenance         = full chain provenance
//       - alternatives       = candidate_ids from OTHER compositions
//                              sharing the same enclosing_function
//       - confidence         = capped bounded value · never HIGH · never PROVEN
//
// WHAT THIS MODULE DOES NOT DO (founder §12/§13/§14 · enforced in code):
//   · No causal claim ("causes", "caused by", "therefore", "responsible for",
//     "results in", "leads to", "because", "root cause is")
//   · No emission of PROVEN or CERTAIN evidence kinds
//   · No promotion of candidate to root-cause conclusion
//   · No ranking or selection of "the" candidate
//   · No natural-language explanation
//   · No LLM · no external inference · no writes · no execution

import type { ComposedArgument, CompositionStep } from "./capability-chain-relationship-composer";

// ── Public shape ─────────────────────────────────────────────────────────

export interface CandidateEndpoint {
  readonly source_file: string;
  readonly start_line: number;
  readonly end_line: number;
  readonly symbol: string;
  readonly fact_kind: string;
}

export interface RootCauseCandidate {
  readonly candidate_id: string;
  readonly composition_id: string;
  readonly candidate_endpoint: CandidateEndpoint;
  readonly symptom_endpoint: CandidateEndpoint;
  /** Human-readable description of the deterministic heuristic that
   *  produced this candidate. NEVER a causal claim. */
  readonly candidate_reason: "first_endpoint_of_verified_composition";
  /** evidence_kind is TYPE-LOCKED to "HYPOTHESIS" · never PROVEN, never
   *  OBSERVED. Fix 12 cannot express certainty about a root cause. */
  readonly evidence_kind: "HYPOTHESIS";
  readonly supporting_relationship_ids: readonly string[];
  readonly provenance: readonly { source_file: string; start_line: number; end_line: number }[];
  readonly enclosing_function: string | null;
  /** Bounded confidence · capped at CONFIDENCE_CEILING (0.7).
   *  Never HIGH · never above 0.85. */
  readonly confidence: number;
  /** candidate_ids of OTHER hypotheses in the same enclosing_function.
   *  Populated after all candidates are emitted for the batch. */
  readonly alternatives: readonly string[];
}

export interface GenerateRootCauseCandidatesInput {
  readonly compositions: readonly ComposedArgument[];
  readonly max_candidates_total?: number;
}

export interface GenerateRootCauseCandidatesResult {
  readonly ok: true;
  readonly candidates: readonly RootCauseCandidate[];
  readonly stats: {
    readonly compositions_seen: number;
    readonly candidates_emitted: number;
    readonly rejected_forbidden_word: number;
    readonly rejected_empty_provenance: number;
    readonly rejected_invalid_evidence_kind: number;
    readonly capped_by: string;
  };
}

// ── Forbidden causal vocabulary (defence-in-depth · founder §12) ─────────
// Templates in this generator produce structured fields only. If any
// candidate somehow accumulates a forbidden causal word (e.g. symbol name
// contains it), the candidate is rejected rather than emitted.
const FORBIDDEN_CAUSAL_TOKENS = [
  "causes",
  "caused by",
  "therefore",
  "responsible for",
  "results in",
  "leads to",
  "because",
  "root cause is",
];

const DEFAULT_MAX_CANDIDATES = 100;
const HARD_MAX_CANDIDATES = 200;
const CONFIDENCE_CEILING = 0.7; // Never HIGH · founder §14 · never above 0.85

// ── Utilities ────────────────────────────────────────────────────────────

function containsForbiddenCausal(text: string): string | null {
  const lower = text.toLowerCase();
  for (const t of FORBIDDEN_CAUSAL_TOKENS) {
    if (lower.includes(t)) return t;
  }
  return null;
}

function stepToEndpoint(step: CompositionStep): CandidateEndpoint {
  return {
    source_file: step.source_file,
    start_line: step.start_line,
    end_line: step.end_line,
    symbol: step.symbol,
    fact_kind: step.fact_kind,
  };
}

/** Compute bounded confidence from composition depth + supporting relationship
 *  count. Never above CONFIDENCE_CEILING · never HIGH · never PROVEN.
 *  This is HYPOTHESIS confidence, not proof confidence. */
function computeHypothesisConfidence(composition: ComposedArgument): number {
  // depth 2 · one relationship pair · base confidence 0.4
  // depth 3+ · slightly higher · never above ceiling
  const base = 0.4 + Math.min(0.05 * (composition.depth - 2), 0.2);
  return Math.min(base, CONFIDENCE_CEILING);
}

// ── Entry point ──────────────────────────────────────────────────────────

export function generateRootCauseCandidates(
  input: GenerateRootCauseCandidatesInput,
): GenerateRootCauseCandidatesResult {
  const maxTotal = Math.min(
    input.max_candidates_total ?? DEFAULT_MAX_CANDIDATES,
    HARD_MAX_CANDIDATES,
  );

  const candidates: RootCauseCandidate[] = [];
  const stats = {
    rejectedForbidden: 0,
    rejectedEmptyProvenance: 0,
    rejectedInvalidEvidenceKind: 0,
  };

  // Preserve input order (Fix 11's compositions are already deterministic)
  const compositions = input.compositions;

  for (const composition of compositions) {
    if (candidates.length >= maxTotal) break;

    // Composition must have depth ≥ 2 (Fix 11 already enforces this · defence-in-depth)
    if (composition.depth < 2) continue;
    if (composition.endpoint_chain.length < 2) continue;

    // First endpoint = candidate root cause (deterministic heuristic · NOT semantic claim)
    // Last endpoint = symptom
    const first = composition.endpoint_chain[0];
    const last = composition.endpoint_chain[composition.endpoint_chain.length - 1];

    const candidateEndpoint = stepToEndpoint(first);
    const symptomEndpoint = stepToEndpoint(last);

    // Deterministic candidate_id · file + first_line + last_line + first_symbol
    const candidateId =
      `${composition.source_file}::candidate::${first.start_line}:${last.start_line}:${first.symbol}`;

    // Forbidden causal vocab check · defence-in-depth · templates should never trigger this
    const scanText = `${candidateEndpoint.symbol} ${symptomEndpoint.symbol}`;
    const forbiddenHit = containsForbiddenCausal(scanText);
    if (forbiddenHit !== null) {
      stats.rejectedForbidden++;
      continue;
    }

    // Empty provenance rejection
    if (composition.provenance.length === 0) {
      stats.rejectedEmptyProvenance++;
      continue;
    }

    const candidate: RootCauseCandidate = {
      candidate_id: candidateId,
      composition_id: composition.composition_id,
      candidate_endpoint: candidateEndpoint,
      symptom_endpoint: symptomEndpoint,
      candidate_reason: "first_endpoint_of_verified_composition",
      evidence_kind: "HYPOTHESIS", // type-locked
      supporting_relationship_ids: composition.relationship_ids,
      provenance: composition.provenance,
      enclosing_function: composition.enclosing_function,
      confidence: computeHypothesisConfidence(composition),
      alternatives: [], // filled in second pass below
    };

    // Runtime defence-in-depth: reject if evidence_kind somehow got mutated
    if ((candidate.evidence_kind as string) !== "HYPOTHESIS") {
      stats.rejectedInvalidEvidenceKind++;
      continue;
    }

    candidates.push(candidate);
  }

  // ── Second pass · populate alternatives per enclosing_function ────────
  // For each candidate, alternatives = candidate_ids from OTHER candidates
  // sharing the same enclosing_function (excluding self). This exposes the
  // hypothesis SET rather than pre-selecting one candidate.
  const byFn = new Map<string, string[]>();
  for (const c of candidates) {
    const key = c.enclosing_function ?? "<file_scope>";
    let bucket = byFn.get(key);
    if (!bucket) {
      bucket = [];
      byFn.set(key, bucket);
    }
    bucket.push(c.candidate_id);
  }

  const candidatesWithAlternatives: RootCauseCandidate[] = candidates.map((c) => {
    const key = c.enclosing_function ?? "<file_scope>";
    const inScope = byFn.get(key) ?? [];
    const alternatives = inScope.filter((id) => id !== c.candidate_id);
    return { ...c, alternatives };
  });

  // Deterministic sort by candidate_id (matches Fix 11 discipline)
  candidatesWithAlternatives.sort((a, b) => a.candidate_id.localeCompare(b.candidate_id));

  return {
    ok: true,
    candidates: candidatesWithAlternatives,
    stats: {
      compositions_seen: compositions.length,
      candidates_emitted: candidatesWithAlternatives.length,
      rejected_forbidden_word: stats.rejectedForbidden,
      rejected_empty_provenance: stats.rejectedEmptyProvenance,
      rejected_invalid_evidence_kind: stats.rejectedInvalidEvidenceKind,
      capped_by: candidatesWithAlternatives.length >= maxTotal
        ? `hit_hard_cap=${maxTotal}`
        : `hard_cap=${maxTotal}`,
    },
  };
}
