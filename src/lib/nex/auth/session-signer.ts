// NEX Auth · signed session cookies (Philip 2026-08-14).
//
// HMAC-SHA256 · local secret · no third-party dep.
// Cookie format: base64url(payload) + "." + base64url(hmac(payload))
//
// Constitutional:
//   - Never trust a session that fails signature verification
//   - Never treat expired sessions as valid
//   - Never fall back to "anonymous but pretend it's the sender" — if
//     verification fails, session becomes anonymous (no impersonation)

import { createHmac, timingSafeEqual } from "node:crypto";
import type { NexSession } from "@/lib/nex/business-context/types";

const DEV_FALLBACK_SECRET = "nex-dev-only-do-not-use-in-prod-9f4e2b7a";

function getSecret(): string {
  const s = process.env.NEX_SESSION_SECRET;
  if (s && s.length >= 32) return s;
  // In production we WOULD reject at boot rather than silently fall back.
  // Local dev: use a stable fallback + warn once.
  warnOnceMissingSecret();
  return DEV_FALLBACK_SECRET;
}

let _warned = false;
function warnOnceMissingSecret(): void {
  if (_warned) return;
  _warned = true;
  // eslint-disable-next-line no-console
  console.warn("[NEX_AUTH] NEX_SESSION_SECRET is missing or too short — using DEV fallback. Set NEX_SESSION_SECRET (≥32 chars) in .env.local for real signing.");
}

// ============================================================================
// Public
// ============================================================================

export type SignedSessionPayload = NexSession & {
  iat: number;     // seconds since epoch
  exp: number;     // seconds since epoch
  email?: string;
};

const DEFAULT_TTL_SECS = 60 * 60 * 24 * 30;   // 30 days

/** Sign a session · returns the cookie value. */
export function signSession(session: NexSession & { email?: string }, ttlSecs = DEFAULT_TTL_SECS): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SignedSessionPayload = { ...session, iat: now, exp: now + ttlSecs };
  const body = base64urlEncode(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = signHmac(body);
  return `${body}.${sig}`;
}

/** Verify + parse a session · returns null when signature bad OR expired. */
export function verifySession(cookieValue: string): SignedSessionPayload | null {
  const dot = cookieValue.lastIndexOf(".");
  if (dot < 1) return null;
  const body = cookieValue.slice(0, dot);
  const sig = cookieValue.slice(dot + 1);
  const expected = signHmac(body);
  // timing-safe compare
  const sigBytes = Buffer.from(sig, "utf8");
  const expBytes = Buffer.from(expected, "utf8");
  if (sigBytes.length !== expBytes.length) return null;
  if (!timingSafeEqual(sigBytes, expBytes)) return null;
  let payload: SignedSessionPayload;
  try {
    payload = JSON.parse(base64urlDecode(body).toString("utf8")) as SignedSessionPayload;
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now) return null;
  if (typeof payload.iat !== "number") return null;
  return payload;
}

/** Cookie serialization for Set-Cookie headers. HttpOnly always · Secure in prod. */
export function serializeSessionCookie(
  name: string,
  value: string,
  opts: { maxAgeSecs?: number; secure?: boolean } = {}
): string {
  const parts = [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${opts.maxAgeSecs ?? DEFAULT_TTL_SECS}`
  ];
  if (opts.secure ?? process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function serializeClearCookie(name: string): string {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

// ============================================================================
// Internal
// ============================================================================

function signHmac(body: string): string {
  return base64urlFromBuffer(createHmac("sha256", getSecret()).update(body).digest());
}

function base64urlEncode(buf: Buffer): string {
  return base64urlFromBuffer(buf);
}

function base64urlFromBuffer(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(s: string): Buffer {
  const norm = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = norm.length % 4 === 0 ? "" : "=".repeat(4 - (norm.length % 4));
  return Buffer.from(norm + pad, "base64");
}
