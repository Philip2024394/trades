// src/lib/nex/durability/idempotency-key.ts
//
// UWI · Wave 2 · D2 · Idempotency-key utility (~30 LOC)
// Founder-authorised programme.
//
// Deterministic key derivation from workflow context. Same inputs always
// produce the same key. Used by every side-effecting write (memory
// retention · evidence journal · hypothesis registration · promotion) so
// duplicate delivery under stale-lease scenarios does not duplicate the
// durable outcome.
//
// Format: `<activity_name>:<sha256_hex_16>` — human-inspectable prefix
// + collision-resistant suffix. Bounded to 64 chars for DB indexing.

import { createHash } from "node:crypto";

export interface IdempotencyKeyInputs {
  /** Workflow / job / campaign id — the outer context. */
  readonly workflow_id: string;
  /** Activity name — the specific side-effecting operation. */
  readonly activity_name: string;
  /** Attempt id — enables intentional re-execution with a fresh key. */
  readonly attempt_id: string | number;
}

/** Derive a deterministic idempotency key from workflow context.
 *  Same inputs always produce the same key. Deterministic and pure. */
export function deriveIdempotencyKey(inputs: IdempotencyKeyInputs): string {
  const payload = `${inputs.workflow_id}|${inputs.activity_name}|${inputs.attempt_id}`;
  const hash = createHash("sha256").update(payload).digest("hex").slice(0, 16);
  const safe_activity = inputs.activity_name.replace(/[^a-z0-9_-]/gi, "_").slice(0, 32).toLowerCase();
  return `${safe_activity}:${hash}`;
}

/** Check whether a string is a well-formed idempotency key. */
export function isValidIdempotencyKey(key: string): boolean {
  return /^[a-z0-9_-]{1,32}:[0-9a-f]{16}$/.test(key);
}
