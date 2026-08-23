// NEX Food · Phase 6 · claim code generation + verification (pure functions).
//
// 6-digit numeric codes · 10-minute expiry · 5-attempt limit per code.
// Codes hashed with pgcrypto crypt() at rest · plaintext never persisted.

import { randomInt } from "node:crypto";

export const CLAIM_CODE_LENGTH = 6;
export const CLAIM_CODE_TTL_MS = 10 * 60 * 1000;
export const CLAIM_CODE_MAX_ATTEMPTS = 5;

/** Generate a fresh 6-digit numeric code. Uses crypto.randomInt (not Math.random). */
export function generateClaimCode(): string {
  const digits: string[] = [];
  for (let i = 0; i < CLAIM_CODE_LENGTH; i++) {
    digits.push(String(randomInt(0, 10)));
  }
  return digits.join("");
}

/** SQL fragment · pgcrypto crypt(code, gen_salt('bf')) → bcrypt hash. */
export const CRYPT_HASH_SQL = "crypt($1, gen_salt('bf'))";

/** SQL fragment · verify code against stored hash. */
export const CRYPT_VERIFY_SQL = "code_hash = crypt($1, code_hash)";

/** Expiry timestamp for a code generated now. */
export function computeExpiry(): Date {
  return new Date(Date.now() + CLAIM_CODE_TTL_MS);
}

/** URL-safe claim ref for the claim page path.  '#FL-2026-00001' → '2026-00001'. */
export function refToPathSlug(publicListingRef: string): string {
  return publicListingRef.replace(/^#FL-/, "");
}

/** Reverse of refToPathSlug. */
export function slugToRef(slug: string): string {
  return `#FL-${slug}`;
}
