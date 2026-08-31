// src/lib/nex/signon/otp-store.ts
//
// Stage 3.33 · Phase 26 · Ephemeral OTP store (Philip 2026-08-31).
//
// In-memory OTP store keyed by full E.164 phone. Same globalThis-bound
// pattern as the Brain's session store — HMR-safe, single-node only.
// Production migration path: swap issueCode + consumeCode for a Redis
// or Supabase-table implementation with the SAME interface so callers
// don't change.
//
// Boundaries:
//   · 6-digit numeric code (matches the UI's OTP_LEN = 6)
//   · 5-minute expiry per code
//   · 5 attempts per code before it's invalidated (defence against
//     brute force · caller is expected to enforce a network-layer
//     rate limit on top)
//   · Only one live code per phone at a time · issuing a new code
//     replaces the previous entry (matches the UI's "resend" button)

const CODE_LENGTH = 6;
const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;

type CodeEntry = {
  code: string;
  issuedAt: number;
  expiresAt: number;
  attempts: number;
};

const g = globalThis as unknown as { __nex_otp_store?: Map<string, CodeEntry> };
function store(): Map<string, CodeEntry> {
  if (!g.__nex_otp_store) g.__nex_otp_store = new Map();
  return g.__nex_otp_store;
}

/**
 * Generate + persist a new OTP for the given phone. Replaces any
 * existing code. Returns the code so the caller (send route) can
 * dispatch it via the provider adapter.
 */
export function issueCode(phone: string, now: number = Date.now()): {
  code: string;
  expiresAt: number;
} {
  // Cryptographically-random digit-only code. Avoids leading-zero bias
  // by rejecting until the leading digit is 0-9 uniformly.
  const buf = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(buf);
  const digits: string[] = [];
  for (const b of buf) digits.push(String(b % 10));
  const code = digits.join("");

  const entry: CodeEntry = {
    code,
    issuedAt: now,
    expiresAt: now + CODE_TTL_MS,
    attempts: 0,
  };
  store().set(phone, entry);
  return { code, expiresAt: entry.expiresAt };
}

export type VerifyOutcome =
  | { ok: true }
  | { ok: false; reason: "no_code_issued" | "code_expired" | "too_many_attempts" | "wrong_code" };

/**
 * Compare `submitted` against the live code for `phone`. On success
 * the entry is consumed (deleted) so a code can only be used once.
 * On failure the attempt counter increments; after MAX_ATTEMPTS the
 * entry is deleted.
 */
export function consumeCode(phone: string, submitted: string, now: number = Date.now()): VerifyOutcome {
  const s = store();
  const entry = s.get(phone);
  if (!entry) return { ok: false, reason: "no_code_issued" };
  if (now > entry.expiresAt) { s.delete(phone); return { ok: false, reason: "code_expired" }; }
  entry.attempts++;
  if (entry.attempts > MAX_ATTEMPTS) { s.delete(phone); return { ok: false, reason: "too_many_attempts" }; }
  if (entry.code !== submitted) return { ok: false, reason: "wrong_code" };
  s.delete(phone);
  return { ok: true };
}

/** Test-only helper · clears every entry. Do not call from production. */
export function __resetOtpStoreForTests(): void {
  store().clear();
}
