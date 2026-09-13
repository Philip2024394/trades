// WO-ACADEMY-02 · training types.
//
// Founder-authorised 2026-09-13 (option b · with modification).
// Doctrine §11.4 · TRAINING ACTIVITY ≠ ACTUAL IMPROVEMENT.
//
// Every record is content-hashed + provenance-chained. Baseline is
// IMMUTABLE — once persisted, its bytes never change. A REGRESSION_
// INTRODUCED verdict leaves the pre-training baseline recoverable.

// ── Training program ────────────────────────────────────────────────────

export type TrainingKind =
  | "knowledge"
  | "skill"
  | "failure"
  | "recovery"
  | "generalisation";

export interface TrainingProgram {
  readonly record_type: "NEX_ACADEMY_TRAINING_PROGRAM";
  readonly program_id: string;
  readonly target_agent_id: string;
  readonly domain: string;
  readonly training_kind: TrainingKind;
  /** Identify the specific weakness this program targets. Founder-locked
   *  causal-chain requirement: training MUST declare what it is trying
   *  to fix. */
  readonly targeted_weakness: string;
  /** The exact task ids used for baseline measurement. These same ids
   *  are used for post-training measurement (§6 rule 2 causal-chain
   *  enforcer). */
  readonly baseline_task_ids: readonly string[];
  /** Cases the training exercise sees. MUST be disjoint from generalisation. */
  readonly training_task_ids: readonly string[];
  /** Held-out cases the training exercise NEVER sees. */
  readonly generalisation_task_ids: readonly string[];
  /** Deliberately-difficult cases testing the rule under adversarial input. */
  readonly adversarial_task_ids: readonly string[];
  /** Previously-mastered cases that must still pass. */
  readonly regression_task_ids: readonly string[];
  readonly max_attempts: number;
  readonly deterministic_seed: string;
  readonly created_at: string;
  /** The founder-signed WO that authorised THIS training program run. */
  readonly authorising_wo_id: string;
  readonly provenance_chain_hash: string;
}

// ── Baseline snapshot (frozen · immutable) ─────────────────────────────

export interface BaselineMetrics {
  readonly task_completion_ratio: number;
  readonly accuracy: number;
  readonly reliability: number;
  readonly failure_classes: readonly { readonly kind: string; readonly count: number }[];
  readonly targeted_weakness_score: number;   // 0..1 measured on baseline task set
}

export interface BaselineSnapshot {
  readonly record_type: "NEX_ACADEMY_BASELINE";
  readonly baseline_id: string;
  readonly program_id: string;
  readonly agent_id: string;
  readonly captured_at: string;
  readonly baseline_task_ids: readonly string[];   // frozen; same as TrainingProgram.baseline_task_ids
  readonly baseline_metrics: BaselineMetrics;
  readonly evidence_pointers: readonly string[];
  /** SHA-256 over the frozen fields above. Provides the reversibility
   *  guarantee — pre-training baseline bytes are content-verifiable. */
  readonly frozen_hash: string;
  readonly provenance_chain_hash: string;
}

// ── Training run + outcomes ────────────────────────────────────────────

export type OutcomeKind = "SUCCESS" | "FAILURE" | "LIMITATION";

export interface TaskOutcome {
  readonly task_id: string;
  readonly outcome: OutcomeKind;
  readonly evidence_pointer: string;
  readonly matched_pattern: string | null;   // which candidate rule (if any) matched
}

export interface TrainingRun {
  readonly record_type: "NEX_ACADEMY_TRAINING_RUN";
  readonly run_id: string;
  readonly program_id: string;
  readonly agent_id: string;
  readonly baseline_id: string;
  readonly started_at: string;
  readonly finished_at: string;

  /** Outcomes on the SAME baseline_task_ids, measured AFTER training with
   *  the candidate rule set applied. Causal-chain enforcer input. */
  readonly post_baseline_outcomes: readonly TaskOutcome[];
  readonly training_outcomes: readonly TaskOutcome[];
  readonly generalisation_outcomes: readonly TaskOutcome[];
  readonly adversarial_outcomes: readonly TaskOutcome[];
  readonly regression_outcomes: readonly TaskOutcome[];

  readonly post_metrics: BaselineMetrics;
  readonly candidate_rules: readonly {
    readonly rule_id: string;
    readonly description: string;
    readonly pattern_regex: string;
    readonly finding_rule: string;   // e.g. "esm-import-outside-module"
  }[];
  readonly resource_usage: { readonly runtime_ms: number };
  readonly provenance_chain_hash: string;
}

// ── Verdict ────────────────────────────────────────────────────────────

export type TrainingVerdictKind =
  | "IMPROVED"
  | "NO_IMPROVEMENT"
  | "GENERALISATION_FAILED"
  | "REGRESSION_INTRODUCED"
  | "INSUFFICIENT_EVIDENCE";

export interface TrainingVerdict {
  readonly record_type: "NEX_ACADEMY_TRAINING_VERDICT";
  readonly verdict_id: string;
  readonly run_id: string;
  readonly baseline_id: string;   // FK to the FROZEN baseline
  readonly kind: TrainingVerdictKind;
  readonly baseline_metrics_snapshot: BaselineMetrics;
  readonly post_metrics_snapshot: BaselineMetrics;
  readonly deltas: {
    readonly task_completion_ratio: number;
    readonly accuracy: number;
    readonly reliability: number;
    readonly targeted_weakness_score: number;
  };
  readonly held_out_success_ratio: number;
  readonly adversarial_success_ratio: number;
  readonly regression_failures: number;
  readonly baseline_frozen_hash_verified: boolean;   // baseline bytes unchanged?
  readonly baseline_benchmark_matched: boolean;      // same task_ids used pre + post?
  readonly rationale: string;
  readonly rule_addition_proposal_id: string | null;
  readonly provenance_chain_hash: string;
}

// ── Rule addition proposal ─────────────────────────────────────────────

export interface RuleAdditionProposal {
  readonly record_type: "NEX_ACADEMY_RULE_ADDITION_PROPOSAL";
  readonly proposal_id: string;
  readonly training_run_id: string;
  readonly target_agent_id: string;
  readonly target_module_path: string;
  readonly proposed_rule: {
    readonly rule_id: string;
    readonly description: string;
    readonly pattern_or_predicate: string;
    readonly finding_rule: string;
    readonly evidence_pointers: readonly string[];
  };
  readonly recommended_wo_action: string;
  readonly authorised_by: null;
  readonly authorising_wo_id: null;
  readonly provenance_chain_hash: string;
}
