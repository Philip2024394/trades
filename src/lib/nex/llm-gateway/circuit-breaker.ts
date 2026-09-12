// src/lib/nex/llm-gateway/circuit-breaker.ts
//
// WAVE-P-1.1 · GAP-6 · Per-provider circuit breaker
// Founder BEGIN WAVE-P-1 · 2026-09-08
//
// Standard closed → open → half_open pattern. Anthropic 529 overloaded
// is deliberately EXCLUDED from the failure count per doctrine (§4 of
// V.5 principles: provider's capacity issue · not our behavior).
//
// State is in-memory per gateway instance. Callers that need persistence
// across restarts should snapshot getSnapshot()/restoreSnapshot() to
// their storage.

import type {
  CircuitBreakerConfig,
  CircuitBreakerState,
  FailureKind,
  ProviderFailure,
} from "./types";
import { DEFAULT_CIRCUIT_BREAKER_CONFIG } from "./types";

// ─── State transitions · pure functions ──────────────────────────

/** Record a successful call · closes the breaker if it was open/half_open
 *  · resets consecutive_failures otherwise. Pure. */
export function recordSuccess(_prior: CircuitBreakerState): CircuitBreakerState {
  return { state: "closed", consecutive_failures: 0 };
}

/** Record a failed call · advances state per the config. Pure. */
export function recordFailure(
  prior: CircuitBreakerState,
  failure: ProviderFailure,
  config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG,
  now_ms: number = Date.now(),
): CircuitBreakerState {
  // Failures excluded from the threshold (overloaded etc) do NOT
  // advance state · but we still return `closed` fresh to keep types
  // consistent.
  if (config.excluded_failure_kinds.includes(failure.kind)) {
    return prior;
  }

  const nextFailures =
    prior.state === "closed"
      ? prior.consecutive_failures + 1
      : 1;

  if (nextFailures >= config.failure_threshold) {
    return {
      state: "open",
      opened_at_ms: now_ms,
      probe_after_ms: now_ms + config.open_duration_ms,
      last_failure_reason: `${failure.kind}: ${failure.reason}`,
    };
  }
  return { state: "closed", consecutive_failures: nextFailures };
}

/** Check whether a request should be allowed through. Returns:
 *   { allow: true }                → issue the call
 *   { allow: true, probe: true }   → issue as half-open probe
 *   { allow: false, reason: "..." }→ short-circuit · trigger fallback */
export function evaluate(
  state: CircuitBreakerState,
  now_ms: number = Date.now(),
): { allow: true; probe?: boolean } | { allow: false; reason: string } {
  if (state.state === "closed") {
    return { allow: true };
  }
  if (state.state === "half_open") {
    return { allow: true, probe: true };
  }
  // Open
  if (now_ms >= state.probe_after_ms) {
    // Transition to half_open · single probe permitted
    return { allow: true, probe: true };
  }
  return {
    allow: false,
    reason: `breaker_open · last_failure: ${state.last_failure_reason} · probe_in_ms: ${state.probe_after_ms - now_ms}`,
  };
}

/** Advance to half_open when a probe is being issued. Pure. */
export function markProbing(prior: CircuitBreakerState, now_ms: number = Date.now()): CircuitBreakerState {
  if (prior.state === "open") {
    return {
      state: "half_open",
      opened_at_ms: prior.opened_at_ms,
      probe_started_at_ms: now_ms,
    };
  }
  return prior;
}

// ─── In-memory registry of per-provider breaker state ────────────

/** In-memory registry · one row per provider id · not persistent
 *  across restarts (callers who need persistence snapshot manually). */
export class CircuitBreakerRegistry {
  private state = new Map<string, CircuitBreakerState>();
  constructor(private readonly config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG) {}

  get(provider_id: string): CircuitBreakerState {
    return this.state.get(provider_id) ?? { state: "closed", consecutive_failures: 0 };
  }

  recordSuccess(provider_id: string): void {
    this.state.set(provider_id, recordSuccess(this.get(provider_id)));
  }

  recordFailure(provider_id: string, failure: ProviderFailure, now_ms?: number): CircuitBreakerState {
    const next = recordFailure(this.get(provider_id), failure, this.config, now_ms);
    this.state.set(provider_id, next);
    return next;
  }

  evaluate(provider_id: string, now_ms?: number): ReturnType<typeof evaluate> {
    return evaluate(this.get(provider_id), now_ms);
  }

  markProbing(provider_id: string, now_ms?: number): void {
    this.state.set(provider_id, markProbing(this.get(provider_id), now_ms));
  }

  /** Snapshot current state for persistence · caller stores externally. */
  snapshot(): ReadonlyMap<string, CircuitBreakerState> {
    return new Map(this.state);
  }

  /** Restore state from snapshot · used after restart if snapshotted. */
  restore(snap: ReadonlyMap<string, CircuitBreakerState>): void {
    this.state = new Map(snap);
  }

  /** For tests · clear all state. */
  reset(): void {
    this.state.clear();
  }
}

// ─── Failure classification from raw error/response ──────────────

/** Classify a raw error into our FailureKind union. Deterministic
 *  · pure. Falls back to "unknown" rather than fabricating a kind. */
export function classifyFailure(input: {
  error?: unknown;
  http_status?: number;
  retry_after_header?: string | number | null;
}): ProviderFailure {
  const ts_iso = new Date().toISOString();
  const retry_after_ms = parseRetryAfter(input.retry_after_header);
  const errMsg = input.error instanceof Error ? input.error.message : (input.error === undefined ? "" : String(input.error));

  // HTTP status classification first
  if (typeof input.http_status === "number") {
    if (input.http_status === 529 || input.http_status === 503) {
      return { kind: "overloaded", http_status: input.http_status, retry_after_ms, reason: errMsg || `HTTP ${input.http_status} overloaded`, ts_iso };
    }
    if (input.http_status === 429) {
      return { kind: "rate_limit", http_status: input.http_status, retry_after_ms, reason: errMsg || "HTTP 429 rate limited", ts_iso };
    }
    if (input.http_status === 401 || input.http_status === 403) {
      return { kind: "auth", http_status: input.http_status, reason: errMsg || `HTTP ${input.http_status} auth`, ts_iso };
    }
    if (input.http_status === 402) {
      return { kind: "quota_exhausted", http_status: input.http_status, reason: errMsg || "HTTP 402 payment required", ts_iso };
    }
    if (input.http_status >= 500) {
      return { kind: "server_error", http_status: input.http_status, retry_after_ms, reason: errMsg || `HTTP ${input.http_status}`, ts_iso };
    }
    if (input.http_status >= 400) {
      return { kind: "malformed_response", http_status: input.http_status, reason: errMsg || `HTTP ${input.http_status}`, ts_iso };
    }
  }

  // Network-shaped errors
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET|EAI_AGAIN|network|timeout/i.test(errMsg)) {
    return { kind: "network", reason: errMsg, ts_iso };
  }

  // Malformed body / parse errors
  if (/malformed|unexpected token|invalid json/i.test(errMsg)) {
    return { kind: "malformed_response", reason: errMsg, ts_iso };
  }

  return { kind: "unknown", reason: errMsg || "unclassified", ts_iso };
}

function parseRetryAfter(v: string | number | null | undefined): number | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "number") return v * 1000;
  // Retry-After header can be seconds (integer) or HTTP-date
  const asNum = Number.parseInt(v, 10);
  if (Number.isFinite(asNum)) return asNum * 1000;
  const asDate = Date.parse(v);
  if (Number.isFinite(asDate)) return Math.max(0, asDate - Date.now());
  return undefined;
}
