// src/lib/nex/observability/counters.ts
//
// Wave 11 · GROUP B remediation · in-process counters for operational
// signals that don't warrant a full audit-log row.
//
// Contract:
//   · Counter names are STATIC · defined here as a closed enumeration.
//     No unbounded key growth (that would leak memory over long runs).
//   · Every counter carries { count, last_at } — enough for
//     "N failures in the last M minutes" reasoning.
//   · The counters are process-scoped. In a multi-instance deploy,
//     each instance has its own view · the operator aggregates via
//     the health endpoint (`/api/nex/observability/health`).
//   · SECURITY · never store secrets, credentials, or user data in
//     the counter values. Counts and timestamps ONLY.

// Fixed roster of counter names. Adding a name is a code change.
// This constraint is intentional — the observability surface is a
// governance boundary, not a free-form logging bucket.
export type CounterName =
  // Shadow-write divergence (F3)
  | "shadow.mirror_failed"
  | "shadow.mirror_success"
  // Manager pipeline (F4, F5)
  | "manager.inbox_writeback_failed"
  | "manager.inbox_read_degraded"
  // Router (F6)
  | "router.route_failed"
  // Enqueue loop (F7)
  | "inbox.enqueue_failed"
  // Job creation (F8)
  | "jobs.create_failed"
  // Audit log retry (F9)
  | "audit.emit_failed"
  | "audit.emit_retried"
  | "audit.emit_dropped"
  // PG read fallback (F10)
  | "inbox.pg_read_fallback"
  | "jobs.pg_read_fallback"
  // Type-safety at boundaries (F17, F18, F19)
  | "validate.row_dropped"
  | "validate.line_dropped"
  // Cron liveness (F12 · stale-cron detection · Vercel Cron path)
  | "cron_tick.fired"
  | "cron_tick.failed"
  // G4 · Local script scheduler liveness (nex-brain-worker.mjs → /run-once).
  // Same shape as cron_tick.fired but distinguishes the LOCAL script
  // path from the Vercel Cron path. Truth Contract §5 R12 requires
  // both signals to be independently observable · a heartbeat alone
  // MUST NOT be inferred as "scheduler firing".
  | "run_once.fired"
  | "run_once.failed"
  // D6 · analytics rollup worker
  | "analytics.rollup_failed"
  | "analytics.rollup_batch_drained"
  // Wave 3 · H4 · Migration 049 activation gate
  | "analytics.rollup_missing_table"
  // Wave 3 · H5 · Alert dispatch fail-closed observability
  | "alerts.dispatch_no_transport"
  // Wave 2 · W-C-COMPANION supervisor (Phase 6)
  | "supervisor.sweep_started"
  | "supervisor.sweep_completed"
  | "supervisor.kj_attested"
  | "supervisor.kj_review_queued"
  | "supervisor.path_a_fallthrough"
  | "supervisor.cascade_terminal"
  | "supervisor.error"
  // Wave 3 · H3 · timeout budgets (T-1 · T-3 · T-4 · T-6 · T-7)
  | "timeout.statement"
  | "timeout.pool_acquire"
  | "timeout.idle_transaction"
  | "timeout.worker_cycle"
  | "timeout.job_budget";

export type CounterSnapshot = {
  count: number;
  last_at: string | null;   // ISO · null until first increment
};

// The counter store is a per-process Map keyed by CounterName.
// Enumeration exhaustiveness enforced at compile time by the type.
const store = new Map<CounterName, CounterSnapshot>();

function ensure(name: CounterName): CounterSnapshot {
  let s = store.get(name);
  if (!s) {
    s = { count: 0, last_at: null };
    store.set(name, s);
  }
  return s;
}

/**
 * Increment a named counter by 1. Never throws. No allocation on the
 * hot path apart from the ISO timestamp string.
 */
export function incr(name: CounterName): void {
  const s = ensure(name);
  s.count += 1;
  s.last_at = new Date().toISOString();
}

/**
 * Read the current value of one counter. Returns { count: 0, last_at: null }
 * for names that have never been incremented (never throws).
 */
export function read(name: CounterName): CounterSnapshot {
  return { ...(store.get(name) ?? { count: 0, last_at: null }) };
}

/**
 * Snapshot of every named counter. Returns even the zero-count entries
 * so operators can see "we ARE looking at this, no failures yet" — the
 * honest "—" behaviour required by NEX doctrine (never fabricate
 * healthy, never omit uninstrumented).
 */
export function snapshot(): Record<CounterName, CounterSnapshot> {
  const out: Partial<Record<CounterName, CounterSnapshot>> = {};
  const names: CounterName[] = [
    "shadow.mirror_failed", "shadow.mirror_success",
    "manager.inbox_writeback_failed", "manager.inbox_read_degraded",
    "router.route_failed",
    "inbox.enqueue_failed",
    "jobs.create_failed",
    "audit.emit_failed", "audit.emit_retried", "audit.emit_dropped",
    "inbox.pg_read_fallback", "jobs.pg_read_fallback",
    "validate.row_dropped", "validate.line_dropped",
    "cron_tick.fired", "cron_tick.failed",
    "run_once.fired", "run_once.failed",
    "analytics.rollup_failed", "analytics.rollup_batch_drained",
    "analytics.rollup_missing_table",
    "alerts.dispatch_no_transport",
    "supervisor.sweep_started", "supervisor.sweep_completed",
    "supervisor.kj_attested", "supervisor.kj_review_queued",
    "supervisor.path_a_fallthrough", "supervisor.cascade_terminal",
    "supervisor.error",
    "timeout.statement", "timeout.pool_acquire", "timeout.idle_transaction",
    "timeout.worker_cycle", "timeout.job_budget",
  ];
  for (const n of names) out[n] = read(n);
  return out as Record<CounterName, CounterSnapshot>;
}

/**
 * TEST-ONLY reset. Do NOT call from production code.
 */
export function _resetAllCountersForTests(): void {
  store.clear();
}
