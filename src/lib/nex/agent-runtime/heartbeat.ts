// src/lib/nex/agent-runtime/heartbeat.ts
//
// NEX Agent Runtime · heartbeat write/read (§14)
// Philip 2026-09-06 · FOUNDER AUTHORIZATION
//
// The heartbeat is INDEPENDENTLY OBSERVABLE. Emitted by the worker
// process; read by the control-plane and watchdog. The worker is NOT the
// sole authority on whether it is alive (§14) — freshness of the
// heartbeat + process aliveness are both checked in runtime-state.ts.

import fs from "node:fs";
import { type Heartbeat, type AgentId } from "./types";
import { heartbeatPath, pidPath, runtimeDataRoot } from "./paths";

function ensureDir(): void {
  const dir = runtimeDataRoot();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Windows rename hardening (Ops-1 · 2026-09-07 · Philip).
// fs.renameSync can transiently fail with EPERM / EBUSY / EACCES when
// antivirus, OneDrive, File Explorer or another process holds the
// target file open for a millisecond. Without a retry, ANY such race
// crashes the whole daemon (observed 2026-09-07 05:37:12 UTC ·
// accommodation PID 37800). We retry with bounded exponential backoff
// (25/50/100/200 ms · 4 attempts total · max ~375 ms wall) for the
// specific Windows-race error codes; other errors (ENOENT, ENOSPC,
// etc.) rethrow immediately. On final failure we best-effort delete
// the leftover .tmp file so subsequent writes don't accumulate cruft.
const WINDOWS_RENAME_RETRY_CODES = new Set(["EPERM", "EBUSY", "EACCES", "UNKNOWN"]);
const RENAME_RETRY_BACKOFFS_MS = [25, 50, 100, 200];

/** Synchronous sleep · Atomics.wait on a small SharedArrayBuffer.
 *  Blocks the event loop briefly · safe here because heartbeat writes
 *  run from a background daemon and the max wait is ~200 ms, well
 *  below the 5-second heartbeat cadence. */
function sleepSync(ms: number): void {
  if (ms <= 0) return;
  const sab = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(sab), 0, 0, ms);
}

function renameWithRetry(tmp: string, target: string): void {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= RENAME_RETRY_BACKOFFS_MS.length; attempt++) {
    try {
      fs.renameSync(tmp, target);
      return;
    } catch (err) {
      lastErr = err;
      const code = (err as { code?: string })?.code;
      if (!code || !WINDOWS_RENAME_RETRY_CODES.has(code)) {
        // Non-retryable · rethrow immediately.
        break;
      }
      if (attempt === RENAME_RETRY_BACKOFFS_MS.length) break;
      sleepSync(RENAME_RETRY_BACKOFFS_MS[attempt]);
    }
  }
  // All attempts exhausted (or non-retryable). Best-effort cleanup of the
  // .tmp file so it doesn't accumulate across crashes.
  try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch { /* ignore */ }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(`renameWithRetry failed: ${String(lastErr)}`);
}

function writeJsonAtomic(p: string, value: unknown): void {
  ensureDir();
  const tmp = `${p}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  renameWithRetry(tmp, p);
}

/** Called by the daemon process on a cadence. Atomic write so a reader
 *  never sees a half-written JSON file. */
export function writeHeartbeat(hb: Heartbeat): void {
  writeJsonAtomic(heartbeatPath(hb.agent_id), hb);
}

/** Read the latest heartbeat for an agent. Returns null when no
 *  heartbeat file exists (agent has never started, or file was
 *  deliberately cleared on graceful shutdown). */
export function readHeartbeat(agent_id: AgentId): Heartbeat | null {
  try {
    const p = heartbeatPath(agent_id);
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, "utf8");
    if (!raw.trim()) return null;
    return JSON.parse(raw) as Heartbeat;
  } catch {
    return null;
  }
}

/** Compute staleness in milliseconds. Returns null when the heartbeat
 *  timestamp cannot be parsed. */
export function heartbeatStalenessMs(hb: Heartbeat, nowMs: number): number | null {
  const t = Date.parse(hb.timestamp_iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, nowMs - t);
}

/** Called by the daemon at graceful shutdown — leaves no stale
 *  heartbeat that could be misread as alive. */
export function clearHeartbeat(agent_id: AgentId): void {
  try {
    const p = heartbeatPath(agent_id);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch { /* best-effort */ }
}

// ── PID file · declared identity + start metadata ────────────────────
// The PID file is a SEPARATE piece of evidence from the heartbeat. If
// the PID file exists but the heartbeat is stale, the process is
// crashed/hung. If both are absent, the agent is cleanly stopped.

export type PidRecord = {
  agent_id: AgentId;
  pid: number;
  started_at_iso: string;
  runtime_version: string;
  command_line: string;
};

export function writePidRecord(rec: PidRecord): void {
  writeJsonAtomic(pidPath(rec.agent_id), rec);
}

export function readPidRecord(agent_id: AgentId): PidRecord | null {
  try {
    const p = pidPath(agent_id);
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, "utf8");
    if (!raw.trim()) return null;
    return JSON.parse(raw) as PidRecord;
  } catch {
    return null;
  }
}

export function clearPidRecord(agent_id: AgentId): void {
  try {
    const p = pidPath(agent_id);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch { /* best-effort */ }
}

/** Cross-platform check: is a given PID currently alive?
 *  On both Windows and POSIX, `process.kill(pid, 0)` returns true when
 *  the process exists AND we have permission to signal it; throws
 *  otherwise. Never actually kills — signal 0 is the alive-probe. */
export function isPidAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: unknown) {
    // ESRCH → not alive · EPERM → alive but we can't signal (still alive)
    const e = err as { code?: string };
    if (e?.code === "EPERM") return true;
    return false;
  }
}
