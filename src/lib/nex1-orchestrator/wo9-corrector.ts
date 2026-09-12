// WO-WORKSTATION-09 · deterministic correction proposer + cycle bounds
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// Given a CycleDiagnosis + the last FilePlan, either propose a corrective
// FilePlan the caller can re-authorize (WO-02) and re-run through the chain
// (WO-04..WO-08), or escalate to the founder when deterministic correction
// isn't possible.
//
// P-Q (correction never creates authority) fully honoured:
//   - proposed plans stay within the trace's existing WO-02 auth scope
//   - proposed plans never touch protected paths (WO-03 challenger will
//     reject those anyway, but we don't attempt them)
//   - proposals requiring new capability, LLM-style reasoning, or scope
//     expansion escalate honestly rather than manufacturing a false fix
//
// The rule library is deliberately small in v0.1. Founder acceptance
// standard: honest UNCORRECTABLE beats false-PASSED correction.

import { randomUUID } from "node:crypto";
import type { FilePlan, FileOp } from "./wo3-types";
import type {
  CycleDiagnosis,
  CorrectionProposal,
  CorrectionCycleState,
  FailureDiagnosis,
  SpecialistSignal,
} from "./wo9-types";
import { DEFAULT_MAX_CORRECTION_ATTEMPTS } from "./wo9-types";

// ── Cycle state helpers ────────────────────────────────────────────────

/** Build the initial cycle state. Attempt 0 has not yet been consumed. */
export function initialCorrectionCycleState(input: {
  readonly trace_id: string;
  readonly max_attempts?: number;
}): CorrectionCycleState {
  return {
    record_type: "NEX1_CORRECTION_CYCLE_STATE",
    cycle_id: `wo9-cycle-${randomUUID()}`,
    trace_id: input.trace_id,
    attempts: 0,
    max_attempts: input.max_attempts ?? DEFAULT_MAX_CORRECTION_ATTEMPTS,
    started_at: new Date().toISOString(),
    last_iteration_at: null,
    rule_history: [],
  };
}

/** Advance the state after an iteration. Returns a fresh state; original
 *  is untouched (immutable pattern -- audit-friendly). */
export function advanceCycleState(state: CorrectionCycleState, rules_applied: readonly string[]): CorrectionCycleState {
  return {
    ...state,
    attempts: state.attempts + 1,
    last_iteration_at: new Date().toISOString(),
    rule_history: [...state.rule_history, ...rules_applied],
  };
}

/** Is another iteration allowed under the bounds? */
export function canContinueCorrection(state: CorrectionCycleState): boolean {
  return state.attempts < state.max_attempts;
}

// ── Public proposer ─────────────────────────────────────────────────────

