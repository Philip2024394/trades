// NEX Brain · Worker Heartbeat Layer · Phase 12.3
//
// Real worker liveness. Every worker call in manager.ts::withAuditEvents
// writes a heartbeat before + after the runner executes. runOneCycle
// primes all six workers with a "standby" heartbeat at cycle start so
// even workers whose queues are empty (loop breaks on first iteration
// with job=null) still get a fresh row — otherwise operators can't
// distinguish "worker was idle this cycle" from "worker never ran".
//
// The UI reads listHeartbeats + deriveLiveness to distinguish five
// states. Standby is NEVER inferred from queue depth — freshness of a
// standby heartbeat is what proves the worker is alive-and-waiting
// vs. dead-or-crashed.
//
// Heartbeat writes are best-effort. A failed upsert MUST NOT break
// the worker cycle — observability layers never propagate errors.
//
// Compatibility: uses existing BrainStore.upsertHeartbeat method that
// FilesystemStore + SupabaseStore already implement, and that migrations
// 041+042 have prepared for PostgresBrainStore. No schema change.

import { brainStore } from "./storage";
import type { WorkerHeartbeat, WorkerType } from "./types";

// Row older than this = worker considered offline / crashed / lost
// connectivity. Matches the docstring on the worker_heartbeats table
// (created in db/migrations/003 · duplicated in deploy/postgres/init/042).
export const LIVENESS_THRESHOLD_MS = 60_000;

// Six worker types the manager may exercise in runOneCycle. Order
// matches the five-stage drain (context → voice → learning → extractor
// → image-analyst → quality-checker). llm-retry is intentionally
// excluded — it's a queue-drain sibling that runs unconditionally and
// its liveness is inferable from cron-tick freshness.
export const BRAIN_WORKER_TYPES: WorkerType[] = [
  "knowledge-context",
  "voice-context",
  "learning-context",
  "knowledge-extractor",
  "image-analyst",
  "quality-checker",
];

// The five liveness states Philip specified in the 12.3 authorization.
// Do NOT add new states without corresponding UI treatment.
export type WorkerLiveness =
  | "working"      // 🟢 runner is actively executing a job
  | "waiting_llm"  // 🟡 runner has claimed a job and is awaiting LLM
  | "standby"      // 🔵 heartbeat fresh · no job in flight · queue may be empty
  | "failed"       // 🔴 last runner threw
  | "offline";     // ⚪ no heartbeat within LIVENESS_THRESHOLD_MS

export function workerHostId(worker_type: WorkerType): string {
  return `${worker_type}@${process.pid}`;
}

export interface HeartbeatUpdate {
  worker_type: WorkerType;
  status: WorkerLiveness;
  current_job_id?: string | null;
  current_stage?: string | null;
  input_ref?: string | null;
  error?: string | null;
}

// Upsert one worker's heartbeat row. Always includes last_seen_at =
// now so freshness ticks forward on every call. Fields last_error and
// last_cycle_summary carry the state Philip requested (current job,
// stage, started/completed timestamps encoded implicitly by last_seen).
//
// Best-effort: any write failure is logged (behind a debug env flag)
// and swallowed. The worker cycle continues regardless. Heartbeats
// are observability — losing one is not a runtime error.
export async function writeHeartbeat(update: HeartbeatUpdate): Promise<void> {
  const nowIso = new Date().toISOString();
  try {
    const store = brainStore();
    const row: WorkerHeartbeat = {
      host_id: workerHostId(update.worker_type),
      last_seen_at: nowIso,
      uptime_ms: Math.round(process.uptime() * 1000),
      cycles_total: 0,
      cycles_failed: 0,
      last_error: update.error ?? null,
      last_cycle_summary: {
        worker_type: update.worker_type,
        status: update.status,
        current_job_id: update.current_job_id ?? null,
        current_stage: update.current_stage ?? null,
        input_ref: update.input_ref ?? null,
        at: nowIso,
      },
      metadata: {
        pid: process.pid,
        node_env: process.env.NODE_ENV ?? "unknown",
      },
    };
    await store.upsertHeartbeat(row);
  } catch (err) {
    if (process.env.NEX_BRAIN_HEARTBEAT_DEBUG === "1") {
      console.warn(
        `[heartbeat] ${update.worker_type} write failed:`,
        err instanceof Error ? err.message : err
      );
    }
  }
}

// Prime a fresh "standby" heartbeat for every worker at the start of
// a manager cycle. If a worker later transitions through working →
// standby/failed, writeHeartbeat overwrites this row. If the worker's
// loop breaks immediately (queue empty), the primed row is what the
// UI sees — proving the worker is Standby, not Offline.
//
// Written in parallel because each host_id is independent. Any single
// failure is swallowed by writeHeartbeat itself.
export async function primeStandbyHeartbeats(): Promise<void> {
  await Promise.all(
    BRAIN_WORKER_TYPES.map((wt) =>
      writeHeartbeat({
        worker_type: wt,
        status: "standby",
        current_stage: "cycle_start",
      })
    )
  );
}

// Derive one worker's UI state from a heartbeat row. Never inspects
// queue depth — that would violate Philip's rule "never infer worker
// health from queue depth alone." A worker with an empty queue and a
// fresh heartbeat is Standby; a worker with an empty queue and a stale
// heartbeat is Offline. Same queue depth, opposite states.
//
// `now` is injectable so tests can pin time deterministically.
export function deriveLiveness(
  hb: WorkerHeartbeat | null | undefined,
  now: number = Date.now()
): WorkerLiveness {
  if (!hb || !hb.last_seen_at) return "offline";
  const seenMs = new Date(hb.last_seen_at).getTime();
  if (!Number.isFinite(seenMs)) return "offline";
  const age = now - seenMs;
  if (age > LIVENESS_THRESHOLD_MS) return "offline";
  const summary = (hb.last_cycle_summary ?? {}) as { status?: string };
  switch (summary.status) {
    case "failed":      return "failed";
    case "waiting_llm": return "waiting_llm";
    case "working":     return "working";
    case "standby":     return "standby";
    default:            return "standby";
  }
}
