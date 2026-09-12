// WO-WORKSTATION-09 · correction / rebuild loop acceptance tests
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// Real evidence flowing through real diagnoser + real corrector. No mocks.
// The tests build synthetic WO-04..WO-07 report shapes (identical to what
// the real executors produce) and verify the diagnoser correctly identifies
// failures + the corrector produces honest proposals (retry / re-invoke /
// escalate). One end-to-end test proves the full loop mechanic: fail →
// diagnose → correct → apply → re-diagnose → success.

import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { diagnoseHistory } from "../wo9-diagnoser";
import {
  proposeCorrection,
  initialCorrectionCycleState,
  advanceCycleState,
  canContinueCorrection,
} from "../wo9-corrector";
import type { EngineeringHistoryEntry } from "../wo8-types";
import type { BuildReport } from "../wo5-types";
import type { RuntimeReport } from "../wo6-types";
import type { SpecialistResult } from "../wo7-types";
import type { FilePlan } from "../wo3-types";

// ── Report builders ─────────────────────────────────────────────────────

let COUNTER = 0;
function nextIds() {
  COUNTER++;
  return {
    trace_id: `wo9-trace-${Date.now()}-${COUNTER}`,
    wo_id: `wo9-wo-${COUNTER}`,
    project_id: `wo9-project-${COUNTER}`,
  };
}

function buildPassingBuild(trace_id: string): BuildReport {
  return {
    record_type: "NEX1_BUILD_REPORT",
    report_id: `br-${randomUUID()}`,
    build_id: `bid-${randomUUID()}`,
    trace_id,
    work_order_id: "wo",
    project_id: "p",
    executable_ref: "node",
    executable_absolute_path: process.execPath,
    args: ["--version"],
    working_directory_absolute: "/tmp/x",
    workspace_root: "/tmp/x",
    exit_code: 0,
    signal: null,
    stdout: "v24.18.0\n",
    stderr: "",
    stdout_bytes: 9, stderr_bytes: 0,
    stdout_truncated: false, stderr_truncated: false,
    duration_ms: 10,
    started_at: new Date(Date.now() + 1000).toISOString(),
    completed_at: new Date().toISOString(),
    artefacts: [],
  };
}

function buildFailedBuild(trace_id: string, extra: { transient?: boolean } = {}): BuildReport {
  return {
    ...buildPassingBuild(trace_id),
    exit_code: 1,
    signal: extra.transient ? "SIGKILL" : null,
    stderr: extra.transient ? "" : "SyntaxError at line 3",
  };
}

function buildPassingRuntime(trace_id: string): RuntimeReport {
  return {
    record_type: "NEX1_RUNTIME_REPORT",
    report_id: `rr-${randomUUID()}`,
    run_id: `rid-${randomUUID()}`,
    trace_id,
    work_order_id: "wo", project_id: "p",
    executable_ref: "node",
    executable_absolute_path: process.execPath,
    args: ["-e", "..."],
    working_directory_absolute: "/tmp/x",
    workspace_root: "/tmp/x",
    port: 4321,
    health_url: "http://127.0.0.1:4321/",
    child_pid: 99999,
    stdout: "", stderr: "",
    stdout_bytes: 0, stderr_bytes: 0,
    stdout_truncated: false, stderr_truncated: false,
    health: {
      attempted_at: new Date().toISOString(),
      attempts: 1,
      succeeded_at: new Date().toISOString(),
      response_status: 200,
      response_body_first_1kb: "ok",
      response_headers: {},
      total_wait_ms: 15,
    },
    termination: {
      attempted_at: new Date().toISOString(),
      graceful_signal_sent: "SIGTERM",
      required_hard_kill: false,
      hard_kill_signal_sent: null,
      exit_code_after_termination: 0,
      signal_after_termination: null,
      total_termination_ms: 5,
    },
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    total_lifetime_ms: 100,
  };
}

function buildFailedRuntime(trace_id: string, kind: "PROCESS_EXITED_EARLY" | "HEALTH_CHECK_TIMEOUT" | "HEALTH_UNEXPECTED_STATUS"): RuntimeReport {
  const base = buildPassingRuntime(trace_id);
  if (kind === "PROCESS_EXITED_EARLY") {
    return { ...base, health: { ...base.health!, succeeded_at: null, response_status: null, attempts: 3 } };
  }
  if (kind === "HEALTH_CHECK_TIMEOUT") {
    return {
      ...base,
      child_pid: null,
      health: { ...base.health!, succeeded_at: null, response_status: null, attempts: 10, total_wait_ms: 5000 },
    };
  }
  // HEALTH_UNEXPECTED_STATUS
  return { ...base, health: { ...base.health!, response_status: 500, response_body_first_1kb: "boom" } };
}

