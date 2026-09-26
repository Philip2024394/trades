// src/lib/nex-native/intelligence/nex-engine-worker.ts
//
// NEX Engine · horizontal worker loop (server-only).
// --------------------------------------------------
// The NEX Generation Engine is REPLICATED horizontally by running this
// worker in N independent processes. Each worker:
//
//   1. Primes the local engine (loads the currently-selected model)
//   2. Polls the nex_generation_job queue with SKIP LOCKED
//   3. For each leased job:
//        a. Heartbeats the lease every ~30 s
//        b. Invokes generateNexReply(conversation_id) — the EXACT
//           existing engine entry, unchanged from the 68/68 GREEN
//           acceptance
//        c. Marks the job completed / failed with honest outcome
//   4. Reclaims dead leases periodically (safe to run from any worker)
//
// The engine architecture itself does not change. This module orchestrates
// worker lifecycle around the engine.

import "server-only";
import * as crypto from "node:crypto";
import * as os from "node:os";
import {
  leaseGenerationJobs,
  completeGenerationJob,
  failGenerationJob,
  heartbeatGenerationJob,
  reclaimExpiredLeases,
  type GenerationJobRow,
} from "../generation-job-service";
import { generateNexReply } from "./nex-assistant";
import { primeInProcessRuntime } from "./in-process-provider";
import { WorkerCircuit } from "./worker-circuit";

export interface WorkerOptions {
  workerId?: string;
  batchSize?: number;
  leaseSeconds?: number;
  pollIntervalMs?: number;
  reclaimIntervalMs?: number;
  onProgress?: (msg: string) => void;
  /** When set, worker stops after this many jobs (used by tests). */
  maxJobs?: number;
  /** External stop signal · check periodically to allow graceful shutdown. */
  shouldStop?: () => boolean;
  /** External pause signal · when true, worker skips leasing this cycle
   *  but does not exit. Used by acceptance harnesses that need to observe
   *  queue depth without workers immediately draining the test load. */
  shouldPause?: () => boolean;
}

export interface WorkerStats {
  workerId: string;
  startedAt: string;
  jobsAttempted: number;
  jobsCompleted: number;
  jobsFailed: number;
  jobsRequeued: number;
  totalLatencyMs: number;
  meanLatencyMs: number;
  lastError: string | null;
}

const DEFAULT_BATCH = 1;
const DEFAULT_LEASE_SECONDS = 90;
const DEFAULT_POLL_MS = 500;
const DEFAULT_RECLAIM_MS = 15_000;

function buildWorkerId(explicit?: string): string {
  if (explicit) return explicit;
  const host = os.hostname().slice(0, 24);
  const pid = process.pid;
  const rand = crypto.randomBytes(3).toString("hex");
  return `${host}:${pid}:${rand}`;
}

