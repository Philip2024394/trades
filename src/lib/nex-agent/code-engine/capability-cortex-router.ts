// src/lib/nex-agent/code-engine/capability-cortex-router.ts
//
// NEX1 · Cortex Router · Founder-authorised 2026-09-18.
//
// PURPOSE
//   Broadcast one observation to N micro-brains, collect their predictions,
//   compute deterministic consensus/disagreement, return an aggregate.
//   Analogue: thalamic broadcasting + cortical column voting.
//
//   Zero LLM. Deterministic. Pure function of the supplied brains and
//   observation. Never authoritative — output is INFERRED.

import type {
  MicroBrain,
  MicroBrainObservation,
  MicroBrainPrediction,
} from "./capability-micro-brain";
import { recordHeartbeat } from "./capability-agent-registry";

export type CortexConsensus =
  | "UNANIMOUS_SAME_PREDICTION"
  | "MAJORITY_AGREES"
  | "DISAGREEMENT_PRESERVED"
  | "SINGLE_RESPONDER"
  | "NO_RESPONSE";

export interface CortexBroadcastResult {
  readonly observation: MicroBrainObservation;
  readonly predictions: readonly MicroBrainPrediction[];
  readonly responders: number;
  readonly non_null_predictions: number;
  readonly consensus: CortexConsensus;
  readonly majority_value: string | number | boolean | null;
  readonly disagreement_count: number;
  readonly evidence_kind: "INFERRED";
  readonly r11b_marker: "CORTEX_AGGREGATE_MUST_NOT_ENTER_R4_SUPPORTING_COUNT";
}

const R11B: "CORTEX_AGGREGATE_MUST_NOT_ENTER_R4_SUPPORTING_COUNT" =
  "CORTEX_AGGREGATE_MUST_NOT_ENTER_R4_SUPPORTING_COUNT";

/** Broadcast to every brain, collect predictions, aggregate deterministically. */
export function broadcastToBrains(
  brains: readonly MicroBrain<MicroBrainObservation>[],
  observation: MicroBrainObservation,
): CortexBroadcastResult {
  const predictions: MicroBrainPrediction[] = [];
  for (const b of brains) {
    // Deterministic order · caller controls sequence.
    b.observe(observation);
    const p = b.predict(observation);
    predictions.push(p);
  }
  const non_null = predictions.filter((p) => p.prediction !== null);
  const responders = predictions.length;
  const non_null_predictions = non_null.length;

  // Tally values (stringified for deterministic comparison).
  const tally = new Map<string, number>();
  for (const p of non_null) {
    const key = JSON.stringify(p.prediction);
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }

  let majority_value: string | number | boolean | null = null;
  let disagreement_count = 0;
  let consensus: CortexConsensus = "NO_RESPONSE";

  if (non_null_predictions === 0) {
    consensus = "NO_RESPONSE";
  } else if (non_null_predictions === 1) {
    consensus = "SINGLE_RESPONDER";
    majority_value = non_null[0].prediction;
  } else {
    // Find the highest-count value deterministically (tie → JSON-lex order).
    let bestKey: string | null = null;
    let bestCount = 0;
    const sortedKeys = Array.from(tally.keys()).sort();
    for (const k of sortedKeys) {
      const c = tally.get(k)!;
      if (c > bestCount) { bestCount = c; bestKey = k; }
    }
    if (bestKey !== null) {
      majority_value = JSON.parse(bestKey) as string | number | boolean | null;
    }
    disagreement_count = tally.size;
    if (tally.size === 1) {
      consensus = "UNANIMOUS_SAME_PREDICTION";
    } else if (bestCount > non_null_predictions / 2) {
      consensus = "MAJORITY_AGREES";
    } else {
      consensus = "DISAGREEMENT_PRESERVED";
    }
  }

  recordHeartbeat({
    agent_id: "cortex_router",
    event_type: "broadcast",
    event_data: {
      responders,
      non_null_predictions,
      consensus,
      majority_value,
      disagreement_count,
      observation_kind: observation.kind,
    },
  });

  return {
    observation,
    predictions,
    responders,
    non_null_predictions,
    consensus,
    majority_value,
    disagreement_count,
    evidence_kind: "INFERRED",
    r11b_marker: R11B,
  };
}

export const CORTEX_ROUTER_VERSION = "cortex.v1";
