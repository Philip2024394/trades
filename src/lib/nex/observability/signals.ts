// src/lib/nex/observability/signals.ts
//
// Wave 11 · GROUP B remediation · structured signal emission.
//
// A "signal" is a machine-readable operational event: something the
// operator should be able to trace after the fact. Signals sit between
// counters (bare tallies) and full audit events (business decisions).
//
// Contract:
//   · Every signal has a { subsystem, kind, code, correlation_id?, detail? }
//     shape. Never a free-form string.
//   · Emission is BEST-EFFORT · never throws to caller · never blocks
//     the caller's hot path (uses void promise + internal catch).
//   · SECURITY (Philip 2026-08-10): never log secrets, credentials,
//     raw provider responses, filesystem paths, or sensitive payloads.
//     The `detail` field is bounded to a short string; callers MUST NOT
//     stuff a full stack trace or an err.message that could contain
//     paths / credentials.
//   · The signal is delivered to console.warn AND (best-effort) to
//     the audit-log subsystem via emitEventSafe. When emitEventSafe
//     itself is broken (audit is what we're instrumenting), the console
//     log is the only durable record for that emission.

import { emitEventSafe } from "@/lib/nex/events/fs-store";
// W-OBS-1 Path A Layer 1 · ALS fallback for correlation_id.
// Explicit sig.correlation_id ALWAYS wins over ALS (preserves
// journeys / attribution / error-envelope existing semantics · plan §11).
// When the caller omits correlation_id AND an ambient ALS scope
// exists (e.g., we're inside an HTTP request wrapped by
// runFromRequest), the ALS value is used as fallback.
import { getCorrelationId } from "./correlation";

export type SignalKind =
  | "shadow-write-failed"     // F3
  | "inbox-writeback-failed"  // F4
  | "inbox-read-degraded"     // F5
  | "route-failed"            // F6
  | "enqueue-failed"          // F7
  | "create-job-failed"       // F8
  | "audit-emit-failed"       // F9
  | "audit-emit-retried"      // F9
  | "audit-emit-dropped"      // F9
  | "pg-read-fallback"        // F10
  | "row-dropped"             // F17, F18
  | "line-dropped";           // F19

export type Signal = {
  subsystem: string;                 // e.g. "brain" · "inbox" · "jobs"
  kind: SignalKind;
  code?: string;                     // short machine tag · optional
  correlation_id?: string;
  detail?: string;                   // bounded human context · no secrets
};

const MAX_DETAIL_LEN = 240;

function sanitiseDetail(detail: string | undefined): string | undefined {
  if (detail == null) return undefined;
  // Truncate to bounded length so a rogue caller passing a full stack
  // can't blow up log lines. Callers should keep this short by design.
  if (detail.length > MAX_DETAIL_LEN) {
    return detail.slice(0, MAX_DETAIL_LEN - 3) + "...";
  }
  return detail;
}

/**
 * Fire-and-forget signal emission. Writes a console.warn line AND
 * (best-effort) an event to the audit trail. Never throws.
 */
export function emitSignal(sig: Signal): void {
  const detail = sanitiseDetail(sig.detail);
  // W-OBS-1 · resolve CID once · explicit-wins-over-ALS via nullish
  // coalescing. If neither caller nor ALS provides one, remains null.
  const resolvedCid = sig.correlation_id ?? getCorrelationId();
  const line = [
    `[nex-signal] subsystem=${sig.subsystem}`,
    `kind=${sig.kind}`,
    sig.code            ? `code=${sig.code}`                        : "",
    resolvedCid         ? `correlation=${resolvedCid}`              : "",
    detail              ? `detail="${detail.replace(/"/g, "'")}"`   : "",
  ].filter(Boolean).join(" ");
  // eslint-disable-next-line no-console
  console.warn(line);

  // Best-effort audit event · absolutely never throws to caller.
  try {
    void emitEventSafe({
      event_type: `nex_signal_${sig.kind}`.replace(/-/g, "_"),
      source: "system",
      actor_id: sig.subsystem,
      related_department: "operations",
      outcome: "signal",
      payload: {
        subsystem: sig.subsystem,
        kind: sig.kind,
        code: sig.code ?? null,
        correlation_id: resolvedCid ?? null,
        detail: detail ?? null,
      },
    });
  } catch {
    // absolutely swallowed · signals must never crash callers
  }
}
