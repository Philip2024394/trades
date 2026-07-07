// Inbox access token — HMAC-signed magic link.
//
// When a homeowner sends a brief to a trade, we email the trade an
// inbox link that carries a signed token. The token grants read + reply
// access to that ONE merchant's inbox for 30 days without a full login.
//
// Payload: businessId (the merchant), issuedAt (unix seconds).
// Signature: HMAC-SHA256 with INBOX_TOKEN_SECRET.
// Format:   <businessId>.<issuedAt>.<sig-hex>
//
// If INBOX_TOKEN_SECRET isn't set, we fall back to ADMIN_COOKIE_SECRET
// which is already provisioned. Both are treated as secrets.

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const s =
    process.env.INBOX_TOKEN_SECRET ||
    process.env.ADMIN_COOKIE_SECRET ||
    "";
  if (s.length < 24) {
    throw new Error(
      "inboxToken: secret missing or too short — set INBOX_TOKEN_SECRET or ADMIN_COOKIE_SECRET (>= 24 chars)."
    );
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

export function signInboxToken(businessId: string): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = `${businessId}.${issuedAt}`;
  return `${payload}.${sign(payload)}`;
}

export type InboxTokenPayload = {
  businessId: string;
  issuedAt: number;
};

export function verifyInboxToken(
  token: string
): InboxTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [businessId, issuedAtStr, providedSig] = parts;
  const issuedAt = Number(issuedAtStr);
  if (!businessId || !Number.isFinite(issuedAt) || !providedSig) return null;
  const payload = `${businessId}.${issuedAtStr}`;
  const expectedSig = sign(payload);
  if (!safeEqual(providedSig, expectedSig)) return null;
  const now = Math.floor(Date.now() / 1000);
  if (now - issuedAt > TOKEN_TTL_SECONDS) return null;
  return { businessId, issuedAt };
}
