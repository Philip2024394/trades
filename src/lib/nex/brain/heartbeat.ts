// NEX Brain · Worker Heartbeat Layer · Phase 12.3 · unified 2026-08-22
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
// Task #72 Step 1c (2026-08-22 · Philip constitutional rule "one heartbeat"):
// unified against nex.worker_heartbeat (singular · migration 063 + 070).
// Prior plural table nex.worker_heartbeats (migration 042 · db/migrations/003
// on Supabase) dropped. Brain workers write with worker_id="brain:<type>",
// worker_type="brain", worker_config="<type>". Reliability layer already
// uses this same table with worker_type="acquisition"/"cle"/etc — no
// competition, no duplicate row shape, no two-writer split brain.

import { brainStore } from "./storage";
import type { WorkerHeartbeat, WorkerType } from "./types";

// Row older than this = worker considered offline / crashed / lost
// connectivity. Matches the docstring on the worker_heartbeat table
// (unified 2026-08-22 · migrations 063 + 070).
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

// Canonical worker_id encoding for Brain workers (Task #72 Step 1c 2026-08-22).
// One stable row per logical Brain worker in nex.worker_heartbeat regardless
// of how many processes run. Multi-instance separation (which was designed
// for Fly horizontal scaling · Fly destroyed 2026-08-09) moved to
// worker_cycle_run per cycle, not per heartbeat.
export function brainWorkerId(worker_type: WorkerType): string {
  return `brain:${worker_type}`;
}

// Legacy alias · kept so downstream imports don't break in the same commit.
// Returns the canonical brainWorkerId · the "@pid" suffix from the plural-era
// is gone. Prefer brainWorkerId in new code.
export function workerHostId(worker_type: WorkerType): string {
  return brainWorkerId(worker_type);
}

// G2 · Truth Contract · runtime identity for every heartbeat.
//
// Philip 2026-08-10 · required to make LOCAL vs CLOUD reportable from
// live evidence. Before G2 the /api/nex/brain/cloud-status endpoint
// counted EVERY heartbeat as "cloud" · so local worker heartbeats
// (host_id `<type>@<local-pid>`) were mis-classified as Fly workers.
//
// Rule: "cloud" requires POSITIVE evidence that we are running on
// Fly · never inferred from heartbeat existence alone.
//
// Detection sources (any one sufficient · Fly sets these on every machine):
//   · FLY_MACHINE_ID   — machine identifier
//   · FLY_APP_NAME     — app name
//   · FLY_REGION       — datacenter region
//   · NEX_RUNTIME_KIND — explicit override (test/audit only)
//
// Absence of ALL of the above → "local". No third state · every
// running process is one or the other. Future runtime types
// (e.g. "aws-lambda") get added here explicitly with their own
// positive-evidence env var · never by inference.
export type RuntimeKind = "local" | "cloud";

export function detectRuntimeKind(env: NodeJS.ProcessEnv = process.env): RuntimeKind {
  const override = env.NEX_RUNTIME_KIND;
  if (override === "local" || override === "cloud") return override;
  const flyPresent =
    (typeof env.FLY_MACHINE_ID === "string" && env.FLY_MACHINE_ID.length > 0) ||
    (typeof env.FLY_APP_NAME   === "string" && env.FLY_APP_NAME.length   > 0) ||
    (typeof env.FLY_REGION     === "string" && env.FLY_REGION.length     > 0);
  return flyPresent ? "cloud" : "local";
}

// Read-side helper · /api/nex/brain/cloud-status uses this to enforce
// the "a heartbeat alone is not cloud" rule. If metadata.runtime_kind
// is anything other than the literal string "cloud", the heartbeat is
// NOT cloud. Legacy rows (written before G2 · missing runtime_kind)
// return false — safe default is local, never cloud.
export function isCloudHeartbeat(hb: { metadata?: Record<string, unknown> | null }): boolean {
  const m = hb.metadata;
  if (!m || typeof m !== "object") return false;
  return m.runtime_kind === "cloud";
}

export interface HeartbeatUpdate {
  worker_type: WorkerType;
  status: WorkerLiveness;
  current_job_id?: string | null;
  current_stage?: string | null;
  input_ref?: string | null;
  error?: string | null;
}

// Map Brain vocabulary → canonical 7-value vocabulary (Task #72 Step 1c 2026-08-22).
// 'offline' is derived from freshness at read time · never stored.
function canonicalStatus(s: WorkerLiveness): WorkerHeartbeat["last_status"] {
  switch (s) {
    case "working":     return "running";
    case "waiting_llm": return "waiting";
    case "standby":     return "standby";
    case "failed":      return "failed";
    case "offline":     return "standby"; // caller must never pass this · defensive
    default:            return "standby";
  }
}

// Upsert one worker's heartbeat row into nex.worker_heartbeat (canonical
// singular table). Always sets last_heartbeat_at = now so freshness ticks
// forward on every call. Brain-specific per-heartbeat detail (current job,
// stage, input_ref, error, uptime_ms, runtime_kind) is carried in metadata
// jsonb · reliability doctrine says primary cycle detail lives in
// worker_cycle_run, not on the heartbeat row.
//
// Best-effort: any write failure is logged (behind a debug env flag)
// and swallowed. The worker cycle continues regardless. Heartbeats
// are observability — losing one is not a runtime error.
export async function writeHeartbeat(update: HeartbeatUpdate): Promise<void> {
  const nowIso = new Date().toISOString();
  try {
    const store = brainStore();
    const row: WorkerHeartbeat = {
      worker_id:         brainWorkerId(update.worker_type),
      worker_type:       "brain",
      worker_config:     update.worker_type,
      last_heartbeat_at: nowIso,
      last_status:       canonicalStatus(update.status),
      last_cycle_run_id: null, // Brain does not yet write cycle_run · Task #57/#59 territory
      metadata: {
        pid:            process.pid,
        node_env:       process.env.NODE_ENV ?? "unknown",
        // G2 · positive-evidence runtime identity · post-Fly all writes are "local"
        // but the field is preserved so /cloud-status stays honest if Fly ever
        // returns · see detectRuntimeKind() above.
        runtime_kind:   detectRuntimeKind(),
        uptime_ms:      Math.round(process.uptime() * 1000),
        // Brain-specific per-heartbeat detail (was primary columns pre-unification)
        current_job_id: update.current_job_id ?? null,
        current_stage:  update.current_stage ?? null,
        input_ref:      update.input_ref ?? null,
        error:          update.error ?? null,
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
// Task #72 Step 1c (2026-08-22): maps canonical status vocabulary
// (idle/running/waiting/standby/completed/failed/stopped) back to the
// UI's WorkerLiveness enum (working/waiting_llm/standby/failed/offline)
// so factory + workers-live UI don't need to change their state map.
//
// `now` is injectable so tests can pin time deterministically.
export function deriveLiveness(
  hb: WorkerHeartbeat | null | undefined,
  now: number = Date.now()
): WorkerLiveness {
  if (!hb || !hb.last_heartbeat_at) return "offline";
  const seenMs = new Date(hb.last_heartbeat_at).getTime();
  if (!Number.isFinite(seenMs)) return "offline";
  const age = now - seenMs;
  if (age > LIVENESS_THRESHOLD_MS) return "offline";
  switch (hb.last_status) {
    case "failed":    return "failed";
    case "waiting":   return "waiting_llm"; // UI vocabulary preserved
    case "running":   return "working";      // UI vocabulary preserved
    case "standby":
    case "idle":
    case "completed":
    case "stopped":
    default:          return "standby";
  }
}