export function proposeCorrection(input: {
  readonly diagnosis: CycleDiagnosis;
  readonly previous_plan: FilePlan;
  readonly cycle_state: CorrectionCycleState;
}): CorrectionProposal {
  // 0. Bounds check first — if we've exceeded max_attempts, escalate.
  if (!canContinueCorrection(input.cycle_state)) {
    return {
      ok: false,
      kind: "escalate_to_founder",
      escalation_reason: "MAX_ATTEMPTS_EXHAUSTED",
      detail: `correction cycle used ${input.cycle_state.attempts} of ${input.cycle_state.max_attempts} attempts`,
      unhandled_diagnoses: input.diagnosis.failures,
    };
  }

  // 1. Nothing to correct — that's not a failure, that's success.
  if (!input.diagnosis.has_failures) {
    return {
      ok: false,
      kind: "escalate_to_founder",
      escalation_reason: "NO_RULE_MATCHES",
      detail: "diagnosis reports no failures; no correction is required",
      unhandled_diagnoses: [],
    };
  }

  // 2. Split failures into what we can correct and what we can't.
  const rules_applied: string[] = [];
  const unhandled: FailureDiagnosis[] = [];
  const reasons: string[] = [];

  const anyTransient = input.diagnosis.any_transient;
  const anySpecialistUnavailable = input.diagnosis.failures.some((f) => f.kind === "specialist_unavailable");
  const anySignalUncorrectable = input.diagnosis.failures.some((f) =>
    f.kind === "specialist_failed" &&
    f.signals.some((s) => isCorrectableSignal(s) === false),
  );

  // RULE 1 · RETRY_TRANSIENT
  // If EVERY failure is transient, the same plan is a legitimate retry.
  const allTransient = input.diagnosis.failures.every((f) =>
    (f.kind === "build_failed"   && f.is_transient) ||
    (f.kind === "runtime_failed" && f.is_transient),
  );
  if (allTransient && anyTransient) {
    rules_applied.push("RETRY_TRANSIENT");
    return {
      ok: true,
      kind: "retry_same_plan",
      next_plan: freshenPlanId(input.previous_plan),
      rules_applied,
      reasoning: "every failure is transient (timeout / network flake / SIGKILL); retrying the same plan is expected to succeed",
    };
  }

  // RULE 2 · REINVOKE_PLAN_MISSING_FILES
  // Every failure that mentions a "missing target file" for a path that
  // WAS in the previous plan. The most likely root cause is that the
  // WO-04 execution didn't actually write the file, so re-invoking the
  // same plan re-attempts the write.
  const missingPaths = collectMissingTargetPaths(input.diagnosis.failures);
  if (missingPaths.length > 0) {
    const planned = new Set(input.previous_plan.ops.map((op) => op.path));
    const allInPlan = missingPaths.every((p) => planned.has(p));
    // Only apply if EVERY failure is a missing-target-file for a planned path.
    // Mixing this with other failures would silently drop them.
    const allFailuresAreMissingFile = input.diagnosis.failures.every((f) =>
      f.kind === "specialist_failed" && f.signals.every((s) => s.kind === "missing_target_file"),
    );
    if (allInPlan && allFailuresAreMissingFile) {
      rules_applied.push("REINVOKE_PLAN_MISSING_FILES");
      return {
        ok: true,
        kind: "reinvoke_plan_missing_files",
        next_plan: freshenPlanId(input.previous_plan),
        rules_applied,
        reasoning: `missing files ${JSON.stringify(missingPaths)} were in the previous plan; the WO-04 write did not land — re-invoking the plan`,
      };
    }
  }

  // 3. Everything else: escalate honestly. The correct reason depends
  //    on the failure mix.
  for (const f of input.diagnosis.failures) {
    unhandled.push(f);
    reasons.push(explainWhyEscalate(f));
  }

  const escalationReason =
    anySpecialistUnavailable ? "REQUIRES_NEW_CAPABILITY"           // needs `npm install`, or a globally-installed tool
    : anySignalUncorrectable ? "P_S_CANNOT_DECIDE_AUTOMATICALLY"  // syntax / test / lint corrections need reasoning P-S forbids
    : /* default */            "NO_RULE_MATCHES";

  return {
    ok: false,
    kind: "escalate_to_founder",
    escalation_reason: escalationReason,
    detail: reasons.join(" · "),
    unhandled_diagnoses: unhandled,
  };
}

// ── Signal correctability classification ───────────────────────────────

/** Can the corrector deterministically fix this signal? Returns null when
 *  the signal has no correction rule at all (escalate with NO_RULE_MATCHES).
 *  Returns false when the signal is known but the correction requires
 *  reasoning P-S forbids (escalate with P_S_CANNOT_DECIDE_AUTOMATICALLY). */
function isCorrectableSignal(signal: SpecialistSignal): boolean | null {
  switch (signal.kind) {
    case "missing_target_file":
      // Correctable via REINVOKE_PLAN_MISSING_FILES rule (handled above).
      return true;
    case "syntax_error":
      // Needs reasoning about what the code should be. P-S: no LLM.
      return false;
    case "unknown_module":
      // Needs reasoning about what import to add. P-S: no LLM.
      return false;
    case "lint_violation":
      // Could theoretically eslint --fix, but that mutates files outside
      // the plan and is style-dependent. Escalate honestly.
      return false;
    case "test_failure":
      // Real test failure: the code or the test needs to change. P-S.
      return false;
    case "unrecognised":
      return null;
  }
}

function explainWhyEscalate(f: FailureDiagnosis): string {
  switch (f.kind) {
    case "build_failed":
      return `build ${f.build_id} failed with exit ${f.exit_code}${f.signal ? ` (signal ${f.signal})` : ""}`;
    case "runtime_failed":
      return `runtime ${f.run_id} failed with ${f.failure_class}`;
    case "specialist_failed":
      return `specialist ${f.tool} FAILED with ${f.findings.length} finding(s) — automatic correction not supported for these signals`;
    case "specialist_unavailable":
      return `specialist ${f.tool} UNAVAILABLE: ${f.non_execution_reason} — likely needs setup (npm install / global tool)`;
    case "execution_failed":
      return `WO-04 execution mismatch: ${f.detail}`;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

function collectMissingTargetPaths(failures: readonly FailureDiagnosis[]): string[] {
  const paths = new Set<string>();
  for (const f of failures) {
    if (f.kind !== "specialist_failed") continue;
    for (const s of f.signals) {
      if (s.kind === "missing_target_file") paths.add(s.path);
    }
  }
  return Array.from(paths);
}

/** Return a copy of the plan with a fresh plan_id + created_at so
 *  downstream ID uniqueness holds. Ops stay identical -- the point of
 *  a retry is same-content. */
function freshenPlanId(plan: FilePlan): FilePlan {
  return {
    ...plan,
    plan_id: `wo9-corrected-plan-${randomUUID()}`,
    ops: plan.ops.map((op) => ({ ...op }) as FileOp),
    created_at: new Date().toISOString(),
  };
}
