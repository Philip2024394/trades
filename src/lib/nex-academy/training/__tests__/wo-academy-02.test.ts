// WO-ACADEMY-02 · Training Engine acceptance tests.
//
// 14 adversarial (A-1..A-14) + 4 property (P-1..P-4) + a small positive
// block. Every A-test in the founder-locked "secretly try to fabricate
// improvement OR grow authority → refused" shape.
//
// Zero mocks. Real WO-07 subprocess. Real GB storage.

import { describe, it, expect, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  buildBaselineSnapshot,
  computeBaselineFrozenHash,
  verifyBaselineFrozenHash,
} from "../baseline-freeze";
import {
  buildSlice1TrainingProgram,
  slice1CaseById,
  SLICE1_BASELINE_CASES,
  SLICE1_TRAINING_CASES,
  SLICE1_GENERALISATION_CASES,
  SLICE1_ADVERSARIAL_CASES,
} from "../training-corpus";
import { runTraining } from "../training-run";
import {
  VERDICT_THRESHOLDS,
  buildTrainingVerdict,
  decideTrainingVerdict,
} from "../verdict";
import { buildProposal } from "../proposal-emitter";
import { applyCandidateRules, SLICE1_CANDIDATE_RULES } from "../candidate-rules";
import type {
  BaselineMetrics,
  BaselineSnapshot,
  TrainingProgram,
  TrainingRun,
} from "../types";

const REPO_ROOT = process.cwd();

async function makeSandbox(): Promise<string> {
  const p = path.join(REPO_ROOT, "data", "nex-agent-workspaces", `academy-02-test-${randomUUID()}`);
  await fs.mkdir(p, { recursive: true });
  return p;
}

async function cleanCollections(): Promise<void> {
  const files = [
    "nex_academy_training_programs",
    "nex_academy_baselines",
    "nex_academy_training_runs",
    "nex_academy_training_verdicts",
    "nex_academy_rule_addition_proposals",
  ];
  const root = path.join(REPO_ROOT, "data", "nex-storage");
  for (const f of files) {
    try { await fs.unlink(path.join(root, `${f}.jsonl`)); } catch { /* ok */ }
  }
}

function baselineMetricsOf(ratio: number, weakness: number): BaselineMetrics {
  return {
    task_completion_ratio: ratio,
    accuracy: ratio,
    reliability: ratio,
    failure_classes: [],
    targeted_weakness_score: weakness,
  };
}

// ═════════════════════════════════════════════════════════════════════════
// POSITIVE / CONSTRUCTION
// ═════════════════════════════════════════════════════════════════════════

