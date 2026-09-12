// WO-WORKSTATION-08 · engineering evidence persistence acceptance tests
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// Real GB storage round-trips against the jsonl backend at
// data/nex-storage/nex1_*_reports.jsonl. No mocks. Each test uses fresh
// trace_ids AND cleans the WO-08 collection files up front so a re-run
// leaves no residue.

import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  saveExecutionReport, loadExecutionReport, listExecutionReportsForTrace,
  saveBuildReport, loadBuildReport, listBuildReportsForTrace,
  saveRuntimeReport, loadRuntimeReport, listRuntimeReportsForTrace,
  saveSpecialistResult, loadSpecialistResult, listSpecialistResultsForTrace,
  listEngineeringHistoryForTrace,
  persistCycle,
} from "../wo8-persist";
import type { ExecutionReport } from "../wo4-types";
import type { BuildReport } from "../wo5-types";
import type { RuntimeReport } from "../wo6-types";
import type { SpecialistResult } from "../wo7-types";

const STORAGE_ROOT = path.join(process.cwd(), "data", "nex-storage");
const WO8_COLLECTIONS = [
  "nex1_execution_reports.jsonl",
  "nex1_build_reports.jsonl",
  "nex1_runtime_reports.jsonl",
  "nex1_specialist_results.jsonl",
];

async function cleanCollections(): Promise<void> {
  for (const name of WO8_COLLECTIONS) {
    const file = path.join(STORAGE_ROOT, name);
    try { await fs.unlink(file); } catch { /* ok */ }
  }
}

// ── Fixture builders (minimal instances of each report type) ────────────

let COUNTER = 0;
function nextIds(): { trace_id: string; wo_id: string; project_id: string } {
  COUNTER++;
  return {
    trace_id: `wo8-test-trace-${Date.now()}-${COUNTER}`,
    wo_id: `wo8-test-wo-${COUNTER}`,
    project_id: `wo8-test-project-${COUNTER}`,
  };
}

function buildExecutionReport(overrides: Partial<ExecutionReport> = {}): ExecutionReport {
  const ids = nextIds();
  return {
    record_type: "NEX1_EXECUTION_REPORT",
    report_id: `wo8-exec-${COUNTER}-${Date.now()}`,
    bundle_id: `wo8-bundle-${COUNTER}`,
    trace_id: ids.trace_id,
    work_order_id: ids.wo_id,
    workspace_root: `/tmp/wo8-workspace-${COUNTER}`,
    written_files: [],
    broker_session_id: `S-${COUNTER}`,
    broker_manifest_hash: `hash-${COUNTER}`,
    observer: {
      record_type: "NEX1_OBSERVER_VERDICT",
      verdict_kind: "MATCH",
      observer_key_id: "observer-key",
      walk_started_at: new Date().toISOString(),
      walk_completed_at: new Date().toISOString(),
      files_observed: 0,
      findings: [],
    },
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    ...overrides,
  };
}

function buildBuildReport(overrides: Partial<BuildReport> = {}): BuildReport {
  const ids = nextIds();
  return {
    record_type: "NEX1_BUILD_REPORT",
    report_id: `wo8-build-${COUNTER}-${Date.now()}`,
    build_id: `wo8-buildid-${COUNTER}`,
    trace_id: ids.trace_id,
    work_order_id: ids.wo_id,
    project_id: ids.project_id,
    executable_ref: "node",
    executable_absolute_path: process.execPath,
    args: ["--version"],
    working_directory_absolute: `/tmp/wo8-workspace-${COUNTER}`,
    workspace_root: `/tmp/wo8-workspace-${COUNTER}`,
    exit_code: 0,
    signal: null,
    stdout: "v24.18.0\n",
    stderr: "",
    stdout_bytes: 9,
    stderr_bytes: 0,
    stdout_truncated: false,
    stderr_truncated: false,
    duration_ms: 42,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    artefacts: [],
    ...overrides,
  };
}

