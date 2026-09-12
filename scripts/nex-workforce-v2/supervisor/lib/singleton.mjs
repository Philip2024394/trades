// NEX Workforce V2 · Supervisor · Singleton lock (OS-level · cross-platform)
// ─────────────────────────────────────────────────────────────────────────────
// Per C8 § 11: singleton without new DB schema or grants. Uses a lock file
// created with O_EXCL (atomic create-if-not-exists) containing PID +
// started_at ISO. If the file exists AND the recorded PID is alive, the
// caller is the second supervisor and must exit cleanly. If the file exists
// but the PID is dead, the lock is stale and can be reclaimed.

import { openSync, readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync, closeSync } from "node:fs";
import { dirname } from "node:path";

const DEFAULT_LOCK_PATH = "data/nex-workforce-v2/supervisor.lock";

function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    // process.kill(pid, 0) throws if pid not alive OR no permission.
    // On both Windows and POSIX, ESRCH means dead. Other errors we treat
    // conservatively as "alive" to avoid stealing another supervisor's lock.
    process.kill(pid, 0);
    return true;
  } catch (e) {
    if (e.code === "ESRCH") return false;
    return true;
  }
}

/**
 * Try to acquire the supervisor singleton lock.
 * @param {object} opts
 * @param {string} [opts.path] - lock file path
 * @returns {{acquired: true, path, pid, startedAt} | {acquired: false, reason, existingPid?, existingStartedAt?}}
 */
export function acquireSingleton({ path = DEFAULT_LOCK_PATH } = {}) {
  // Ensure parent dir exists (idempotent · no error if present)
  try { mkdirSync(dirname(path), { recursive: true }); } catch {}

  const startedAt = new Date().toISOString();
  const payload = JSON.stringify({ pid: process.pid, started_at: startedAt, host: process.env.HOSTNAME || process.env.COMPUTERNAME || "unknown" });

  // Attempt atomic create-if-not-exists
  try {
    const fd = openSync(path, "wx");
    try { writeFileSync(fd, payload); } finally { closeSync(fd); }
    return { acquired: true, path, pid: process.pid, startedAt };
  } catch (e) {
    if (e.code !== "EEXIST") {
      return { acquired: false, reason: `open-error: ${e.message}` };
    }
  }

  // Lock file exists · inspect
  let existing;
  try {
    existing = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    // Corrupt lock file · treat as stale and reclaim
    try { unlinkSync(path); } catch {}
    return acquireSingleton({ path }); // one recursion · corrupt-lock branch
  }

  if (existing?.pid && isPidAlive(existing.pid)) {
    return {
      acquired: false,
      reason: "existing_supervisor_alive",
      existingPid: existing.pid,
      existingStartedAt: existing.started_at,
    };
  }

  // Stale lock (PID dead) · reclaim
  try { unlinkSync(path); } catch {}
  return acquireSingleton({ path }); // one recursion · stale-lock branch
}

/**
 * Release the singleton lock. Idempotent · safe to call on shutdown regardless
 * of whether we own the lock.
 */
export function releaseSingleton({ path = DEFAULT_LOCK_PATH } = {}) {
  if (!existsSync(path)) return { released: false, reason: "no_lock_file" };
  try {
    const existing = JSON.parse(readFileSync(path, "utf8"));
    // Only release if WE own it (defensive)
    if (existing?.pid === process.pid) {
      unlinkSync(path);
      return { released: true };
    }
    return { released: false, reason: "not_owner", existingPid: existing?.pid };
  } catch (e) {
    return { released: false, reason: `read-error: ${e.message}` };
  }
}
