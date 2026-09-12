// src/lib/nex/founder/session.ts
//
// SLICE #7 · Founder-Mode Session v0 (Philip 2026-09-05)
//
// PURPOSE
// -------
// Founder authentication is TWO-FACTOR by design:
//
//   Factor 1 · Identity: authenticated Supabase user_id matches the
//              configured founder anchor (see identity.ts)
//   Factor 2 · Elevation: a valid, unexpired founder-mode session
//              signed by NEX_FOUNDER_MODE_SECRET, entered by
//              re-confirming NEX_FOUNDER_MODE_PASSWORD (sudo-like).
//
// Both factors MUST be present for any founder command to be
// executed. Being logged in as the founder identity is NOT enough
// on its own — you must have explicitly entered founder mode within
// the TTL window.
//
// This deliberately mirrors the sudo model: the founder logs in like
// anyone else, then explicitly elevates privileges for a bounded
// window. Reduces blast radius if the founder's browser is
// unattended.
//
// TOKEN FORMAT
// ------------
// Cookie value: `<user_id>.<issued_at_iso>.<hmac_hex>`
// HMAC input:   `${user_id}.${issued_at_iso}`
// Algorithm:    HMAC-SHA256 with NEX_FOUNDER_MODE_SECRET
// Verification: timing-safe · TTL-bounded · user-id-bounded
//
// The token is opaque to Supabase — this is a NEX-owned second
// factor layered ON TOP of the Supabase Auth session.

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getFounderConfig } from "./identity";

export const FOUNDER_MODE_COOKIE_NAME = "nex_founder_mode";

// Token separator: `~` is chosen so it never appears in either
// (a) UUIDs (hex + hyphens) or (b) ISO 8601 timestamps (digits + T
// + hyphens + colons + period). Using `.` would collide with the
// millisecond period in `2026-09-05T09:56:11.234Z`.
const TOKEN_SEPARATOR = "~";
const TOKEN_PARTS = 3;

// ─── Token operations ────────────────────────────────────────────

function getSecret(): string {
  const secret = process.env.NEX_FOUNDER_MODE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "[nex/founder/session] NEX_FOUNDER_MODE_SECRET missing or too short (min 32 chars)",
    );
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

/**
 * Mint a fresh founder-mode token. The token embeds the user_id +
 * timestamp so verification is bound to the identity AND rejects
 * expired tokens.
 *
 * Pure · does not touch cookies. Caller sets the cookie.
 */
export function mintFounderModeToken(userId: string, now: Date = new Date()): string {
  if (!userId || typeof userId !== "string") {
    throw new Error("[nex/founder/session] mintFounderModeToken · userId required");
  }
  const issuedAtIso = now.toISOString();
  const payload = `${userId}${TOKEN_SEPARATOR}${issuedAtIso}`;
  const hmac = sign(payload);
  return `${payload}${TOKEN_SEPARATOR}${hmac}`;
}

export type FounderModeVerificationResult =
  | {
      valid: true;
      user_id: string;
      issued_at_iso: string;
      expires_at_iso: string;
      remaining_sec: number;
    }
  | { valid: false; reason: string };

/**
 * Verify a founder-mode token. Timing-safe · TTL-checked ·
 * user-id-checked. Returns a discriminated union so callers can
 * distinguish "no cookie" from "expired" from "wrong user" from
 * "tampered."
 *
 * If `expectedUserId` is provided, the token's user_id MUST match.
 * This defends against a stolen token being replayed against a
 * different Supabase session.
 */
export function verifyFounderModeToken(
  raw: string | null | undefined,
  expectedUserId: string | null,
  now: Date = new Date(),
): FounderModeVerificationResult {
  if (!raw || typeof raw !== "string") {
    return { valid: false, reason: "no_token" };
  }
  const parts = raw.split(TOKEN_SEPARATOR);
  if (parts.length !== TOKEN_PARTS) {
    return { valid: false, reason: "malformed_token" };
  }
  const [userId, issuedAtIso, providedHmac] = parts;
  if (!userId || !issuedAtIso || !providedHmac) {
    return { valid: false, reason: "malformed_token" };
  }

  // HMAC verification (timing-safe)
  const payload = `${userId}${TOKEN_SEPARATOR}${issuedAtIso}`;
  let expectedHmac: string;
  try {
    expectedHmac = sign(payload);
  } catch {
    return { valid: false, reason: "server_misconfigured" };
  }
  const a = Buffer.from(providedHmac);
  const b = Buffer.from(expectedHmac);
  if (a.length !== b.length) {
    return { valid: false, reason: "signature_mismatch" };
  }
  let signatureOk = false;
  try {
    signatureOk = timingSafeEqual(a, b);
  } catch {
    return { valid: false, reason: "signature_mismatch" };
  }
  if (!signatureOk) {
    return { valid: false, reason: "signature_mismatch" };
  }

  // TTL check
  const issuedAt = new Date(issuedAtIso).getTime();
  if (!Number.isFinite(issuedAt)) {
    return { valid: false, reason: "malformed_timestamp" };
  }
  const config = getFounderConfig();
  const ttlMs = config.founder_mode_ttl_sec * 1000;
  const expiresAt = issuedAt + ttlMs;
  const remainingMs = expiresAt - now.getTime();
  if (remainingMs <= 0) {
    return { valid: false, reason: "expired" };
  }

  // User-id binding
  if (expectedUserId && userId !== expectedUserId) {
    return { valid: false, reason: "user_id_mismatch" };
  }

  return {
    valid: true,
    user_id: userId,
    issued_at_iso: issuedAtIso,
    expires_at_iso: new Date(expiresAt).toISOString(),
    remaining_sec: Math.floor(remainingMs / 1000),
  };
}

/**
 * Constant-time password check for founder-mode elevation.
 * Reuses the timing-safe compare pattern from adminAuth.ts.
 */
export function checkFounderModePassword(input: string | null | undefined): boolean {
  const expected = process.env.NEX_FOUNDER_MODE_PASSWORD;
  if (!expected || expected.length < 12) return false;
  if (!input || typeof input !== "string") return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ─── Cookie helpers ──────────────────────────────────────────────

export function founderModeCookieOptions() {
  const config = getFounderConfig();
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: config.founder_mode_ttl_sec,
  };
}

/**
 * Read the founder-mode token from the request cookies. Server-only.
 * Returns null when the cookie is absent.
 */
export async function readFounderModeCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(FOUNDER_MODE_COOKIE_NAME)?.value ?? null;
}
