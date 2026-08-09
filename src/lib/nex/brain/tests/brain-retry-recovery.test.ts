// Wave 8 · G.retry-recovery closure · vitest against filesystem adapter.
//
// Runs the scenario from src/lib/nex/testing/brain-recovery.ts against
// a fresh FilesystemStore inside a per-test tmp directory. Proves that
// the worker_jobs schema + adapter support the retry state transitions
// the audit's G.retry-recovery query looks for
// (attempts > 1 AND status = 'completed').
//
// This closes the LOCAL half of the six-worker-proveout BLOCKED gap.
// The PRODUCTION half is closed by running
// scripts/prove-brain-retry-recovery.mjs against the active backend
// and then re-running the proveout runner within its 5-min freshness
// window · see docs/headquarters-production-readiness/
// HEADQUARTERS-PRODUCTION-READINESS-AUDIT.md §16b closure notes.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FilesystemStore } from "../adapters/filesystem";
import {
  scenarioBrainWorkerRetryRecovery,
  filesystemResetJobToWaiting,
  filesystemCleanupScenarioRows,
} from "../../testing/brain-recovery";

let originalCwd: string;
let tmp: string;

beforeEach(() => {
  originalCwd = process.cwd();
  tmp = mkdtempSync(join(tmpdir(), "nex-brain-retry-"));
  process.chdir(tmp);
});

afterEach(() => {
  process.chdir(originalCwd);
  try { rmSync(tmp, { recursive: true, force: true }); } catch { /* best effort */ }
});

function countRows(name: string): number {
  const p = join(process.cwd(), "data", "nex-brain", `${name}.json`);
  if (!existsSync(p)) return 0;
  return (JSON.parse(readFileSync(p, "utf8")) as unknown[]).length;
}

describe("Wave 8 · G.retry-recovery closure", () => {
  it("scenario walks worker_job through claim → simulated crash → reclaim → complete", async () => {
    const store = new FilesystemStore();
    const result = await scenarioBrainWorkerRetryRecovery(store, {
      resetJobToWaiting: filesystemResetJobToWaiting,
      cleanupRows: filesystemCleanupScenarioRows,
      label: "vitest-filesystem",
    });
    // Surface observations if the scenario failed so the reason is
    // in the test output, not just an assertion on status alone.
    if (result.status !== "pass") {
      // eslint-disable-next-line no-console
      console.error("scenario observations:", result.observations);
    }
    expect(result.status).toBe("pass");
    expect(result.detail.final_attempts as number).toBeGreaterThanOrEqual(2);
    expect(result.detail.final_status).toBe("completed");
    expect(result.detail.result_id).toBeTruthy();
  });

  it("scenario cleans up its own rows so it can run repeatedly", async () => {
    const store = new FilesystemStore();
    const jobsBefore    = countRows("worker_jobs");
    const resultsBefore = countRows("worker_results");
    const result = await scenarioBrainWorkerRetryRecovery(store, {
      resetJobToWaiting: filesystemResetJobToWaiting,
      cleanupRows: filesystemCleanupScenarioRows,
      label: "vitest-cleanup",
    });
    expect(result.status).toBe("pass");
    expect(countRows("worker_jobs")).toBe(jobsBefore);
    expect(countRows("worker_results")).toBe(resultsBefore);
  });

  it("scenario is idempotent across two consecutive runs", async () => {
    const store = new FilesystemStore();
    const r1 = await scenarioBrainWorkerRetryRecovery(store, {
      resetJobToWaiting: filesystemResetJobToWaiting,
      cleanupRows: filesystemCleanupScenarioRows,
      label: "vitest-run-1",
    });
    const r2 = await scenarioBrainWorkerRetryRecovery(store, {
      resetJobToWaiting: filesystemResetJobToWaiting,
      cleanupRows: filesystemCleanupScenarioRows,
      label: "vitest-run-2",
    });
    expect(r1.status).toBe("pass");
    expect(r2.status).toBe("pass");
    // Two distinct tags · two distinct job ids · two distinct result ids.
    expect(r1.detail.job_id).not.toBe(r2.detail.job_id);
    expect(r1.detail.result_id).not.toBe(r2.detail.result_id);
  });
});
