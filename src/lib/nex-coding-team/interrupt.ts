// NEX Coding Team · pipeline interrupt (Founder STOP)
// Founder-triggered abort of a running pipeline via a sentinel file.
// The runtime checks the sentinel BETWEEN stages and BETWEEN agents,
// and the queue dispatcher checks it BETWEEN polls, so a STOP click
// halts the pipeline within milliseconds without process killing.
//
// This is the safe replacement for the rejected `Stop-Process -Name node`
// PowerShell watcher: no OS-level kills · no cross-process signals · no
// destruction of anything the Founder didn't explicitly request.

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import * as path from "node:path";

const REPO_ROOT = process.cwd();

export interface AbortRecord {
  readonly run_id: string;
  readonly requested_at: string;
  readonly reason: string;
  readonly strategy: "abort" | "discard" | "edit";
}

export function abortSentinelPath(run_id: string): string {
  return path.join(REPO_ROOT, "data", "nex-coding-team", "runs", run_id, ".abort");
}

export function runDirExists(run_id: string): boolean {
  const runDir = path.join(REPO_ROOT, "data", "nex-coding-team", "runs", run_id);
  return existsSync(runDir);
}

export function requestAbort(record: Omit<AbortRecord, "requested_at">): { ok: boolean; already: boolean; reason?: string } {
  if (!runDirExists(record.run_id)) {
    return { ok: false, already: false, reason: "no such run" };
  }
  const p = abortSentinelPath(record.run_id);
  if (existsSync(p)) return { ok: true, already: true };
  const full: AbortRecord = { ...record, requested_at: new Date().toISOString() };
  const dir = path.dirname(p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(p, JSON.stringify(full, null, 2), "utf8");
  return { ok: true, already: false };
}

export function isAborted(run_id: string): boolean {
  return existsSync(abortSentinelPath(run_id));
}

export function readAbort(run_id: string): AbortRecord | null {
  const p = abortSentinelPath(run_id);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as AbortRecord;
  } catch {
    return null;
  }
}

/** Clear the abort sentinel · used when the Founder resumes an aborted run. */
export function clearAbort(run_id: string): void {
  const p = abortSentinelPath(run_id);
  if (existsSync(p)) {
    try {
      unlinkSync(p);
    } catch {
      /* ignore */
    }
  }
}
