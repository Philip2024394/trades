// Supervised worker · wraps any KnowledgeWalker with the lifecycle
// required by the persistent workforce.
//
// Contract this file guarantees (Philip 2026-08-30):
//   · A worker never silently exits · every failure emits state
//   · A completed job automatically claims the next one — the worker
//     keeps walking until told to drain or the queue is empty
//   · A hang is turned into DEAD via heartbeat expiry
//   · A crash is turned into RETRYING → BACKOFF with exponential wait
//   · Repeated failures on one job route it to the dead-letter queue
//   · Circuit breaker prevents pounding a broken source
//   · Checkpoints preserve progress across restarts
//
// The worker is a plain async generator that yields status events —
// the supervisor consumes them, mutates the registry, and decides
// when to stop the worker.

import type { KnowledgeWalker } from "./../walkers/types";
import type { EnrichedKnowledgeRecord } from "./../walkers/pipeline";
import { runWalker } from "./../walkers/pipeline";
import type { WorkforceRegistry } from "./registry";
import type { Job, WorkerRecord } from "./types";

export type SupervisedWorkerOptions = {
  workerId: string;
  walker: KnowledgeWalker;
  registry: WorkforceRegistry;
  /** Lease TTL in ms · worker must heartbeat before this expires. */
  leaseTtlMs?: number;
  /** How often to heartbeat while a job is in flight. */
  heartbeatIntervalMs?: number;
  /** Max attempts before the job goes to the dead-letter queue. */
  maxAttempts?: number;
  /** Max time one acquire() can run before the supervisor kills it. */
  maxAcquireMs?: number;
  /** Circuit breaker configuration. */
  breakerOpenAfter?: number;
  breakerOpenForMs?: number;
  /** Injected clock for tests. */
  now?: () => Date;
  /** Callback fired every time a job is published · used for
   *  reporting and test observation. */
  onPublish?: (records: EnrichedKnowledgeRecord[]) => Promise<void> | void;
  /** Test-only failure injection · when set, this async function is
   *  called instead of the walker's acquire(). Simulates hang / crash
   *  / timeout / silent behaviour. */
  __inject?: () => Promise<Awaited<ReturnType<KnowledgeWalker["acquire"]>>>;
};

export type WorkerEvent =
  | { type: "claim"; jobId: string }
  | { type: "publish"; jobId: string; records: number }
  | { type: "failure"; jobId: string; reason: string; attempt: number }
  | { type: "dead_letter"; jobId: string; reason: string }
  | { type: "idle"; reason: "queue_empty" | "circuit_open" | "draining" }
  | { type: "state"; state: WorkerRecord["state"] };

/** Runs one supervised iteration of a worker. Returns after a single
 *  job cycle (claim → publish → checkpoint OR failure paths). The
 *  supervisor calls this in a loop so a "completed job → next job"
 *  is the DEFAULT behaviour, not an add-on. */
