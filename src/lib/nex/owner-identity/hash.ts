// src/lib/nex/owner-identity/hash.ts
//
// FOUNDER MASTER ACCESS · credential hashing (scrypt · node:crypto built-in)
// Philip 2026-09-08 · AUTHORIZE Founder Master Access mission
//
// Hard rules per doctrine:
//   · credential NEVER stored in plaintext anywhere
//   · scrypt with high work factor
//   · random per-credential salt
//   · constant-time verify (timingSafeEqual)
//   · reject empty / weak credentials at hash time
//   · minimum length enforced

import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

export const SCRYPT_N = 16384;          // work factor · CPU/memory cost
export const SCRYPT_R = 8;              // block size
export const SCRYPT_P = 1;              // parallelization
export const KEY_LENGTH = 64;           // hash output length in bytes
export const SALT_LENGTH = 16;          // salt in bytes
export const MIN_CREDENTIAL_LENGTH = 12;

export type OwnerCredentialHash = {
  /** Format: "scrypt$<N>$<r>$<p>$<salt_hex>$<hash_hex>" · self-describing · never contains plaintext */
  encoded: string;
  created_at_iso: string;
};

/** Hash a credential. Rejects empty / too-short input. Returns a self-describing
 *  encoded string containing algorithm parameters + salt + hash · NEVER the
 *  plaintext credential. */
export function hashOwnerCredential(plaintext: string): OwnerCredentialHash {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("REJECTED: empty credential");
  }
  if (plaintext.length < MIN_CREDENTIAL_LENGTH) {
    throw new Error(`REJECTED: credential shorter than ${MIN_CREDENTIAL_LENGTH} characters`);
  }
  const salt = randomBytes(SALT_LENGTH);
  const derived = scryptSync(plaintext, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  const encoded = `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${derived.toString("hex")}`;
  return { encoded, created_at_iso: new Date().toISOString() };
}

/** Verify a candidate against a stored hash. Constant-time. Returns
 *  { valid: boolean } · never returns the candidate or hash in the result. */
export function verifyOwnerCredential(candidate: string, hashRecord: OwnerCredentialHash): { valid: boolean; reason?: string } {
  if (typeof candidate !== "string" || candidate.length === 0) {
    return { valid: false, reason: "empty candidate" };
  }
  const parts = hashRecord.encoded.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return { valid: false, reason: "malformed hash record" };
  }
  const N = parseInt(parts[1], 10);
  const r = parseInt(parts[2], 10);
  const p = parseInt(parts[3], 10);
  const salt = Buffer.from(parts[4], "hex");
  const stored = Buffer.from(parts[5], "hex");
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return { valid: false, reason: "invalid hash parameters" };
  }
  let derived: Buffer;
  try {
    derived = scryptSync(candidate, salt, stored.length, { N, r, p });
  } catch {
    return { valid: false, reason: "derive failed" };
  }
  if (derived.length !== stored.length) return { valid: false, reason: "length mismatch" };
  const valid = timingSafeEqual(derived, stored);
  return { valid };
}

/** Utility: derive a short PUBLIC fingerprint of a hash record (for logging
 *  which credential slot fired · never the credential itself). Not reversible. */
export function credentialFingerprintForAudit(hashRecord: OwnerCredentialHash): string {
  const parts = hashRecord.encoded.split("$");
  if (parts.length !== 6) return "invalid";
  // Use FIRST 12 hex chars of the DERIVED hash · not the salt · not the plaintext
  return `cred_fp_${parts[5].slice(0, 12)}`;
}
