// src/lib/nex-agent/code-engine/capability-mb-outcome-quality-recorder.ts
//
// NEX1 · Iteration 2 · mb_outcome_quality recorder wrapper (Ledger B).
//
// PURPOSE
//   Non-invasively record prediction records for mb_outcome_quality
//   without modifying the brain's own reasoning file. Callers who want
//   the prediction persisted use this wrapper; callers who just want the
//   prediction still call the raw brain directly.
//
// MISSION CONSTRAINT (2026-09-18 · Section 2 · Section 3)
//   - Do not modify mb_outcome_quality's reasoning.
//   - features_the_brain_had_at_prediction_time contains ONLY what the
//     brain actually consumed at predict time (mission §3):
//       source_file, j2_response_kind, execution_path_known
//     No other fields.  In particular NOT `mutation_target_line`,
//     NOT `actual_execution_path_line`, NOT any outcome-side field.
//
//   The features here mirror the exact set that
//   `predictFromAccumulatedOutcomes` filters on (j2_response_kind and
//   execution_path_known) plus `source_file` which the brain receives.
//   No engineer-supplied hint about what feature is missing is passed
//   through this wrapper.

import { predictOutcomeQuality, type ProposedActionObservation } from "./capability-mb-outcome-quality";
import { appendPrediction, type PredictionFeatures } from "./capability-prediction-verdict-store";
import type { MicroBrainPrediction } from "./capability-micro-brain";

export interface PredictAndRecordResult {
  readonly prediction: MicroBrainPrediction;
  /** Unique ID · caller must pass this back to recordVerdict when ground truth arrives. */
  readonly entry_id: string;
}

export function predictOutcomeQualityAndRecord(
  observation: ProposedActionObservation,
  repo_root?: string,
): PredictAndRecordResult {
  const prediction = predictOutcomeQuality(observation);
  // ONLY the fields that mb_outcome_quality.predictFromAccumulatedOutcomes
  // ACTUALLY consumes in its filter. source_file is passed in the
  // observation but never read by the brain's reasoning, therefore it
  // must NOT be included here (mission Section 3, Section 25).
  const features: PredictionFeatures = {
    j2_response_kind: observation.data.j2_response_kind,
    execution_path_known: observation.data.execution_path_known,
  };
  const entry_id = appendPrediction({
    brain_id: "mb_outcome_quality",
    features_the_brain_had_at_prediction_time: features,
    prediction_label: prediction.prediction,
    prediction_confidence: prediction.confidence,
    repo_root,
  });
  return { prediction, entry_id };
}

export const MB_OUTCOME_QUALITY_RECORDER_VERSION = "mb-outcome-quality-recorder.v1";
