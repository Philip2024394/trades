// src/lib/nex/programmer-improvement/evaluator-adapter.ts
//
// NEX Programmer Agent · Phase F · thin composition layer over
// Phase C (reviewer) + Phase D (benchmark evaluator) + Phase E (drift)
// Philip 2026-09-06 · AUTHORIZE · PHASE F · §22 anti-self-reinforcement
//
// Boundary discipline (§22):
//   Phase F NEVER re-implements a reviewer, evaluator, or drift detector.
//   It COMPOSES the existing Phase C/D/E functions and preserves them
//   as the independent authority. If Phase C says NEEDS_CHANGES, Phase F
//   accepts NEEDS_CHANGES · it cannot override.
//
// This file makes composition explicit so the promoter never touches
// the underlying phase modules directly.

import { review } from "@/lib/nex/programmer-review/reviewer";
import type { ReviewRequest, ReviewResponse } from "@/lib/nex/programmer-review/types";
import { evaluateCorpus, checkThresholds, aggregatePerClass } from "@/lib/nex/programmer-benchmark/evaluator";
import type {
  BenchmarkCorpus,
  EvaluationRun,
  Thresholds,
} from "@/lib/nex/programmer-benchmark/types";
import { DEFAULT_THRESHOLDS } from "@/lib/nex/programmer-benchmark/types";
import { computeDrift } from "@/lib/nex/programmer-stability/drift-detector";
import { captureManifest, computeCaseFingerprint } from "@/lib/nex/programmer-stability/version-manifest";
import { buildStabilityRun } from "@/lib/nex/programmer-stability/history";
import type {
  StabilityRun,
  DriftReport,
  VersionManifest,
} from "@/lib/nex/programmer-stability/types";

// ─── Review adapter ────────────────────────────────────────────

/** Delegates to Phase C review(). Phase F never mutates the reviewer,
 *  never inspects its internals, never overrides its verdict. */
export function runReview(req: ReviewRequest): ReviewResponse {
  return review(req);
}

// ─── Benchmark adapter ────────────────────────────────────────

/** Delegates to Phase D evaluateCorpus() + threshold check. */
export function runBenchmark(input: {
  corpus: BenchmarkCorpus;
  thresholds?: Thresholds;
  triggered_by?: "manual" | "runner";
}): {
  evaluation: EvaluationRun;
  threshold_checks: ReturnType<typeof checkThresholds>;
  all_thresholds_passed: boolean;
} {
  const thresholds = input.thresholds ?? DEFAULT_THRESHOLDS;
  const evaluation = evaluateCorpus(input.corpus, {
    triggered_by: input.triggered_by ?? "runner",
  });
  const threshold_checks = checkThresholds(evaluation.overall, evaluation.per_class, thresholds);
  const all_thresholds_passed = threshold_checks.every((c) => c.passed);
  return { evaluation, threshold_checks, all_thresholds_passed };
}

// ─── Manifest + stability run construction ────────────────────

export type BuildBaselineInput = {
  corpus: BenchmarkCorpus;
  knowledge_snapshot_hash?: string;
  repo_root: string;
};

/** Capture a manifest + build the StabilityRun wrapping an
 *  EvaluationRun. Never persists · caller decides. */
export function buildStabilityRunFromEvaluation(input: {
  evaluation: EvaluationRun;
  corpus: BenchmarkCorpus;
  knowledge_snapshot_hash?: string;
  repo_root: string;
  triggered_by: StabilityRun["triggered_by"];
  parent_run_id?: string | null;
  baseline_run_id?: string | null;
  notes?: string;
  full_result_pointer?: string;
  run_id_override?: string;
}): StabilityRun {
  const manifest = captureManifest({
    corpus: input.corpus,
    repoRoot: input.repo_root,
    // knowledge_files defaults to none → knowledge_snapshot_hash="UNKNOWN"
    // A future authorize can extend this to Phase B knowledge JSONL files.
  });
  const fingerprint = computeCaseFingerprint(
    input.evaluation.results.map((r) => ({
      case_id: r.case_id,
      match_status: r.match_status,
      actual_verdict: r.actual_verdict,
      actual_finding_count: r.actual_finding_count,
    })),
  );
  return buildStabilityRun({
    evaluation: input.evaluation,
    manifest,
    triggered_by: input.triggered_by,
    parent_run_id: input.parent_run_id ?? null,
    baseline_run_id: input.baseline_run_id ?? null,
    notes: input.notes ?? "",
    full_result_pointer: input.full_result_pointer ?? "",
    case_fingerprint: fingerprint,
    run_id_override: input.run_id_override,
  });
}

// ─── Drift adapter ────────────────────────────────────────────

/** Delegates to Phase E computeDrift(). */
export function runDrift(baseline: StabilityRun, current: StabilityRun): DriftReport {
  return computeDrift(baseline, current);
}

// ─── Fresh-process fingerprint reproduction (§15) ─────────────
//
// Spawns a subprocess that runs the corpus evaluation from disk-only
// state, computes the fingerprint independently, and reports whether
// it matches the expected fingerprint. Bounded timeout · never blocks
// indefinitely. Returns a boolean; the promoter reads it.

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type FreshProcessReproductionOptions = {
  expected_fingerprint: string;
  runner_script: string;        // absolute path to a .mjs runner
  timeout_ms?: number;
  env?: Record<string, string>;
};

export type FreshProcessReproductionResult =
  | { reproduced: true; fingerprint: string; duration_ms: number }
  | { reproduced: false; reason: string; fingerprint?: string; duration_ms: number };

export function verifyFreshProcessReproduction(
  opts: FreshProcessReproductionOptions,
): FreshProcessReproductionResult {
  const start = Date.now();
  const result = spawnSync("node", [opts.runner_script], {
    timeout: opts.timeout_ms ?? 60_000,
    env: { ...process.env, ...opts.env },
    encoding: "utf8",
    // Windows: shell:true so nested npx invocations inside the runner
    // resolve `npx.cmd`. The runner is a controlled repo-local script.
    shell: process.platform === "win32",
  });
  const duration_ms = Date.now() - start;
  if (result.error) {
    return { reproduced: false, reason: `spawn_error:${result.error.message}`, duration_ms };
  }
  if (typeof result.status === "number" && result.status !== 0) {
    return { reproduced: false, reason: `nonzero_exit:${result.status}:${(result.stderr ?? "").slice(0, 200)}`, duration_ms };
  }
  // Runner is expected to print exactly the fingerprint on its last non-empty line.
  const lines = (result.stdout ?? "").split(/\r?\n/).filter((l) => l.trim().length > 0);
  const printed = lines[lines.length - 1]?.trim() ?? "";
  if (!printed) {
    return { reproduced: false, reason: "no_fingerprint_output", duration_ms };
  }
  if (printed !== opts.expected_fingerprint) {
    return { reproduced: false, reason: "fingerprint_mismatch", fingerprint: printed, duration_ms };
  }
  return { reproduced: true, fingerprint: printed, duration_ms };
}