export async function runOneCycle(opts: SupervisedWorkerOptions): Promise<WorkerEvent[]> {
  const {
    workerId, walker, registry,
    leaseTtlMs      = 30_000,
    heartbeatIntervalMs = 5_000,
    maxAttempts     = 5,
    maxAcquireMs    = 60_000,
    breakerOpenAfter= 3,
    breakerOpenForMs= 30_000,
    now             = () => new Date(),
  } = opts;

  const events: WorkerEvent[] = [];
  const emit = (e: WorkerEvent) => events.push(e);

  // 1. Ensure the worker is registered.
  const worker = registry.registerWorker({ id: workerId, walkerId: walker.id });
  registry.setWorkerState(workerId, "STARTING");
  emit({ type: "state", state: "STARTING" });

  // 2. Circuit-breaker gate · if the source is open, sit out this
  //    cycle so the supervisor can move on to another worker.
  const sourceKey = walker.id;
  registry.tryHalfOpen(sourceKey); // opportunistic probe transition
  const breaker = registry.getBreaker(sourceKey);
  if (breaker.state === "open") {
    registry.setWorkerState(workerId, "BACKOFF");
    emit({ type: "state", state: "BACKOFF" });
    emit({ type: "idle", reason: "circuit_open" });
    return events;
  }

  // 3. Claim a job.
  const claim = registry.claimNextJob(workerId, { leaseTtlMs });
  if (!claim) {
    registry.setWorkerState(workerId, "WAITING");
    emit({ type: "state", state: "WAITING" });
    emit({ type: "idle", reason: "queue_empty" });
    return events;
  }
  const { job } = claim;
  emit({ type: "claim", jobId: job.id });
  registry.setWorkerState(workerId, "RUNNING", { currentJobId: job.id });
  emit({ type: "state", state: "RUNNING" });

  // 4. Heartbeat while acquire() runs · a keepalive timer that renews
  //    the lease until acquire() returns or throws or times out.
  const heartbeatHandle = setInterval(() => {
    registry.heartbeat(workerId, job.id, { leaseTtlMs });
  }, heartbeatIntervalMs);

  const acquireFn = opts.__inject ?? (() => walker.acquire());

  // 5. Race acquire() against a hard timeout.
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`acquire_timeout_${maxAcquireMs}ms`)), maxAcquireMs);
  });

  let chunks: Awaited<ReturnType<KnowledgeWalker["acquire"]>>;
  try {
    chunks = await Promise.race([acquireFn(), timeoutPromise]);
  } catch (e) {
    clearInterval(heartbeatHandle);
    return handleFailure(e as Error);
  }
  clearInterval(heartbeatHandle);

  // 6. Silent-return check · a walker that returns 0 chunks repeatedly
  //    is treated as a failure so its job eventually goes to
  //    dead-letter rather than looping forever.
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return handleFailure(new Error("walker_returned_no_chunks"));
  }

  // 7. Run through the pipeline · dedupe + Q&A + provenance already
  //    live in runWalker (existing code). We wrap the walker in a
  //    shim that returns our already-acquired chunks so the pipeline
  //    still handles validation.
  const shim: KnowledgeWalker = {
    id: walker.id,
    domain: walker.domain,
    defaultStability: walker.defaultStability,
    description: walker.description,
    refreshCadenceDays: walker.refreshCadenceDays,
    async acquire() { return chunks; },
  };

  let records: EnrichedKnowledgeRecord[];
  try {
    const result = await runWalker(shim);
    records = result.records;
  } catch (e) {
    return handleFailure(e as Error);
  }

  // 8. Publish · call the onPublish hook + record success.
  if (opts.onPublish) {
    try { await opts.onPublish(records); }
    catch (e) { return handleFailure(e as Error); }
  }
  registry.recordPublish(workerId, records.length);
  registry.recordBreakerSuccess(sourceKey);
  emit({ type: "publish", jobId: job.id, records: records.length });

  // 9. Reschedule the job for its refresh cadence + release lease +
  //    mark worker WAITING (ready for next cycle).
  const nextAt = new Date(now().getTime() + walker.refreshCadenceDays * 86_400_000).toISOString();
  registry.updateJob(job.id, {
    scheduledFor: nextAt,
    attempts: 0,
    checkpoint: { lastPublishAt: now().toISOString(), lastRecordCount: records.length },
  });
  registry.releaseJob(job.id);
  registry.setWorkerState(workerId, "WAITING", { currentJobId: null });
  emit({ type: "state", state: "WAITING" });
  return events;

  // ── helpers ──────────────────────────────────────────────────────

  function handleFailure(err: Error): WorkerEvent[] {
    clearInterval(heartbeatHandle);
    const reason = err.message.slice(0, 200);
    registry.recordFailure(workerId, reason);
    registry.recordBreakerFailure(sourceKey, { openAfter: breakerOpenAfter, openForMs: breakerOpenForMs });

    // Bump the job's attempt counter, decide dead-letter or retry.
    const attempt = job.attempts + 1;
    const totalAttempts = job.totalAttempts + 1;

    if (attempt >= maxAttempts) {
      registry.moveToDeadLetter({
        jobId: job.id,
        walkerId: job.walkerId,
        region: job.region,
        failedAt: now().toISOString(),
        attempts: totalAttempts,
        reason,
        errorHistory: [{ at: now().toISOString(), reason }],
      });
      registry.setWorkerState(workerId, "WAITING", { currentJobId: null });
      emit({ type: "state", state: "WAITING" });
      emit({ type: "dead_letter", jobId: job.id, reason });
      return events;
    }

    // Exponential backoff · 5s · 15s · 45s · 135s · 405s.
    const backoffMs = 5000 * Math.pow(3, attempt - 1);
    const nextAt = new Date(now().getTime() + backoffMs).toISOString();
    registry.updateJob(job.id, {
      attempts: attempt,
      totalAttempts,
      scheduledFor: nextAt,
    });
    registry.releaseJob(job.id);
    registry.setWorkerState(workerId, "BACKOFF", { currentJobId: null });
    emit({ type: "state", state: "BACKOFF" });
    emit({ type: "failure", jobId: job.id, reason, attempt });
    return events;
  }
}

/** Run a worker continuously until stop() is called or the queue is
 *  empty AND the caller opts to exit on empty. Between cycles the
 *  worker sleeps briefly to avoid hot-looping when idle. */
export async function runWorkerLoop(opts: SupervisedWorkerOptions & {
  exitOnEmptyQueue?: boolean;
  betweenCyclesMs?: number;
  /** Test hook · returns true to stop the loop after emitted events. */
  shouldStop?: (allEvents: WorkerEvent[]) => boolean;
}): Promise<WorkerEvent[]> {
  const between = opts.betweenCyclesMs ?? 250;
  const all: WorkerEvent[] = [];
  let cycles = 0;
  while (true) {
    const events = await runOneCycle(opts);
    all.push(...events);
    cycles++;
    if (opts.shouldStop && opts.shouldStop(all)) break;
    const idle = events.some((e) => e.type === "idle");
    if (idle && opts.exitOnEmptyQueue) break;
    if (between > 0) await new Promise((r) => setTimeout(r, between));
  }
  return all;
}
