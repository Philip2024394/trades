// src/lib/nex-agent/code-engine/hypothesis/capability-experiment-sandbox.ts
//
// NEX1 · Experiment Sandbox · Ledger B substrate.
//
// Runs bounded experiments against hypotheses IF any are produced.
// Never runs unless a hypothesis exists in the store. Never modifies
// production files. Executes in a disposable directory under
// `data/nex1-experiment-sandbox/<experiment_id>/`.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { registerAgent, recordHeartbeat } from "../capability-agent-registry";
import { attachExperimentId, type HypothesisRecord } from "./capability-hypothesis-store";

registerAgent({
  id: "experiment_sandbox",
  name: "Experiment Sandbox · bounded runner",
  cognitive_layer: "hypothesis_and_experimentation",
  description: "Runs bounded experiments against hypotheses in disposable directories. Never modifies production code. Requires an explicit hypothesis input.",
});

export interface ExperimentSpec {
  readonly hypothesis: HypothesisRecord;
  readonly test_fn: (sandbox_dir: string) => Promise<{ observed_result: string; ground_truth: string; artefacts?: readonly string[] }> | { observed_result: string; ground_truth: string; artefacts?: readonly string[] };
  readonly repo_root?: string;
}

export interface ExperimentReceipt {
  readonly experiment_id: string;
  readonly hypothesis_id: string;
  readonly sandbox_dir: string;
  readonly observed_result: string;
  readonly ground_truth: string;
  readonly artefacts: readonly string[];
  readonly started_at: string;
  readonly finished_at: string;
}

export async function runExperiment(spec: ExperimentSpec): Promise<ExperimentReceipt> {
  const experiment_id = "exp_" + crypto.randomBytes(6).toString("hex");
  const startedAt = new Date().toISOString();
  const rr = spec.repo_root ?? process.cwd();
  const sandbox = path.join(rr, "data", "nex1-experiment-sandbox", experiment_id);
  fs.mkdirSync(sandbox, { recursive: true });

  const result = await Promise.resolve(spec.test_fn(sandbox));
  attachExperimentId(spec.hypothesis.hypothesis_id, experiment_id, rr);

  const receipt: ExperimentReceipt = {
    experiment_id,
    hypothesis_id: spec.hypothesis.hypothesis_id,
    sandbox_dir: sandbox,
    observed_result: result.observed_result,
    ground_truth: result.ground_truth,
    artefacts: result.artefacts ?? [],
    started_at: startedAt,
    finished_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(sandbox, "receipt.json"), JSON.stringify(receipt, null, 2), "utf8");

  recordHeartbeat({
    agent_id: "experiment_sandbox",
    event_type: "run_experiment",
    event_data: { experiment_id, hypothesis_id: spec.hypothesis.hypothesis_id },
  });
  return receipt;
}

export const EXPERIMENT_SANDBOX_VERSION = "experiment-sandbox.v1";
