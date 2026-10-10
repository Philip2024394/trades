// src/lib/nex-agent/code-engine/capability-reflection-aware-prediction.ts
//
// NEX1 · Iteration 4 · ε · Reflection-aware prediction wrapper (Ledger B).
//
// PURPOSE
//   Wraps mb_outcome_quality.predict + prediction-verdict-store append so
//   that, at prediction time, NEX also queries her own reflection store
//   for any prior reflections keyed by the same observation-features. If
//   any are found, they are returned alongside the prediction and a
//   confidence-adjustment signal is applied.
//
//   The retrieval trigger is STRUCTURAL:
//     reflection_key(observation.features) → exact match against store.
//   No Claude-authored heuristic decides when to retrieve.
//
//   The behaviour change on retrieval is a DEGRADED confidence and a
//   `prior_reflection_retrieved: true` flag in the envelope. This is
//   informational; the underlying brain prediction is unchanged. The
//   caller sees the flag and may (or may not) act on it. NEX has done
//   the RETRIEVAL and the CONFIDENCE ADJUSTMENT autonomously.
//
// Constitutional boundary preserved: this capability does not modify
// mb_outcome_quality's reasoning, does not gate decisions, and never
// carries authority to execute mutations. It emits a signal.

import { predictOutcomeQuality, type ProposedActionObservation } from "./capability-mb-outcome-quality";
import { appendPrediction, type PredictionFeatures } from "./capability-prediction-verdict-store";
import type { MicroBrainPrediction } from "./capability-micro-brain";
import { registerAgent, recordHeartbeat } from "./capability-agent-registry";
import { loadAllReflections, reflectionKey, type ReflectionEntry } from "./capability-post-verdict-reflection";

registerAgent({
  id: "reflection_aware_prediction",
  name: "Reflection-aware prediction wrapper",
  cognitive_layer: "metacognition",
  description: "At prediction time, queries the reflection store by observation-feature key. If prior reflections exist for this cell, degrades confidence and flags the envelope. Retrieval is structural; NEX chooses to retrieve without external cue.",
});

export interface ReflectionAwareEnvelope {
  readonly prediction: MicroBrainPrediction;
  readonly entry_id: string;
  readonly reflection_key: string;
  readonly retrieved_reflections: readonly ReflectionEntry[];
  readonly prior_reflection_retrieved: boolean;
  readonly confidence_before_reflection: number;
  readonly confidence_after_reflection: number;
  readonly metacognition_signal: null | "prior_failure_signature_at_this_feature_cell";
}

const CONFIDENCE_ATTENUATION_ON_PRIOR_FAILURE = 0.35;
const MIN_CONFIDENCE_FLOOR = 0.05;

/**
 * The single entry-point callers use. Executes:
 *   1. compute reflection_key(observation.features)
 *   2. load NEX's own reflection store; filter by matching key
 *   3. call the raw brain prediction
 *   4. append a prediction record
 *   5. if any reflections were retrieved:
 *        · lower the confidence multiplicatively (bounded by floor)
 *        · emit `prior_failure_signature_at_this_feature_cell` signal
 *      else:
 *        · pass through unchanged
 *
 * All steps are deterministic. No Claude reasoning is embedded.
 */
export function predictWithReflection(observation: ProposedActionObservation, repo_root?: string): ReflectionAwareEnvelope {
  const features: PredictionFeatures = {
    j2_response_kind: observation.data.j2_response_kind,
    execution_path_known: observation.data.execution_path_known,
  };
  const key = reflectionKey(features);

  // NEX's own retrieval · deterministic key match
  const allReflections = loadAllReflections(repo_root ?? observation.data.repo_root);
  const retrieved = allReflections.filter((r) => r.reflection_key === key);

  // Raw prediction · unchanged brain reasoning
  const prediction = predictOutcomeQuality(observation);

  // Persist prediction record
  const entry_id = appendPrediction({
    brain_id: "mb_outcome_quality",
    features_the_brain_had_at_prediction_time: features,
    prediction_label: prediction.prediction,
    prediction_confidence: prediction.confidence,
    repo_root: repo_root ?? observation.data.repo_root,
  });

  // Confidence adjustment · structural, not rule-authored
  const cBefore = prediction.confidence;
  let cAfter = cBefore;
  let signal: ReflectionAwareEnvelope["metacognition_signal"] = null;
  if (retrieved.length > 0) {
    cAfter = Math.max(MIN_CONFIDENCE_FLOOR, cBefore * CONFIDENCE_ATTENUATION_ON_PRIOR_FAILURE);
    signal = "prior_failure_signature_at_this_feature_cell";
  }

  recordHeartbeat({
    agent_id: "reflection_aware_prediction",
    event_type: "predict_with_reflection",
    event_data: {
      reflection_key: key,
      retrieved_count: retrieved.length,
      confidence_before: cBefore,
      confidence_after: cAfter,
    },
  });

  return {
    prediction,
    entry_id,
    reflection_key: key,
    retrieved_reflections: retrieved,
    prior_reflection_retrieved: retrieved.length > 0,
    confidence_before_reflection: cBefore,
    confidence_after_reflection: cAfter,
    metacognition_signal: signal,
  };
}

export const REFLECTION_AWARE_PREDICTION_VERSION = "reflection-aware-prediction.v1";