function buildRuntimeReport(overrides: Partial<RuntimeReport> = {}): RuntimeReport {
  const ids = nextIds();
  return {
    record_type: "NEX1_RUNTIME_REPORT",
    report_id: `wo8-runtime-${COUNTER}-${Date.now()}`,
    run_id: `wo8-run-${COUNTER}`,
    trace_id: ids.trace_id,
    work_order_id: ids.wo_id,
    project_id: ids.project_id,
    executable_ref: "node",
    executable_absolute_path: process.execPath,
    args: ["-e", "..."],
    working_directory_absolute: `/tmp/wo8-workspace-${COUNTER}`,
    workspace_root: `/tmp/wo8-workspace-${COUNTER}`,
    port: 4321,
    health_url: `http://127.0.0.1:4321/`,
    child_pid: 99999,
    stdout: "",
    stderr: "",
    stdout_bytes: 0,
    stderr_bytes: 0,
    stdout_truncated: false,
    stderr_truncated: false,
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
    ...overrides,
  };
}

function buildSpecialistResult(overrides: Partial<SpecialistResult> = {}): SpecialistResult {
  const ids = nextIds();
  return {
    record_type: "NEX1_SPECIALIST_RESULT",
    result_id: `wo8-specialist-${COUNTER}-${Date.now()}`,
    invocation_id: `wo8-invocation-${COUNTER}`,
    trace_id: ids.trace_id,
    work_order_id: ids.wo_id,
    project_id: ids.project_id,
    status: "PASSED",
    tool: {
      kind: "node-syntax",
      display_name: "Node syntax check",
      command: "node --check x.js",
      resolved_version: process.version,
    },
    exit_code: 0,
    stdout: "",
    stderr: "",
    stdout_truncated: false,
    stderr_truncated: false,
    findings: [],
    duration_ms: 10,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    evidence_hash: "a".repeat(64),
    non_execution_reason: null,
    ...overrides,
  };
}

// ── Suite ───────────────────────────────────────────────────────────────

