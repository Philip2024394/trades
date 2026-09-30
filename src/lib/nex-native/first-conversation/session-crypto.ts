// src/lib/nex-native/first-conversation/session-crypto.ts
//
// Bridge 99 · signed nex_session cookie · Stage 4a
// -----------------------------------------------------------------------------
// Sealed doctrine reference:
//   docs/doctrine/bridge-99-first-conversation-principle-plan-2026-09-30.md
//   §7 Cookie contract · Founder-sealed 2026-09-30 · doctrine baseline 6566ace3.
//
// Pure sign/verify functions for the `nex_session` cookie. Zero dependencies
// on Next.js, Supabase, DB, or any I/O. Fully unit-testable.
//
// Token layout (JWT-adjacent, without a header):
//
//     <base64url(JSON(payload))> "." <base64url(hmacSha256(payloadEncoded, key))>
//
// Payload (v1 · sealed §7):
//   { account_id, session_id, issued_at_ms, expires_at_ms }
//
// Verify pipeline (sealed §7 validity contract):
//   1. structural check — exactly two dot-separated base64url parts
//   2. HMAC signature match with timing-safe compare against every accepted key
//   3. payload JSON parse + shape check
//   4. temporal check — now < expires_at_ms
//
// The three doctrine-required validity conditions decompose as:
//   · signature_matches         → step 2
//   · now < expires_at          → step 4
//   · session_id NOT IN revoked → checked at the DB layer (session-registry
//                                 service, Stage 4b), NOT here.
//
// Verify DOES NOT hit any DB. Callers combine verify() with a DB revocation
// check to reach full validity per §7.
//
// Signing-key rotation:
//   `activeKey` signs every new token. `acceptedKeys` may include the
//   previous key(s) during a rotation window (sealed §7 recommends 7 days).
//   `activeKey` MUST always appear in `acceptedKeys` (defensive check).
//
// Timing-safe comparison via `timingSafeEqual` on equal-length buffers.
// If lengths differ, the compare returns false without leaking length info.

import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The signed cookie payload. All fields REQUIRED. */
export interface NexSessionPayload {
  /** nex_account.id · the resolved account this session identifies. */
  account_id: string;
  /** Per-credential-instance identifier (jti) · unique per session-create.
   *  Distinct from account_id: revoking one session_id must not invalidate
   *  every session for the same account. */
  session_id: string;
  /** ms epoch · when this token was issued. */
  issued_at_ms: number;
  /** ms epoch · when this token expires. Cookie is rejected on or after. */
  expires_at_ms: number;
}

/** Signing configuration · both keys are opaque secrets (>= 32 bytes). */
export interface NexSessionCryptoConfig {
  /** Key used to sign every NEW token. MUST be included in acceptedKeys. */
  activeKey: string;
  /** Keys accepted at verify time. Enables rotation with overlap window. */
  acceptedKeys: readonly string[];
}

export type NexSessionVerifyResult =
  | { ok: true; payload: NexSessionPayload }
  | { ok: false; reason: NexSessionVerifyFailure };

export type NexSessionVerifyFailure =
  | "malformed"           // structural check failed
  | "bad_signature"       // no accepted key verified the signature
  | "invalid_payload"     // JSON parse or shape check failed
  | "expired";            // now >= expires_at_ms

// ---------------------------------------------------------------------------
// Config guards
// ---------------------------------------------------------------------------

