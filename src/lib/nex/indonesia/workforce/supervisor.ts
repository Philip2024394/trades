// NEX Walker Supervisor · the daemon that keeps the workforce alive.
//
// Runs a periodic tick that:
//   1. Reaps expired leases (marks workers DEAD)
//   2. Restarts DEAD workers (state → STARTING · checkpoint preserved)
//   3. Escalates STUCK workers (no progress for N minutes → restart)
//   4. Rolls over daily metrics at UTC day boundary
//   5. Runs one cycle for every worker in {STARTING, WAITING, RETRYING}
//   6. Half-open probe on circuit breakers past their cooldown
//
// The tick is idempotent · calling it repeatedly is safe. Multiple
// tick cycles per second are fine · workers self-throttle via
// betweenCyclesMs and BACKOFF state.

import type { KnowledgeWalker } from "../walkers/types";
import type { WorkforceRegistry } from "./registry";
import type { EnrichedKnowledgeRecord } from "../walkers/pipeline";
import { runOneCycle } from "./supervised-worker";
import type { WorkerRecord } from "./types";
import { planFleet } from "./fleet-planner";
import type { WalkerSpec } from "../walkers/taxonomy";

export type SupervisorOptions = {
  registry: WorkforceRegistry;
  /** Map of walkerId → concrete KnowledgeWalker instance. Supervisor
   *  looks up the walker for each worker at cycle-time. */
  walkers: Map<string, KnowledgeWalker>;
  /** Optional walker taxonomy specs · when provided, supervisor
   *  regenerates the queue on every tick so an empty queue never
   *  permanently stops the workforce. Any active spec whose worker
   *  slots are missing a queued job (and whose refresh cadence has
   *  elapsed) gets one enqueued automatically. */
  taxonomySpecs?: WalkerSpec[];
  /** Called with published records so the CLI can persist them to the
   *  corpus. */
  onPublish?: (walkerId: string, records: EnrichedKnowledgeRecord[]) => Promise<void> | void;
  /** How stale is stuck? Default 5 minutes without a state change or
   *  publish. */
  stuckThresholdMs?: number;
  /** Injected clock for tests. */
  now?: () => Date;
  /** Failure injection hook · called for each worker · when it
   *  returns a function, that function replaces the walker's acquire().
   *  Used by failure-injection tests. */
  __inject?: (workerId: string) => (() => Promise<Awaited<ReturnType<KnowledgeWalker["acquire"]>>>) | undefined;
  /** Per-worker options (lease TTL, timeouts) overrides. */
  workerOptions?: {
    leaseTtlMs?: number;
    heartbeatIntervalMs?: number;
    maxAttempts?: number;
    maxAcquireMs?: number;
    breakerOpenAfter?: number;
    breakerOpenForMs?: number;
  };
};

export type SupervisorTickReport = {
  tickAt: string;
  reaped: string[];          // job ids whose leases expired
  restarted: string[];       // worker ids reset from DEAD to STARTING
  escalated: string[];       // worker ids escalated STUCK → DEAD
  workersCycled: number;
  publishedRecordsThisTick: number;
  /** Jobs the tick regenerated (empty-queue → planner). */
  regenerated: string[];
};

