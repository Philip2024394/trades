// src/lib/nex/capability-runtime/event-contract.ts
//
// NEX Event Architecture · Stage 4 · Typed envelope + durability contract
// Founder-authorised build-lane addition · 2026-09-23.
//
// Purpose: formalise a typed contract that WRAPS the authoritative NEX
// event infrastructure without duplicating it. Every existing event
// remains where it is:
//   · agent lifecycle → nex.aof_agent_event  (append-only, authoritative)
//   · cycle           → nex.aof_cycle        (append + terminal update)
//   · job             → nex.harvest_job      (status transitions)
//   · worker          → nex.harvest_worker   (heartbeat + status)
//   · source cooldown → nex.aof_source_cooldown
//   · yield/evidence  → nex.harvest_yield + nex.discovery_business_evidence
//   · capability      → nex.aof_agent_capability
//
// This module adds:
//   1. A universal `EventEnvelope` type + `DurableEventEnvelope` /
//      `LiveEventEnvelope` discriminated variants.
//   2. An adapter `fromAofAgentEvent()` that losslessly maps an
//      authoritative AofAgentEvent row into a DurableEventEnvelope.
//   3. `validateEventEnvelope()` that rejects malformed input.
//
// Doctrine invariants enforced by this contract:
//   _EVENT_DURABILITY_IS_A_HARD_INVARIANT — a live signal never becomes
//     authoritative truth. Durable envelopes MUST carry durable_store +
//     durable_row_id. Live envelopes MUST NOT.
//   _EVENT_CONTRACT_IS_READ_ONLY — no update/delete semantics. Every field
//     is readonly. No mutation helpers exported.
//   _EVENT_CONTRACT_DOES_NOT_STORE_ANYTHING — writing events remains the
//     job of the authoritative modules (lifecycle.ts, cycle.ts, queue.ts…).

import type { AofAgentEvent, EventKind as AofEventKind } from "../aof/types";

// ═══════════════════════════════════════════════════════════════════════
// EVENT DOMAINS
// ═══════════════════════════════════════════════════════════════════════

/**
 * NEX event domains — ONLY the domains that already exist in the codebase
 * are listed. Absent from the union on purpose:
 *   · session.* — no session events table exists yet
 *   · workflow.* — Stage 13 will formalise if needed
 *   · build.* — no build event surface exists yet
 *   · deployment.* — no deployment event surface exists yet
 *
 * §18 no-fake-completeness: adding one requires a corresponding real
 * durable store + adapter + test.
 */
export type EventDomain =
  | "agent"      // AOF agent lifecycle events   → nex.aof_agent_event
  | "cycle"      // AOF cycle events              → nex.aof_cycle
  | "job"        // Harvest job status events    → nex.harvest_job transitions
  | "worker"     // Harvest worker events         → nex.harvest_worker
  | "source"     // Source cooldown events        → nex.aof_source_cooldown
  | "discovery"  // Discovery yield events        → nex.harvest_yield
  | "evidence"   // Evidence recording events     → nex.discovery_business_evidence
  | "capability" // Capability grant/revoke       → nex.aof_agent_capability
  | "governance" // Founder-sign / allowlist change (kind=decision in aof_agent_event)
  | "recovery";  // Reaper decisions              → recovery-agent kind=decision in aof_agent_event

export const KNOWN_EVENT_DOMAINS: readonly EventDomain[] = [
  "agent",
  "cycle",
  "job",
  "worker",
  "source",
  "discovery",
  "evidence",
  "capability",
  "governance",
  "recovery",
] as const;

// ═══════════════════════════════════════════════════════════════════════
// DURABILITY
// ═══════════════════════════════════════════════════════════════════════

/**
 * Durability kind — the crucial distinction between operational truth
 * and transient observation.
 *
 * - "durable": backed by an authoritative store row that survives restart.
 *              Reconstructable. Safe to feed into projections and audits.
 * - "live":    transient observation/streaming signal. NEVER authoritative.
 *              Suitable for HQ dashboards, not for evidence claims.
 */
export type EventDurability = "durable" | "live";

// ═══════════════════════════════════════════════════════════════════════
// ENVELOPE TYPES
// ═══════════════════════════════════════════════════════════════════════

/**
 * Base envelope shared by durable and live variants. Every field is
 * readonly · the contract is a read view over authoritative state.
 */
export interface EventEnvelopeBase {
  readonly event_id: string;
  readonly event_kind: string;
  readonly event_domain: EventDomain;
  readonly event_version: number;
  readonly producer: string;
  readonly timestamp: string;
  readonly correlation_id: string | null;
  readonly causation_id: string | null;
  readonly payload: Record<string, unknown>;
}

/**
 * A durable event is guaranteed reconstructable from an authoritative
 * store row. It MUST identify the store + row so callers can re-fetch.
 */
export interface DurableEventEnvelope extends EventEnvelopeBase {
  readonly durability: "durable";
  readonly durable_store: string;
  readonly durable_row_id: string;
}

/**
 * A live event is a transient observation. It MUST NOT claim to be
 * durable and MUST NOT carry durable_store / durable_row_id.
 */
export interface LiveEventEnvelope extends EventEnvelopeBase {
  readonly durability: "live";
}

export type EventEnvelope = DurableEventEnvelope | LiveEventEnvelope;

