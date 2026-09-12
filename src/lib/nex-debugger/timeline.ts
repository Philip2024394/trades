// src/lib/nex-debugger/timeline.ts
//
// NEX Debugger · failure timeline + first-divergence detector (C-5).
// Deterministic serialisation. No LLM. No network.

import { createHash } from "node:crypto";
import type { FailureTimeline, StateStep, FailureEvent, FirstDivergence } from "./types";
import type { ReproductionObservation } from "./reproducer";

function sha256Prefix(s: string): string { return createHash("sha256").update(s).digest("hex").slice(0, 16); }

export interface BuildTimelineInput {
  readonly session_id: string;
  readonly input: unknown;
  readonly seed: string;
  readonly observation: ReproductionObservation;
  readonly expected_timeline?: readonly { readonly step_index: number; readonly expected_state_hash: string; readonly note?: string }[];
  readonly first_run_hash: string;
  readonly second_run_hash: string;
}

export function buildTimeline(i: BuildTimelineInput): FailureTimeline {
  const ops = i.observation.step_operations ?? [];
  const stateHashes = i.observation.step_state_hashes ?? [];
  const steps: StateStep[] = [];
  for (let idx = 0; idx < ops.length; idx++) {
    const before = idx === 0 ? sha256Prefix("initial:" + JSON.stringify(i.input)) : stateHashes[idx - 1] ?? "";
    const after = stateHashes[idx] ?? "";
    const expected = i.expected_timeline?.find((e) => e.step_index === idx);
    const diff = expected && expected.expected_state_hash !== after
      ? `expected=${expected.expected_state_hash} · actual=${after}`
      : undefined;
    steps.push({
      step_index: idx,
      operation: ops[idx],
      state_before_hash: before,
      state_after_hash: after,
      diff_from_expected: diff,
      notes: expected?.note,
    });
  }

  const failure: FailureEvent = {
    step_index: i.observation.failure_step_index ?? Math.max(0, ops.length - 1),
    kind: i.observation.kind,
    observed_output: i.observation.observed_output,
    stack_trace_hash: i.observation.stack_trace_hash,
  };

  // First divergence: earliest step whose actual state hash disagrees with expected.
  let first_divergence: FirstDivergence | null = null;
  if (i.expected_timeline && i.expected_timeline.length > 0) {
    for (const step of steps) {
      const expected = i.expected_timeline.find((e) => e.step_index === step.step_index);
      if (!expected) continue;
      if (expected.expected_state_hash !== step.state_after_hash) {
        first_divergence = {
          step_index: step.step_index,
          expected_state_hash: expected.expected_state_hash,
          actual_state_hash: step.state_after_hash,
          diff_description: `first divergence at step ${step.step_index} · operation="${step.operation}"`,
        };
        break;
      }
    }
  }

  return {
    session_id: i.session_id,
    input_hash: sha256Prefix(JSON.stringify(i.input)),
    seed: i.seed,
    steps,
    failure,
    first_divergence,
    determinism_witness: {
      first_run_hash: i.first_run_hash,
      second_run_hash: i.second_run_hash,
      identical: i.first_run_hash === i.second_run_hash,
    },
  };
}
