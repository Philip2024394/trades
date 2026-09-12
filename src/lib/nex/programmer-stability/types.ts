// src/lib/nex/programmer-stability/types.ts
//
// NEX Programmer Agent · Phase E · temporal stability types
// Philip 2026-09-05 · AUTHORIZE · PHASE E
//
// Discipline:
//   Every stability run captures a VERSION MANIFEST so that any change
//   in results is ATTRIBUTABLE to reviewer / evaluator / benchmark /
//   knowledge / environment — never "unexplained" (§13). Runs are
//   APPEND-ONLY. Historical results cannot be mutated (§11). The
//   evaluator does not declare its own health — a separate drift
//   comparison layer emits STABLE / IMPROVED / DEGRADED / FAILED /
//   UNEXPLAINED (§17 · §24).

import type { EvaluationRun, ClassMetrics, OverallMetrics } from "@/lib/nex/programmer-benchmark/types";

// ─── Version manifest · attribution surface ─────────────────────

/** Captures the exact source-of-truth state that produced a stability
 *  run. Every field is hashable so a fresh process can independently
 *  reproduce or attribute a change. UNKNOWN is a permitted honest
 *  value when a dimension cannot be established (§12). */
export type VersionManifest = {
  /** Corpus version string (e.g. "programmer-benchmark-v1") */
  benchmark_version: string;
  /** SHA-256 hex of the corpus content · uses first 24 chars for brevity */
  benchmark_hash: string;
  /** Content hash of reviewer + test-quality source files */
  reviewer_hash: string;
  /** Content hash of evaluator + corpus source files */
  evaluator_hash: string;
  /** SHA-256 hex of the relevant knowledge snapshot · UNKNOWN when
   *  no knowledge is consulted by the current corpus */
  knowledge_snapshot_hash: string | "UNKNOWN";
  /** Node.js version identifier */
  environment_identifier: string;
  /** ISO timestamp when the manifest was captured */
  captured_at: string;
};

// ─── Stability run · immutable record ───────────────────────────

/** Header record persisted append-only in the history store. Full
 *  per-case detail is stored in a separate file · pointer preserved
 *  here so historical inspection stays fast. */
export type StabilityRun = {
  run_id: string;
  parent_run_id: string | null;      // most-recent prior run (chronological chain)
  baseline_run_id: string | null;    // reference to the baseline this compares to
  timestamp: string;
  triggered_by: "runner" | "adversarial_test" | "controlled_change";
  version_manifest: VersionManifest;
  /** Fingerprint = SHA-256 (short) of sorted (case_id | match_status |
   *  actual_verdict | actual_finding_count). Materially-identical runs
   *  produce identical fingerprints. */
  case_fingerprint: string;
  overall: OverallMetrics;
  per_class: ClassMetrics[];
  full_result_pointer: string;       // file path to full EvaluationRun JSON
  notes: string;                      // controlled-change description or adversarial context
  /** Op-Truth §OP.5: always null in persisted record. */
  final_status: null;
};

// ─── Drift detection ────────────────────────────────────────────

export type DriftDirection = "STABLE" | "IMPROVED" | "DEGRADED" | "FAILED" | "UNEXPLAINED";

export type ClassDrift = {
  defect_class: string;
  baseline_catch_rate: number;
  current_catch_rate: number;
  delta: number;
  direction: DriftDirection;
  reason: string;
};

export type VerdictFlip = {
  case_id: string;
  baseline_verdict: string;
  current_verdict: string;
  baseline_finding_count: number;
  current_finding_count: number;
  is_regression: boolean;   // true when current verdict is worse than baseline
};

export type DriftAttribution = {
  reviewer_changed: boolean;
  evaluator_changed: boolean;
  benchmark_changed: boolean;
  knowledge_changed: boolean;
  environment_changed: boolean;
  /** Human-readable summary of what changed between manifests. */
  summary: string;
};

export type DriftReport = {
  baseline_run_id: string;
  current_run_id: string;
  attribution: DriftAttribution;
  fingerprints_identical: boolean;
  overall_direction: DriftDirection;
  overall_delta: {
    defective_catch_rate: number;
    false_positive_rate: number;
    tests_pass_but_code_wrong_catch_rate: number;
    uncertain_accuracy: number;
  };
  per_class_drift: ClassDrift[];
  verdict_flips: VerdictFlip[];
  reasons: string[];
};

// ─── Stability thresholds (§9) ──────────────────────────────────

export type StabilityThresholds = {
  /** Per-class catch-rate must not fall below this. */
  per_class_min_catch_rate: number;
  /** False-positive rate must not exceed this. */
  max_false_positive_rate: number;
  /** Tests-pass-but-code-wrong catch rate must not fall below this. */
  tests_pass_but_code_wrong_min_catch_rate: number;
  /** Uncertainty accuracy must not fall below this. */
  min_uncertainty_accuracy: number;
  /** Fingerprint mismatch across identical-config runs raises FAILED. */
  identical_runs_require_identical_fingerprint: boolean;
};

export const DEFAULT_STABILITY_THRESHOLDS: StabilityThresholds = {
  per_class_min_catch_rate: 0.80,
  max_false_positive_rate: 0.10,
  tests_pass_but_code_wrong_min_catch_rate: 0.80,
  min_uncertainty_accuracy: 0.80,
  identical_runs_require_identical_fingerprint: true,
};

// ─── Convenience: wrap an EvaluationRun into a StabilityRun ─────

export type StabilityRunBuildInput = {
  evaluation: EvaluationRun;
  manifest: VersionManifest;
  triggered_by: StabilityRun["triggered_by"];
  parent_run_id?: string | null;
  baseline_run_id?: string | null;
  notes?: string;
  full_result_pointer: string;
  case_fingerprint: string;
  run_id_override?: string;   // for deterministic test-time IDs
};

// ─── Phase E permission scope (§32 · §33) ───────────────────────

export type PhaseEForbiddenAction =
  | "createScheduler"
  | "createCron"
  | "createWatcher"
  | "createDaemon"
  | "startBackgroundLoop"
  | "commit"
  | "deploy"
  | "modifyProduction"
  | "modifyReviewerAutomatically"
  | "activateWorkforce"
  | "startAutonomousImprovementLoop"
  | "modifyHistoricalRun"
  | "modifyBenchmarkDuringRun";
