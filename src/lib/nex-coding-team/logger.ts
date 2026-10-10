// NEX Coding Team · Per-run audit logger
// Every agent event, every file write, every gate verdict is appended to a
// per-run log so the Founder can later reconstruct exactly why the Debugger
// applied a specific patch or the Reviewer rejected. Never mutated after write.

import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import * as path from "node:path";
import type { AgentId } from "./types";

const REPO_ROOT = process.cwd();

export function logDir(run_id: string): string {
  return path.join(REPO_ROOT, "data", "nex-coding-team", "runs", run_id, "logs");
}

export function ensureLogDir(run_id: string): string {
  const d = logDir(run_id);
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return d;
}

export interface LogEntry {
  readonly ts: string;
  readonly kind:
    | "agent_started"
    | "agent_finished"
    | "file_write"
    | "file_write_denied"
    | "test_run"
    | "tsc_run"
    | "git_op"
    | "stage_transition"
    | "gate_verdict"
    | "escalation"
    | "governance_check"
    | "founder_input_needed";
  readonly agent_id: AgentId | "orchestrator";
  readonly summary: string;
  readonly detail?: Record<string, unknown>;
}

export function log(run_id: string, entry: Omit<LogEntry, "ts">): void {
  ensureLogDir(run_id);
  const full: LogEntry = { ts: new Date().toISOString(), ...entry };
  const fp = path.join(logDir(run_id), "run.jsonl");
  appendFileSync(fp, JSON.stringify(full) + "\n", "utf8");
}

/** Structured file-write event · used by permission gate on grant and deny. */
export function logFileWrite(
  run_id: string,
  agent: AgentId | "orchestrator",
  target_path: string,
  granted: boolean,
  reason?: string | null,
  bytes?: number,
): void {
  log(run_id, {
    kind: granted ? "file_write" : "file_write_denied",
    agent_id: agent,
    summary: granted ? `wrote ${target_path}` : `refused ${target_path}: ${reason ?? "unknown"}`,
    detail: { target_path, granted, reason, bytes },
  });
}

/** Record a governance-invariant check result. */
export function logGovernanceCheck(
  run_id: string,
  invariant: string,
  ok: boolean,
  evidence?: string,
): void {
  log(run_id, {
    kind: "governance_check",
    agent_id: "orchestrator",
    summary: `${invariant}: ${ok ? "OK" : "VIOLATED"}`,
    detail: { invariant, ok, evidence },
  });
}
