// WO-WORKSTATION-01 · idempotency
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// Foundation only — this file does NOT invoke code generation, real execution,
// or any downstream capability. It only guarantees that repeated submission
// of the same founder request produces the same project identity, so retries
// after a crash/restart don't fork a project.
//
// Rule: `trace_id` for a request is a deterministic function of
//   - raw_request text
//   - optional seed
//   - optional idempotency_key (client-supplied)
// So the same (request, seed, key) triple always resolves to the same
// trace_id. Different keys → different projects. Missing key → hash of
// (request, seed) only, which is still stable for the same input.
//
// This is a lookup helper. Actual storage of the mapping lives in the
// durable-store; this file only computes the hash + returns the key.

import { createHash } from "node:crypto";

/**
 * Compute a deterministic idempotency key for a founder request.
 *
 * When the client supplies its own `idempotency_key`, use it (client-owned
 * dedup, e.g. request retries). Otherwise hash the semantic content of the
 * request so two identical submissions collapse to the same key.
 *
 * Never mixes user input with the hash namespace — the returned string is
 * prefixed with `wo1:idem:` so a comparison against another kind of hash
 * cannot collide.
 */
export function computeIdempotencyKey(input: {
  readonly raw_request: string;
  readonly seed?: string;
  readonly idempotency_key?: string;
}): string {
  if (typeof input.idempotency_key === "string" && input.idempotency_key.trim().length > 0) {
    // Client-supplied · trust but namespace.
    return `wo1:idem:client:${input.idempotency_key.trim()}`;
  }
  const h = createHash("sha256");
  h.update(input.raw_request);
  h.update("\0");                // domain separator so seed cannot collide
  h.update(input.seed ?? "");
  return `wo1:idem:derived:${h.digest("hex")}`;
}

/**
 * Compute a stable trace_id (project identity) from an idempotency key.
 * Different derivation from the idempotency key itself so a leaked key
 * doesn't reveal the trace_id directly.
 */
export function deriveTraceIdFromIdempotencyKey(key: string): string {
  const h = createHash("sha256");
  h.update("wo1:trace_id:v1\0");
  h.update(key);
  // 24 hex chars = 96 bits · collision-safe for the foreseeable trace volume,
  // shorter than a full 64-char sha256 for URL/log ergonomics.
  return `wo1-${h.digest("hex").slice(0, 24)}`;
}
