// src/lib/nex-agent/code-engine/hypothesis/capability-hypothesis-verifier.ts
//
// NEX1 · Hypothesis Verifier · Ledger B substrate.
//
// Takes:
//   · a HypothesisRecord (from the store)
//   · an ExperimentResult (from the sandbox)
//   · a ground_truth value supplied by the experiment runner
//
// Classifies:
//   · SUPPORTED · observed_result matches expected_observation
//   · REJECTED · observed_result matches counterexample_condition
//   · UNRESOLVED · neither matches (inconclusive evidence)
//
// This module does NOT invent ground truth. It compares supplied values.
// It does NOT propose hypotheses.

import { registerAgent, recordHeartbeat } from "../capability-agent-registry";
import { updateHypothesisStatus, type HypothesisRecord, type HypothesisStatus } from "./capability-hypothesis-store";

registerAgent({
  id: "hypothesis_verifier",
  name: "Hypothesis Verifier",
  cognitive_layer: "hypothesis_and_experimentation",
  description: "Compares supplied observed_result and ground_truth against a hypothesis's expected_observation / counterexample_condition. Deterministic string/JSON comparison. Never invents ground truth.",
});

export interface ExperimentResultInput {
  readonly experiment_id: string;
  readonly hypothesis_id: string;
  readonly observed_result: string;        // caller supplies · deterministic value
  readonly ground_truth: string;           // caller supplies · deterministic value
}

export interface VerifierVerdict {
  readonly hypothesis_id: string;
  readonly experiment_id: string;
  readonly status: HypothesisStatus;
  readonly reasoning: string;
  readonly observed_result: string;
  readonly ground_truth: string;
}

export function verifyHypothesis(
  hypothesis: HypothesisRecord,
  experiment: ExperimentResultInput,
  repo_root?: string,
): VerifierVerdict {
  const observed = experiment.observed_result.trim();
  const truth = experiment.ground_truth.trim();
  let status: HypothesisStatus;
  let reasoning: string;

  const supportsExpected = observed === hypothesis.expected_observation.trim();
  const matchesCounterexample = observed === hypothesis.counterexample_condition.trim();

  if (supportsExpected && observed === truth) {
    status = "SUPPORTED";
    reasoning = "observed_result equals expected_observation AND equals ground_truth";
  } else if (matchesCounterexample) {
    status = "REJECTED";
    reasoning = "observed_result equals counterexample_condition";
  } else if (observed !== truth) {
    status = "REJECTED";
    reasoning = "observed_result does not match ground_truth";
  } else {
    status = "UNRESOLVED";
    reasoning = "observed_result matches ground_truth but does not match either the expected_observation or the counterexample_condition · verifier cannot conclude";
  }

  updateHypothesisStatus(hypothesis.hypothesis_id, status, repo_root);
  recordHeartbeat({
    agent_id: "hypothesis_verifier",
    event_type: "verify",
    event_data: { hypothesis_id: hypothesis.hypothesis_id, experiment_id: experiment.experiment_id, status },
  });

  return {
    hypothesis_id: hypothesis.hypothesis_id,
    experiment_id: experiment.experiment_id,
    status,
    reasoning,
    observed_result: observed,
    ground_truth: truth,
  };
}

export const HYPOTHESIS_VERIFIER_VERSION = "hypothesis-verifier.v1";
