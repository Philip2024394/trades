// NEX Brain · Worker Audit Log · emit helper.
//
// Every worker calls emitAuditEvent() at decision points. Fire-and-forget:
// audit failures NEVER crash a worker (logging must not affect the pipeline).
//
// Doctrine: feedback_nex_must_know_its_own_state_infrastructure_doctrine_2026_08_07.md
// Table:    db/migrations/004_worker_audit_events.sql
//
// Usage pattern:
//   await emitAuditEvent({
//     worker_type: "knowledge-extractor",
//     event_type: "provider_request_sent",
//     provider: "cloudflare",
//     model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
//     job_id: currentJob.id,
//     input_ref: currentJob.input_ref,
//     actor: "nex",
//   });
//
// The helper resolves worker_host_id from FLY_MACHINE_ID / HOSTNAME so
// every event is attributable to a specific worker container.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { WorkerType } from "./types";
import { emitEventSafe } from "../events/fs-store";

// ── Dual-write bridge · Supabase audit table + filesystem Event Bus ──
//
// Every audit event is also written to the filesystem Event Bus
// (`data/nex-events/events.jsonl`). This means the Living Timeline,
// Operations History, Worker Journal and Analytics receive real events
// TODAY without waiting for migration 004 to be applied. When migration
// 004 lands, the Supabase table also fills in · consumers dedupe by
// timestamp+ref. Fire-and-forget · same failure semantics as the
// Supabase write · never blocks or crashes the caller.
function mirrorToEventBus(input: EmitAuditEventInput): void {
  // Map worker_type → source (worker / system / etc.)
  const src: "worker" | "system" | "human" | "cron" =
    input.worker_type === "system" ? "system" :
    input.actor === "user"          ? "human"  :
    input.actor === "system"        ? "system" :
                                      "worker";
  // Map audit outcome shape onto the Intelligence Event outcome enum
  const outcome: "success" | "failure" | "pending" | "informational" =
    input.event_type === "job_completed"                                          ? "success" :
    input.event_type.endsWith("_failed") || input.event_type === "record_rejected" ? "failure" :
    input.event_type.startsWith("provider_circuit_")                              ? "informational" :
    input.outcome === "ok"                                                        ? "success" :
    input.outcome && input.outcome !== "unknown"                                  ? "failure" :
                                                                                    "informational";
  emitEventSafe({
    event_type: input.event_type,
    source: src,
    actor_id: input.worker_type,
    related_job: input.job_id ?? null,
    related_department: "operations",
    outcome,
    payload: {
      worker_type: input.worker_type,
      input_ref: input.input_ref ?? null,
      provider: input.provider ?? null,
      model: input.model ?? null,
      confidence: input.confidence ?? null,
      latency_ms: input.latency_ms ?? null,
      raw_outcome: input.outcome ?? null,
      error: input.error_snippet ?? null,
      ...(input.details ?? {}),
    },
  });
}

// ── Canonical event type union (kept broad — DB column is TEXT) ─────

export type AuditEventType =
  | "job_started"
  | "provider_request_sent"
  | "provider_response_ok"
  | "provider_response_failed"
  | "provider_circuit_opened"
  | "provider_circuit_closed"
  | "provider_budget_exhausted"
  | "knowledge_extracted"
  | "validation_started"
  | "validation_completed"
  | "record_promoted_to_review"
  | "record_promoted_to_authoritative"
  | "record_rejected"
  | "record_deprecated"
  | "job_completed"
  | "job_failed"
  | "contradiction_detected"
  | "contradiction_resolved"
  | "config_snapshot";

export type AuditActor = "nex" | "system" | "accountant" | "user" | "import";

export type AuditProviderOutcome =
  | "ok"
  | "429"
  | "timeout"
  | "5xx"
  | "circuit_open"
  | "budget_exhausted"
  | "network_error"
  | "invalid_response"
  | "unknown";

