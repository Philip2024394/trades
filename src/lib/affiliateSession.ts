// Server-only helpers for the Xrated Trades Affiliate dashboard session.
//
// Mirrors the shape of tradeSession.ts but issues a distinct cookie
// (`xrated_affiliate_session`) carrying the numeric affiliate_id. We
// reuse ADMIN_COOKIE_SECRET so there's a single secret-rotation
// surface; HMAC namespaces are inferred from the payload shape
// (admin = "ok", trade = { listing_id, slug }, affiliate =
// { affiliate_id }), so a cookie minted for one surface can never be
// replayed against another.
import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

export const AFFILIATE_SESSION_COOKIE_NAME = "xrated_affiliate_session";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  const secret = process.env.ADMIN_COOKIE_SECRET;
  if (!secret) {
    throw new Error("Missing ADMIN_COOKIE_SECRET");
  }
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

function b64urlEncode(input: string): string {
  return Buffer.from(input, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(input: string): string {
  const padded = input
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(input.length + ((4 - (input.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64").toString("utf-8");
}

export type AffiliateSessionPayload = {
  /** Sequential numeric affiliate_id — what the user shares in URLs. */
  affiliate_id: number;
  /** Unix seconds when this session stops being valid. */
  exp: number;
};

/** Sign a session cookie. Returns `<base64url(json)>.<hmac>`. */
export function signAffiliateSession(
  payload: { affiliate_id: number },
  expSeconds: number = COOKIE_MAX_AGE_SECONDS
): string {
  const full: AffiliateSessionPayload = {
    affiliate_id: payload.affiliate_id,
    exp: Math.floor(Date.now() / 1000) + expSeconds
  };
  const body = b64urlEncode(JSON.stringify(full));
  const sig = sign(body);
  return `${body}.${sig}`;
}

/** Constant-time verify + decode. Null on any failure. */
export function verifyAffiliateSession(
  cookieValue: string | undefined | null
): { affiliate_id: number } | null {
  if (!cookieValue || typeof cookieValue !== "string") return null;
  const dot = cookieValue.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = cookieValue.slice(0, dot);
  const sig = cookieValue.slice(dot + 1);
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  try {
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  let payload: AffiliateSessionPayload;
  try {
    payload = JSON.parse(b64urlDecode(body)) as AffiliateSessionPayload;
  } catch {
    return null;
  }
  if (
    !payload ||
    typeof payload.affiliate_id !== "number" ||
    typeof payload.exp !== "number"
  ) {
    return null;
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return { affiliate_id: payload.affiliate_id };
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: COOKIE_MAX_AGE_SECONDS
};

/** Mint + attach a session cookie on the outgoing response. */
export function setAffiliateSessionCookie(
  response: NextResponse,
  affiliateId: number
): void {
  const value = signAffiliateSession({ affiliate_id: affiliateId });
  response.cookies.set(AFFILIATE_SESSION_COOKIE_NAME, value, COOKIE_OPTIONS);
}

/** Clear the session cookie — used by /api/affiliates/logout. */
export function clearAffiliateSessionCookie(response: NextResponse): void {
  response.cookies.set(AFFILIATE_SESSION_COOKIE_NAME, "", {
    ...COOKIE_OPTIONS,
    maxAge: 0
  });
}

/** Read + verify the session from a NextRequest. Null when missing. */
export function readAffiliateSession(
  req: NextRequest
): { affiliate_id: number } | null {
  const raw = req.cookies.get(AFFILIATE_SESSION_COOKIE_NAME)?.value;
  return verifyAffiliateSession(raw);
}

/**
 * Read + verify the session from a Server Component via next/headers.
 * Returns null when missing — pages should redirect to /affiliates/login
 * on null.
 */
export async function readAffiliateSessionServer(): Promise<{
  affiliate_id: number;
} | null> {
  const jar = await cookies();
  return verifyAffiliateSession(jar.get(AFFILIATE_SESSION_COOKIE_NAME)?.value);
}
