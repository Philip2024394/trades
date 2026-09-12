// src/lib/nex/agent-runtime/heartbeat-atomic.test.ts
//
// NEX Agent Runtime · Ops-1 · heartbeat rename hardening
// Philip 2026-09-07
//
// Root-cause tests for the 2026-09-07 05:37:12 UTC Accommodation crash.
// The daemon died because `fs.renameSync` in writeJsonAtomic hit a
// transient Windows EPERM (antivirus/OneDrive/Explorer held the target
// heartbeat file for a millisecond) and there was no retry.
//
// Post-fix: renameWithRetry attempts up to 4 times with 25/50/100/200 ms
// backoff for EPERM/EBUSY/EACCES/UNKNOWN. Non-retryable errors rethrow
// immediately. On final failure, the leftover .tmp file is best-effort
// cleaned up so it doesn't accumulate across crashes.
//
// Uses NEX_AGENT_RUNTIME_DATA_ROOT temp-dir isolation (same pattern as
// lifecycle.test.ts) so production data/nex-agent-runtime/ is never
// touched.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { writeHeartbeat, readHeartbeat, clearHeartbeat } from "./heartbeat";
import { heartbeatPath } from "./paths";
import { AGENT_RUNTIME_VERSION } from "./types";
import type { Heartbeat } from "./types";

let tempDir = "";
let originalEnv: string | undefined;

function makeHeartbeat(overrides: Partial<Heartbeat> = {}): Heartbeat {
  return {
    agent_id: "accommodation",
    run_id: "test-run-1",
    process_id: 12345,
    timestamp_iso: new Date().toISOString(),
    status: "RUNNING",
    current_task: "test",
    last_success_iso: null,
    last_failure_iso: null,
    internet_state: "UNKNOWN",
    runtime_version: AGENT_RUNTIME_VERSION,
    ...overrides,
  };
}

beforeEach(() => {
  originalEnv = process.env.NEX_AGENT_RUNTIME_DATA_ROOT;
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-hb-atomic-"));
  process.env.NEX_AGENT_RUNTIME_DATA_ROOT = tempDir;
});

afterEach(() => {
  if (originalEnv === undefined) delete process.env.NEX_AGENT_RUNTIME_DATA_ROOT;
  else process.env.NEX_AGENT_RUNTIME_DATA_ROOT = originalEnv;
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  vi.restoreAllMocks();
});

describe("Ops-1 · heartbeat atomic write · happy path", () => {
  it("writeHeartbeat writes the file and readHeartbeat returns it", () => {
    const hb = makeHeartbeat();
    writeHeartbeat(hb);
    const read = readHeartbeat("accommodation");
    expect(read).not.toBeNull();
    expect(read?.agent_id).toBe("accommodation");
    expect(read?.run_id).toBe("test-run-1");
  });

  it("no leftover .tmp file after a successful write", () => {
    writeHeartbeat(makeHeartbeat());
    const files = fs.readdirSync(tempDir);
    const tmpLeftovers = files.filter((f) => f.includes(".tmp-"));
    expect(tmpLeftovers, "no .tmp file must remain after successful write").toEqual([]);
  });

  it("clearHeartbeat removes the file", () => {
    writeHeartbeat(makeHeartbeat());
    expect(fs.existsSync(heartbeatPath("accommodation"))).toBe(true);
    clearHeartbeat("accommodation");
    expect(fs.existsSync(heartbeatPath("accommodation"))).toBe(false);
  });
});

