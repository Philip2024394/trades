// WO-WORKSTATION-09 · correction / rebuild loop types
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// Turns the WO-04..WO-08 linear pipeline into a bounded, evidence-driven
// correction loop while remaining strictly under the existing authorization
// boundary. NEX1 proposes; the caller (with founder authority) decides
// whether to accept and re-run. Correction never creates authority (P-Q).

import type { FilePlan } from "./wo3-types";
import type { SpecialistFinding, SpecialistKind } from "./wo7-types";

// ── Failure diagnosis · discriminated union ─────────────────────────────

export type FailureDiagnosis =
  | {
      readonly kind: "build_failed";
      readonly report_id: string;
      readonly build_id: string;
      readonly exit_code: number | null;
      readonly signal: string | null;
      /** True when the WO-05 failure was transient (spawn error / timeout)
       *  and a retry with the same plan is a reasonable correction. */
      readonly is_transient: boolean;
      readonly stderr_excerpt: string;
    }
  | {
      readonly kind: "runtime_failed";
      readonly report_id: string;
      readonly run_id: string;
      /** The specific WO-06 failure surface. */
      readonly failure_class:
        | "PROCESS_EXITED_EARLY"
        | "HEALTH_CHECK_TIMEOUT"
        | "HEALTH_UNEXPECTED_STATUS"
        | "HEALTH_UNEXPECTED_BODY";
      readonly is_transient: boolean;
      readonly stderr_excerpt: string;
    }
  | {
      readonly kind: "specialist_failed";
      readonly result_id: string;
      readonly tool: SpecialistKind;
      readonly findings: readonly SpecialistFinding[];
      /** Structured signals extracted from findings that a correction
       *  rule can pattern-match on. Populated by the diagnoser. */
      readonly signals: readonly SpecialistSignal[];
    }
  | {
      readonly kind: "specialist_unavailable";
      readonly result_id: string;
      readonly tool: SpecialistKind;
      readonly non_execution_reason: string;
      /** Not always a "failure" — but WO-09 records it so the caller can
       *  distinguish "specialist said code is broken" from "specialist
       *  couldn't even run" (which usually means npm install / setup). */
    }
  | {
      readonly kind: "execution_failed";
      readonly report_id: string;
      readonly detail: string;
    };

/** Compact structured signal a corrector rule can match on. */
export type SpecialistSignal =
  | { readonly kind: "syntax_error";        readonly path: string | null; readonly line: number | null; readonly message: string }
  | { readonly kind: "missing_target_file"; readonly path: string;         readonly detail: string }
  | { readonly kind: "unknown_module";      readonly module_name: string;  readonly path: string | null; readonly line: number | null }
  | { readonly kind: "lint_violation";      readonly rule: string;         readonly path: string | null; readonly line: number | null }
  | { readonly kind: "test_failure";        readonly test_name: string;    readonly detail: string }
  | { readonly kind: "unrecognised";        readonly finding_message: string };

// ── Cycle diagnosis (top-level result of diagnoseHistory) ───────────────

export interface CycleDiagnosis {
  readonly record_type: "NEX1_CYCLE_DIAGNOSIS";
  readonly trace_id: string;
  readonly has_failures: boolean;
  readonly failures: readonly FailureDiagnosis[];
  /** True when at least one failure looks retriable (transient) rather
   *  than a real code defect. Corrector uses this to prefer retry over
   *  escalation when both are options. */
  readonly any_transient: boolean;
  readonly diagnosed_at: string;
}

// ── Correction proposal ─────────────────────────────────────────────────

export type CorrectionProposal =
  | {
      readonly ok: true;
      readonly kind: "retry_same_plan"
                    | "reinvoke_plan_missing_files"
                    | "modified_plan";
      readonly next_plan: FilePlan;
      /** Which rule(s) produced this proposal. Human-readable +
       *  audit-friendly. */
      readonly rules_applied: readonly string[];
      readonly reasoning: string;
    }
  | {
      readonly ok: false;
      readonly kind: "escalate_to_founder";
      readonly escalation_reason: EscalationReason;
      readonly detail: string;
      readonly unhandled_diagnoses: readonly FailureDiagnosis[];
    };

export type EscalationReason =
  | "NO_RULE_MATCHES"                  // rule library has no correction for this pattern
  | "REQUIRES_LLM_REASONING"           // deterministic correction impossible for this class
  | "REQUIRES_NEW_CAPABILITY"          // correction needs auth beyond current scope
  | "MAX_ATTEMPTS_EXHAUSTED"           // cycle bounded and we've tried enough
  | "AMBIGUOUS_DIAGNOSIS"              // multiple conflicting failures
  | "P_S_CANNOT_DECIDE_AUTOMATICALLY"; // P-S: no LLM means no automatic reasoning

// ── Cycle state · bounds enforcement ────────────────────────────────────

/** Immutable cycle state passed between iterations. Callers construct
 *  the initial state, receive an updated one after each iteration, and
 *  check `canContinue` before proposing another correction. */
export interface CorrectionCycleState {
  readonly record_type: "NEX1_CORRECTION_CYCLE_STATE";
  readonly cycle_id: string;
  readonly trace_id: string;
  readonly attempts: number;
  readonly max_attempts: number;
  readonly started_at: string;
  readonly last_iteration_at: string | null;
  /** Rules applied in each attempt so far. Kept for audit + so the
   *  corrector can avoid proposing the same rule on the same failure
   *  twice in a row (which would loop). */
  readonly rule_history: readonly string[];
}

/** Test hook + default. */
export const DEFAULT_MAX_CORRECTION_ATTEMPTS = 5;