describe("WO-WORKSTATION-08 · engineering evidence persistence", () => {
  beforeEach(async () => {
    await cleanCollections();
  });

  // ── 1 · Per-type round-trip ─────────────────────────────────────────

  it("ExecutionReport round-trips through GB storage", async () => {
    const r = buildExecutionReport();
    const save = await saveExecutionReport(r);
    expect(save.ok).toBe(true);
    if (!save.ok) return;
    expect(save.already_present).toBe(false);
    const loaded = await loadExecutionReport(r.report_id);
    expect(loaded).not.toBeNull();
    expect(loaded!.report_id).toBe(r.report_id);
    expect(loaded!.bundle_id).toBe(r.bundle_id);
    expect(loaded!.observer.verdict_kind).toBe("MATCH");
  });

  it("BuildReport round-trips through GB storage", async () => {
    const r = buildBuildReport();
    const save = await saveBuildReport(r);
    expect(save.ok).toBe(true);
    if (!save.ok) return;
    const loaded = await loadBuildReport(r.report_id);
    expect(loaded).not.toBeNull();
    expect(loaded!.exit_code).toBe(0);
    expect(loaded!.executable_ref).toBe("node");
  });

  it("RuntimeReport round-trips through GB storage", async () => {
    const r = buildRuntimeReport();
    const save = await saveRuntimeReport(r);
    expect(save.ok).toBe(true);
    if (!save.ok) return;
    const loaded = await loadRuntimeReport(r.report_id);
    expect(loaded).not.toBeNull();
    expect(loaded!.health?.response_status).toBe(200);
    expect(loaded!.termination?.exit_code_after_termination).toBe(0);
  });

  it("SpecialistResult round-trips through GB storage", async () => {
    const r = buildSpecialistResult();
    const save = await saveSpecialistResult(r);
    expect(save.ok).toBe(true);
    if (!save.ok) return;
    const loaded = await loadSpecialistResult(r.result_id);
    expect(loaded).not.toBeNull();
    expect(loaded!.status).toBe("PASSED");
    expect(loaded!.tool.kind).toBe("node-syntax");
  });

  // ── 2 · Idempotency ─────────────────────────────────────────────────

  it("saveExecutionReport is idempotent on exact resubmission", async () => {
    const r = buildExecutionReport();
    const first = await saveExecutionReport(r);
    const second = await saveExecutionReport(r);
    expect(first.ok).toBe(true); expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.already_present).toBe(false);
    expect(second.already_present).toBe(true);
    // Only one row is present
    const all = await listExecutionReportsForTrace(r.trace_id);
    expect(all).toHaveLength(1);
  });

  it("saveBuildReport is idempotent", async () => {
    const r = buildBuildReport();
    await saveBuildReport(r);
    const dup = await saveBuildReport(r);
    if (!dup.ok) return;
    expect(dup.already_present).toBe(true);
    const all = await listBuildReportsForTrace(r.trace_id);
    expect(all).toHaveLength(1);
  });

  it("saveRuntimeReport is idempotent", async () => {
    const r = buildRuntimeReport();
    await saveRuntimeReport(r);
    const dup = await saveRuntimeReport(r);
    if (!dup.ok) return;
    expect(dup.already_present).toBe(true);
  });

  it("saveSpecialistResult is idempotent", async () => {
    const r = buildSpecialistResult();
    await saveSpecialistResult(r);
    const dup = await saveSpecialistResult(r);
    if (!dup.ok) return;
    expect(dup.already_present).toBe(true);
  });

  // ── 3 · Validation ──────────────────────────────────────────────────

  it("REPORT_MISSING_ID when report_id is empty", async () => {
    const r = { ...buildExecutionReport(), report_id: "" };
    const result = await saveExecutionReport(r);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason_code).toBe("REPORT_MISSING_ID");
  });

  it("REPORT_MISSING_TRACE_ID when trace_id is empty", async () => {
    const r = { ...buildExecutionReport(), trace_id: "" };
    const result = await saveExecutionReport(r);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason_code).toBe("REPORT_MISSING_TRACE_ID");
  });

  // ── 4 · List-by-trace ────────────────────────────────────────────────

  it("listBuildReportsForTrace returns reports sorted by started_at ascending", async () => {
    const trace_id = `wo8-list-trace-${Date.now()}`;
    const t1 = new Date(Date.now() - 3000).toISOString();
    const t2 = new Date(Date.now() - 2000).toISOString();
    const t3 = new Date(Date.now() - 1000).toISOString();
    await saveBuildReport(buildBuildReport({ trace_id, started_at: t2 }));
    await saveBuildReport(buildBuildReport({ trace_id, started_at: t1 }));
    await saveBuildReport(buildBuildReport({ trace_id, started_at: t3 }));
    const list = await listBuildReportsForTrace(trace_id);
    expect(list).toHaveLength(3);
    expect(list[0].started_at).toBe(t1);
    expect(list[1].started_at).toBe(t2);
    expect(list[2].started_at).toBe(t3);
  });

  it("listExecutionReportsForTrace returns empty array when trace has no reports", async () => {
    const list = await listExecutionReportsForTrace(`nonexistent-trace-${Date.now()}`);
    expect(list).toEqual([]);
  });

  // ── 5 · Unified engineering history ──────────────────────────────────

  it("listEngineeringHistoryForTrace merges all four report kinds chronologically", async () => {
    const trace_id = `wo8-history-trace-${Date.now()}`;
    const wo_id = "wo-hist";
    const project_id = "proj-hist";
    const t = (offset: number): string => new Date(Date.now() + offset).toISOString();
    // Persist in mixed order to prove the sort works
    await saveBuildReport(buildBuildReport({ trace_id, work_order_id: wo_id, project_id, started_at: t(200) }));
    await saveExecutionReport(buildExecutionReport({ trace_id, work_order_id: wo_id, started_at: t(100) }));
    await saveRuntimeReport(buildRuntimeReport({ trace_id, work_order_id: wo_id, project_id, started_at: t(300) }));
    await saveSpecialistResult(buildSpecialistResult({ trace_id, work_order_id: wo_id, project_id, started_at: t(400) }));

    const history = await listEngineeringHistoryForTrace(trace_id);
    expect(history).toHaveLength(4);
    expect(history[0].kind).toBe("execution");
    expect(history[1].kind).toBe("build");
    expect(history[2].kind).toBe("runtime");
    expect(history[3].kind).toBe("specialist");
    // Discriminated union pattern works: WO-09 can dispatch on entry.kind
    for (const entry of history) {
      if (entry.kind === "execution")  expect(entry.report.record_type).toBe("NEX1_EXECUTION_REPORT");
      if (entry.kind === "build")      expect(entry.report.record_type).toBe("NEX1_BUILD_REPORT");
      if (entry.kind === "runtime")    expect(entry.report.record_type).toBe("NEX1_RUNTIME_REPORT");
      if (entry.kind === "specialist") expect(entry.result.record_type).toBe("NEX1_SPECIALIST_RESULT");
    }
  });

  it("listEngineeringHistoryForTrace is empty for unknown trace", async () => {
    const history = await listEngineeringHistoryForTrace(`unknown-trace-${Date.now()}`);
    expect(history).toEqual([]);
  });

  // ── 6 · persistCycle · atomic multi-report save ──────────────────────

  it("persistCycle saves every report kind in a single call", async () => {
    const trace_id = `wo8-cycle-trace-${Date.now()}`;
    const wo_id = "wo-cycle";
    const project_id = "proj-cycle";
    const outcome = await persistCycle({
      execution_report: buildExecutionReport({ trace_id, work_order_id: wo_id }),
      build_reports: [buildBuildReport({ trace_id, work_order_id: wo_id, project_id })],
      runtime_reports: [buildRuntimeReport({ trace_id, work_order_id: wo_id, project_id })],
      specialist_results: [
        buildSpecialistResult({ trace_id, work_order_id: wo_id, project_id }),
        buildSpecialistResult({ trace_id, work_order_id: wo_id, project_id }),
      ],
    });
    expect(outcome.any_failed).toBe(false);
    expect(outcome.execution?.ok).toBe(true);
    expect(outcome.builds).toHaveLength(1);
    expect(outcome.runtimes).toHaveLength(1);
    expect(outcome.specialists).toHaveLength(2);

    const history = await listEngineeringHistoryForTrace(trace_id);
    expect(history).toHaveLength(5);   // 1 execution + 1 build + 1 runtime + 2 specialists
  });

  it("persistCycle any_failed is true when any save rejects", async () => {
    const trace_id = `wo8-fail-trace-${Date.now()}`;
    const outcome = await persistCycle({
      execution_report: buildExecutionReport({ trace_id, report_id: "" }),  // will fail
    });
    expect(outcome.any_failed).toBe(true);
    expect(outcome.execution?.ok).toBe(false);
  });

  // ── 7 · Survives process-boundary simulation ─────────────────────────

  it("saved reports survive re-reading via a fresh getStorage() call", async () => {
    // The jsonl backend writes to disk, and load() re-reads on every call.
    // So this test is effectively "does the file persist across load
    // invocations" — which it does because we're not caching.
    const r = buildBuildReport();
    await saveBuildReport(r);
    // A subsequent load reads the file fresh
    const loaded1 = await loadBuildReport(r.report_id);
    const loaded2 = await loadBuildReport(r.report_id);
    expect(loaded1).not.toBeNull();
    expect(loaded2).not.toBeNull();
    expect(loaded1!.report_id).toBe(loaded2!.report_id);
    // Verify the file actually exists on disk
    const file = path.join(STORAGE_ROOT, "nex1_build_reports.jsonl");
    const stat = await fs.stat(file);
    expect(stat.isFile()).toBe(true);
    expect(stat.size).toBeGreaterThan(0);
  });
});