export async function runNexEngineWorker(opts: WorkerOptions = {}): Promise<WorkerStats> {
  const workerId = buildWorkerId(opts.workerId);
  const batchSize = Math.max(1, opts.batchSize ?? DEFAULT_BATCH);
  const leaseSeconds = opts.leaseSeconds ?? DEFAULT_LEASE_SECONDS;
  const pollMs = opts.pollIntervalMs ?? DEFAULT_POLL_MS;
  const reclaimMs = opts.reclaimIntervalMs ?? DEFAULT_RECLAIM_MS;
  const emit = opts.onProgress ?? ((_: string) => {});

  const stats: WorkerStats = {
    workerId,
    startedAt: new Date().toISOString(),
    jobsAttempted: 0,
    jobsCompleted: 0,
    jobsFailed: 0,
    jobsRequeued: 0,
    totalLatencyMs: 0,
    meanLatencyMs: 0,
    lastError: null,
  };

  emit(`worker ${workerId} · priming engine (may take up to ~5 min on cold cache)`);
  const primed = await primeInProcessRuntime();
  if ("error" in primed) {
    stats.lastError = `engine_prime_failed · ${primed.error}`;
    emit(`worker ${workerId} · ${stats.lastError}`);
    return stats;
  }
  emit(`worker ${workerId} · engine primed · model=${primed.modelId} · loadMs=${primed.loadMs}`);

  const circuit = new WorkerCircuit();
  let lastReclaim = 0;

  while (true) {
    if (opts.shouldStop && opts.shouldStop()) {
      emit(`worker ${workerId} · stopping (shouldStop signal)`);
      break;
    }
    if (opts.maxJobs !== undefined && stats.jobsAttempted >= opts.maxJobs) {
      emit(`worker ${workerId} · reached maxJobs=${opts.maxJobs}, stopping`);
      break;
    }

    // Periodic reclaim · safe from any worker
    const now = Date.now();
    if (now - lastReclaim > reclaimMs) {
      try {
        const n = await reclaimExpiredLeases();
        if (n > 0) emit(`worker ${workerId} · reclaimed ${n} expired lease(s)`);
      } catch (e) {
        emit(`worker ${workerId} · reclaim error: ${e instanceof Error ? e.message : String(e)}`);
      }
      lastReclaim = now;
    }

    // External pause gate · lets a controller (harness or ops surface)
    // temporarily hold the fleet without stopping the workers.
    if (opts.shouldPause && opts.shouldPause()) {
      await sleep(pollMs);
      continue;
    }

    // Circuit-breaker gate · isolate a bad-state worker so the rest of
    // the fleet keeps serving. Job payloads remain queued for other
    // workers to pick up · nothing is dropped.
    if (!circuit.canRequestWork()) {
      const wait = Math.max(pollMs, Math.min(circuit.cooldownRemainingMs(), 5000));
      emit(`worker ${workerId} · circuit ${circuit.getState()} · cooldown ${wait}ms`);
      await sleep(wait);
      continue;
    }

    let leased: GenerationJobRow[] = [];
    try {
      leased = await leaseGenerationJobs(workerId, batchSize, leaseSeconds);
    } catch (e) {
      stats.lastError = `lease_error · ${e instanceof Error ? e.message : String(e)}`;
      circuit.recordFailure();
      emit(`worker ${workerId} · ${stats.lastError} · circuit=${circuit.getState()}`);
      await sleep(pollMs);
      continue;
    }

    if (leased.length === 0) {
      await sleep(pollMs);
      continue;
    }

    for (const job of leased) {
      stats.jobsAttempted++;
      const jobStart = Date.now();
      emit(`worker ${workerId} · leased job ${job.id.slice(0, 8)}… (conv=${job.conversation_id.slice(0, 8)}… · attempt=${job.attempts})`);

      // Heartbeat guard · extends the lease every ~30 s while the engine works.
      // Guard flag prevents late-firing heartbeats (already-in-flight when
      // clearInterval runs) from writing to a row whose lease was already
      // released by completion or failure of THIS job.
      let heartbeatTimer: NodeJS.Timeout | null = null;
      let heartbeatAborted = false;
      const heartbeatEvery = Math.max(15_000, (leaseSeconds * 1000) / 3);
      heartbeatTimer = setInterval(() => {
        if (heartbeatAborted) return;
        void heartbeatGenerationJob({ id: job.id, worker_id: workerId, extend_by_seconds: leaseSeconds })
          .catch((e) => emit(`worker ${workerId} · heartbeat error: ${e instanceof Error ? e.message : String(e)}`));
      }, heartbeatEvery);
      const stopHeartbeat = () => {
        heartbeatAborted = true;
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
      };

      try {
        const reply = await generateNexReply(job.conversation_id);
        stopHeartbeat();

        if (reply.path === "gap" || reply.message_id === null) {
          // Honest engine gap · surface as failure. May requeue if attempts remain.
          circuit.recordFailure();
          const { requeued } = await failGenerationJob({
            id: job.id,
            error: `engine_gap · ${reply.skipped_reason ?? "no message_id"}`,
          });
          if (requeued) {
            stats.jobsRequeued++;
            emit(`worker ${workerId} · job ${job.id.slice(0, 8)}… requeued (attempts=${job.attempts + 1})`);
          } else {
            stats.jobsFailed++;
            emit(`worker ${workerId} · job ${job.id.slice(0, 8)}… FAILED · ${reply.skipped_reason}`);
          }
        } else {
          circuit.recordSuccess();
          await completeGenerationJob({
            id: job.id,
            result_message_id: reply.message_id,
            result_model_id: reply.model_used ?? "unknown",
            result_latency_ms: reply.duration_ms,
            result_attempts_used: 1,
            result_findings: [],
          });
          const jobMs = Date.now() - jobStart;
          stats.jobsCompleted++;
          stats.totalLatencyMs += jobMs;
          stats.meanLatencyMs = Math.round(stats.totalLatencyMs / stats.jobsCompleted);
          emit(`worker ${workerId} · job ${job.id.slice(0, 8)}… OK · ${reply.duration_ms}ms · ${reply.reply_preview?.slice(0, 40).replace(/\n/g, " ")}…`);
        }
      } catch (e) {
        stopHeartbeat();
        const msg = e instanceof Error ? e.message : String(e);
        circuit.recordFailure();
        const { requeued } = await failGenerationJob({ id: job.id, error: `worker_exception · ${msg.slice(0, 200)}` }).catch(() => ({ requeued: false }));
        if (requeued) {
          stats.jobsRequeued++;
          emit(`worker ${workerId} · job ${job.id.slice(0, 8)}… exception → requeued · ${msg.slice(0, 60)}`);
        } else {
          stats.jobsFailed++;
          emit(`worker ${workerId} · job ${job.id.slice(0, 8)}… exception → FAILED · ${msg.slice(0, 60)}`);
        }
        stats.lastError = msg;
      }
    }
  }

  return stats;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