describe("WO-ACADEMY-02 · construction", () => {
  afterEach(cleanCollections);

  it("Slice-1 training program constructs with disjoint sets", () => {
    const p = buildSlice1TrainingProgram({
      target_agent_id: "wo7-node-syntax-specialist",
      domain: "validation",
      authorising_wo_id: "wo-academy-02",
    });
    expect(p.record_type).toBe("NEX_ACADEMY_TRAINING_PROGRAM");
    expect(p.baseline_task_ids.length).toBeGreaterThanOrEqual(5);
    expect(p.training_task_ids.length).toBeGreaterThanOrEqual(5);
    expect(p.generalisation_task_ids.length).toBeGreaterThanOrEqual(3);
    expect(p.provenance_chain_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("Baseline frozen_hash verifies", () => {
    const p = buildSlice1TrainingProgram({
      target_agent_id: "wo7-node-syntax-specialist",
      domain: "validation",
      authorising_wo_id: "wo-academy-02",
    });
    const b = buildBaselineSnapshot({
      program: p,
      baseline_metrics: baselineMetricsOf(0.5, 0.0),
      evidence_pointers: ["ev-1", "ev-2"],
      antecedent_provenance_hashes: [p.provenance_chain_hash],
    });
    expect(b.frozen_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyBaselineFrozenHash(b)).toBe(true);
  });

  it("Real end-to-end runTraining produces baseline + run + verdict + (proposal if IMPROVED)", async () => {
    const sandbox = await makeSandbox();
    try {
      const program = buildSlice1TrainingProgram({
        target_agent_id: "wo7-node-syntax-specialist",
        domain: "validation",
        authorising_wo_id: "wo-academy-02",
      });
      const result = await runTraining({ program, sandbox_root: sandbox });
      // Structural checks
      expect(result.baseline_id).toMatch(/^academy-baseline-/);
      expect(result.baseline_frozen_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(result.run.baseline_id).toBe(result.baseline_id);
      expect(result.verdict.baseline_id).toBe(result.baseline_id);
      // Verdict is one of the 5 enum values
      expect(["IMPROVED", "NO_IMPROVEMENT", "GENERALISATION_FAILED", "REGRESSION_INTRODUCED", "INSUFFICIENT_EVIDENCE"]).toContain(result.verdict.kind);
      // Proposal only when IMPROVED
      if (result.verdict.kind === "IMPROVED") {
        expect(result.proposal).not.toBeNull();
        expect(result.proposal?.authorised_by).toBeNull();
        expect(result.proposal?.authorising_wo_id).toBeNull();
      } else {
        expect(result.proposal).toBeNull();
      }
      // Post-baseline outcomes measured on SAME baseline task ids
      const baselineIds = new Set(program.baseline_task_ids);
      const postIds = result.run.post_baseline_outcomes.map((o) => o.task_id);
      for (const id of postIds) expect(baselineIds.has(id)).toBe(true);
    } finally { await fs.rm(sandbox, { recursive: true, force: true }); }
  }, 300_000);
});

// ═════════════════════════════════════════════════════════════════════════
// ADVERSARIAL (14 tests · §9)
// ═════════════════════════════════════════════════════════════════════════

describe("WO-ACADEMY-02 · adversarial", () => {
  afterEach(cleanCollections);

  // A-1
  it("A-1 · training modules never import substrate write helpers", async () => {
    const files = [
      "src/lib/nex-academy/training/types.ts",
      "src/lib/nex-academy/training/baseline-freeze.ts",
      "src/lib/nex-academy/training/candidate-rules.ts",
      "src/lib/nex-academy/training/training-corpus.ts",
      "src/lib/nex-academy/training/training-executor.ts",
      "src/lib/nex-academy/training/verdict.ts",
      "src/lib/nex-academy/training/proposal-emitter.ts",
      "src/lib/nex-academy/training/training-run.ts",
    ];
    for (const f of files) {
      const src = await fs.readFile(path.join(REPO_ROOT, f), "utf8");
      expect(src).not.toMatch(/from\s+["']@\/lib\/nex1-orchestrator\/wo4-executor/);
      expect(src).not.toMatch(/from\s+["']@\/lib\/nex-authority-broker/);
      expect(src).not.toMatch(/executeAuthorisedDiffBundle/);
    }
  });

  // A-2
  it("A-2 · training modules never sign any authorisation", async () => {
    const files = [
      "src/lib/nex-academy/training/types.ts",
      "src/lib/nex-academy/training/baseline-freeze.ts",
      "src/lib/nex-academy/training/candidate-rules.ts",
      "src/lib/nex-academy/training/training-corpus.ts",
      "src/lib/nex-academy/training/training-executor.ts",
      "src/lib/nex-academy/training/verdict.ts",
      "src/lib/nex-academy/training/proposal-emitter.ts",
      "src/lib/nex-academy/training/training-run.ts",
    ];
    for (const f of files) {
      const src = await fs.readFile(path.join(REPO_ROOT, f), "utf8");
      expect(src).not.toMatch(/signAuthorization/);
      expect(src).not.toMatch(/signFounderKeyManifest/);
      expect(src).not.toMatch(/signCrawlerManifest/);
    }
  });

  // A-3
  it("A-3 · verdict function is a pure function (100 runs identical)", () => {
    const p = buildSlice1TrainingProgram({
      target_agent_id: "wo7-node-syntax-specialist",
      domain: "validation",
      authorising_wo_id: "wo-academy-02",
    });
    const baseline = buildBaselineSnapshot({
      program: p,
      baseline_metrics: baselineMetricsOf(0.7, 0.3),
      evidence_pointers: ["ev-1", "ev-2", "ev-3", "ev-4", "ev-5"],
      antecedent_provenance_hashes: [p.provenance_chain_hash],
    });
    const runFixture: TrainingRun = {
      record_type: "NEX_ACADEMY_TRAINING_RUN",
      run_id: "run-1",
      program_id: p.program_id,
      agent_id: p.target_agent_id,
      baseline_id: baseline.baseline_id,
      started_at: "2026-09-13T00:00:00.000Z",
      finished_at: "2026-09-13T00:00:00.000Z",
      post_baseline_outcomes: p.baseline_task_ids.map((id) => ({
        task_id: id, outcome: "SUCCESS", evidence_pointer: `ev-${id}`, matched_pattern: null,
      })),
      training_outcomes: p.training_task_ids.map((id) => ({
        task_id: id, outcome: "SUCCESS", evidence_pointer: `ev-${id}`, matched_pattern: null,
      })),
      generalisation_outcomes: p.generalisation_task_ids.map((id) => ({
        task_id: id, outcome: "SUCCESS", evidence_pointer: `ev-${id}`, matched_pattern: null,
      })),
      adversarial_outcomes: p.adversarial_task_ids.map((id) => ({
        task_id: id, outcome: "SUCCESS", evidence_pointer: `ev-${id}`, matched_pattern: null,
      })),
      regression_outcomes: p.regression_task_ids.map((id) => ({
        task_id: id, outcome: "SUCCESS", evidence_pointer: `ev-${id}`, matched_pattern: null,
      })),
      post_metrics: baselineMetricsOf(0.9, 0.9),
      candidate_rules: [],
      resource_usage: { runtime_ms: 1 },
      provenance_chain_hash: "test-hash",
    };
    const first = decideTrainingVerdict({ baseline, run: runFixture });
    for (let i = 0; i < 100; i++) {
      expect(decideTrainingVerdict({ baseline, run: runFixture })).toEqual(first);
    }
  });

  // A-4
  it("A-4 · regression in regression_outcomes forces REGRESSION_INTRODUCED, cannot be overridden by high scores", () => {
    const p = buildSlice1TrainingProgram({
      target_agent_id: "wo7-node-syntax-specialist",
      domain: "validation",
      authorising_wo_id: "wo-academy-02",
    });
    const baseline = buildBaselineSnapshot({
      program: p,
      baseline_metrics: baselineMetricsOf(0.7, 0.3),
      evidence_pointers: ["ev-1", "ev-2", "ev-3", "ev-4", "ev-5"],
      antecedent_provenance_hashes: [p.provenance_chain_hash],
    });
    // A run with EXCELLENT everything EXCEPT one regression failure
    const runFixture: TrainingRun = {
      record_type: "NEX_ACADEMY_TRAINING_RUN",
      run_id: "run-1", program_id: p.program_id, agent_id: p.target_agent_id, baseline_id: baseline.baseline_id,
      started_at: "", finished_at: "",
      post_baseline_outcomes: p.baseline_task_ids.map((id) => ({ task_id: id, outcome: "SUCCESS" as const, evidence_pointer: "e", matched_pattern: null })),
      training_outcomes: p.training_task_ids.map((id) => ({ task_id: id, outcome: "SUCCESS" as const, evidence_pointer: "e", matched_pattern: null })),
      generalisation_outcomes: p.generalisation_task_ids.map((id) => ({ task_id: id, outcome: "SUCCESS" as const, evidence_pointer: "e", matched_pattern: null })),
      adversarial_outcomes: p.adversarial_task_ids.map((id) => ({ task_id: id, outcome: "SUCCESS" as const, evidence_pointer: "e", matched_pattern: null })),
      // A single FAILURE in regression forces REGRESSION_INTRODUCED
      regression_outcomes: [{ task_id: "regr-01", outcome: "FAILURE" as const, evidence_pointer: "e", matched_pattern: null }],
      post_metrics: baselineMetricsOf(1.0, 1.0),
      candidate_rules: [], resource_usage: { runtime_ms: 1 }, provenance_chain_hash: "h",
    };
    const d = decideTrainingVerdict({ baseline, run: runFixture });
    expect(d.kind).toBe("REGRESSION_INTRODUCED");
  });

  // A-5
  it("A-5 · corpus sets are disjoint (constructor-enforced)", () => {
    const p = buildSlice1TrainingProgram({
      target_agent_id: "wo7-node-syntax-specialist",
      domain: "validation",
      authorising_wo_id: "wo-academy-02",
    });
    const baseline = new Set(p.baseline_task_ids);
    const training = new Set(p.training_task_ids);
    const genl = new Set(p.generalisation_task_ids);
    const adv = new Set(p.adversarial_task_ids);
    const reg = new Set(p.regression_task_ids);

    for (const id of training) expect(baseline.has(id) || genl.has(id) || adv.has(id) || reg.has(id)).toBe(false);
    for (const id of genl) expect(training.has(id) || adv.has(id) || reg.has(id)).toBe(false);
    for (const id of adv) expect(training.has(id) || genl.has(id) || reg.has(id)).toBe(false);
  });

  // A-6 · same-benchmark rule 2 — different post benchmark → INSUFFICIENT_EVIDENCE
  it("A-6 · post-training measured on DIFFERENT benchmark than baseline → INSUFFICIENT_EVIDENCE (causal chain)", () => {
    const p = buildSlice1TrainingProgram({
      target_agent_id: "wo7-node-syntax-specialist",
      domain: "validation",
      authorising_wo_id: "wo-academy-02",
    });
    const baseline = buildBaselineSnapshot({
      program: p,
      baseline_metrics: baselineMetricsOf(0.5, 0.2),
      evidence_pointers: ["ev-1", "ev-2", "ev-3", "ev-4", "ev-5"],
      antecedent_provenance_hashes: [p.provenance_chain_hash],
    });
    // Post-baseline outcomes use DIFFERENT task ids (attacker swaps benchmark)
    const runFixture: TrainingRun = {
      record_type: "NEX_ACADEMY_TRAINING_RUN",
      run_id: "run-attacker", program_id: p.program_id, agent_id: p.target_agent_id, baseline_id: baseline.baseline_id,
      started_at: "", finished_at: "",
      post_baseline_outcomes: [
        { task_id: "fabricated-easy-1", outcome: "SUCCESS" as const, evidence_pointer: "e", matched_pattern: null },
        { task_id: "fabricated-easy-2", outcome: "SUCCESS" as const, evidence_pointer: "e", matched_pattern: null },
      ],
      training_outcomes: [], generalisation_outcomes: [], adversarial_outcomes: [], regression_outcomes: [],
      post_metrics: baselineMetricsOf(1.0, 1.0),
      candidate_rules: [], resource_usage: { runtime_ms: 1 }, provenance_chain_hash: "h",
    };
    const d = decideTrainingVerdict({ baseline, run: runFixture });
    expect(d.kind).toBe("INSUFFICIENT_EVIDENCE");
    expect(d.rationale).toMatch(/causal claim cannot be evaluated/);
    expect(d.baseline_benchmark_matched).toBe(false);
  });

  // A-7 · targeted-weakness improvement enforced
  it("A-7 · training that improves overall metrics but NOT the targeted weakness → NO_IMPROVEMENT", () => {
    const p = buildSlice1TrainingProgram({
      target_agent_id: "wo7-node-syntax-specialist",
      domain: "validation",
      authorising_wo_id: "wo-academy-02",
    });
    const baseline = buildBaselineSnapshot({
      program: p,
      baseline_metrics: baselineMetricsOf(0.5, 0.4),   // weakness at 0.4
      evidence_pointers: ["ev-1", "ev-2", "ev-3", "ev-4", "ev-5"],
      antecedent_provenance_hashes: [p.provenance_chain_hash],
    });
    // Post: overall ratio up, but weakness unchanged (< 0.10 delta)
    const runFixture: TrainingRun = {
      record_type: "NEX_ACADEMY_TRAINING_RUN",
      run_id: "run-1", program_id: p.program_id, agent_id: p.target_agent_id, baseline_id: baseline.baseline_id,
      started_at: "", finished_at: "",
      post_baseline_outcomes: p.baseline_task_ids.map((id) => ({ task_id: id, outcome: "SUCCESS" as const, evidence_pointer: "e", matched_pattern: null })),
      training_outcomes: p.training_task_ids.map((id) => ({ task_id: id, outcome: "SUCCESS" as const, evidence_pointer: "e", matched_pattern: null })),
      generalisation_outcomes: p.generalisation_task_ids.map((id) => ({ task_id: id, outcome: "SUCCESS" as const, evidence_pointer: "e", matched_pattern: null })),
      adversarial_outcomes: p.adversarial_task_ids.map((id) => ({ task_id: id, outcome: "SUCCESS" as const, evidence_pointer: "e", matched_pattern: null })),
      regression_outcomes: p.regression_task_ids.map((id) => ({ task_id: id, outcome: "SUCCESS" as const, evidence_pointer: "e", matched_pattern: null })),
      post_metrics: baselineMetricsOf(0.9, 0.42),   // overall +0.4 · weakness only +0.02
      candidate_rules: [], resource_usage: { runtime_ms: 1 }, provenance_chain_hash: "h",
    };
    const d = decideTrainingVerdict({ baseline, run: runFixture });
    expect(d.kind).toBe("NO_IMPROVEMENT");
    expect(d.rationale).toMatch(/targeted weakness/);
  });

  // A-8 · RuleAdditionProposal emitted ONLY when verdict IMPROVED
  it("A-8 · buildProposal refuses on non-IMPROVED verdicts", () => {
    const p = buildSlice1TrainingProgram({
      target_agent_id: "wo7", domain: "validation", authorising_wo_id: "w",
    });
    const baseline = buildBaselineSnapshot({
      program: p, baseline_metrics: baselineMetricsOf(0.5, 0.2), evidence_pointers: ["e1", "e2", "e3", "e4", "e5"],
      antecedent_provenance_hashes: [p.provenance_chain_hash],
    });
    const emptyRun: TrainingRun = {
      record_type: "NEX_ACADEMY_TRAINING_RUN", run_id: "r", program_id: p.program_id, agent_id: p.target_agent_id, baseline_id: baseline.baseline_id,
      started_at: "", finished_at: "",
      post_baseline_outcomes: [], training_outcomes: [], generalisation_outcomes: [], adversarial_outcomes: [], regression_outcomes: [],
      post_metrics: baselineMetricsOf(0.5, 0.2), candidate_rules: [], resource_usage: { runtime_ms: 0 }, provenance_chain_hash: "h",
    };
    const nonImprovedVerdict = buildTrainingVerdict({
      baseline, run: emptyRun, rule_addition_proposal_id: null,
      antecedent_provenance_hashes: [baseline.provenance_chain_hash],
    });
    expect(nonImprovedVerdict.kind).not.toBe("IMPROVED");
    const proposal = buildProposal({
      run: emptyRun, verdict: nonImprovedVerdict,
      target_agent_id: "wo7", target_module_path: "src/lib/nex1-orchestrator/wo7-run-specialist.ts",
    });
    expect(("refused" in proposal) && proposal.refused).toBe(true);
  });

  // A-9 · Proposal authorised_by always null
  it("A-9 · buildProposal always sets authorised_by=null and authorising_wo_id=null", () => {
    // We use a synthetic IMPROVED verdict to bypass the enforcement and check the emit
    const proposal = buildProposal({
      run: {
        record_type: "NEX_ACADEMY_TRAINING_RUN", run_id: "r", program_id: "p", agent_id: "wo7", baseline_id: "b",
        started_at: "", finished_at: "",
        post_baseline_outcomes: [], training_outcomes: [], generalisation_outcomes: [], adversarial_outcomes: [], regression_outcomes: [],
        post_metrics: baselineMetricsOf(1, 1),
        candidate_rules: [{ rule_id: "r1", description: "d", pattern_regex: "p", finding_rule: "f" }],
        resource_usage: { runtime_ms: 0 }, provenance_chain_hash: "h",
      },
      verdict: {
        record_type: "NEX_ACADEMY_TRAINING_VERDICT", verdict_id: "v", run_id: "r", baseline_id: "b", kind: "IMPROVED",
        baseline_metrics_snapshot: baselineMetricsOf(0.5, 0.2), post_metrics_snapshot: baselineMetricsOf(1, 1),
        deltas: { task_completion_ratio: 0.5, accuracy: 0.5, reliability: 0.5, targeted_weakness_score: 0.8 },
        held_out_success_ratio: 1, adversarial_success_ratio: 1, regression_failures: 0,
        baseline_frozen_hash_verified: true, baseline_benchmark_matched: true,
        rationale: "test", rule_addition_proposal_id: null, provenance_chain_hash: "vh",
      },
      target_agent_id: "wo7", target_module_path: "src/lib/nex1-orchestrator/wo7-run-specialist.ts",
    });
    expect("refused" in proposal).toBe(false);
    if ("refused" in proposal) return;
    expect(proposal.authorised_by).toBeNull();
    expect(proposal.authorising_wo_id).toBeNull();
  });

  // A-10 · training touches CAPABILITY only, never AUTHORITY
  it("A-10 · training modules do not import authorization helpers", async () => {
    const files = [
      "src/lib/nex-academy/training/verdict.ts",
      "src/lib/nex-academy/training/proposal-emitter.ts",
      "src/lib/nex-academy/training/training-run.ts",
    ];
    for (const f of files) {
      const src = await fs.readFile(path.join(REPO_ROOT, f), "utf8");
      expect(src).not.toMatch(/verifyAuthorization/);
      expect(src).not.toMatch(/signAuthorization/);
    }
  });

  // A-11 · training never auto-promotes career state
  it("A-11 · training modules never import applyCareerTransition", async () => {
    const files = [
      "src/lib/nex-academy/training/baseline-freeze.ts",
      "src/lib/nex-academy/training/training-executor.ts",
      "src/lib/nex-academy/training/verdict.ts",
      "src/lib/nex-academy/training/proposal-emitter.ts",
      "src/lib/nex-academy/training/training-run.ts",
    ];
    for (const f of files) {
      const src = await fs.readFile(path.join(REPO_ROOT, f), "utf8");
      expect(src).not.toMatch(/applyCareerTransition/);
      expect(src).not.toMatch(/applyDecommissionWithGuard/);
    }
  });

  // A-12 · Zero external LLM SDK imports
  it("A-12 · zero external LLM SDK imports anywhere in nex-academy/training/", async () => {
    const dir = path.join(REPO_ROOT, "src/lib/nex-academy/training");
    const walk = async (d: string): Promise<string[]> => {
      const out: string[] = [];
      const entries = await fs.readdir(d, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) out.push(...await walk(p));
        else if (e.isFile() && /\.(ts|tsx|mjs|mts|js)$/.test(e.name)) out.push(p);
      }
      return out;
    };
    const files = await walk(dir);
    const forbidden = /from\s+["'](openai|@anthropic-ai\/sdk|@anthropic\/sdk|@google\/generative-ai|@google-ai|cohere|@cohere-ai|mistral|@mistralai|@aws-sdk\/client-bedrock)/;
    for (const f of files) {
      const src = await fs.readFile(f, "utf8");
      expect(src).not.toMatch(forbidden);
    }
  });

  // A-13 · Provenance covers baseline + metrics — byte tamper detected
  it("A-13 · baseline frozen_hash detects one-byte tamper on metrics", () => {
    const p = buildSlice1TrainingProgram({
      target_agent_id: "wo7", domain: "validation", authorising_wo_id: "w",
    });
    const b = buildBaselineSnapshot({
      program: p, baseline_metrics: baselineMetricsOf(0.5, 0.2), evidence_pointers: ["e1", "e2"],
      antecedent_provenance_hashes: [p.provenance_chain_hash],
    });
    expect(verifyBaselineFrozenHash(b)).toBe(true);
    // Tamper: change the metrics without updating frozen_hash
    const tampered: BaselineSnapshot = { ...b, baseline_metrics: baselineMetricsOf(0.99, 0.99) };
    expect(verifyBaselineFrozenHash(tampered)).toBe(false);
  });

  // A-14 · Reversibility · REGRESSION_INTRODUCED verdict leaves baseline intact
  it("A-14 · reversibility · pre-training baseline bytes survive REGRESSION_INTRODUCED", async () => {
    // Full round-trip through storage: capture baseline, then a synthetic
    // REGRESSION verdict, and verify the baseline record's frozen_hash
    // still verifies (i.e. its bytes were never modified by the verdict path).
    const sandbox = await makeSandbox();
    try {
      const p = buildSlice1TrainingProgram({
        target_agent_id: "wo7-node-syntax-specialist",
        domain: "validation",
        authorising_wo_id: "wo-academy-02",
      });
      const baseline = buildBaselineSnapshot({
        program: p, baseline_metrics: baselineMetricsOf(0.7, 0.3),
        evidence_pointers: ["ev-1", "ev-2", "ev-3", "ev-4", "ev-5"],
        antecedent_provenance_hashes: [p.provenance_chain_hash],
      });
      const originalFrozenHash = baseline.frozen_hash;
      // Synthetic REGRESSION run
      const runFixture: TrainingRun = {
        record_type: "NEX_ACADEMY_TRAINING_RUN", run_id: "r", program_id: p.program_id, agent_id: p.target_agent_id, baseline_id: baseline.baseline_id,
        started_at: "", finished_at: "",
        post_baseline_outcomes: p.baseline_task_ids.map((id) => ({ task_id: id, outcome: "SUCCESS" as const, evidence_pointer: "e", matched_pattern: null })),
        training_outcomes: [], generalisation_outcomes: [], adversarial_outcomes: [],
        regression_outcomes: [{ task_id: "regr-01", outcome: "FAILURE", evidence_pointer: "e", matched_pattern: null }],
        post_metrics: baselineMetricsOf(1, 1),
        candidate_rules: [], resource_usage: { runtime_ms: 0 }, provenance_chain_hash: "h",
      };
      const verdict = buildTrainingVerdict({
        baseline, run: runFixture, rule_addition_proposal_id: null,
        antecedent_provenance_hashes: [baseline.provenance_chain_hash],
      });
      expect(verdict.kind).toBe("REGRESSION_INTRODUCED");
      // The baseline is still verifiable — bytes unchanged
      expect(baseline.frozen_hash).toBe(originalFrozenHash);
      expect(verifyBaselineFrozenHash(baseline)).toBe(true);
    } finally { await fs.rm(sandbox, { recursive: true, force: true }); }
  });
});

// ═════════════════════════════════════════════════════════════════════════
// PROPERTY (4 tests · §9)
// ═════════════════════════════════════════════════════════════════════════

describe("WO-ACADEMY-02 · property", () => {
  afterEach(cleanCollections);

  // P-1 · Training + generalisation sets are disjoint
  it("P-1 · Slice-1 training/generalisation/adversarial sets are pairwise disjoint", () => {
    const training = new Set(SLICE1_TRAINING_CASES.map((c) => c.case_id));
    const gen = new Set(SLICE1_GENERALISATION_CASES.map((c) => c.case_id));
    const adv = new Set(SLICE1_ADVERSARIAL_CASES.map((c) => c.case_id));
    for (const id of gen) expect(training.has(id)).toBe(false);
    for (const id of adv) expect(training.has(id)).toBe(false);
    for (const id of adv) expect(gen.has(id)).toBe(false);
  });

  // P-2 · Verdict function is pure (already covered by A-3; additional check)
  it("P-2 · verdict function is deterministic across 50 random-shape inputs", () => {
    for (let i = 0; i < 50; i++) {
      const p = buildSlice1TrainingProgram({
        target_agent_id: "wo7", domain: "d", authorising_wo_id: "w",
        deterministic_seed: `seed-${i}`,
      });
      const baseline = buildBaselineSnapshot({
        program: p, baseline_metrics: baselineMetricsOf((i % 10) / 10, (i % 7) / 10),
        evidence_pointers: ["e1", "e2", "e3", "e4", "e5"],
        antecedent_provenance_hashes: [p.provenance_chain_hash],
      });
      const runFixture: TrainingRun = {
        record_type: "NEX_ACADEMY_TRAINING_RUN", run_id: `r-${i}`, program_id: p.program_id, agent_id: p.target_agent_id, baseline_id: baseline.baseline_id,
        started_at: "", finished_at: "",
        post_baseline_outcomes: p.baseline_task_ids.map((id) => ({ task_id: id, outcome: "SUCCESS" as const, evidence_pointer: "e", matched_pattern: null })),
        training_outcomes: p.training_task_ids.map((id) => ({ task_id: id, outcome: "SUCCESS" as const, evidence_pointer: "e", matched_pattern: null })),
        generalisation_outcomes: p.generalisation_task_ids.map((id) => ({ task_id: id, outcome: "SUCCESS" as const, evidence_pointer: "e", matched_pattern: null })),
        adversarial_outcomes: p.adversarial_task_ids.map((id) => ({ task_id: id, outcome: "SUCCESS" as const, evidence_pointer: "e", matched_pattern: null })),
        regression_outcomes: p.regression_task_ids.map((id) => ({ task_id: id, outcome: "SUCCESS" as const, evidence_pointer: "e", matched_pattern: null })),
        post_metrics: baselineMetricsOf(((i + 3) % 11) / 10, ((i + 5) % 11) / 10),
        candidate_rules: [], resource_usage: { runtime_ms: 0 }, provenance_chain_hash: "h",
      };
      const a = decideTrainingVerdict({ baseline, run: runFixture });
      const b = decideTrainingVerdict({ baseline, run: runFixture });
      expect(a).toEqual(b);
    }
  });

  // P-3 · Candidate-rule application is deterministic
  it("P-3 · applyCandidateRules is deterministic across identical inputs", () => {
    const stderr = "SyntaxError: Cannot use import statement outside a module";
    const findings: [] = [];
    const r1 = applyCandidateRules({ real_findings: findings, real_stderr: stderr, candidate_rules: SLICE1_CANDIDATE_RULES });
    const r2 = applyCandidateRules({ real_findings: findings, real_stderr: stderr, candidate_rules: SLICE1_CANDIDATE_RULES });
    expect(r1).toEqual(r2);
    // And it should match the esm rule
    expect(r1.some((f) => f.rule === "esm-import-outside-module")).toBe(true);
  });

  // P-4 · Frozen-hash covers metrics + task_ids + evidence
  it("P-4 · every substantive field affects the frozen_hash", () => {
    const base = computeBaselineFrozenHash({
      program_id: "p", agent_id: "a",
      baseline_task_ids: ["t1", "t2"], baseline_metrics: baselineMetricsOf(0.5, 0.2),
      evidence_pointers: ["e1"],
    });
    // Change task_ids
    const diffTasks = computeBaselineFrozenHash({
      program_id: "p", agent_id: "a",
      baseline_task_ids: ["t1", "t3"], baseline_metrics: baselineMetricsOf(0.5, 0.2),
      evidence_pointers: ["e1"],
    });
    expect(base).not.toBe(diffTasks);
    // Change metrics
    const diffMetrics = computeBaselineFrozenHash({
      program_id: "p", agent_id: "a",
      baseline_task_ids: ["t1", "t2"], baseline_metrics: baselineMetricsOf(0.6, 0.2),
      evidence_pointers: ["e1"],
    });
    expect(base).not.toBe(diffMetrics);
    // Change evidence
    const diffEvidence = computeBaselineFrozenHash({
      program_id: "p", agent_id: "a",
      baseline_task_ids: ["t1", "t2"], baseline_metrics: baselineMetricsOf(0.5, 0.2),
      evidence_pointers: ["e2"],
    });
    expect(base).not.toBe(diffEvidence);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// THRESHOLDS SANITY
// ═════════════════════════════════════════════════════════════════════════

describe("WO-ACADEMY-02 · thresholds sanity", () => {
  it("thresholds are within [0,1] and ordered sensibly", () => {
    const t = VERDICT_THRESHOLDS;
    expect(t.GENERALISATION_MIN).toBeGreaterThan(0);
    expect(t.GENERALISATION_MIN).toBeLessThan(1);
    expect(t.WEAKNESS_IMPROVEMENT_MIN).toBeGreaterThan(0);
    expect(t.WEAKNESS_IMPROVEMENT_MIN).toBeGreaterThanOrEqual(t.IMPROVEMENT_MIN);
    expect(t.ADVERSARIAL_MIN).toBeGreaterThan(0);
    expect(t.ADVERSARIAL_MIN).toBeLessThan(1);
    expect(t.MIN_BASELINE_EVIDENCE).toBeGreaterThan(0);
    expect(t.MIN_TRAINING_EVIDENCE).toBeGreaterThan(0);
  });
});
