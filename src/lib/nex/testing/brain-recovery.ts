// NEX Brain Recovery Suite · Wave 8 · G.retry-recovery closure
//
// Sits alongside src/lib/nex/testing/recovery.ts. Where recovery.ts
// covers the delivery subsystem (nex.delivery_jobs · nex.contacts),
// this file covers the BRAIN subsystem (nex.worker_jobs · knowledge
// worker retry semantics).
//
// Purpose · closure of Wave 8 six-worker-proveout BLOCKED item
// G.retry-recovery per HEADQUARTERS-PRODUCTION-READINESS-AUDIT.md
// §16b. The audit requires fresh evidence that a worker_job satisfying
// `attempts > 1 AND status = 'completed'` can be produced by the
// current stack. Attempts increment on every claimNextJob call, so the
// state proves worker-crash-then-reclaim (worker A claims, dies before
// completing, lease expires, worker B reclaims and finishes). This is
// distinct from LLM-provider failure (which sets status='failed', a
// terminal state that does NOT satisfy the query).
//
// The scenario walks a synthetic knowledge-context WorkerJob through
// the retry state transitions against a supplied BrainStore. All rows
// are tagged with input_ref='retry-recovery-<timestamp>' + cleaned up
// on completion so this can run repeatedly without polluting the store.
//
// Runs against ANY BrainStore adapter · the vitest test uses the
// filesystem adapter (repeatable · no infrastructure) · the operator
// script (scripts/prove-brain-retry-recovery.mjs) invokes it against
// whichever backend brainStore() selects (dev fs · postgres · supabase).

import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { BrainStore } from "@/lib/nex/brain/storage";
import type { WorkerJob } from "@/lib/nex/brain/types";

export type ScenarioStatus = "pass" | "fail" | "skipped";

export interface BrainScenarioResult {
  name: string;
  status: ScenarioStatus;
  duration_ms: number;
  observations: string[];
  detail: Record<string, unknown>;
}

export interface BrainRecoverySuiteResult {
  ok: boolean;
  ran_at: string;
  scenarios: BrainScenarioResult[];
  passed: number;
  failed: number;
  skipped: number;
  total: number;
}

export interface RunOptions {
  // Called after the first claim to simulate the crash by resetting
  // status back to 'waiting' so the second claim can succeed. Injected
  // because different backends need different reset mechanics
  // (filesystem: rewrite the JSONL row · postgres: UPDATE nex.worker_jobs).
  resetJobToWaiting: (job_id: string) => Promise<void>;
  // Best-effort cleanup called after the scenario finishes. Deletes
  // both the WorkerJob row and any WorkerResult row created during the
  // run. Injected for the same adapter-specific reason as reset. If
  // cleanup fails the scenario still passes · the row is tagged with
  // input_ref='retry-recovery-<timestamp>' for out-of-band removal.
  cleanupRows: (job_id: string, result_id: string | null) => Promise<void>;
  // Optional label for the run (echoed into observations for auditing).
  label?: string;
}

// Default helpers for the filesystem adapter. Both write through the
// same file layout FilesystemStore uses (data/nex-brain/*.json) · safe
// because the scenario tags its own rows and only touches its own ids.

export async function filesystemResetJobToWaiting(job_id: string): Promise<void> {
  const p = jobsPath();
  const rows = await readJson<WorkerJob>(p);
  const next = rows.map((j) =>
    j.id === job_id
      ? {
          ...j,
          status: "waiting" as const,
          assigned_worker_id: null,
          assigned_at: null,
          lease_expires_at: null,
          updated_at: new Date().toISOString(),
        }
      : j,
  );
  await writeJson(p, next);
}

export async function filesystemCleanupScenarioRows(
  job_id: string,
  result_id: string | null,
): Promise<void> {
  const jp = jobsPath();
  const rp = resultsPath();
  const jobs = await readJson<WorkerJob>(jp);
  await writeJson(jp, jobs.filter((j) => j.id !== job_id));
  if (result_id) {
    const results = await readJson<{ id: string }>(rp);
    await writeJson(rp, results.filter((r) => r.id !== result_id));
  }
}