/** Throws if config is unsafe. Callers should invoke once at module load. */
export function assertSessionCryptoConfig(cfg: NexSessionCryptoConfig): void {
  if (!cfg.activeKey || cfg.activeKey.length < 32) {
    throw new Error(
      "session-crypto: activeKey must be at least 32 characters (opaque high-entropy secret)",
    );
  }
  if (!Array.isArray(cfg.acceptedKeys) || cfg.acceptedKeys.length === 0) {
    throw new Error("session-crypto: acceptedKeys must be a non-empty array");
  }
  if (!cfg.acceptedKeys.includes(cfg.activeKey)) {
    throw new Error(
      "session-crypto: activeKey must be present in acceptedKeys (self-verify sanity)",
    );
  }
  for (const k of cfg.acceptedKeys) {
    if (!k || k.length < 32) {
      throw new Error(
        "session-crypto: every acceptedKeys entry must be at least 32 characters",
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Sign
// ---------------------------------------------------------------------------

/** Produce a signed cookie token from a payload. */
export function signSessionToken(
  payload: NexSessionPayload,
  cfg: NexSessionCryptoConfig,
): string {
  if (!isValidPayloadShape(payload)) {
    throw new Error("session-crypto.signSessionToken: invalid payload shape");
  }
  const encoded = base64urlEncode(JSON.stringify(payload));
  const sig = hmacSha256Base64url(cfg.activeKey, encoded);
  return `${encoded}.${sig}`;
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

/**
 * Verify a token. Returns the payload on success, or a structured
 * failure reason. Does NOT check DB revocation; callers must combine
 * with a session-registry lookup for full sealed-§7 validity.
 *
 * `nowMs` is injectable for deterministic tests.
 */
export function verifySessionToken(
  token: string,
  cfg: NexSessionCryptoConfig,
  nowMs: number = Date.now(),
): NexSessionVerifyResult {
  // Step 1 · structural check
  if (typeof token !== "string" || token.length === 0) {
    return { ok: false, reason: "malformed" };
  }
  const dot = token.indexOf(".");
  if (dot < 0 || dot === token.length - 1) {
    return { ok: false, reason: "malformed" };
  }
  // Reject tokens with more than one dot — enforces the two-part shape.
  if (token.indexOf(".", dot + 1) >= 0) {
    return { ok: false, reason: "malformed" };
  }
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!encoded || !sig) return { ok: false, reason: "malformed" };

  // Step 2 · HMAC verify against every accepted key, timing-safe
  let anyMatch = false;
  for (const key of cfg.acceptedKeys) {
    const expected = hmacSha256Base64url(key, encoded);
    if (constantTimeStringEqual(sig, expected)) {
      anyMatch = true;
      // Do NOT break early · continue looping so total time is
      // independent of which key matched (defence-in-depth).
    }
  }
  if (!anyMatch) return { ok: false, reason: "bad_signature" };

  // Step 3 · decode + shape check
  let payload: unknown;
  try {
    payload = JSON.parse(base64urlDecodeString(encoded));
  } catch {
    return { ok: false, reason: "invalid_payload" };
  }
  if (!isValidPayloadShape(payload)) {
    return { ok: false, reason: "invalid_payload" };
  }

  // Step 4 · temporal check
  if (nowMs >= payload.expires_at_ms) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, payload };
}

// ---------------------------------------------------------------------------
// Convenience: fresh session id
// ---------------------------------------------------------------------------

/** Generate a fresh session_id (uuid v4). Wrapped for testability. */
export function generateSessionId(): string {
  return randomUUID();
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function hmacSha256Base64url(key: string, input: string): string {
  return base64urlEncode(
    createHmac("sha256", key).update(input, "utf8").digest(),
  );
}

function base64urlEncode(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecodeString(input: string): string {
  const pad = 4 - (input.length % 4);
  const padded = pad === 4 ? input : input + "=".repeat(pad);
  const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64").toString("utf8");
}

/**
 * Timing-safe string compare. Returns false without leaking length info
 * when strings differ in length. Uses timingSafeEqual on equal-length
 * buffers.
 */
function constantTimeStringEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) {
    // Still do a dummy compare of equal-length buffers so total time
    // is not obviously proportional to the shorter input's length.
    // (Not fully constant-time across length pairs, but avoids the
    // trivial early-return timing signal.)
    const dummy = Buffer.alloc(aBuf.length);
    timingSafeEqual(aBuf, dummy);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidPayloadShape(x: unknown): x is NexSessionPayload {
  if (!x || typeof x !== "object") return false;
  const p = x as Record<string, unknown>;
  if (typeof p.account_id !== "string" || !UUID_RE.test(p.account_id)) return false;
  if (typeof p.session_id !== "string" || !UUID_RE.test(p.session_id)) return false;
  if (typeof p.issued_at_ms !== "number" || !Number.isFinite(p.issued_at_ms)) return false;
  if (typeof p.expires_at_ms !== "number" || !Number.isFinite(p.expires_at_ms)) return false;
  if (p.expires_at_ms <= p.issued_at_ms) return false;
  // Reject payloads with unknown extra fields · forward-compatibility hazard.
  const keys = Object.keys(p);
  if (keys.length !== 4) return false;
  return true;
}
