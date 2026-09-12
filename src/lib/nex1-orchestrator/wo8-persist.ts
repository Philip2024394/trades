// WO-WORKSTATION-08 · engineering evidence persistence
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// Save / load / list the four report kinds from WO-04..WO-07 through the
// existing GB storage abstraction (getStorage() from nex/storage/registry).
// jsonl backend by default; postgres/dual-write via NEX_STORAGE_BACKEND.
// NEX GB storage canonical per ADR-0319 correction to ADR-0318. Not Supabase.
//
// Additive layer -- WO-04..WO-07 executors are unchanged. Callers who want
// durability import from this module explicitly. Backwards compatible with
// callers that only need the in-memory reports.

import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import type { ExecutionReport } from "./wo4-types";
import type { BuildReport } from "./wo5-types";
import type { RuntimeReport } from "./wo6-types";
import type { SpecialistResult } from "./wo7-types";
import type { EngineeringHistoryEntry, PersistResult } from "./wo8-types";

// ── ExecutionReport (WO-04) ─────────────────────────────────────────────

export async function saveExecutionReport(report: ExecutionReport): Promise<PersistResult> {
  if (!report.report_id) return { ok: false, reason_code: "REPORT_MISSING_ID", reason: "ExecutionReport.report_id is required" };
  if (!report.trace_id) return { ok: false, reason_code: "REPORT_MISSING_TRACE_ID", reason: "ExecutionReport.trace_id is required" };
  const existing = await loadExecutionReport(report.report_id);
  if (existing) return { ok: true, already_present: true };
  try {
    await getStorage().save(COLLECTIONS.nex1_execution_reports, report);
    return { ok: true, already_present: false };
  } catch (err) {
    return { ok: false, reason_code: "STORAGE_UNAVAILABLE", reason: (err as Error).message };
  }
}

export async function loadExecutionReport(report_id: string): Promise<ExecutionReport | null> {
  const rows = await getStorage().query<ExecutionReport>(COLLECTIONS.nex1_execution_reports, {
    where: { report_id },
    limit: 1,
  });
  return rows[0] ?? null;
}

export async function listExecutionReportsForTrace(trace_id: string): Promise<ExecutionReport[]> {
  return getStorage().query<ExecutionReport>(COLLECTIONS.nex1_execution_reports, {
    where: { trace_id },
    limit: 10000,
    order_by: "started_at",
    order_dir: "asc",
  });
}

// ── BuildReport (WO-05) ─────────────────────────────────────────────────

export async function saveBuildReport(report: BuildReport): Promise<PersistResult> {
  if (!report.report_id) return { ok: false, reason_code: "REPORT_MISSING_ID", reason: "BuildReport.report_id is required" };
  if (!report.trace_id) return { ok: false, reason_code: "REPORT_MISSING_TRACE_ID", reason: "BuildReport.trace_id is required" };
  const existing = await loadBuildReport(report.report_id);
  if (existing) return { ok: true, already_present: true };
  try {
    await getStorage().save(COLLECTIONS.nex1_build_reports, report);
    return { ok: true, already_present: false };
  } catch (err) {
    return { ok: false, reason_code: "STORAGE_UNAVAILABLE", reason: (err as Error).message };
  }
}

export async function loadBuildReport(report_id: string): Promise<BuildReport | null> {
  const rows = await getStorage().query<BuildReport>(COLLECTIONS.nex1_build_reports, {
    where: { report_id },
    limit: 1,
  });
  return rows[0] ?? null;
}

export async function listBuildReportsForTrace(trace_id: string): Promise<BuildReport[]> {
  return getStorage().query<BuildReport>(COLLECTIONS.nex1_build_reports, {
    where: { trace_id },
    limit: 10000,
    order_by: "started_at",
    order_dir: "asc",
  });
}

// ── RuntimeReport (WO-06) ───────────────────────────────────────────────

export async function saveRuntimeReport(report: RuntimeReport): Promise<PersistResult> {
  if (!report.report_id) return { ok: false, reason_code: "REPORT_MISSING_ID", reason: "RuntimeReport.report_id is required" };
  if (!report.trace_id) return { ok: false, reason_code: "REPORT_MISSING_TRACE_ID", reason: "RuntimeReport.trace_id is required" };
  const existing = await loadRuntimeReport(report.report_id);
  if (existing) return { ok: true, already_present: true };
  try {
    await getStorage().save(COLLECTIONS.nex1_runtime_reports, report);
    return { ok: true, already_present: false };
  } catch (err) {
    return { ok: false, reason_code: "STORAGE_UNAVAILABLE", reason: (err as Error).message };
  }
}