export type EmitAuditEventInput = {
  worker_type: WorkerType | "system";
  event_type: AuditEventType;
  actor: AuditActor;
  job_id?: string | null;
  input_ref?: string | null;
  latency_ms?: number | null;
  provider?: string | null;
  model?: string | null;
  confidence?: number | null;
  outcome?: AuditProviderOutcome | string | null;
  error_snippet?: string | null;
  details?: Record<string, unknown> | null;
  at?: string;                  // Optional override; defaults to NOW()
};

// ── Lazy singleton Supabase client (mirrors storage.ts pattern) ─────

let _client: SupabaseClient | null = null;
function getClient(): SupabaseClient | null {
  if (_client) return _client;
  const url =
    process.env.NEX_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const key =
    process.env.NEX_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

function resolveHostId(): string {
  return (
    process.env.FLY_MACHINE_ID ||
    process.env.HOSTNAME ||
    `local-${process.pid ?? "unknown"}`
  );
}

// ── The emit function ──────────────────────────────────────────────

/**
 * Insert one audit event. Fire-and-forget — never throws to the caller.
 * On failure, logs to console.warn but does not propagate.
 *
 * Callers that need to know if the insert succeeded should use
 * `emitAuditEventSync` instead (returns Promise<boolean>).
 */
export function emitAuditEvent(input: EmitAuditEventInput): void {
  // Wave 11 · F9 remediation · failures no longer silently swallowed.
  // Failed events are enqueued into the bounded retry buffer + counter
  // fires. drainAuditRetryBuffer() (below) is the operator-invokable
  // retry path — cron-tick can call it opportunistically.
  void emitAuditEventSync(input).then((ok) => {
    if (!ok) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { enqueueForRetry } = require("@/lib/nex/observability/retry-buffer") as typeof import("@/lib/nex/observability/retry-buffer");
      enqueueForRetry(input);
    }
  }).catch(() => {
    // Truly unexpected · emitAuditEventSync itself is supposed to swallow
    // internal errors and return false. If we somehow get here, enqueue
    // for retry anyway so the event isn't lost.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { enqueueForRetry } = require("@/lib/nex/observability/retry-buffer") as typeof import("@/lib/nex/observability/retry-buffer");
    enqueueForRetry(input);
  });
}

/**
 * Insert one audit event and return whether it succeeded.
 * Never throws — returns false on failure with the error logged.
 * Use this only when caller must react to insert failure (rare).
 */
export async function emitAuditEventSync(input: EmitAuditEventInput): Promise<boolean> {
  // ALWAYS mirror to filesystem Event Bus first · works even when Supabase
  // client is unavailable · Living Timeline sees the event regardless.
  mirrorToEventBus(input);

  const client = getClient();
  if (!client) {
    // Not an error — Supabase optional today · Event Bus already captured it.
    return true;
  }
  const row = {
    worker_type: input.worker_type,
    worker_host_id: resolveHostId(),
    job_id: input.job_id ?? null,
    input_ref: input.input_ref ?? null,
    event_type: input.event_type,
    actor: input.actor,
    at: input.at ?? new Date().toISOString(),
    latency_ms: input.latency_ms ?? null,
    provider: input.provider ?? null,
    model: input.model ?? null,
    confidence: input.confidence ?? null,
    outcome: input.outcome ?? null,
    error_snippet: input.error_snippet ? String(input.error_snippet).slice(0, 240) : null,
    details: input.details ?? {},
  };
  const { error } = await client.from("worker_audit_events").insert(row);
  if (error) {
    console.warn(`[nex-audit] insert failed (${input.event_type}):`, error.message);
    return false;
  }
  return true;
}

// ── Batch variant — high-volume paths (LLM chain) prefer batching ────

/** Batch-insert many events in one round-trip. Same fire-and-forget +
 *  best-effort behaviour. Use when a code path emits several events in
 *  a tight loop (e.g. LLM provider fallthrough logging multiple attempts). */
