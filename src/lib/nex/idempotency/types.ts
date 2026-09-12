// src/lib/nex/idempotency/types.ts
//
// WAVE-P-1.2 · GAP-5 · Idempotency key handling
// Founder BEGIN WAVE-P-1 · 2026-09-08
//
// Stripe-style Idempotency-Key semantics · client-generated UUID ·
// server stores response body keyed by hash · retries return cached
// response · TTL-based cleanup · self-sustainment: default JSONL store,
// Supabase backend swappable via adapter interface.

export const IDEMPOTENCY_HEADER = "Idempotency-Key";

/** How long a completed record stays valid for replay before eviction.
 *  Default 24h matches Stripe convention. */
export const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/** Stored record shape · body kept as opaque string (JSON-serialized
 *  by caller) so any response type is supported. */
export type IdempotencyRecord = {
  key: string;                              // client-supplied Idempotency-Key
  request_hash: string;                     // SHA-256 of request body · defends against key-reuse-with-different-body
  status: "in_flight" | "completed" | "failed";
  response_body_json?: string;              // serialized response · populated on completion
  status_code?: number;
  created_at_ms: number;
  completed_at_ms?: number;
  expires_at_ms: number;                    // created_at + TTL
  route_path: string;                       // for auditability · which API surface
  actor_hint_hash?: string;                 // hashed actor id · never plaintext
};

/** Result of a lookup · discriminated so caller can distinguish
 *  first-time-request vs safe-replay vs conflict. */
export type IdempotencyLookupResult =
  | { kind: "not_found" }                                                       // first time · caller proceeds
  | { kind: "in_flight"; record: IdempotencyRecord }                            // duplicate concurrent · caller returns 409
  | { kind: "completed_same_request"; record: IdempotencyRecord }               // replay · caller returns cached response
  | { kind: "completed_different_request"; record: IdempotencyRecord; new_hash: string } // key-reuse-with-different-body · 422
  | { kind: "expired" };                                                        // stale · caller treats as first time

/** Adapter interface · JSONL store is default · Supabase alternative
 *  can be plugged in later without changing middleware code. */
export interface IdempotencyStore {
  lookup(key: string, request_hash: string): Promise<IdempotencyLookupResult>;
  begin(record: Omit<IdempotencyRecord, "status" | "completed_at_ms" | "response_body_json" | "status_code"> & { status?: "in_flight" }): Promise<void>;
  complete(key: string, status_code: number, response_body_json: string): Promise<void>;
  fail(key: string, reason: string): Promise<void>;
  /** Sweep expired records · called by cron or on-write · pure count return. */
  sweepExpired(now_ms?: number): Promise<number>;
}
