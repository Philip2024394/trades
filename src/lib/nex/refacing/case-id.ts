// RefacingCaseId — canonical Refacing Case identity per Stage 1 · C2/C5 LOCKED.
//
// Every Refacing Case has ONE canonical `rf_...` ID referenced by all other
// systems (Brain / Refacing / Chat / HQ / Quote). Other systems have their
// own records/IDs but each REFERENCES the canonical Case ID.
//
// Format: `rf_` + base32-encoded time + `_` + 8-char random suffix.
// The time-prefix ensures rough sortability without exposing collision-risky
// sequential IDs. Length is stable across cases (16 chars after prefix).

import { randomBytes } from "node:crypto";

export type RefacingCaseId = `rf_${string}`;

const BASE32_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"; // Crockford (no i, l, o, u)

function encodeBase32(n: number, length: number): string {
  let out = "";
  let v = n;
  while (v > 0 && out.length < length) {
    out = BASE32_ALPHABET[v & 31] + out;
    v = Math.floor(v / 32);
  }
  return out.padStart(length, "0");
}

function randomBase32(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += BASE32_ALPHABET[bytes[i] & 31];
  }
  return out;
}

/**
 * Generate a new canonical Refacing Case ID.
 * Format: `rf_<time>_<random>` · e.g. `rf_1n8h9k4x_a7f2c9d1`.
 */
export function newRefacingCaseId(): RefacingCaseId {
  const time = encodeBase32(Date.now(), 8);
  const rand = randomBase32(8);
  return `rf_${time}_${rand}` as RefacingCaseId;
}

/**
 * Type guard — is this string a well-formed Refacing Case ID?
 * Accepts the canonical `rf_<time>_<rand>` shape.
 */
export function isRefacingCaseId(v: unknown): v is RefacingCaseId {
  if (typeof v !== "string") return false;
  return /^rf_[0-9a-z]{4,12}_[0-9a-z]{4,16}$/.test(v);
}

/**
 * Assert-style guard. Throws with a specific PR-1/Stage-1 citation on failure.
 */
export function assertRefacingCaseId(v: unknown): asserts v is RefacingCaseId {
  if (!isRefacingCaseId(v)) {
    throw new Error(
      `Stage 1 · C2/C5 violation · expected canonical rf_ Refacing Case ID · got ${JSON.stringify(v)}`
    );
  }
}
