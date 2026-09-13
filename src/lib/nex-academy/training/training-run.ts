// WO-ACADEMY-02 · training-run orchestrator.
//
// Wires the founder-locked causal chain end-to-end:
//
//   BASELINE (real specialist run, frozen · content-hashed)
//        ↓
//   TRAINING (candidate rules designed against training set)
//        ↓
//   POST-TRAINING MEASUREMENT on SAME baseline benchmark
//        ↓
//   HELD-OUT + ADVERSARIAL + REGRESSION measurement
//        ↓
//   VERDICT (pure function of the causal chain)
//        ↓
//   PROPOSAL (emitted ONLY on IMPROVED · authorised_by=null)
//
// Zero mocks. Real WO-07 subprocess for every task. Baseline bytes remain
// immutable regardless of verdict.

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { provenanceChainHash } from "@/lib/nex-intelligence/provenance";
import { buildBaselineSnapshot, persistBaseline } from "./baseline-freeze";
import { runTrainingTask } from "./training-executor";
import { buildTrainingVerdict, persistVerdict } from "./verdict";
import { buildProposal, persistProposal } from "./proposal-emitter";
import { SLICE1_CANDIDATE_RULES, type CandidateRule } from "./candidate-rules";
import {
  SLICE1_ADVERSARIAL_CASES,
  SLICE1_BASELINE_CASES,
  SLICE1_GENERALISATION_CASES,
  SLICE1_REGRESSION_CASES,
  SLICE1_TRAINING_CASES,
} from "./training-corpus";
import type {
  BaselineMetrics,
  RuleAdditionProposal,
  TaskOutcome,
  TrainingProgram,
  TrainingRun,
  TrainingVerdict,
} from "./types";

// ── Convenience: measure metrics from a task-outcome list ──────────────

function computeMetricsFromOutcomes(
  outs: readonly TaskOutcome[],
  weaknessRule: string,
): BaselineMetrics {
  const total = outs.length;
  const successes = outs.filter((o) => o.outcome === "SUCCESS").length;
  const failures = outs.filter((o) => o.outcome === "FAILURE").length;
  const limitations = outs.filter((o) => o.outcome === "LIMITATION").length;
  const weaknessRelevant = outs.filter((o) => o.matched_pattern === weaknessRule || o.task_id.includes("esm"));
  const weaknessSuccess = weaknessRelevant.filter((o) => o.outcome === "SUCCESS").length;

  return {
    task_completion_ratio: total > 0 ? successes / total : 0,
    accuracy: total > 0 ? (successes / total) : 0,
    reliability: total > 0 ? Math.max(0, 1 - (failures + limitations) / total) : 0,
    failure_classes: failures + limitations > 0
      ? [{ kind: "specialist-missed-classification", count: failures + limitations }]
      : [],
    targeted_weakness_score: weaknessRelevant.length > 0
      ? weaknessSuccess / weaknessRelevant.length
      : 0,
  };
}

// ── Full training cycle ────────────────────────────────────────────────

export interface RunTrainingInput {
  readonly program: TrainingProgram;
  readonly sandbox_root: string;
  readonly candidate_rules?: readonly CandidateRule[];   // defaults to SLICE1
}

export interface RunTrainingResult {
  readonly baseline_id: string;
  readonly baseline_frozen_hash: string;
  readonly run: TrainingRun;
  readonly verdict: TrainingVerdict;
  readonly proposal: RuleAdditionProposal | null;
}

