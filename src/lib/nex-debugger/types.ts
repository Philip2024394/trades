// src/lib/nex-debugger/types.ts
//
// NEX Debugger Evidence Specialist · types only.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Constitutional purpose (locked C-3, C-4, C-5):
//   Find reproducible causal explanations for observed software failures
//   without claiming certainty beyond the evidence.
//
// Symptom ≠ Cause.
// ROOT_CAUSE_UNRESOLVED and NOT_REPRODUCIBLE are first-class successful outcomes.
// Ordinal outcomes only · never confidence percent · never *_score.

export type DebuggerOutcome =
  | "REPRODUCED"
  | "ROOT_CAUSE_SUPPORTED"
  | "ROOT_CAUSE_PLAUSIBLE"
  | "ROOT_CAUSE_UNRESOLVED"
  | "NOT_REPRODUCIBLE"
  | "INSUFFICIENT_EVIDENCE";

export type ConfidenceClass = "strong" | "plausible" | "weak" | "insufficient";

export type SBFLFormula = "ochiai" | "tarantula" | "dstar";

export interface DebuggerAttribution {
  readonly external_llm_used: false;
  readonly deterministic: true;
  readonly taught_by: "master_ai_engineer";
  readonly role: "nex_debugger_evidence_specialist";
  readonly authority: "descriptive_read_only";
  readonly produced_by: "nex_debugger_evidence_specialist";
}

export interface ReproducibilityInformation {
  readonly command: string;
  readonly cwd: string;
  readonly env_fingerprint: string;
  readonly node_version: string;
  readonly platform: string;
  readonly seed: string;
}

// ─── Failure timeline (C-5) ──────────────────────────────────────

export interface StateStep {
  readonly step_index: number;
  readonly operation: string;
  readonly state_before_hash: string;
  readonly state_after_hash: string;
  readonly diff_from_expected?: string;
  readonly notes?: string;
}

export interface FailureEvent {
  readonly step_index: number;
  readonly kind: string;                  // e.g. "exception" · "assertion_failure" · "wrong_output"
  readonly observed_output: unknown;
  readonly stack_trace_hash?: string;
}

export interface FirstDivergence {
  readonly step_index: number;
  readonly expected_state_hash: string;
  readonly actual_state_hash: string;
  readonly diff_description: string;
}

export interface FailureTimeline {
  readonly session_id: string;
  readonly input_hash: string;
  readonly seed: string;
  readonly steps: readonly StateStep[];
  readonly failure: FailureEvent;
  readonly first_divergence: FirstDivergence | null;
  readonly determinism_witness: { readonly first_run_hash: string; readonly second_run_hash: string; readonly identical: boolean };
}

// ─── Minimisation (ddmin) ────────────────────────────────────────

export interface MinimisedRepro {
  readonly present: true;
  readonly size_bytes: number;
  readonly reduction_ratio: number;       // (original_size - minimised_size) / original_size · numeric measurement, not a quality score
  readonly ddmin_iterations: number;
  readonly minimised_input_hash: string;
}

// ─── SBFL ────────────────────────────────────────────────────────

export interface SBFLRankingEntry {
  readonly location: string;              // path::line
  readonly path: string;
  readonly line: number;
  readonly suspicion: number;             // literature-named formula output · never renamed to *_score
}

export interface SBFLResult {
  readonly formula: SBFLFormula;
  readonly ranking: readonly SBFLRankingEntry[];
  readonly top_candidate: { readonly path: string; readonly line: number; readonly symbol?: string } | null;
  readonly coverage_matrix_hash: string;
  readonly evidence_id: string;
}

// ─── AST diff ────────────────────────────────────────────────────

export interface ASTDiffChurnedNode {
  readonly path: string;
  readonly syntax_kind: string;
  readonly line_start: number;
  readonly line_end: number;
  readonly churn_class: "added" | "removed" | "modified";
}

export interface ASTDiff {
  readonly diff_id: string;
  readonly baseline_source_hash: string;
  readonly candidate_source_hash: string;
  readonly churned_nodes: readonly ASTDiffChurnedNode[];
  readonly evidence_id: string;
}

// ─── Root-cause candidate ────────────────────────────────────────

export interface RootCauseCandidate {
  readonly candidate_id: string;
  readonly location: { readonly path: string; readonly line: number; readonly symbol?: string };
  readonly evidence_ids: readonly string[];
  readonly symptom_frame: { readonly file: string; readonly line: number; readonly stack_hash?: string };
  readonly confidence_class: ConfidenceClass;
}

// ─── Debugger evidence record ───────────────────────────────────

export interface DebuggerEvidence {
  readonly record_type: "DEBUGGER_EVIDENCE";
  readonly session_id: string;
  readonly schema_version: string;         // "v0.1.0"
  readonly outcome: DebuggerOutcome;
  readonly outcome_reason: string;
  readonly reproduction: {
    readonly attempted: boolean;
    readonly reproduced: boolean;
    readonly attempts: number;
    readonly seed: string;
    readonly deterministic: boolean;
  };
  readonly minimised_repro: MinimisedRepro | null;
  readonly failure_timeline: FailureTimeline | null;
  readonly sbfl_result: SBFLResult | null;
  readonly ast_diff: ASTDiff | null;
  readonly root_cause_candidates: readonly RootCauseCandidate[];
  readonly authoritative_top_candidate: RootCauseCandidate | null;
  readonly evidence_pool_ids: readonly string[];
  readonly reproducibility_information: ReproducibilityInformation;
  readonly byte_identity_witness: { readonly before_hash: string; readonly after_hash: string; readonly drift_count: number; readonly drifted: readonly string[] };
  readonly determinism_witness: { readonly first_run_hash: string; readonly second_run_hash: string; readonly identical: boolean };
  readonly limitations: string;
  readonly authorisation: false;            // literal-false
  readonly execution: false;                // literal-false
  readonly authority_boundary: "evidence_producer_only";
  readonly attribution: DebuggerAttribution;
  readonly at: string;                      // ISO-8601 · excluded from deterministic signature
}

// ─── Diagnosis input ─────────────────────────────────────────────

export interface CoverageEntry {
  readonly test_id: string;
  readonly passed: boolean;
  readonly executed_locations: readonly string[];   // "path::line"
}

export interface SourceSnapshot {
  readonly path: string;
  readonly content: string;
}

export interface DiagnosisInput {
  readonly session_id?: string;
  readonly failing_input: unknown;
  readonly seed?: string;

  // Repro harness · a pure function that runs deterministically on given input+seed
  // and returns either an observed failure or null (no failure observed).
  // Passed as a serialised description so callers over HTTP can pass a reference to a
  // registered fixture rather than a raw function.
  readonly reproduction_fixture_id: string;

  // Expected state timeline (optional) for first-divergence detection.
  readonly expected_timeline?: {
    readonly steps: readonly { readonly step_index: number; readonly expected_state_hash: string; readonly note?: string }[];
  };

  // Coverage matrix for SBFL. Optional.
  readonly coverage?: readonly CoverageEntry[];

  // Two source snapshots for AST-diff (baseline vs candidate).
  readonly baseline_sources?: readonly SourceSnapshot[];
  readonly candidate_sources?: readonly SourceSnapshot[];

  readonly reject_llm_attempt?: boolean;
}
