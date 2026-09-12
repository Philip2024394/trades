// src/lib/nex/programmer-execution/audit.ts
//
// NEX Programmer Agent · Phase G · append-only execution audit log
// Philip 2026-09-06 · AUTHORIZE · PHASE G · §19 §35
//
// Every autonomous engineering run leaves an auditable trail:
//   · executions.jsonl        — compact index (one entry per run)
//   · runs/{run_id}.json      — full ExecutionRun body per run
//
// The audit log is APPEND-ONLY. Duplicate run_id throws. In-place
// modification is refused by the file guard. Deletion is not exposed.

import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ExecutionRun, AuditEntry } from "./types";

export function programmerExecutionAuditDir(): string {
  const override = process.env.NEX_PROGRAMMER_EXECUTION_DIR;
  if (override && override.trim().length > 0) return override;
  return path.resolve(process.cwd(), "data", "programmer-execution");
}

class ForbiddenPhaseGWrite extends Error {
  constructor(target: string) { super(`Phase-G forbidden write to: ${target}`); }
}

function pathFor(filename: string): string {
  const root = programmerExecutionAuditDir();
  const p = path.resolve(root, filename);
  if (!p.startsWith(root + path.sep) && p !== root) {
    throw new ForbiddenPhaseGWrite(p);
  }
  return p;
}

function ensureDir(): void {
  const dir = programmerExecutionAuditDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const runsDir = path.join(dir, "runs");
  if (!existsSync(runsDir)) mkdirSync(runsDir, { recursive: true });
}

const EXECUTIONS_INDEX = "executions.jsonl";

// ─── Persist full ExecutionRun body ────────────────────────────

export function persistExecutionRun(run: ExecutionRun): string {
  if (run.final_status_narrative !== null) {
    throw new Error("Op-Truth violation: ExecutionRun.final_status_narrative must be null in persisted record");
  }
  ensureDir();
  const relPath = path.join("runs", `${run.run_id}.json`);
  const abs = pathFor(relPath);
  writeFileSync(abs, JSON.stringify(run, null, 2) + "\n", "utf8");
  return relPath;
}

// ─── Append compact audit entry ────────────────────────────────

export function appendAuditEntry(entry: AuditEntry): void {
  if (entry.final_status_narrative !== null) {
    throw new Error("Op-Truth violation: AuditEntry.final_status_narrative must be null");
  }
  const existing = readAuditIndex();
  if (existing.some((e) => e.run_id === entry.run_id)) {
    throw new Error(`historical_mutation_rejected: run_id ${entry.run_id} already present · append-only discipline`);
  }
  ensureDir();
  appendFileSync(pathFor(EXECUTIONS_INDEX), JSON.stringify(entry) + "\n", "utf8");
}

/** Compose the compact entry from a full run. */
export function auditEntryFromRun(run: ExecutionRun): AuditEntry {
  return {
    run_id: run.run_id,
    task_id: run.task_id,
    started_at: run.started_at,
    finished_at: run.finished_at,
    final_status: run.final_status,
    sandbox_root: run.sandbox_root,
    execution_fingerprint: run.execution_fingerprint,
    final_status_narrative: null,
    files_modified_count: run.files_modified.length,
    denied_operations_count: run.denied_operations.length,
    iterations_count: run.iterations.length,
  };
}

// ─── Read helpers ──────────────────────────────────────────────

export function readAuditIndex(): AuditEntry[] {
  const p = pathFor(EXECUTIONS_INDEX);
  if (!existsSync(p)) return [];
  const raw = readFileSync(p, "utf8");
  const out: AuditEntry[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try { out.push(JSON.parse(trimmed) as AuditEntry); }
    catch { /* skip malformed */ }
  }
  return out;
}

export function readFullExecutionRun(runId: string): ExecutionRun | null {
  const relPath = path.join("runs", `${runId}.json`);
  const abs = pathFor(relPath);
  if (!existsSync(abs)) return null;
  try {
    return JSON.parse(readFileSync(abs, "utf8")) as ExecutionRun;
  } catch { return null; }
}

// ─── Test-only reset ──────────────────────────────────────────

export function _resetAuditStoreForTests(): void {
  const p = pathFor(EXECUTIONS_INDEX);
  if (existsSync(p)) writeFileSync(p, "", "utf8");
}

export { ForbiddenPhaseGWrite };
