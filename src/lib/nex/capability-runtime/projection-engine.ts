// src/lib/nex/capability-runtime/projection-engine.ts
//
// NEX Runtime Projection Engine · Stage 6 · Authoritative-store read seam
// Founder-authorised build-lane addition · 2026-09-23.
//
// Purpose: a typed read-only projection contract that composes state from
// authoritative NEX stores and exposes an explicit freshness signal —
// so Founder pages, agents, and future models never see a silent zero
// when a query fails.
//
// HARD GUARDRAILS:
//   _PROJECTION_IS_READ_ONLY                   — no writes, no persistence
//   _PROJECTION_IS_NOT_A_SECOND_SOURCE_OF_TRUTH — reads authoritative stores,
//                                                 never becomes canonical
//   _PROJECTION_NEVER_SILENT_ZERO_ON_ERROR      — status !== "ok" → fact null;
//                                                 error/unavailable/stale
//                                                 are truthful, not zero
//
// This module defines the contract only. Concrete projections live in
// `./projections/`. Each concrete projection MUST:
//   1. Read from authoritative durable stores
//   2. Return a LoggedFact<T> (Stage 5) with correct provenance
//   3. Set freshness = "ok" ONLY when the read fully succeeded
//   4. Set fact = null whenever freshness !== "ok"
//   5. Never persist a materialised copy anywhere

import type { LoggedFact } from "./logged-fact";

// ═══════════════════════════════════════════════════════════════════════
// FRESHNESS SIGNAL
// ═══════════════════════════════════════════════════════════════════════

/**
 * Freshness state discriminated union.
 *
 * - "ok": read succeeded, value is authoritative right now
 * - "stale": read succeeded but data is older than expected. Value MAY
 *   still be shown but consumer should note the staleness.
 * - "unavailable": a specific dependency is not reachable (schema missing,
 *   endpoint down, feature gated off). Value must be null.
 * - "error": unexpected failure. Value must be null.
 *
 * Consumers MUST distinguish these four states. A silent zero when
 * status !== "ok" is a violation of the no-silent-zero doctrine.
 */
export type ProjectionFreshness =
  | { readonly status: "ok" }
  | { readonly status: "stale"; readonly last_ok_at: string; readonly staleness_reason: string }
  | { readonly status: "unavailable"; readonly reason: string }
  | { readonly status: "error"; readonly error: string };

// ═══════════════════════════════════════════════════════════════════════
// PROJECTION RESULT
// ═══════════════════════════════════════════════════════════════════════

/**
 * Result envelope returned by every projection compute() call.
 *
 * Invariant enforced by validateProjectionResult:
 *   freshness.status === "ok" ↔ fact is non-null
 *   freshness.status !== "ok" ↔ fact is null
 *
 * The projection MUST NOT return zero-valued or empty defaults when it
 * failed. It MUST return null and a truthful freshness.
 */
export interface ProjectionResult<T> {
  readonly projection_name: string;
  readonly projection_version: string;
  readonly fact: LoggedFact<T> | null;
  readonly freshness: ProjectionFreshness;
  readonly computed_at: string;
}

// ═══════════════════════════════════════════════════════════════════════
// PROJECTION ENGINE INTERFACE
// ═══════════════════════════════════════════════════════════════════════

/**
 * Contract every concrete projection implements. `compute(input)` returns
 * a ProjectionResult, never throws — errors become `freshness.status === "error"`.
 */
export interface ProjectionEngine<TInput, TValue> {
  readonly name: string;
  readonly version: string;
  compute(input: TInput): Promise<ProjectionResult<TValue>>;
}

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Ergonomic constructor for the OK case. Callers pass their fact and a
 * fresh timestamp. Never returns a zero for error — this helper is only
 * for the success branch.
 */
export function okResult<T>(input: {
  readonly projection_name: string;
  readonly projection_version: string;
  readonly fact: LoggedFact<T>;
  readonly computed_at?: string;
}): ProjectionResult<T> {
  const now = input.computed_at ?? new Date().toISOString();
  return {
    projection_name: input.projection_name,
    projection_version: input.projection_version,
    fact: input.fact,
    freshness: { status: "ok" },
    computed_at: now,
  };
}

export function staleResult<T>(input: {
  readonly projection_name: string;
  readonly projection_version: string;
  readonly fact: LoggedFact<T>;
  readonly last_ok_at: string;
  readonly staleness_reason: string;
  readonly computed_at?: string;
}): ProjectionResult<T> {
  return {
    projection_name: input.projection_name,
    projection_version: input.projection_version,
    fact: input.fact,
    freshness: {
      status: "stale",
      last_ok_at: input.last_ok_at,
      staleness_reason: input.staleness_reason,
    },
    computed_at: input.computed_at ?? new Date().toISOString(),
  };
}

export function unavailableResult<T>(input: {
  readonly projection_name: string;
  readonly projection_version: string;
  readonly reason: string;
  readonly computed_at?: string;
}): ProjectionResult<T> {
  return {
    projection_name: input.projection_name,
    projection_version: input.projection_version,
    fact: null,
    freshness: { status: "unavailable", reason: input.reason },
    computed_at: input.computed_at ?? new Date().toISOString(),
  };
}

export function errorResult<T>(input: {
  readonly projection_name: string;
  readonly projection_version: string;
  readonly error: string;
  readonly computed_at?: string;
}): ProjectionResult<T> {
  return {
    projection_name: input.projection_name,
    projection_version: input.projection_version,
    fact: null,
    freshness: { status: "error", error: input.error },
    computed_at: input.computed_at ?? new Date().toISOString(),
  };
}

/**
 * Validate that a projection result honours the no-silent-zero invariant:
 *   ok      → fact MUST be non-null (fresh value present)
 *   stale   → fact MUST be non-null (last-good value carried with staleness marker)
 *   unavailable → fact MUST be null  (no legitimate value to show)
 *   error       → fact MUST be null  (read failed · no zero-defaults)
 * Returns { ok: true } on pass, { ok: false, reason } on violation.
 */
export function validateProjectionInvariant<T>(
  r: ProjectionResult<T>,
): { ok: true } | { ok: false; reason: string } {
  const status = r.freshness.status;
  if (status === "ok" || status === "stale") {
    if (r.fact === null) {
      return { ok: false, reason: `${status}_freshness_requires_non_null_fact` };
    }
    return { ok: true };
  }
  // unavailable · error
  if (r.fact !== null) {
    return { ok: false, reason: `${status}_freshness_must_have_null_fact_no_silent_zero` };
  }
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════
// DOCTRINE LOCKS (Stage 6)
// ═══════════════════════════════════════════════════════════════════════

export const _PROJECTION_IS_READ_ONLY =
  "projections_read_authoritative_stores_never_write_never_persist_materialised_copy";

export const _PROJECTION_IS_NOT_A_SECOND_SOURCE_OF_TRUTH =
  "authoritative_state_stays_in_original_stores_projections_are_transient_derivations";

export const _PROJECTION_NEVER_SILENT_ZERO_ON_ERROR =
  "when_read_fails_freshness_becomes_error_or_unavailable_and_fact_becomes_null_never_zero";

export const _PROJECTION_COMPUTE_NEVER_THROWS =
  "compute_catches_all_errors_and_maps_them_to_freshness_error_status_never_propagates";