// ═══════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: string };

const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.length > 0;
}

function isNullOrString(x: unknown): x is string | null {
  return x === null || typeof x === "string";
}

/**
 * Validate any candidate value against the EventEnvelope contract.
 * Rejects malformed input with a specific reason.
 */
export function validateEventEnvelope(x: unknown): ValidationResult<EventEnvelope> {
  if (!isRecord(x)) return { ok: false, reason: "envelope_must_be_object" };

  if (!isNonEmptyString(x.event_id)) return { ok: false, reason: "event_id_missing_or_empty" };
  if (!isNonEmptyString(x.event_kind)) return { ok: false, reason: "event_kind_missing_or_empty" };
  if (!isNonEmptyString(x.event_domain)) return { ok: false, reason: "event_domain_missing_or_empty" };
  if (!KNOWN_EVENT_DOMAINS.includes(x.event_domain as EventDomain)) {
    return { ok: false, reason: `unknown_event_domain: ${x.event_domain}` };
  }
  if (typeof x.event_version !== "number" || x.event_version < 1 || !Number.isFinite(x.event_version)) {
    return { ok: false, reason: "event_version_must_be_positive_number" };
  }
  if (!isNonEmptyString(x.producer)) return { ok: false, reason: "producer_missing_or_empty" };
  if (!isNonEmptyString(x.timestamp) || !ISO_TIMESTAMP_RE.test(x.timestamp)) {
    return { ok: false, reason: "timestamp_must_be_iso8601" };
  }
  if (!isNullOrString(x.correlation_id)) return { ok: false, reason: "correlation_id_must_be_string_or_null" };
  if (!isNullOrString(x.causation_id)) return { ok: false, reason: "causation_id_must_be_string_or_null" };
  if (!isRecord(x.payload)) return { ok: false, reason: "payload_must_be_object" };

  if (x.durability === "durable") {
    if (!isNonEmptyString(x.durable_store)) {
      return { ok: false, reason: "durable_envelope_must_carry_durable_store" };
    }
    if (!isNonEmptyString(x.durable_row_id)) {
      return { ok: false, reason: "durable_envelope_must_carry_durable_row_id" };
    }
    return { ok: true, value: x as unknown as DurableEventEnvelope };
  }

  if (x.durability === "live") {
    if ("durable_store" in x && x.durable_store !== undefined) {
      return { ok: false, reason: "live_envelope_must_not_carry_durable_store" };
    }
    if ("durable_row_id" in x && x.durable_row_id !== undefined) {
      return { ok: false, reason: "live_envelope_must_not_carry_durable_row_id" };
    }
    return { ok: true, value: x as unknown as LiveEventEnvelope };
  }

  return { ok: false, reason: "durability_must_be_durable_or_live" };
}

// ═══════════════════════════════════════════════════════════════════════
// ADAPTERS · from authoritative rows into envelopes (read-only)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Map a nex.aof_agent_event row into a durable envelope losslessly.
 *
 * Chosen event_kind stays the raw AOF kind (registered, heartbeat, decision, etc.).
 * event_domain is determined by mapping AOF kinds — most map to "agent"
 * except "cycle_start"/"cycle_end" (→ "cycle").
 *
 * durable_store is the SQL table name; durable_row_id is the event_id.
 * The adapter never invents fields — all payload keys come from the row.
 */
export function fromAofAgentEvent(row: AofAgentEvent): DurableEventEnvelope {
  return {
    event_id: `aof-agent-event:${row.event_id}`,
    event_kind: row.event_kind,
    event_domain: aofEventKindToDomain(row.event_kind),
    event_version: 1,
    producer: row.agent_id,
    timestamp: row.event_at,
    correlation_id: row.cycle_id ?? null,
    causation_id: null,
    payload: row.payload ?? {},
    durability: "durable",
    durable_store: "nex.aof_agent_event",
    durable_row_id: String(row.event_id),
  };
}

/**
 * Map an AOF event_kind to its logical event_domain.
 * Uses the same taxonomy that lives in AOF's authoritative code paths.
 */
export function aofEventKindToDomain(kind: AofEventKind): EventDomain {
  switch (kind) {
    case "cycle_start":
    case "cycle_end":
      return "cycle";
    case "cooldown_applied":
    case "failover":
      return "source";
    case "decision":
      return "recovery";
    default:
      return "agent";
  }
}

// ═══════════════════════════════════════════════════════════════════════
// DOCTRINE LOCKS (Stage 4)
// ═══════════════════════════════════════════════════════════════════════

export const _EVENT_DURABILITY_IS_A_HARD_INVARIANT =
  "durable_envelopes_carry_durable_store_and_durable_row_id_live_envelopes_never_do";

export const _EVENT_CONTRACT_IS_READ_ONLY =
  "no_update_or_delete_helpers_exposed_all_envelope_fields_are_readonly";

export const _EVENT_CONTRACT_DOES_NOT_STORE_ANYTHING =
  "authoritative_write_paths_remain_in_lifecycle_ts_cycle_ts_queue_ts_and_related_modules";

export const _EVENT_CONTRACT_NEVER_MODIFIES_PROTECTED_AOF =
  "stage_4_creates_only_new_files_in_capability_runtime_never_touches_aof_capability_or_lifecycle";
