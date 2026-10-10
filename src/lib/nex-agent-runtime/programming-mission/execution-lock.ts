// WO-NEX-RUNTIME-12 · execution lock.
//
// Founder-locked 2026-09-14. A-16 revealed that the JSONL-based "already
// executed?" check has a TOCTOU race: two concurrent /execute requests
// can both load the draft in the "ready" state, both proceed, both
// report EXECUTED.
//
// Founder's rule (locked): "files changed exactly once · one completion
// receipt · one workstation attestation · no duplicate mission execution."
//
// Fix: OS-level exclusive-create file lock. `openSync(..., "wx")` is
// atomic — if the lock file already exists, the second caller gets
// EEXIST and MUST refuse. The lock is released after the mission
// completes (successful OR failed) so retries after failure are OK.

import { promises as fs } from "node:fs";
import path from "node:path";
import { openSync, closeSync } from "node:fs";

const LOCK_DIR_REL = "data/nex-agent-runtime/mission-locks" as const;

export type AcquireLockResult =
  | { readonly ok: true; readonly lock_path: string; readonly release: () => Promise<void> }
  | { readonly ok: false; readonly reason: "already_locked"; readonly held_by_pid?: number };

/** Atomically acquire an execution lock for the given draft_id. Returns
 *  a release function on success · an "already_locked" result on failure.
 *  The lock is a real file · openSync with "wx" flag is atomic at the
 *  filesystem layer. Guarantees that concurrent /execute requests for
 *  the same draft cannot both proceed past this point. */
export async function acquireExecutionLock(input: {
  readonly repo_root: string;
  readonly draft_id: string;
}): Promise<AcquireLockResult> {
  const dir = path.join(input.repo_root, LOCK_DIR_REL);
  await fs.mkdir(dir, { recursive: true });
  const lockPath = path.join(dir, `${input.draft_id}.lock`);
  let fd: number;
  try {
    fd = openSync(lockPath, "wx");
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "EEXIST") {
      // Read the existing lock file to inspect who holds it (best effort)
      let held_by_pid: number | undefined;
      try {
        const raw = await fs.readFile(lockPath, "utf8");
        const parsed = JSON.parse(raw) as { pid?: number };
        held_by_pid = parsed.pid;
      } catch { /* lock file exists but unreadable · still refuse */ }
      return { ok: false, reason: "already_locked", held_by_pid };
    }
    throw e;
  }
  // Write who holds the lock (defensive · never trusted)
  try {
    const payload = JSON.stringify({ pid: process.pid, acquired_at: new Date().toISOString(), draft_id: input.draft_id });
    await fs.writeFile(lockPath, payload, { encoding: "utf8", mode: 0o600 });
  } catch { /* even if write fails, we have the lock via the open */ }
  try { closeSync(fd); } catch { /* fd close race · lock still held via file existence */ }

  let released = false;
  const release = async (): Promise<void> => {
    if (released) return;
    released = true;
    try { await fs.rm(lockPath, { force: true }); } catch { /* best effort */ }
  };
  return { ok: true, lock_path: lockPath, release };
}

/** Release-only helper for callers that need to fail-closed if the
 *  release step throws. Not currently used · release() above is
 *  best-effort by design (a dangling lock only blocks re-execution
 *  of a single draft · which is safer than a stuck-forever lock). */
export async function forceReleaseLock(repo_root: string, draft_id: string): Promise<void> {
  const lockPath = path.join(repo_root, LOCK_DIR_REL, `${draft_id}.lock`);
  try { await fs.rm(lockPath, { force: true }); } catch { /* ok */ }
}