function jobsPath(): string {
  return path.join(process.cwd(), "data", "nex-brain", "worker_jobs.json");
}
function resultsPath(): string {
  return path.join(process.cwd(), "data", "nex-brain", "worker_results.json");
}
async function readJson<T>(p: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(p, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}
async function writeJson<T>(p: string, rows: T[]): Promise<void> {
  const tmp = `${p}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(rows, null, 2), "utf8");
  await fs.rename(tmp, p);
}

export async function scenarioBrainWorkerRetryRecovery(
  store: BrainStore,
  opts: RunOptions,
): Promise<BrainScenarioResult> {
  const t0 = Date.now();
  const obs: string[] = [];
  const tag = `retry-recovery-${Date.now().toString(36)}`;
  const label = opts.label ? ` [${opts.label}]` : "";
  let enqueuedId: string | null = null;
  let resultId: string | null = null;
  try {
    // Step 1: enqueue a synthetic knowledge-context worker_job.
    const enq = await store.enqueueJob({
      worker_type: "knowledge-context",
      priority: 999, // very low priority · will not compete with real work
      input_kind: "test",
      input_ref: tag,
      input_payload: { retry_recovery_test: true, marker: tag },
    });
    enqueuedId = enq.id;
    obs.push(`enqueued job ${enq.id} · input_ref=${tag}${label}`);

    // Step 2: first claim · attempts becomes 1 · status becomes assigned.
    const claim1 = await store.claimNextJob(
      "knowledge-context",
      `retry-test-worker-A-${tag}`,
      60,
    );
    if (!claim1 || claim1.id !== enq.id) {
      return fail(t0, obs, `first claim returned ${claim1?.id ?? "null"} · expected ${enq.id}`);
    }
    obs.push(`claim 1 · worker=A · attempts=${claim1.attempts} · status=${claim1.status}`);
    if (claim1.attempts !== 1) {
      return fail(t0, obs, `expected attempts=1 after first claim · got ${claim1.attempts}`);
    }

    // Step 3: simulate worker crash · reset status to waiting so the
    // next claim can pick it up (models lease-expiry reclaim).
    await opts.resetJobToWaiting(enq.id);
    obs.push("simulated worker crash · reset status → waiting");

    // Step 4: second claim · attempts becomes 2.
    const claim2 = await store.claimNextJob(
      "knowledge-context",
      `retry-test-worker-B-${tag}`,
      60,
    );
    if (!claim2 || claim2.id !== enq.id) {
      return fail(t0, obs, `second claim returned ${claim2?.id ?? "null"} · expected ${enq.id}`);
    }
    obs.push(`claim 2 · worker=B · attempts=${claim2.attempts} · status=${claim2.status}`);
    if (claim2.attempts < 2) {
      return fail(t0, obs, `expected attempts>=2 after reclaim · got ${claim2.attempts}`);
    }

    // Step 5: insert a synthetic result so completeJob has an FK target.
    const result = await store.insertResult({
      job_id: enq.id,
      worker_type: "knowledge-context",
      worker_id: `retry-test-worker-B-${tag}`,
      output_kind: "test",
      output_payload: { retry_recovery_proof: true, tag },
    });
    resultId = result.id;
    obs.push(`inserted worker_result ${result.id}`);

    // Step 6: complete the job.
    await store.completeJob(enq.id, result.id);
    obs.push("called completeJob");

    // Step 7: readback + assert the terminal state.
    const finalRow = await store.getWorkerJob(enq.id);
    if (!finalRow) return fail(t0, obs, "final readback returned null");
    obs.push(`final · attempts=${finalRow.attempts} · status=${finalRow.status} · result_id=${finalRow.result_id ?? "null"}`);
    if (finalRow.status !== "completed") {
      return fail(t0, obs, `expected status=completed · got ${finalRow.status}`);
    }
    if (finalRow.attempts < 2) {
      return fail(t0, obs, `expected attempts>=2 · got ${finalRow.attempts}`);
    }
    return {
      name: "brain_worker_retry_recovery",
      status: "pass",
      duration_ms: Date.now() - t0,
      observations: obs,
      detail: {
        job_id: enq.id,
        final_attempts: finalRow.attempts,
        final_status: finalRow.status,
        result_id: finalRow.result_id,
        tag,
      },
    };
  } catch (e) {
    return fail(t0, obs, e instanceof Error ? e.message : "exception");
  } finally {
    if (enqueuedId) {
      // Best-effort cleanup · do NOT throw · the scenario's success
      // must not depend on cleanup succeeding. Row is tagged with
      // input_ref='retry-recovery-<timestamp>' for out-of-band removal
      // if cleanup swallows an error.
      try { await opts.cleanupRows(enqueuedId, resultId); } catch { /* ignore */ }
    }
  }
}

function fail(t0: number, obs: string[], reason: string): BrainScenarioResult {
  return {
    name: "brain_worker_retry_recovery",
    status: "fail",
    duration_ms: Date.now() - t0,
    observations: [...obs, `FAIL: ${reason}`],
    detail: {},
  };
}

export async function runBrainRecoverySuite(
  store: BrainStore,
  opts: RunOptions,
): Promise<BrainRecoverySuiteResult> {
  const scenarios: BrainScenarioResult[] = [];
  scenarios.push(await scenarioBrainWorkerRetryRecovery(store, opts));
  const passed = scenarios.filter((s) => s.status === "pass").length;
  const failed = scenarios.filter((s) => s.status === "fail").length;
  const skipped = scenarios.filter((s) => s.status === "skipped").length;
  return {
    ok: failed === 0,
    ran_at: new Date().toISOString(),
    scenarios,
    passed,
    failed,
    skipped,
    total: scenarios.length,
  };
}
