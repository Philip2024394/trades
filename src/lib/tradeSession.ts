// Server-only helpers for the Trade Off public-side session.
//
// We reuse the same HMAC primitive + ADMIN_COOKIE_SECRET as the admin
// surface, but issue a separate cookie (`xrated_trade_session`) carrying
// the tradesperson's listing identity. Storing listing_id + slug in the
// signed payload lets the dashboard authorize a request without a DB
// round-trip per render — we still re-verify slug ownership server-side
// on the page so a session minted for a different listing can never be
// abused against a different slug.
//
// Why reuse ADMIN_COOKIE_SECRET? Single secret = one rotation surface;
// HMAC namespaces are inferred from the payload shape (admin payload is
// just "ok"; trade payload is JSON `{ listing_id, slug, exp }`). A leak
// of the admin cookie can't be replayed as a trade cookie and vice versa
// because the payload bytes differ.
import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";

export const TRADE_SESSION_COOKIE_NAME = "xrated_trade_session";

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

export type TradeSessionPayload = {
  listing_id: string;
  slug: string;
  /** Unix seconds when this session stops being valid. */
  exp: number;
};

/**
 * Sign a session cookie. Returns the encoded string `<base64url(json)>.<hmac>`.
 * Set `expSeconds` to override the default 30-day expiry (used in tests).
 */
export function signTradeSession(
  payload: { listing_id: string; slug: string },
  expSeconds: number = COOKIE_MAX_AGE_SECONDS
): string {
  const full: TradeSessionPayload = {
    listing_id: payload.listing_id,
    slug: payload.slug,
    exp: Math.floor(Date.now() / 1000) + expSeconds
  };
  const body = b64urlEncode(JSON.stringify(full));
  const sig = sign(body);
  return `${body}.${sig}`;
}

/**
 * Constant-time verify + decode a session cookie value. Returns null when
 * the signature is invalid, the payload is malformed, or the cookie has
 * expired. We never throw — every failure path is a null return so
 * callers can simply treat it as "no session".
 */
export function verifyTradeSession(
  cookieValue: string | undefined | null
): { listing_id: string; slug: string } | null {
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
  let payload: TradeSessionPayload;
  try {
    payload = JSON.parse(b64urlDecode(body)) as TradeSessionPayload;
  } catch {
    return null;
  }
  if (
    !payload ||
    typeof payload.listing_id !== "string" ||
    typeof payload.slug !== "string" ||
    typeof payload.exp !== "number"
  ) {
    return null;
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return { listing_id: payload.listing_id, slug: payload.slug };
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: COOKIE_MAX_AGE_SECONDS
};

/**
 * Mint + attach a session cookie on the outgoing response. Call from
 * /api/trade-off/create after a successful insert, from /login on
 * success, and from /set-password after a recovery completes.
 */
export function setTradeSessionCookie(
  response: NextResponse,
  listingId: string,
  slug: string
): void {
  const value = signTradeSession({ listing_id: listingId, slug });
  response.cookies.set(TRADE_SESSION_COOKIE_NAME, value, COOKIE_OPTIONS);
}

/** Clear the session cookie — used by /api/trade-off/logout. */
export function clearTradeSessionCookie(response: NextResponse): void {
  response.cookies.set(TRADE_SESSION_COOKIE_NAME, "", {
    ...COOKIE_OPTIONS,
    maxAge: 0
  });
}

/**
 * Read + verify the session from an incoming request. Returns null when
 * the request has no cookie, the cookie is forged / expired, or the
 * payload is malformed.
 */
export function readTradeSession(
  req: NextRequest
): { listing_id: string; slug: string } | null {
  const raw = req.cookies.get(TRADE_SESSION_COOKIE_NAME)?.value;
  return verifyTradeSession(raw);
}