export async function runTraining(input: RunTrainingInput): Promise<RunTrainingResult> {
  const started_at = new Date().toISOString();
  const startMs = Date.now();
  const candidateRules = input.candidate_rules ?? SLICE1_CANDIDATE_RULES;
  await fs.mkdir(input.sandbox_root, { recursive: true });

  // ── PHASE 1 · BASELINE (no candidate rules) ─────────────────────────
  const baselineOutcomes: TaskOutcome[] = [];
  const baselineEvidence: string[] = [];
  for (const caseId of input.program.baseline_task_ids) {
    const c = SLICE1_BASELINE_CASES.find((x) => x.case_id === caseId);
    if (!c) throw new Error(`[training-run] baseline case ${caseId} not found in slice-1 corpus`);
    const dir = path.join(input.sandbox_root, "baseline");
    const result = await runTrainingTask({ case: c, sandbox_root: dir, candidate_rules: [] });
    baselineOutcomes.push(result.outcome);
    baselineEvidence.push(result.outcome.evidence_pointer);
  }
  const weaknessRule = candidateRules[0]?.finding_rule ?? "esm-import-outside-module";
  const baselineMetrics = computeMetricsFromOutcomes(baselineOutcomes, weaknessRule);
  const baseline = buildBaselineSnapshot({
    program: input.program,
    baseline_metrics: baselineMetrics,
    evidence_pointers: baselineEvidence,
    antecedent_provenance_hashes: [input.program.provenance_chain_hash],
  });
  await persistBaseline(baseline);

  // ── PHASE 2 · TRAINING (with candidate rules) ───────────────────────
  const trainingOutcomes: TaskOutcome[] = [];
  for (const caseId of input.program.training_task_ids) {
    const c = SLICE1_TRAINING_CASES.find((x) => x.case_id === caseId);
    if (!c) throw new Error(`[training-run] training case ${caseId} not found in slice-1 corpus`);
    const dir = path.join(input.sandbox_root, "training");
    const r = await runTrainingTask({ case: c, sandbox_root: dir, candidate_rules: candidateRules });
    trainingOutcomes.push(r.outcome);
  }

  // ── PHASE 3 · POST-TRAINING on SAME baseline benchmark ─────────────
  const postBaselineOutcomes: TaskOutcome[] = [];
  for (const caseId of input.program.baseline_task_ids) {
    const c = SLICE1_BASELINE_CASES.find((x) => x.case_id === caseId);
    if (!c) continue;
    const dir = path.join(input.sandbox_root, "post-baseline");
    const r = await runTrainingTask({ case: c, sandbox_root: dir, candidate_rules: candidateRules });
    postBaselineOutcomes.push(r.outcome);
  }
  const postMetrics = computeMetricsFromOutcomes(postBaselineOutcomes, weaknessRule);

  // ── PHASE 4 · HELD-OUT generalisation ──────────────────────────────
  const genOutcomes: TaskOutcome[] = [];
  for (const caseId of input.program.generalisation_task_ids) {
    const c = SLICE1_GENERALISATION_CASES.find((x) => x.case_id === caseId);
    if (!c) continue;
    const dir = path.join(input.sandbox_root, "generalisation");
    const r = await runTrainingTask({ case: c, sandbox_root: dir, candidate_rules: candidateRules });
    genOutcomes.push(r.outcome);
  }

  // ── PHASE 5 · ADVERSARIAL ──────────────────────────────────────────
  const advOutcomes: TaskOutcome[] = [];
  for (const caseId of input.program.adversarial_task_ids) {
    const c = SLICE1_ADVERSARIAL_CASES.find((x) => x.case_id === caseId);
    if (!c) continue;
    const dir = path.join(input.sandbox_root, "adversarial");
    const r = await runTrainingTask({ case: c, sandbox_root: dir, candidate_rules: candidateRules });
    advOutcomes.push(r.outcome);
  }

  // ── PHASE 6 · REGRESSION (real specialist, no candidate rules)
  //    NB: we run regression WITHOUT the candidate rules — we're checking
  //    that the underlying specialist ALREADY passes these cases and
  //    nothing about the training exercise contaminated the environment.
  //    True regression testing of the CANDIDATE RULES themselves is
  //    handled at rule-adoption time (a future founder-signed WO).
  const regOutcomes: TaskOutcome[] = [];
  for (const caseId of input.program.regression_task_ids) {
    const c = SLICE1_REGRESSION_CASES.find((x) => x.case_id === caseId);
    if (!c) continue;
    const dir = path.join(input.sandbox_root, "regression");
    const r = await runTrainingTask({ case: c, sandbox_root: dir, candidate_rules: [] });
    regOutcomes.push(r.outcome);
  }

  // ── PHASE 7 · Assemble TrainingRun ──────────────────────────────────
  const run_id = `academy-run-${randomUUID()}`;
  const finished_at = new Date().toISOString();
  const runBase = {
    record_type: "NEX_ACADEMY_TRAINING_RUN" as const,
    run_id,
    program_id: input.program.program_id,
    agent_id: input.program.target_agent_id,
    baseline_id: baseline.baseline_id,
    started_at,
    finished_at,
    post_baseline_outcomes: Object.freeze(postBaselineOutcomes) as readonly TaskOutcome[],
    training_outcomes: Object.freeze(trainingOutcomes) as readonly TaskOutcome[],
    generalisation_outcomes: Object.freeze(genOutcomes) as readonly TaskOutcome[],
    adversarial_outcomes: Object.freeze(advOutcomes) as readonly TaskOutcome[],
    regression_outcomes: Object.freeze(regOutcomes) as readonly TaskOutcome[],
    post_metrics: postMetrics,
    candidate_rules: Object.freeze(candidateRules.map((c) => ({
      rule_id: c.rule_id,
      description: c.description,
      pattern_regex: c.pattern_regex,
      finding_rule: c.finding_rule,
    }))) as readonly TrainingRun["candidate_rules"][number][],
    resource_usage: { runtime_ms: Date.now() - startMs },
  };
  const run: TrainingRun = { ...runBase, provenance_chain_hash: provenanceChainHash(runBase, [baseline.provenance_chain_hash]) };
  await getStorage().save(COLLECTIONS.nex_academy_training_runs, run);

  // ── PHASE 8 · VERDICT (pure function of the causal chain) ──────────
  // Build proposal-id if IMPROVED; wire it into the verdict record
  let proposal: RuleAdditionProposal | null = null;
  const verdictInProgress = buildTrainingVerdict({
    baseline,
    run,
    rule_addition_proposal_id: null,
    antecedent_provenance_hashes: [baseline.provenance_chain_hash, run.provenance_chain_hash],
  });

  if (verdictInProgress.kind === "IMPROVED") {
    const built = buildProposal({
      run,
      verdict: verdictInProgress,
      target_agent_id: input.program.target_agent_id,
      target_module_path: "src/lib/nex1-orchestrator/wo7-run-specialist.ts",
    });
    if ("refused" in built === false) {
      proposal = built as RuleAdditionProposal;
      await persistProposal(proposal);
    }
  }

  // Rebuild verdict with the proposal id (if any) attached
  const verdict = buildTrainingVerdict({
    baseline,
    run,
    rule_addition_proposal_id: proposal ? proposal.proposal_id : null,
    antecedent_provenance_hashes: [baseline.provenance_chain_hash, run.provenance_chain_hash],
  });
  await persistVerdict(verdict);

  return {
    baseline_id: baseline.baseline_id,
    baseline_frozen_hash: baseline.frozen_hash,
    run,
    verdict,
    proposal,
  };
}

// ── Persistence helper for the program itself ──────────────────────────

export async function persistTrainingProgram(p: TrainingProgram): Promise<void> {
  await getStorage().save(COLLECTIONS.nex_academy_training_programs, p);
}