export async function supervisorTick(opts: SupervisorOptions): Promise<SupervisorTickReport> {
  const now = opts.now ?? (() => new Date());
  const stuckThresholdMs = opts.stuckThresholdMs ?? 300_000; // 5 min

  // 0. Queue regeneration · scheduler ensures work is always
  //    available when it's due. Runs first so the tick doesn't
  //    idle-out on an empty queue when it could be picking up
  //    scheduled work.
  const regenerated = regenerateQueue(opts);

  // 1. Reap expired leases (marks orphan workers DEAD).
  const reaped = opts.registry.reapExpiredLeases();

  // 2. Rollover metrics if UTC day flipped.
  opts.registry.rolloverMetricsIfNeeded();

  // 3. Restart DEAD workers.
  const snapshot = opts.registry.getSnapshot();
  const restarted: string[] = [];
  for (const w of snapshot.workers) {
    if (w.state === "DEAD") {
      opts.registry.setWorkerState(w.id, "STARTING");
      restarted.push(w.id);
    }
  }

  // 4. Escalate STUCK workers · workers that haven't changed state in
  //    stuckThresholdMs get flipped to DEAD (supervisor will restart
  //    on the next tick).
  const escalated: string[] = [];
  const nowT = now().getTime();
  for (const w of snapshot.workers) {
    if (w.state === "RUNNING" || w.state === "BACKOFF") {
      const changedAt = new Date(w.stateChangedAt).getTime();
      if (nowT - changedAt > stuckThresholdMs) {
        opts.registry.setWorkerState(w.id, "STUCK", { lastError: `no_progress_for_${nowT - changedAt}ms` });
        opts.registry.setWorkerState(w.id, "DEAD", { lastError: `escalated_from_stuck` });
        escalated.push(w.id);
      }
    }
  }

  // 5. Cycle every worker in a runnable state.
  const runnable = ["STARTING", "WAITING", "RETRYING"] as const;
  const eligible = snapshot.workers.filter((w) => (runnable as readonly WorkerRecord["state"][]).includes(w.state));
  let publishedRecordsThisTick = 0;
  let workersCycled = 0;
  for (const w of eligible) {
    const walker = opts.walkers.get(w.walkerId);
    if (!walker) continue; // walker instance not registered · skip
    const inject = opts.__inject ? opts.__inject(w.id) : undefined;
    const events = await runOneCycle({
      workerId: w.id,
      walker,
      registry: opts.registry,
      now,
      onPublish: opts.onPublish ? async (records) => {
        await opts.onPublish!(w.walkerId, records);
      } : undefined,
      __inject: inject,
      ...opts.workerOptions,
    });
    workersCycled++;
    for (const e of events) if (e.type === "publish") publishedRecordsThisTick += e.records;
  }

  const report: SupervisorTickReport = {
    tickAt: now().toISOString(),
    reaped,
    restarted,
    escalated,
    workersCycled,
    publishedRecordsThisTick,
    regenerated,
  };

  // 6. Stamp a supervisor heartbeat so the OUTER watchdog can detect
  //    "alive but no progress" cases. A tick that cycled at least one
  //    worker or made a meaningful state change is "successful".
  opts.registry.updateSupervisorHeartbeat({
    successful: workersCycled > 0 || publishedRecordsThisTick > 0 || reaped.length > 0 || restarted.length > 0 || regenerated.length > 0,
  });

  return report;
}

/** Queue regeneration · turns an empty queue into work when work is
 *  due. For every taxonomy-active walker, if no job exists for its
 *  worker slots, enqueue one immediately (scheduledFor=now). This is
 *  the fix for "queue empty → workforce stopped" — the workforce
 *  becomes idle only when NO active walker has due work. */
function regenerateQueue(opts: SupervisorOptions): string[] {
  if (!opts.taxonomySpecs || opts.taxonomySpecs.length === 0) return [];
  const active = opts.taxonomySpecs.filter((s) => s.status === "active" || s.status === "mature");
  if (active.length === 0) return [];
  const walkerInstances = [...opts.walkers.values()].filter((w) => active.some((s) => s.id === w.id));
  if (walkerInstances.length === 0) return [];

  const now = opts.now ?? (() => new Date());
  const plan = planFleet(active, walkerInstances, { now });
  const snap = opts.registry.getSnapshot();
  const existingJobIds = new Set(snap.jobs.map((j) => j.id));
  const regenerated: string[] = [];

  for (const entry of plan) {
    if (existingJobIds.has(entry.job.id)) continue;
    // Only regenerate if this job isn't in the dead-letter queue.
    if (snap.deadLetter.some((d) => d.jobId === entry.job.id)) continue;
    opts.registry.enqueueJob(entry.job);
    // Ensure the worker is registered so it can claim the job.
    if (!snap.workers.some((w) => w.id === entry.workerId)) {
      opts.registry.registerWorker({ id: entry.workerId, walkerId: entry.walkerId, region: entry.region });
    }
    regenerated.push(entry.job.id);
  }
  return regenerated;
}

/** Long-running supervisor loop. Ticks every `intervalMs` until
 *  `signal.aborted` becomes true (SIGINT/SIGTERM in CLI · manual in
 *  tests). Persistence is handled by the registry per-mutation, so
 *  crashing during a tick loses at most the current in-flight
 *  acquire — the checkpoint is preserved. */
export async function runSupervisor(opts: SupervisorOptions & {
  intervalMs?: number;
  signal?: AbortSignal;
  onTick?: (report: SupervisorTickReport) => void | Promise<void>;
}): Promise<void> {
  const intervalMs = opts.intervalMs ?? 5_000;
  const signal = opts.signal;
  const processStartedAt = (opts.now ?? (() => new Date()))().toISOString();
  opts.registry.updateSupervisorHeartbeat({ processStartedAt });
  while (!signal?.aborted) {
    try {
      const report = await supervisorTick(opts);
      if (opts.onTick) await opts.onTick(report);
    } catch (e) {
      // A supervisor exception must NEVER crash the loop · log + carry on.
      console.error("[supervisor] tick failed:", e);
    }
    if (signal?.aborted) break;
    await sleepAbortable(intervalMs, signal);
  }
  // Drain: mark every runnable worker DRAINING · caller may await.
  const snap = opts.registry.getSnapshot();
  for (const w of snap.workers) {
    if (w.state !== "DEAD" && w.state !== "COMPLETED") {
      opts.registry.setWorkerState(w.id, "DRAINING");
    }
  }
}

function sleepAbortable(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
  });
}
