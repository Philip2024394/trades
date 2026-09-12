// src/lib/nex/idempotency/middleware.ts
//
// WAVE-P-1.2 · Idempotency middleware helper for Next.js API routes
// Founder BEGIN WAVE-P-1 · 2026-09-08
//
// This is a route-handler wrapper · NOT installed into any production
// route by this wave. Wiring into /api/conversations/**/route.ts is a
// separate BEGIN. This file provides the composable primitive.

import { randomUUID } from "node:crypto";
import type { IdempotencyStore, IdempotencyRecord } from "./types";
import { IDEMPOTENCY_HEADER, DEFAULT_IDEMPOTENCY_TTL_MS } from "./types";
import { hashActor, hashRequest, computeExpiry, JsonlIdempotencyStore } from "./store";

// ═══════════════════════════════════════════════════════════════════
// § Route wrapper contract
// ═══════════════════════════════════════════════════════════════════

/** Result the wrapped handler produces · will be cached against the
 *  idempotency key. */
export type WrappedHandlerResult<T> = {
  status_code: number;
  body: T;
};

/** Options for withIdempotency wrapper. */
export type WithIdempotencyOptions = {
  route_path: string;
  actor_id?: string | null;
  ttl_ms?: number;
  store?: IdempotencyStore;
  /** When true (default) · require the header · reject with 400 if absent.
   *  When false · handler runs without idempotency guard (behavior matches
   *  pre-idempotency baseline). */
  require_header?: boolean;
};

/** Response the wrapper may return early · signals caller to serve. */
export type IdempotencyWrapperResponse<T> =
  | { kind: "proceed"; key: string; request_hash: string }
  | { kind: "cached"; status_code: number; body: T }
  | { kind: "in_flight_conflict"; status_code: 409; body: { error: string; conflicting_key: string } }
  | { kind: "different_request_conflict"; status_code: 422; body: { error: string; key: string; stored_hash: string; new_hash: string } }
  | { kind: "missing_header_refused"; status_code: 400; body: { error: string } };

// ═══════════════════════════════════════════════════════════════════
// § The load-bearing wrapper primitive
// ═══════════════════════════════════════════════════════════════════

/** Given the raw request bytes + headers · resolve idempotency state.
 *  Callers use this at the top of a route handler:
 *
 *    const preflight = await preflightIdempotency({ raw_body, headers, options });
 *    if (preflight.kind === "cached") return NextResponse.json(preflight.body, { status: preflight.status_code });
 *    if (preflight.kind === "in_flight_conflict") return NextResponse.json(preflight.body, { status: 409 });
 *    if (preflight.kind === "different_request_conflict") return NextResponse.json(preflight.body, { status: 422 });
 *    if (preflight.kind === "missing_header_refused") return NextResponse.json(preflight.body, { status: 400 });
 *    // proceed with the real handler · then finalize:
 *    const result = await handler(...);
 *    await finalizeIdempotency({ key: preflight.key, status_code: 200, body: result, store });
 *    return NextResponse.json(result);
 */
export async function preflightIdempotency<T>(input: {
  raw_body: string;
  headers: Headers | { get(name: string): string | null };
  options: WithIdempotencyOptions;
}): Promise<IdempotencyWrapperResponse<T>> {
  const { raw_body, headers, options } = input;
  const requireHeader = options.require_header !== false;
  const store = options.store ?? new JsonlIdempotencyStore();

  const providedKey = headers.get(IDEMPOTENCY_HEADER);
  if (!providedKey) {
    if (requireHeader) {
      return {
        kind: "missing_header_refused",
        status_code: 400,
        body: { error: `Missing required header '${IDEMPOTENCY_HEADER}'. Client MUST supply a UUID.` },
      };
    }
    // Fallback: generate ephemeral key · route runs without dedup benefit
    return { kind: "proceed", key: `ephemeral_${randomUUID()}`, request_hash: hashRequest(raw_body) };
  }

  if (!isValidIdempotencyKey(providedKey)) {
    return {
      kind: "missing_header_refused",
      status_code: 400,
      body: { error: `Invalid '${IDEMPOTENCY_HEADER}': must be 8-128 characters of URL-safe ASCII.` },
    };
  }

  const request_hash = hashRequest(raw_body);
  const lookup = await store.lookup(providedKey, request_hash);

  if (lookup.kind === "not_found" || lookup.kind === "expired") {
    // Begin new record
    const now = Date.now();
    await store.begin({
      key: providedKey,
      request_hash,
      created_at_ms: now,
      expires_at_ms: computeExpiry(now, options.ttl_ms),
      route_path: options.route_path,
      actor_hint_hash: hashActor(options.actor_id),
    });
    return { kind: "proceed", key: providedKey, request_hash };
  }

  if (lookup.kind === "in_flight") {
    return {
      kind: "in_flight_conflict",
      status_code: 409,
      body: { error: "Request with this Idempotency-Key is already in flight.", conflicting_key: providedKey },
    };
  }

  if (lookup.kind === "completed_same_request") {
    return {
      kind: "cached",
      status_code: lookup.record.status_code ?? 200,
      body: parseCachedBody<T>(lookup.record),
    };
  }

  if (lookup.kind === "completed_different_request") {
    return {
      kind: "different_request_conflict",
      status_code: 422,
      body: {
        error: `Idempotency-Key '${providedKey}' was previously used with a different request body.`,
        key: providedKey,
        stored_hash: lookup.record.request_hash,
        new_hash: lookup.new_hash,
      },
    };
  }

  // Fallback (should be unreachable given the union)
  return { kind: "proceed", key: providedKey, request_hash };
}

/** Called by the route handler after the real work completes ·
 *  persists the response body against the key. */
export async function finalizeIdempotency<T>(input: {
  key: string;
  status_code: number;
  body: T;
  store?: IdempotencyStore;
}): Promise<void> {
  if (input.key.startsWith("ephemeral_")) return; // no persistence for ephemeral
  const store = input.store ?? new JsonlIdempotencyStore();
  await store.complete(input.key, input.status_code, JSON.stringify(input.body));
}

/** Called by the route handler if the real work fails. */
export async function failIdempotency(input: {
  key: string;
  reason: string;
  store?: IdempotencyStore;
}): Promise<void> {
  if (input.key.startsWith("ephemeral_")) return;
  const store = input.store ?? new JsonlIdempotencyStore();
  await store.fail(input.key, input.reason);
}

// ═══════════════════════════════════════════════════════════════════
// § helpers
// ═══════════════════════════════════════════════════════════════════

function isValidIdempotencyKey(key: string): boolean {
  if (typeof key !== "string") return false;
  if (key.length < 8 || key.length > 128) return false;
  return /^[A-Za-z0-9_\-]+$/.test(key);
}

function parseCachedBody<T>(record: IdempotencyRecord): T {
  if (!record.response_body_json) return {} as T;
  try { return JSON.parse(record.response_body_json) as T; }
  catch { return {} as T; }
}
