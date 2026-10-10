// src/lib/nex-agent/code-engine/hypothesis/capability-hypothesis-aware-prediction.ts
//
// NEX1 · Hypothesis-Aware Prediction (additive · Ledger B wiring).
//
// PURPOSE
//   Wraps predictWithReflection with an additional consultation step:
//   at prediction time, check the hypothesis store for any SUPPORTED
//   hypotheses that apply to the current observation's feature-cell.
//   If a SUPPORTED hypothesis about "cell has mixed outcomes" is
//   applicable AND the current cell in accumulated evidence actually
//   has mixed outcomes, attenuate confidence and emit a signal.
//
// HONEST DISCLOSURE
//   · The wiring (which hypothesis is applicable to which observation)
//     is Claude-authored. Ledger B.
//   · The DECISION (attenuate confidence, emit signal) is Claude-authored.
//     Ledger B.
//   · The RESULT (the specific attenuation, the specific signal on this
//     observation) is data-derived from NEX's own accumulated evidence.
//   · Nothing predetermined about the current observation is used.
//
// This is analogous to Iteration 4 · ε's reflection-aware-prediction:
// engineered wrapper, NEX-derived outputs.

import { registerAgent, recordHeartbeat } from "../capability-agent-registry";
import { predictWithReflection, type ReflectionAwareEnvelope } from "../capability-reflection-aware-prediction";
import { loadAllHypotheses, type HypothesisRecord } from "./capability-hypothesis-store";
import { loadAllVerdicts } from "../capability-prediction-verdict-store";
import { cellKey } from "../capability-representation-cell-audit";
import type { ProposedActionObservation } from "../capability-mb-outcome-quality";

registerAgent({
  id: "hypothesis_aware_prediction",
  name: "Hypothesis-Aware Prediction Wrapper",
  cognitive_layer: "hypothesis_and_experimentation",
  description: "Wraps reflection-aware-prediction. Consults the hypothesis store for SUPPORTED hypotheses about mixed-outcome cells. If the current observation's cell actually has mixed outcomes in accumulated evidence, applies the hypothesis: attenuates confidence and emits signal. Additive · no production path modified.",
});

const HYPOTHESIS_ATTENUATION = 0.5;
const MIN_CONFIDENCE_FLOOR = 0.05;

export interface HypothesisAwareEnvelope extends ReflectionAwareEnvelope {
  readonly hypothesis_applied: boolean;
  readonly applied_hypothesis_id: string | null;
  readonly hypothesis_signal: null | "supported_hypothesis_applies_to_this_observation";
  readonly confidence_before_hypothesis: number;
  readonly confidence_after_hypothesis: number;
  readonly cell_key_at_prediction: string;
  readonly cell_matched_count: number;
  readonly cell_failed_count: number;
  readonly cell_outcomes_uniform: boolean;
}

export function predictWithHypothesisAwareness(observation: ProposedActionObservation, repo_root?: string): HypothesisAwareEnvelope {
  // Step 1 · run the existing reflection-aware prediction (Iter 4 · ε machinery unchanged)
  const reflAware = predictWithReflection(observation, repo_root);

  // Step 2 · compute the current observation's cell key based on the SAME
  //          features the brain saw (matches how reflection-aware works).
  const currentCellKey = cellKey({
    j2_response_kind: observation.data.j2_response_kind,
    execution_path_known: observation.data.execution_path_known,
  });

  // Step 3 · check accumulated verdict corpus: does this cell CURRENTLY
  //          have mixed outcomes in NEX's own experience?
  const allVerdicts = loadAllVerdicts(repo_root);
  const cellVerdicts = allVerdicts.filter((v) =>
    cellKey(v.features_the_brain_had_at_prediction_time) === currentCellKey,
  );
  const cellMatched = cellVerdicts.filter((v) => v.matched === true).length;
  const cellFailed = cellVerdicts.filter((v) => v.matched === false).length;
  const cellUniform = !(cellMatched > 0 && cellFailed > 0);

  // Step 4 · check hypothesis store for SUPPORTED hypotheses about mixed cells
  const hypotheses = loadAllHypotheses(repo_root);
  // Match by the neurologist's observation_pattern kind. This is a structural
  // token match — Claude does not encode the meaning of the pattern here.
  const relevant = hypotheses.filter((h) =>
    h.status === "SUPPORTED" &&
    h.observation_pattern === "same_observed_representation_different_outcomes"
  );

  let cBefore = reflAware.confidence_after_reflection;
  let cAfter = cBefore;
  let signal: HypothesisAwareEnvelope["hypothesis_signal"] = null;
  let appliedId: string | null = null;
  let applied = false;

  // Application rule · exact wiring (single line):
  //   apply IF a SUPPORTED "mixed outcomes" hypothesis exists AND the
  //   current cell actually has mixed outcomes in accumulated evidence.
  if (relevant.length > 0 && !cellUniform) {
    cAfter = Math.max(MIN_CONFIDENCE_FLOOR, cBefore * HYPOTHESIS_ATTENUATION);
    signal = "supported_hypothesis_applies_to_this_observation";
    appliedId = relevant[0].hypothesis_id;
    applied = true;
  }

  recordHeartbeat({
    agent_id: "hypothesis_aware_prediction",
    event_type: "predict_with_hypothesis_awareness",
    event_data: {
      cell_key: currentCellKey,
      cell_matched: cellMatched,
      cell_failed: cellFailed,
      cell_uniform: cellUniform,
      applied,
      applied_hypothesis_id: appliedId,
      conf_before: cBefore,
      conf_after: cAfter,
    },
  });

  return {
    ...reflAware,
    hypothesis_applied: applied,
    applied_hypothesis_id: appliedId,
    hypothesis_signal: signal,
    confidence_before_hypothesis: cBefore,
    confidence_after_hypothesis: cAfter,
    cell_key_at_prediction: currentCellKey,
    cell_matched_count: cellMatched,
    cell_failed_count: cellFailed,
    cell_outcomes_uniform: cellUniform,
  };
}

export const HYPOTHESIS_AWARE_PREDICTION_VERSION = "hypothesis-aware-prediction.v1";
