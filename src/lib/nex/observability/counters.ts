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
  | "validate.line_dropped";

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
