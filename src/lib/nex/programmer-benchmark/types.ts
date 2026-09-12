// src/lib/nex/programmer-benchmark/types.ts
//
// NEX Programmer Agent · Phase D · benchmark & evaluation types
// Philip 2026-09-05 · AUTHORIZE · PHASE D
//
// Discipline (§7):
//   The benchmark itself obeys Operational Truth. Ground truth is
//   INDEPENDENT of the Programmer's opinion. A benchmark case is
//   "defective" only when independent evidence establishes it.
//
// Every case is IMMUTABLE once persisted in a corpus version. Changes
// require a new corpus version (§22 · §23).

import type {
  FindingCategory,
  ReviewRequest,
  ReviewVerdict,
} from "@/lib/nex/programmer-review/types";

// ─── Defect classes (§4) ─────────────────────────────────────────
//
// Materially different engineering failure modes. Adding a class
// requires a corpus version bump AND explicit authorization.

export type DefectClass =
  // Correctness
  | "correctness.off_by_one"
  | "correctness.boundary_condition"
  | "correctness.null_handling"
  | "correctness.error_propagation"
  | "correctness.unit_conversion"
  // Concurrency
  | "concurrency.race_condition"
  | "concurrency.lost_update"
  | "concurrency.unsafe_shared_state"
  // Security
  | "security.sql_injection"
  | "security.authorization_bypass"
  | "security.privilege_escalation"
  | "security.data_leakage"
  | "security.csrf"
  | "security.unsafe_deserialization"
  | "security.path_traversal"
  | "security.secret_exposure"
  // Reliability
  | "reliability.silent_error_swallow"
  | "reliability.missing_timeout"
  | "reliability.resource_leak"
  | "reliability.unbounded_recursion"
  // Data / DB
  | "data.schema_migration_hazard"
  | "data.transaction_boundary"
  | "data.constraint_assumption"
  // Temporal / Distributed
  | "temporal.timing_boundary"
  | "temporal.clock_assumption"
  | "temporal.stale_cache"
  | "temporal.idempotency_failure"
  // API / Integration
  | "api.incorrect_contract"
  | "api.missing_validation"
  | "api.incorrect_status_handling"
  // Non-defect (used for correct/incomplete/uncertain cases)
  | "control.correct"
  | "control.incomplete"
  | "control.uncertain"
  | "control.adversarial_unfamiliar_but_correct";

export type Difficulty =
  | "FOUNDATIONAL"
  | "INTERMEDIATE"
  | "ADVANCED"
  | "ADVERSARIAL";

// ─── Ground truth ────────────────────────────────────────────────
//
// The independently verified truth about the case. Distinct from the
// Programmer's verdict — comparison happens at evaluation time.

export type GroundTruth =
  | "DEFECTIVE"       // real defect present · independently verified
  | "CORRECT"         // no material defect · independently verified
  | "INCOMPLETE"      // partially correct · missing documented edge case
  | "UNCERTAIN";      // evidence genuinely insufficient · verdict cannot be established

export type GroundTruthEvidence = {
  method: "executable_reproduction" | "specification_reference" | "static_check" | "runtime_observation" | "deterministic_fixture" | "authoritative_documentation" | "cross_verification";
  description: string;
  pointer: string;
};

// ─── Benchmark case (immutable) ──────────────────────────────────

export type BenchmarkCase = {
  case_id: string;                  // stable · unique within corpus version
  corpus_version: string;
  defect_class: DefectClass;
  difficulty: Difficulty;
  requirement: string;              // exposed via ReviewRequest
  request: ReviewRequest;           // the fixture handed to review()
  ground_truth: GroundTruth;
  expected_verdict: ReviewVerdict;
  expected_finding_categories?: FindingCategory[];
  ground_truth_evidence: GroundTruthEvidence[];
  provenance: string;               // who authored + verified this case
  /** Marks cases that were designed to elicit test-quality analysis
   *  (implementation is defective but its tests pass). Counted in the
   *  dedicated tests-pass-but-code-wrong benchmark bucket. */
  tests_pass_but_code_wrong?: boolean;
};

// ─── Corpus (versioned · immutable snapshot) ────────────────────

export type BenchmarkCorpus = {
  version: string;                  // e.g. "programmer-benchmark-v1"
  frozen_at: string;                // ISO · when this version was frozen
  authored_by: string;
  cases: readonly BenchmarkCase[];  // immutable
  case_count: number;
  defect_classes_covered: readonly DefectClass[];
};

