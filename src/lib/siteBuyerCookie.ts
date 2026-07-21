// HMAC-signed buyer-email cookie for The Site anonymous flow.
//
// When a not-signed-in visitor buys a single image (£5.99) or the
// unlimited sub (£14.99/mo), Stripe redirects back with a session_id
// query param. The Stripe success handler (see /api/site/return) uses
// that session_id to fetch the buyer email and mints this cookie so
// subsequent downloads + entitlement checks can identify them
// WITHOUT re-typing the email.
//
// Cookie shape: `<base64url({ email, exp })>.<hmac>` — same
// primitive as tradeSession.ts, separate cookie name so an
// email-only session can never be replayed as a merchant session.
//
// SERVER-ONLY. Read via readSiteBuyerEmailCookie(); write via
// setSiteBuyerEmailCookie() from a response mutator.

import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import type { NextResponse } from "next/server";

export const SITE_BUYER_COOKIE = "tn_site_buyer";
const MAX_AGE_S = 60 * 60 * 24 * 365;   // 1 year — purchases are perpetual

function getSecret(): string {
  const secret = process.env.ADMIN_COOKIE_SECRET;
  if (!secret) throw new Error("Missing ADMIN_COOKIE_SECRET");
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

function b64urlEncode(input: string): string {
  return Buffer.from(input, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(input: string): string {
  const padded = input
    .replace(/-/g, "+").replace(/_/g, "/")
    .padEnd(input.length + ((4 - (input.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64").toString("utf-8");
}

type Payload = { email: string; exp: number };

/** Sign an email into a cookie value. Called by the Stripe success
 *  handler after we've read the email off checkout.session. */
export function signSiteBuyerCookie(email: string): string {
  const payload: Payload = {
    email: email.trim().toLowerCase(),
    exp:   Math.floor(Date.now() / 1000) + MAX_AGE_S
  };
  const encoded = b64urlEncode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

/** Verify + decode. Returns email or null when missing/tampered/
 *  expired. Constant-time HMAC compare via timingSafeEqual. */
export function verifySiteBuyerCookie(raw: string | undefined): string | null {
  if (!raw) return null;
  const dot = raw.indexOf(".");
  if (dot < 0) return null;
  const encoded = raw.slice(0, dot);
  const macIn   = raw.slice(dot + 1);
  const expect  = sign(encoded);
  try {
    if (macIn.length !== expect.length) return null;
    if (!timingSafeEqual(Buffer.from(macIn, "hex"), Buffer.from(expect, "hex"))) {
      return null;
    }
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(b64urlDecode(encoded)) as Payload;
    if (typeof parsed.email !== "string" || typeof parsed.exp !== "number") return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed.email;
  } catch {
    return null;
  }
}

/** Read + verify the cookie off the incoming request headers.
 *  Returns null when absent, malformed, tampered, or expired. */
export async function readSiteBuyerEmailCookie(): Promise<string | null> {
  const jar = await cookies();
  return verifySiteBuyerCookie(jar.get(SITE_BUYER_COOKIE)?.value);
}

/** Attach the cookie to a NextResponse — used by the Stripe success
 *  handler which needs to redirect + set the cookie in one shot. */
export function setSiteBuyerCookieOnResponse(res: NextResponse, email: string): void {
  res.cookies.set({
    name:     SITE_BUYER_COOKIE,
    value:    signSiteBuyerCookie(email),
    httpOnly: true,
    sameSite: "lax",
    secure:   process.env.NODE_ENV === "production",
    path:     "/",
    maxAge:   MAX_AGE_S
  });
}