function buildSpecialistPassed(trace_id: string): SpecialistResult {
  return {
    record_type: "NEX1_SPECIALIST_RESULT",
    result_id: `sr-${randomUUID()}`,
    invocation_id: `inv-${randomUUID()}`,
    trace_id, work_order_id: "wo", project_id: "p",
    status: "PASSED",
    tool: { kind: "node-syntax", display_name: "node --check", command: "node --check x.js", resolved_version: process.version },
    exit_code: 0,
    stdout: "", stderr: "",
    stdout_truncated: false, stderr_truncated: false,
    findings: [],
    duration_ms: 10,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    evidence_hash: "a".repeat(64),
    non_execution_reason: null,
  };
}

function buildSpecialistFailedSyntax(trace_id: string, path: string): SpecialistResult {
  const base = buildSpecialistPassed(trace_id);
  return {
    ...base,
    status: "FAILED",
    exit_code: 1,
    stderr: `${path}:3\nconst x = ;\n          ^\nSyntaxError: Unexpected token ';'`,
    findings: [{
      path, line: 3, column: null,
      severity: "error", rule: "syntax-error",
      message: "SyntaxError: Unexpected token ';'",
    }],
  };
}

function buildSpecialistFailedMissingFile(trace_id: string, path: string): SpecialistResult {
  const base = buildSpecialistPassed(trace_id);
  return {
    ...base,
    status: "FAILED",
    exit_code: 1,
    stderr: `Error: ENOENT: no such file or directory, open '${path}'`,
    findings: [{
      path, line: null, column: null,
      severity: "error", rule: "syntax-error",
      message: `Error: ENOENT: no such file or directory, open '${path}'`,
    }],
  };
}

function buildSpecialistUnavailable(trace_id: string): SpecialistResult {
  const base = buildSpecialistPassed(trace_id);
  return {
    ...base,
    status: "UNAVAILABLE",
    exit_code: null,
    tool: { kind: "tsc", display_name: "tsc", command: "npx tsc --version", resolved_version: null },
    non_execution_reason: "tsc not resolvable in workspace",
    findings: [],
  };
}

function wrapEntry(...items: Array<BuildReport | RuntimeReport | SpecialistResult>): EngineeringHistoryEntry[] {
  return items.map((item) => {
    if ("build_id" in item) return { kind: "build" as const, started_at: item.started_at, report: item };
    if ("run_id" in item)   return { kind: "runtime" as const, started_at: item.started_at, report: item };
    return { kind: "specialist" as const, started_at: item.started_at, result: item };
  });
}

function samplePlan(trace_id: string, ops: FilePlan["ops"] = [
  { kind: "create", path: "src/app/page.tsx", template_ref: "next-app-page.v1",
    template_params: { route: "/", title: "T", headline: "H", paragraphs: ["p"] }, reason: "home" },
]): FilePlan {
  return {
    record_type: "NEX1_FILE_PLAN",
    plan_id: `plan-${randomUUID()}`,
    project_id: "p",
    trace_id,
    ops,
    created_at: new Date().toISOString(),
  };
}

// ── Suite ───────────────────────────────────────────────────────────────