describe("Ops-1 · heartbeat rename EPERM retry (root-cause fix)", () => {
  it("survives a single transient EPERM on rename", () => {
    const realRename = fs.renameSync;
    const renameSpy = vi.spyOn(fs, "renameSync");
    let call = 0;
    renameSpy.mockImplementation((from: fs.PathLike, to: fs.PathLike) => {
      call++;
      if (call === 1) {
        const err = new Error("EPERM: operation not permitted, rename") as NodeJS.ErrnoException;
        err.code = "EPERM";
        throw err;
      }
      return realRename(from, to);
    });

    writeHeartbeat(makeHeartbeat({ current_task: "post-eperm-retry" }));
    expect(call).toBeGreaterThanOrEqual(2); // at least one retry happened
    const read = readHeartbeat("accommodation");
    expect(read?.current_task).toBe("post-eperm-retry");
  });

  it("survives two consecutive EPERMs, succeeds on the third attempt", () => {
    const realRename = fs.renameSync;
    const renameSpy = vi.spyOn(fs, "renameSync");
    let call = 0;
    renameSpy.mockImplementation((from: fs.PathLike, to: fs.PathLike) => {
      call++;
      if (call <= 2) {
        const err = new Error("EBUSY: resource busy or locked") as NodeJS.ErrnoException;
        err.code = "EBUSY";
        throw err;
      }
      return realRename(from, to);
    });

    writeHeartbeat(makeHeartbeat({ current_task: "recovered-after-2-ebusy" }));
    expect(call).toBe(3);
    expect(readHeartbeat("accommodation")?.current_task).toBe("recovered-after-2-ebusy");
  });

  it("EACCES is also retried", () => {
    const realRename = fs.renameSync;
    const renameSpy = vi.spyOn(fs, "renameSync");
    let call = 0;
    renameSpy.mockImplementation((from: fs.PathLike, to: fs.PathLike) => {
      call++;
      if (call === 1) {
        const err = new Error("EACCES: permission denied") as NodeJS.ErrnoException;
        err.code = "EACCES";
        throw err;
      }
      return realRename(from, to);
    });

    writeHeartbeat(makeHeartbeat());
    expect(call).toBe(2);
  });

  it("UNKNOWN Windows error is also retried (matches observed antivirus behavior)", () => {
    const realRename = fs.renameSync;
    const renameSpy = vi.spyOn(fs, "renameSync");
    let call = 0;
    renameSpy.mockImplementation((from: fs.PathLike, to: fs.PathLike) => {
      call++;
      if (call === 1) {
        const err = new Error("UNKNOWN: unknown error, rename") as NodeJS.ErrnoException;
        err.code = "UNKNOWN";
        throw err;
      }
      return realRename(from, to);
    });

    writeHeartbeat(makeHeartbeat());
    expect(call).toBe(2);
  });
});

describe("Ops-1 · non-retryable errors are NOT retried", () => {
  it("ENOENT throws immediately without retry", () => {
    const renameSpy = vi.spyOn(fs, "renameSync");
    renameSpy.mockImplementation(() => {
      const err = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      throw err;
    });

    expect(() => writeHeartbeat(makeHeartbeat())).toThrow(/ENOENT/);
    // No retry - only the initial attempt fires.
    expect(renameSpy).toHaveBeenCalledTimes(1);
  });

  it("ENOSPC (disk full) throws immediately without retry", () => {
    const renameSpy = vi.spyOn(fs, "renameSync");
    renameSpy.mockImplementation(() => {
      const err = new Error("ENOSPC: no space left on device") as NodeJS.ErrnoException;
      err.code = "ENOSPC";
      throw err;
    });

    expect(() => writeHeartbeat(makeHeartbeat())).toThrow(/ENOSPC/);
    expect(renameSpy).toHaveBeenCalledTimes(1);
  });
});

describe("Ops-1 · all attempts fail · tmp file cleaned up", () => {
  it("after 4 failed EPERM attempts, throws and cleans up the .tmp file", () => {
    const renameSpy = vi.spyOn(fs, "renameSync");
    renameSpy.mockImplementation(() => {
      const err = new Error("EPERM: operation not permitted, rename") as NodeJS.ErrnoException;
      err.code = "EPERM";
      throw err;
    });

    expect(() => writeHeartbeat(makeHeartbeat())).toThrow(/EPERM/);
    // Retry policy: 1 initial + 4 retries (backoffs 25/50/100/200 ms) = 5 attempts total.
    expect(renameSpy).toHaveBeenCalledTimes(5);

    // Best-effort cleanup: NO .tmp file must remain in the temp dir
    // (production observation 2026-09-07: leftover tmp file accumulated
    // after the earlier crash; this test locks in the cleanup behavior).
    const files = fs.readdirSync(tempDir);
    const tmpLeftovers = files.filter((f) => f.includes(".tmp-"));
    expect(tmpLeftovers, `no .tmp file must remain (found: ${tmpLeftovers.join(", ")})`).toEqual([]);
  });
});

describe("Ops-1 · leftover tmp files from prior crashes cause no harm", () => {
  it("writeHeartbeat still succeeds when a stale .tmp file from a prior crash exists", () => {
    // Simulate the exact leftover from the 2026-09-07 05:37:12 UTC
    // Accommodation crash: a .tmp-<pid>-<ts> file present on disk from
    // a prior EPERM-killed process.
    const stalePath = path.join(
      tempDir,
      "heartbeat-accommodation.json.tmp-99999-1000000000000",
    );
    fs.writeFileSync(stalePath, "{}");
    expect(fs.existsSync(stalePath)).toBe(true);

    writeHeartbeat(makeHeartbeat({ current_task: "post-crash-recovery" }));

    // The stale tmp is untouched (each write uses its own unique tmp
    // name with the current pid+ts, so stale ones are inert). This is
    // documented behavior — verified here so a future refactor that
    // aggressively purges tmp files doesn't accidentally break resume.
    const read = readHeartbeat("accommodation");
    expect(read?.current_task).toBe("post-crash-recovery");
  });
});