// ─── Evaluation result & aggregate metrics ───────────────────────

export type EvaluationResult = {
  case_id: string;
  corpus_version: string;
  defect_class: DefectClass;
  difficulty: Difficulty;
  ground_truth: GroundTruth;
  expected_verdict: ReviewVerdict;
  actual_verdict: ReviewVerdict;
  match_status: "CORRECT" | "WRONG" | "EXECUTION_ERROR";
  execution_error?: string;
  expected_finding_categories?: FindingCategory[];
  actual_finding_categories: FindingCategory[];
  actual_finding_count: number;
  actual_confidence: "low" | "medium" | "high";
  actual_review_id: string;
  knowledge_used: string[];
  reasoning_trace_length: number;
  timestamp: string;
};

export type ClassMetrics = {
  defect_class: DefectClass;
  total: number;
  correct: number;
  wrong: number;
  execution_error: number;
  catch_rate: number;                // correct / total (for DEFECTIVE / INCOMPLETE cases · exclusive of EXECUTION_ERROR)
};

export type OverallMetrics = {
  total_cases: number;
  correct: number;
  wrong: number;
  execution_error: number;
  overall_accuracy: number;
  // Per-ground-truth breakdowns · no aggregate masking (§13)
  defective_correct: number;         // ground_truth=DEFECTIVE AND match=CORRECT
  defective_total: number;
  defective_catch_rate: number;
  correct_correctly_accepted: number; // ground_truth=CORRECT AND match=CORRECT
  correct_total: number;
  false_positive_rate: number;        // ground_truth=CORRECT AND match=WRONG (reviewer said defective)
  uncertain_correct: number;
  uncertain_total: number;
  uncertain_accuracy: number;
  tests_pass_but_code_wrong_correct: number;
  tests_pass_but_code_wrong_total: number;
  tests_pass_but_code_wrong_catch_rate: number;
};

export type EvaluationRun = {
  run_id: string;
  corpus_version: string;
  started_at: string;
  completed_at: string | null;
  triggered_by: "manual" | "runner";
  results: EvaluationResult[];
  overall: OverallMetrics;
  per_class: ClassMetrics[];
  /** Op-Truth: always null in persisted record. Verifier derives status. */
  final_status: null;
};

export type Thresholds = {
  per_class_min_catch_rate: number;         // default 0.80 (§14)
  tests_pass_but_code_wrong_min_catch_rate: number;   // default 0.80
  max_false_positive_rate: number;          // default 0.10
  min_uncertainty_accuracy: number;         // default 0.80
  min_class_sample_for_threshold: number;   // classes with < this many samples excluded from threshold check
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  per_class_min_catch_rate: 0.80,
  tests_pass_but_code_wrong_min_catch_rate: 0.80,
  max_false_positive_rate: 0.10,
  min_uncertainty_accuracy: 0.80,
  // Corpus v1 has many defect subclasses at n=1. Setting min=1 means
  // every represented class contributes to threshold pass/fail rather
  // than being excluded as "insufficient sample". This is honest for
  // v1 · future corpus versions can raise this once broader per-class
  // coverage is authored (each additional case requires its own
  // ground-truth verification per §5 §6).
  min_class_sample_for_threshold: 1,
};

export type ThresholdCheck = {
  criterion: string;
  measured: number;
  threshold: number;
  passed: boolean;
  detail: string;
};

// ─── Evaluator boundary sentinel (§32) ──────────────────────────
//
// Type-level marker that any module writing benchmark artifacts must
// import. Ensures "who is allowed to touch the corpus" is enforceable
// at review time.

export type EvaluatorAuthorityScope =
  | "read_corpus"
  | "execute_case"
  | "aggregate_metrics"
  | "write_evaluation_run";

/** Forbidden actions at Phase D · explicit list · module-level audit
 *  test verifies no export begins with these prefixes. */
export type PhaseDForbiddenAction =
  | "commit"
  | "deploy"
  | "grantAccess"
  | "modifyProduction"
  | "modifyCorpus"           // corpus is immutable after freeze
  | "modifyReviewer"         // benchmark cannot rewrite Programmer
  | "scheduleRecurring"
  | "startWatcher"
  | "createWorkforce";