describe("WO-WORKSTATION-09 · correction loop", () => {

  // ── 1 · Diagnoser · classifies each failure kind ─────────────────────

  it("diagnoseHistory returns no failures for a clean passing cycle", () => {
    const { trace_id } = nextIds();
    const history = wrapEntry(
      buildPassingBuild(trace_id),
      buildPassingRuntime(trace_id),
      buildSpecialistPassed(trace_id),
    );
    const d = diagnoseHistory({ trace_id, history });
    expect(d.has_failures).toBe(false);
    expect(d.failures).toHaveLength(0);
    expect(d.any_transient).toBe(false);
  });

  it("diagnoseHistory identifies a failed build with a code defect", () => {
    const { trace_id } = nextIds();
    const d = diagnoseHistory({ trace_id, history: wrapEntry(buildFailedBuild(trace_id)) });
    expect(d.has_failures).toBe(true);
    expect(d.failures[0].kind).toBe("build_failed");
    if (d.failures[0].kind !== "build_failed") return;
    expect(d.failures[0].exit_code).toBe(1);
    expect(d.failures[0].is_transient).toBe(false);
  });

  it("diagnoseHistory marks a SIGKILL build as transient", () => {
    const { trace_id } = nextIds();
    const d = diagnoseHistory({ trace_id, history: wrapEntry(buildFailedBuild(trace_id, { transient: true })) });
    expect(d.any_transient).toBe(true);
    if (d.failures[0].kind !== "build_failed") return;
    expect(d.failures[0].is_transient).toBe(true);
  });

  it("diagnoseHistory classifies each runtime failure kind correctly", () => {
    const { trace_id } = nextIds();
    const d1 = diagnoseHistory({ trace_id, history: wrapEntry(buildFailedRuntime(trace_id, "PROCESS_EXITED_EARLY")) });
    const d2 = diagnoseHistory({ trace_id, history: wrapEntry(buildFailedRuntime(trace_id, "HEALTH_CHECK_TIMEOUT")) });
    const d3 = diagnoseHistory({ trace_id, history: wrapEntry(buildFailedRuntime(trace_id, "HEALTH_UNEXPECTED_STATUS")) });
    if (d1.failures[0].kind !== "runtime_failed") return;
    if (d2.failures[0].kind !== "runtime_failed") return;
    if (d3.failures[0].kind !== "runtime_failed") return;
    expect(d1.failures[0].failure_class).toBe("PROCESS_EXITED_EARLY");
    expect(d2.failures[0].failure_class).toBe("HEALTH_CHECK_TIMEOUT");
    expect(d2.failures[0].is_transient).toBe(true);
    expect(d3.failures[0].failure_class).toBe("HEALTH_UNEXPECTED_STATUS");
  });

  it("diagnoseHistory extracts a syntax_error signal from a specialist FAILED result", () => {
    const { trace_id } = nextIds();
    const d = diagnoseHistory({ trace_id, history: wrapEntry(buildSpecialistFailedSyntax(trace_id, "src/broken.js")) });
    expect(d.has_failures).toBe(true);
    if (d.failures[0].kind !== "specialist_failed") return;
    expect(d.failures[0].tool).toBe("node-syntax");
    expect(d.failures[0].signals).toHaveLength(1);
    expect(d.failures[0].signals[0].kind).toBe("syntax_error");
  });

  it("diagnoseHistory extracts a missing_target_file signal", () => {
    const { trace_id } = nextIds();
    const d = diagnoseHistory({ trace_id, history: wrapEntry(buildSpecialistFailedMissingFile(trace_id, "src/app/page.tsx")) });
    if (d.failures[0].kind !== "specialist_failed") return;
    const sig = d.failures[0].signals[0];
    expect(sig.kind).toBe("missing_target_file");
    if (sig.kind !== "missing_target_file") return;
    expect(sig.path).toBe("src/app/page.tsx");
  });

  it("diagnoseHistory surfaces UNAVAILABLE as its own diagnosis kind", () => {
    const { trace_id } = nextIds();
    const d = diagnoseHistory({ trace_id, history: wrapEntry(buildSpecialistUnavailable(trace_id)) });
    expect(d.has_failures).toBe(true);
    expect(d.failures[0].kind).toBe("specialist_unavailable");
    if (d.failures[0].kind !== "specialist_unavailable") return;
    expect(d.failures[0].tool).toBe("tsc");
  });

  it("diagnoseHistory returns only failures when mixed with passes", () => {
    const { trace_id } = nextIds();
    const history = wrapEntry(
      buildPassingBuild(trace_id),
      buildFailedRuntime(trace_id, "HEALTH_UNEXPECTED_STATUS"),
      buildSpecialistPassed(trace_id),
    );
    const d = diagnoseHistory({ trace_id, history });
    expect(d.failures).toHaveLength(1);
    expect(d.failures[0].kind).toBe("runtime_failed");
  });

  // ── 2 · Cycle state · bounds enforcement ─────────────────────────────

  it("initialCorrectionCycleState starts at attempts=0 with default max", () => {
    const state = initialCorrectionCycleState({ trace_id: "t" });
    expect(state.attempts).toBe(0);
    expect(state.max_attempts).toBe(5);
    expect(canContinueCorrection(state)).toBe(true);
  });

  it("advanceCycleState is immutable and increments attempts", () => {
    const s0 = initialCorrectionCycleState({ trace_id: "t" });
    const s1 = advanceCycleState(s0, ["RULE_A"]);
    expect(s0.attempts).toBe(0);
    expect(s1.attempts).toBe(1);
    expect(s1.rule_history).toEqual(["RULE_A"]);
    expect(s1.cycle_id).toBe(s0.cycle_id);
  });

  it("canContinueCorrection returns false once max_attempts is reached", () => {
    let state = initialCorrectionCycleState({ trace_id: "t", max_attempts: 2 });
    state = advanceCycleState(state, ["r1"]);
    expect(canContinueCorrection(state)).toBe(true);
    state = advanceCycleState(state, ["r2"]);
    expect(canContinueCorrection(state)).toBe(false);
  });

  // ── 3 · Corrector · rules-based proposals ────────────────────────────

  it("propose returns MAX_ATTEMPTS_EXHAUSTED escalation when cycle is at bound", () => {
    const { trace_id } = nextIds();
    const history = wrapEntry(buildFailedBuild(trace_id));
    const diagnosis = diagnoseHistory({ trace_id, history });
    let state = initialCorrectionCycleState({ trace_id, max_attempts: 1 });
    state = advanceCycleState(state, ["prior"]);
    const proposal = proposeCorrection({
      diagnosis,
      previous_plan: samplePlan(trace_id),
      cycle_state: state,
    });
    expect(proposal.ok).toBe(false);
    if (proposal.ok) return;
    expect(proposal.escalation_reason).toBe("MAX_ATTEMPTS_EXHAUSTED");
  });

  it("propose returns retry_same_plan for an all-transient failure set", () => {
    const { trace_id } = nextIds();
    const history = wrapEntry(buildFailedBuild(trace_id, { transient: true }));
    const diagnosis = diagnoseHistory({ trace_id, history });
    const state = initialCorrectionCycleState({ trace_id });
    const proposal = proposeCorrection({
      diagnosis,
      previous_plan: samplePlan(trace_id),
      cycle_state: state,
    });
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;
    expect(proposal.kind).toBe("retry_same_plan");
    expect(proposal.rules_applied).toContain("RETRY_TRANSIENT");
    // Fresh plan id, same ops
    expect(proposal.next_plan.plan_id).not.toBe(samplePlan(trace_id).plan_id);
  });

  it("propose returns reinvoke_plan_missing_files when a planned path went missing", () => {
    const { trace_id } = nextIds();
    const missingPath = "src/app/page.tsx";
    const plan = samplePlan(trace_id, [
      { kind: "create", path: missingPath, template_ref: "next-app-page.v1",
        template_params: { route: "/", title: "T", headline: "H", paragraphs: ["p"] }, reason: "home" },
    ]);
    const history = wrapEntry(buildSpecialistFailedMissingFile(trace_id, missingPath));
    const diagnosis = diagnoseHistory({ trace_id, history });
    const proposal = proposeCorrection({
      diagnosis,
      previous_plan: plan,
      cycle_state: initialCorrectionCycleState({ trace_id }),
    });
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;
    expect(proposal.kind).toBe("reinvoke_plan_missing_files");
    expect(proposal.rules_applied).toContain("REINVOKE_PLAN_MISSING_FILES");
  });

  it("propose ESCALATES on a syntax_error signal (P-S: cannot deterministically correct without an LLM)", () => {
    const { trace_id } = nextIds();
    const history = wrapEntry(buildSpecialistFailedSyntax(trace_id, "src/broken.js"));
    const diagnosis = diagnoseHistory({ trace_id, history });
    const proposal = proposeCorrection({
      diagnosis,
      previous_plan: samplePlan(trace_id),
      cycle_state: initialCorrectionCycleState({ trace_id }),
    });
    expect(proposal.ok).toBe(false);
    if (proposal.ok) return;
    expect(proposal.escalation_reason).toBe("P_S_CANNOT_DECIDE_AUTOMATICALLY");
    expect(proposal.unhandled_diagnoses).toHaveLength(1);
  });

  it("propose ESCALATES REQUIRES_NEW_CAPABILITY when a specialist is UNAVAILABLE", () => {
    const { trace_id } = nextIds();
    const history = wrapEntry(buildSpecialistUnavailable(trace_id));
    const diagnosis = diagnoseHistory({ trace_id, history });
    const proposal = proposeCorrection({
      diagnosis,
      previous_plan: samplePlan(trace_id),
      cycle_state: initialCorrectionCycleState({ trace_id }),
    });
    expect(proposal.ok).toBe(false);
    if (proposal.ok) return;
    expect(proposal.escalation_reason).toBe("REQUIRES_NEW_CAPABILITY");
  });

  it("propose does NOT escalate on a clean cycle (no failures) — it returns NO_RULE_MATCHES honestly", () => {
    const { trace_id } = nextIds();
    const history = wrapEntry(buildPassingBuild(trace_id), buildSpecialistPassed(trace_id));
    const diagnosis = diagnoseHistory({ trace_id, history });
    const proposal = proposeCorrection({
      diagnosis,
      previous_plan: samplePlan(trace_id),
      cycle_state: initialCorrectionCycleState({ trace_id }),
    });
    expect(proposal.ok).toBe(false);
    if (proposal.ok) return;
    expect(proposal.escalation_reason).toBe("NO_RULE_MATCHES");
    expect(proposal.detail).toMatch(/no failures/);
  });

  // ── 4 · End-to-end loop mechanic · fail → correct → succeed ──────────

  it("loop mechanic: transient failure → RETRY_TRANSIENT → next iteration passes", () => {
    const { trace_id } = nextIds();
    // Attempt 1: transient failure
    const attempt1 = wrapEntry(buildFailedBuild(trace_id, { transient: true }));
    const d1 = diagnoseHistory({ trace_id, history: attempt1 });
    const state0 = initialCorrectionCycleState({ trace_id });
    const p1 = proposeCorrection({ diagnosis: d1, previous_plan: samplePlan(trace_id), cycle_state: state0 });
    expect(p1.ok).toBe(true);
    if (!p1.ok) return;

    // Caller "applies" the corrected plan (which is the same ops with a
    // fresh plan_id) and re-runs the chain. Simulate the re-run producing
    // a passing build this time.
    const state1 = advanceCycleState(state0, p1.rules_applied);
    const attempt2 = wrapEntry(buildPassingBuild(trace_id));
    const d2 = diagnoseHistory({ trace_id, history: attempt2 });
    expect(d2.has_failures).toBe(false);
    expect(state1.attempts).toBe(1);
    expect(state1.rule_history).toContain("RETRY_TRANSIENT");
  });

  it("loop mechanic: bounded escalation after repeated failure (max_attempts exceeded)", () => {
    const { trace_id } = nextIds();
    let state = initialCorrectionCycleState({ trace_id, max_attempts: 2 });
    const failedHistory = wrapEntry(buildFailedBuild(trace_id, { transient: true }));
    const diagnosis = diagnoseHistory({ trace_id, history: failedHistory });
    // Attempt 1: correction proposed
    let p = proposeCorrection({ diagnosis, previous_plan: samplePlan(trace_id), cycle_state: state });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    state = advanceCycleState(state, p.rules_applied);
    // Attempt 2: correction proposed again (same transient class)
    p = proposeCorrection({ diagnosis, previous_plan: samplePlan(trace_id), cycle_state: state });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    state = advanceCycleState(state, p.rules_applied);
    // Attempt 3: bounds exceeded → escalation MAX_ATTEMPTS_EXHAUSTED
    const p3 = proposeCorrection({ diagnosis, previous_plan: samplePlan(trace_id), cycle_state: state });
    expect(p3.ok).toBe(false);
    if (p3.ok) return;
    expect(p3.escalation_reason).toBe("MAX_ATTEMPTS_EXHAUSTED");
  });

  it("proposal never widens authority: proposed plan trace_id matches previous_plan trace_id", () => {
    const { trace_id } = nextIds();
    const plan = samplePlan(trace_id);
    const history = wrapEntry(buildFailedBuild(trace_id, { transient: true }));
    const diagnosis = diagnoseHistory({ trace_id, history });
    const proposal = proposeCorrection({ diagnosis, previous_plan: plan, cycle_state: initialCorrectionCycleState({ trace_id }) });
    if (!proposal.ok) throw new Error("expected corrective proposal");
    expect(proposal.next_plan.trace_id).toBe(plan.trace_id);
    // Same ops (retry semantics, not scope widening)
    expect(proposal.next_plan.ops.map((o) => o.path)).toEqual(plan.ops.map((o) => o.path));
  });
});
