// src/lib/nex-agent/code-engine/capability-mb-outcome-quality.ts
//
// NEX1 · Cycle 4 · Phase B · mb_outcome_quality micro-brain (Ledger B).
// Founder-authorised 2026-09-18 as Ledger B engineering.
//
// PURPOSE
//   A new micro-brain that reads the outcome-experience store and predicts,
//   before a coding action is taken, whether the proposed action's shape
//   family has a track record of matching the correct execution path.
//
//   The algorithm is hand-authored (Ledger B). The specific predictions
//   are DATA-DERIVED from accumulated outcome-experience entries — so if
//   the store contains 10 wrong-branch outcomes for a shape family and 2
//   correct-target outcomes, the brain predicts "risky." Same code, no
//   accumulated evidence → prediction is "unknown."
//
// CONSTITUTIONAL PRESERVATION
//   - Zero LLM. Deterministic. R11-B preserved.
//   - Never authoritative. Prediction is informational only.
//   - Predictions carry evidence_kind: "INFERRED".
//   - The brain does NOT modify code, does not vote on decisions, does
//     not gate promotions. Consumers may consult its output.

import type { MicroBrain, MicroBrainObservation, MicroBrainPrediction } from "./capability-micro-brain";
import { createMicroBrain } from "./capability-micro-brain";
import { loadAllOutcomes, extractOutcomeFeatures } from "./capability-outcome-experience";

// ── Public shape ────────────────────────────────────────────────────────

export type OutcomeSafetyPrediction =
  | "safe_by_prior_evidence"
  | "risky_by_prior_evidence"
  | "unknown_no_prior_evidence";

// ── Rule table (Ledger B) · thresholds derived from empirical intuition ─
//
// Not hardcoded outcomes. These are threshold parameters the algorithm
// uses to CATEGORISE what the data says. If the founder wants to tune
// thresholds later, they live here in one place.
const MIN_PRIORS_FOR_PREDICTION = 2;
const RISKY_THRESHOLD = 0.5; // fraction of priors with correct target < 0.5 → risky
const SAFE_THRESHOLD = 0.75;  // fraction of priors with correct target ≥ 0.75 → safe

// ── Runtime observation shape ──────────────────────────────────────────

export interface ProposedActionObservation extends MicroBrainObservation {
  readonly kind: "proposed_action";
  readonly data: {
    readonly source_file: string; // e.g. "src/lib/foo/bar.ts"
    readonly j2_response_kind: "proposal" | "refusal" | "no_signal";
    readonly execution_path_known: boolean;
    readonly repo_root?: string;
  };
}

// ── The core prediction · data-driven ──────────────────────────────────
//
// Given a proposed action, look at accumulated outcome-experience entries
// with matching shape features (excluding `mutation_targets_execution_path`
// which is what we're PREDICTING). Compute the empirical success rate.
// Return safe/risky/unknown based on threshold.

function predictFromAccumulatedOutcomes(
  observation: ProposedActionObservation,
): { prediction: OutcomeSafetyPrediction; support_count: number; success_fraction: number | null; rule_hits: string[] } {
  const repo_root = observation.data.repo_root;
  const outcomes = loadAllOutcomes(repo_root);

  if (outcomes.length === 0) {
    return {
      prediction: "unknown_no_prior_evidence",
      support_count: 0,
      success_fraction: null,
      rule_hits: ["no_outcome_evidence_at_all"],
    };
  }

  // Match dimensions · deliberately EXCLUDE mutation_targets_execution_path
  // because that is exactly what we are trying to predict.
  //
  // Match on: j2_response_kind + execution_path_known.
  //
  // This is a genuine data-driven filter: same-shape past outcomes only.
  const matched = outcomes.filter((e) => {
    const f = extractOutcomeFeatures(e);
    return (
      f.j2_response_kind === observation.data.j2_response_kind &&
      f.execution_path_known === observation.data.execution_path_known
    );
  });

  if (matched.length < MIN_PRIORS_FOR_PREDICTION) {
    return {
      prediction: "unknown_no_prior_evidence",
      support_count: matched.length,
      success_fraction: null,
      rule_hits: [`below_min_priors_threshold_${MIN_PRIORS_FOR_PREDICTION}`],
    };
  }

  // Compute fraction of matched priors whose mutation actually targeted
  // the executed path.
  const withMutation = matched.filter((e) => e.mutation_applied);
  if (withMutation.length === 0) {
    return {
      prediction: "unknown_no_prior_evidence",
      support_count: 0,
      success_fraction: null,
      rule_hits: ["no_mutation_outcomes_in_match_set"],
    };
  }
  const correctTarget = withMutation.filter((e) => e.mutation_target_matches_execution_path === true).length;
  const fraction = correctTarget / withMutation.length;

  let prediction: OutcomeSafetyPrediction;
  const hits: string[] = [];
  if (fraction < RISKY_THRESHOLD) {
    prediction = "risky_by_prior_evidence";
    hits.push(`fraction_${fraction.toFixed(2)}_below_${RISKY_THRESHOLD}`);
  } else if (fraction >= SAFE_THRESHOLD) {
    prediction = "safe_by_prior_evidence";
    hits.push(`fraction_${fraction.toFixed(2)}_at_or_above_${SAFE_THRESHOLD}`);
  } else {
    prediction = "unknown_no_prior_evidence";
    hits.push(`fraction_${fraction.toFixed(2)}_between_thresholds`);
  }
  return {
    prediction,
    support_count: withMutation.length,
    success_fraction: fraction,
    rule_hits: hits,
  };
}

// ── Assemble the MicroBrain instance ──────────────────────────────────

export const mb_outcome_quality: MicroBrain<ProposedActionObservation> = createMicroBrain<ProposedActionObservation>({
  id: "mb_outcome_quality",
  name: "μBrain · outcome quality predictor (Cycle 4 · Ledger B)",
  domain: "outcome_quality_prediction",
  cognitive_layer: "procedural_memory",
  description:
    "Predicts safety of a proposed coding action based on frequency of prior outcomes with matching shape whose mutations actually hit the executed line. Data-driven confidence; hand-authored thresholds.",
  rulebook: [
    {
      id: "outcome_quality_from_priors",
      matches: (obs) => obs.kind === "proposed_action",
      predict: (obs) => {
        const r = predictFromAccumulatedOutcomes(obs as ProposedActionObservation);
        // Encode confidence: higher confidence when more priors + more decisive fraction.
        const confidence = r.support_count === 0
          ? 0
          : Math.min(0.99, 0.4 + Math.min(0.4, r.support_count * 0.05) + Math.abs((r.success_fraction ?? 0.5) - 0.5) * 0.4);
        return {
          value: r.prediction,
          confidence: Math.round(confidence * 100) / 100,
        };
      },
    },
  ],
});

export function predictOutcomeQuality(
  observation: ProposedActionObservation,
): MicroBrainPrediction {
  return mb_outcome_quality.predict(observation);
}

export const MB_OUTCOME_QUALITY_VERSION = "mb-outcome-quality.v1";
export const _INTERNAL = { MIN_PRIORS_FOR_PREDICTION, RISKY_THRESHOLD, SAFE_THRESHOLD };