export async function loadRuntimeReport(report_id: string): Promise<RuntimeReport | null> {
  const rows = await getStorage().query<RuntimeReport>(COLLECTIONS.nex1_runtime_reports, {
    where: { report_id },
    limit: 1,
  });
  return rows[0] ?? null;
}

export async function listRuntimeReportsForTrace(trace_id: string): Promise<RuntimeReport[]> {
  return getStorage().query<RuntimeReport>(COLLECTIONS.nex1_runtime_reports, {
    where: { trace_id },
    limit: 10000,
    order_by: "started_at",
    order_dir: "asc",
  });
}

// ── SpecialistResult (WO-07) ────────────────────────────────────────────

export async function saveSpecialistResult(result: SpecialistResult): Promise<PersistResult> {
  if (!result.result_id) return { ok: false, reason_code: "REPORT_MISSING_ID", reason: "SpecialistResult.result_id is required" };
  if (!result.trace_id) return { ok: false, reason_code: "REPORT_MISSING_TRACE_ID", reason: "SpecialistResult.trace_id is required" };
  const existing = await loadSpecialistResult(result.result_id);
  if (existing) return { ok: true, already_present: true };
  try {
    await getStorage().save(COLLECTIONS.nex1_specialist_results, result);
    return { ok: true, already_present: false };
  } catch (err) {
    return { ok: false, reason_code: "STORAGE_UNAVAILABLE", reason: (err as Error).message };
  }
}

export async function loadSpecialistResult(result_id: string): Promise<SpecialistResult | null> {
  const rows = await getStorage().query<SpecialistResult>(COLLECTIONS.nex1_specialist_results, {
    where: { result_id },
    limit: 1,
  });
  return rows[0] ?? null;
}

export async function listSpecialistResultsForTrace(trace_id: string): Promise<SpecialistResult[]> {
  return getStorage().query<SpecialistResult>(COLLECTIONS.nex1_specialist_results, {
    where: { trace_id },
    limit: 10000,
    order_by: "started_at",
    order_dir: "asc",
  });
}

// ── Unified engineering history ─────────────────────────────────────────
//
// The whole point of WO-08. Returns every report kind for a trace_id
// merged into a single chronological stream. WO-09 will read this to
// decide what to correct next.

export async function listEngineeringHistoryForTrace(trace_id: string): Promise<EngineeringHistoryEntry[]> {
  const [executions, builds, runtimes, specialists] = await Promise.all([
    listExecutionReportsForTrace(trace_id),
    listBuildReportsForTrace(trace_id),
    listRuntimeReportsForTrace(trace_id),
    listSpecialistResultsForTrace(trace_id),
  ]);
  const entries: EngineeringHistoryEntry[] = [
    ...executions.map((r) => ({ kind: "execution" as const, started_at: r.started_at, report: r })),
    ...builds.map((r)     => ({ kind: "build"     as const, started_at: r.started_at, report: r })),
    ...runtimes.map((r)   => ({ kind: "runtime"   as const, started_at: r.started_at, report: r })),
    ...specialists.map((r) => ({ kind: "specialist" as const, started_at: r.started_at, result: r })),
  ];
  entries.sort((a, b) => a.started_at.localeCompare(b.started_at));
  return entries;
}

// ── Convenience · atomic "persist everything at once" helper ────────────
//
// A caller with a fresh cycle worth of reports can hand them all off to
// WO-08 in one call. Each individual save is still idempotent, so
// re-running with the same inputs is safe. If any one save fails, the
// caller sees the specific failure; earlier saves that succeeded remain
// persisted (durability biased toward preservation over rollback).

export interface PersistCycleInput {
  readonly execution_report?: ExecutionReport;
  readonly build_reports?: readonly BuildReport[];
  readonly runtime_reports?: readonly RuntimeReport[];
  readonly specialist_results?: readonly SpecialistResult[];
}

export interface PersistCycleOutcome {
  readonly execution: PersistResult | null;
  readonly builds: readonly PersistResult[];
  readonly runtimes: readonly PersistResult[];
  readonly specialists: readonly PersistResult[];
  readonly any_failed: boolean;
}

export async function persistCycle(input: PersistCycleInput): Promise<PersistCycleOutcome> {
  const execution = input.execution_report ? await saveExecutionReport(input.execution_report) : null;
  const builds = await Promise.all((input.build_reports ?? []).map(saveBuildReport));
  const runtimes = await Promise.all((input.runtime_reports ?? []).map(saveRuntimeReport));
  const specialists = await Promise.all((input.specialist_results ?? []).map(saveSpecialistResult));
  const any_failed = [
    ...(execution ? [execution] : []),
    ...builds,
    ...runtimes,
    ...specialists,
  ].some((r) => !r.ok);
  return { execution, builds, runtimes, specialists, any_failed };
}