export function emitAuditEvents(events: EmitAuditEventInput[]): void {
  // Wave 11 · F9 · every failed batch enqueues each event into the
  // bounded retry buffer individually so the retry loop is per-event
  // (partial batch failures don't stall subsequent retries).
  void emitAuditEventsSync(events).then((ok) => {
    if (!ok) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { enqueueForRetry } = require("@/lib/nex/observability/retry-buffer") as typeof import("@/lib/nex/observability/retry-buffer");
      for (const e of events) enqueueForRetry(e);
    }
  }).catch(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { enqueueForRetry } = require("@/lib/nex/observability/retry-buffer") as typeof import("@/lib/nex/observability/retry-buffer");
    for (const e of events) enqueueForRetry(e);
  });
}

// Wave 11 · F9 · operator-invokable retry drainer. Callers (cron-tick
// / a future observability-tick endpoint) invoke this to attempt
// reinsertion of previously-failed events. Successful retries emit
// `audit-emit-retried` counter · failed retries re-enqueue up to
// MAX_RETRY_ATTEMPTS · then drop with `audit-emit-dropped`.
const MAX_RETRY_ATTEMPTS = 3;

export async function drainAuditRetryBuffer(): Promise<{
  attempted: number;
  succeeded: number;
  requeued: number;
  dropped: number;
}> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drainRetryBuffer, enqueueForRetry } = require("@/lib/nex/observability/retry-buffer") as typeof import("@/lib/nex/observability/retry-buffer");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { incr } = require("@/lib/nex/observability/counters") as typeof import("@/lib/nex/observability/counters");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { emitSignal } = require("@/lib/nex/observability/signals") as typeof import("@/lib/nex/observability/signals");
  const snap = drainRetryBuffer<EmitAuditEventInput>();
  let succeeded = 0, requeued = 0, dropped = 0;
  for (const entry of snap) {
    const ok = await emitAuditEventSync(entry.payload).catch(() => false);
    if (ok) {
      succeeded += 1;
      incr("audit.emit_retried");
      emitSignal({ subsystem: "audit-retry", kind: "audit-emit-retried", code: "success" });
    } else if (entry.attempts + 1 >= MAX_RETRY_ATTEMPTS) {
      dropped += 1;
      incr("audit.emit_dropped");
      emitSignal({
        subsystem: "audit-retry",
        kind: "audit-emit-dropped",
        code: "max-attempts",
        detail: `attempts=${entry.attempts + 1}`,
      });
    } else {
      requeued += 1;
      enqueueForRetry({ ...entry.payload });
    }
  }
  return { attempted: snap.length, succeeded, requeued, dropped };
}

export async function emitAuditEventsSync(events: EmitAuditEventInput[]): Promise<boolean> {
  if (events.length === 0) return true;
  // Mirror the whole batch to the Event Bus before Supabase attempt.
  for (const e of events) mirrorToEventBus(e);

  const client = getClient();
  if (!client) {
    // Event Bus already captured them · not a failure.
    return true;
  }
  const hostId = resolveHostId();
  const rows = events.map((input) => ({
    worker_type: input.worker_type,
    worker_host_id: hostId,
    job_id: input.job_id ?? null,
    input_ref: input.input_ref ?? null,
    event_type: input.event_type,
    actor: input.actor,
    at: input.at ?? new Date().toISOString(),
    latency_ms: input.latency_ms ?? null,
    provider: input.provider ?? null,
    model: input.model ?? null,
    confidence: input.confidence ?? null,
    outcome: input.outcome ?? null,
    error_snippet: input.error_snippet ? String(input.error_snippet).slice(0, 240) : null,
    details: input.details ?? {},
  }));
  const { error } = await client.from("worker_audit_events").insert(rows);
  if (error) {
    console.warn(`[nex-audit] batch insert failed (${events.length} events):`, error.message);
    return false;
  }
  return true;
}
