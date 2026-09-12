// src/lib/nex/founder/audit.ts
//
// SLICE #7 · Founder Command Audit v0 (Philip 2026-09-05)
//
// PURPOSE
// -------
// Every founder-related decision produces a permanent audit record.
// This module is a thin wrapper over the existing NEX Intelligence
// Event Bus (`emitEventSafe` from `../events/fs-store`) that:
//
//   1. Forces the correct `source` for founder events (executive_layer)
//   2. Forces a consistent event_type namespace (`founder.*`)
//   3. Forces a consistent actor_id shape (`founder:<user_id>`)
//   4. Never blocks or throws · fire-and-forget · audit failure must
//      NEVER prevent legitimate founder authority
//
// EVENT TYPES EMITTED
// -------------------
//   founder.session.entered
//     Founder successfully elevated to founder mode. Records
//     issued_at, expires_at, source_ip (if available).
//
//   founder.session.exited
//     Founder explicitly exited founder mode (cookie cleared).
//     Or session expired naturally (recorded on next verify attempt).
//
//   founder.command.received
//     Command payload received by the server. Records raw kind +
//     command_id BEFORE governance runs. This is the entry log.
//
//   founder.command.authorized
//     Governance approved the command. Records kind + command_id.
//
//   founder.command.denied
//     Governance rejected the command. Records kind + gate + reason.
//     This is the SECURITY log · every denial is auditable.
//
//   founder.command.executed
//     Command handler ran to completion. Records kind + command_id
//     + outcome_summary. This is the outcome log.
//
//   founder.command.failed
//     Command handler threw. Records error_kind + command_id.
//
//   founder.identity.rejected
//     A non-founder user attempted to enter founder mode or issue a
//     founder command. Records the offending supabase_user_id.
//     This is the intrusion log.
//
// The event_type is a TEXT column · adding new founder.* event types
// later requires no schema change.

import "server-only";
import { emitEventSafe } from "../events/fs-store";

export type FounderAuditKind =
  | "founder.session.entered"
  | "founder.session.exited"
  | "founder.command.received"
  | "founder.command.authorized"
  | "founder.command.denied"
  | "founder.command.executed"
  | "founder.command.failed"
  | "founder.identity.rejected";

export type FounderAuditInput = {
  kind: FounderAuditKind;
  /** Supabase user_id of the actor · required for identity events, may be null when caller is unauthenticated. */
  actor_supabase_user_id: string | null;
  /** Optional command_id · attached for command.* events. */
  command_id?: string;
  /** Optional command kind · attached for command.* events. */
  command_kind?: string;
  /** Optional governance decision context on denial. */
  denial_gate?: "allowlist" | "denylist" | "malformed" | "auth" | "identity" | "session";
  /** Optional structured reason string · attached to denial + failure. */
  reason?: string;
  /** Optional correlation id for cross-turn tracing. */
  correlation_id?: string;
  /** Optional structured payload · schema is event-specific. Small. */
  extra?: Record<string, unknown>;
};

const OUTCOME_BY_KIND: Record<FounderAuditKind, "success" | "failure" | "pending" | "informational"> = {
  "founder.session.entered":   "success",
  "founder.session.exited":    "informational",
  "founder.command.received":  "pending",
  "founder.command.authorized":"success",
  "founder.command.denied":    "failure",
  "founder.command.executed":  "success",
  "founder.command.failed":    "failure",
  "founder.identity.rejected": "failure",
};

/**
 * Emit a founder audit event. Fire-and-forget. Never throws · never
 * blocks. If the event bus is unavailable, the emission is silently
 * dropped (matching worker audit-log semantics · audit failure must
 * not block operational authority).
 *
 * Rationale for fire-and-forget: an audit-storage outage must NOT
 * become a denial-of-service on legitimate founder commands. The
 * caller has already made the security decision; audit is
 * observability, not authorization.
 *
 * For dual-write to Postgres `nex.events`, that path is inherited
 * automatically from `emitEventSafe` (per fs-store.ts documentation).
 */
export function emitFounderEvent(input: FounderAuditInput): void {
  try {
    const outcome = OUTCOME_BY_KIND[input.kind];
    emitEventSafe({
      event_type: input.kind,
      source: "executive_layer",
      actor_id: input.actor_supabase_user_id
        ? `founder:${input.actor_supabase_user_id}`
        : "founder:anonymous",
      related_department: "governance",
      outcome,
      payload: {
        command_id: input.command_id ?? null,
        command_kind: input.command_kind ?? null,
        denial_gate: input.denial_gate ?? null,
        reason: input.reason ?? null,
        correlation_id: input.correlation_id ?? null,
        // Extras last so callers can override defaults if truly needed
        // (but callers should treat the standard keys above as reserved).
        ...(input.extra ?? {}),
      },
    });
  } catch {
    // Audit failure MUST NOT block operational authority. Swallow.
    // If auditing fails silently, the founder command still executes.
    // Observability degrades; authority is preserved.
  }
}
