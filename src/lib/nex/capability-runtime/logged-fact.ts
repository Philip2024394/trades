// src/lib/nex/capability-runtime/logged-fact.ts
//
// NEX Model-Visible = Logged · Stage 5 · Typed provenance wrapper
// Founder-authorised build-lane addition · 2026-09-23.
//
// Wraps any value with a mandatory durable provenance reference. The
// contract enforces: anything crossing a boundary as "operational truth"
// must point at real NEX durable state · either specific rows or a
// deterministic query signature.
//
// Stage 5 is primarily documentation (`docs/NEX-MODEL-VISIBLE-LOGGED.md`).
// This module adds the minimum types + validator that Stage 6 projections
// will consume. It does NOT create a new event store, audit DB, or log.
//
// Doctrine invariants:
//   _LOGGED_FACT_PROVENANCE_IS_REQUIRED — every LoggedFact carries a ref
//   _LOGGED_FACT_NEVER_INTRODUCES_NEW_STORE — wraps existing stores only
//   _LIVE_SIGNAL_IS_NOT_A_LOGGED_FACT — LiveEventEnvelope must not be
//     upgraded into a LoggedFact without an authoritative store write

import type { ValidationResult } from "./event-contract";

// ═══════════════════════════════════════════════════════════════════════
// PROVENANCE
// ═══════════════════════════════════════════════════════════════════════

/**
 * A reference to durable NEX state that reconstructs a fact.
 *
 * Two shapes:
 *   - `durable_row`: specific rows in a specific store
 *   - `durable_query`: a deterministic query against a store (aggregate reads)
 *
 * `store` is the fully qualified table name (e.g. "nex.harvest_business_candidate").
 * It MUST refer to a real durable store · the validator does not verify
 * table existence, but developers who invent store names for facts they
 * haven't persisted violate the doctrine.
 */
export type DurableProvenanceRef =
  | {
      readonly kind: "durable_row";
      readonly store: string;
      readonly row_ids: readonly string[];
      readonly recorded_at: string;
    }
  | {
      readonly kind: "durable_query";
      readonly store: string;
      readonly query_signature: string;
      readonly recorded_at: string;
    };

/**
 * A value paired with mandatory provenance. Passed across boundaries
 * where an autonomous model or Founder page consumes state.
 */
export interface LoggedFact<T> {
  readonly value: T;
  readonly provenance: DurableProvenanceRef;
  readonly recorded_at: string;
}

// ═══════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════

const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.length > 0;
}

/**
 * Validate a candidate `DurableProvenanceRef`.
 * Rejects: missing kind · empty store · durable_row without non-empty row_ids ·
 * durable_query without query_signature · non-ISO timestamp.
 */
export function validateProvenanceRef(x: unknown): ValidationResult<DurableProvenanceRef> {
  if (!isRecord(x)) return { ok: false, reason: "provenance_must_be_object" };
  if (!isNonEmptyString(x.store)) return { ok: false, reason: "store_missing_or_empty" };
  if (!isNonEmptyString(x.recorded_at) || !ISO_TIMESTAMP_RE.test(x.recorded_at)) {
    return { ok: false, reason: "provenance_recorded_at_must_be_iso8601" };
  }

  if (x.kind === "durable_row") {
    const rowIds = x.row_ids;
    if (!Array.isArray(rowIds) || rowIds.length === 0) {
      return { ok: false, reason: "durable_row_provenance_requires_non_empty_row_ids" };
    }
    for (const r of rowIds) {
      if (!isNonEmptyString(r)) {
        return { ok: false, reason: "durable_row_provenance_row_ids_must_be_non_empty_strings" };
      }
    }
    return { ok: true, value: x as unknown as DurableProvenanceRef };
  }

  if (x.kind === "durable_query") {
    if (!isNonEmptyString(x.query_signature)) {
      return { ok: false, reason: "durable_query_provenance_requires_query_signature" };
    }
    return { ok: true, value: x as unknown as DurableProvenanceRef };
  }

  return { ok: false, reason: "provenance_kind_must_be_durable_row_or_durable_query" };
}

/**
 * Validate a candidate `LoggedFact<T>`. Rejects: missing value ·
 * missing/invalid provenance · non-ISO recorded_at.
 *
 * `T` cannot be validated at runtime (generic); the validator checks only
 * that the field is present. Callers should narrow `T` at their type
 * boundaries.
 */
export function validateLoggedFact<T = unknown>(x: unknown): ValidationResult<LoggedFact<T>> {
  if (!isRecord(x)) return { ok: false, reason: "logged_fact_must_be_object" };
  if (!("value" in x)) return { ok: false, reason: "logged_fact_must_carry_value" };
  if (!isNonEmptyString(x.recorded_at) || !ISO_TIMESTAMP_RE.test(x.recorded_at)) {
    return { ok: false, reason: "logged_fact_recorded_at_must_be_iso8601" };
  }
  const prov = validateProvenanceRef(x.provenance);
  if (!prov.ok) return { ok: false, reason: `provenance:${prov.reason}` };
  return { ok: true, value: x as unknown as LoggedFact<T> };
}

/**
 * Convenience constructor · builds a LoggedFact pointing at specific rows.
 * Callers wire this from real durable reads; the function itself performs
 * no I/O.
 */
export function loggedFactFromRows<T>(input: {
  readonly value: T;
  readonly store: string;
  readonly row_ids: readonly string[];
  readonly recorded_at?: string;
}): LoggedFact<T> {
  const now = input.recorded_at ?? new Date().toISOString();
  return {
    value: input.value,
    provenance: {
      kind: "durable_row",
      store: input.store,
      row_ids: input.row_ids,
      recorded_at: now,
    },
    recorded_at: now,
  };
}

/**
 * Convenience constructor · builds a LoggedFact for an aggregate/query
 * result. `query_signature` should be a deterministic identifier (SQL
 * hash, parametrised template + args, etc.) that another caller could
 * re-run to obtain the same result.
 */
export function loggedFactFromQuery<T>(input: {
  readonly value: T;
  readonly store: string;
  readonly query_signature: string;
  readonly recorded_at?: string;
}): LoggedFact<T> {
  const now = input.recorded_at ?? new Date().toISOString();
  return {
    value: input.value,
    provenance: {
      kind: "durable_query",
      store: input.store,
      query_signature: input.query_signature,
      recorded_at: now,
    },
    recorded_at: now,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// DOCTRINE LOCKS (Stage 5)
// ═══════════════════════════════════════════════════════════════════════

export const _MODEL_VISIBLE_IS_LOGGED =
  "operational_truth_presented_to_any_consumer_must_be_reconstructable_from_durable_state";

export const _LOGGED_FACT_PROVENANCE_IS_REQUIRED =
  "every_LoggedFact_carries_a_DurableProvenanceRef_no_fact_flows_without_provenance";

export const _LOGGED_FACT_NEVER_INTRODUCES_NEW_STORE =
  "stage_5_wraps_existing_durable_stores_never_creates_new_event_store_or_audit_db";

export const _LIVE_SIGNAL_IS_NOT_A_LOGGED_FACT =
  "LiveEventEnvelope_cannot_upgrade_to_LoggedFact_without_a_real_authoritative_store_row";
