// Merchant session — the identity used by every canteen/review/
// notebook write endpoint.
//
// Backed by the existing HMAC-signed session cookie
// `xrated_trade_session` (see src/lib/tradeSession.ts). That cookie
// is set by /api/trade-off/login on successful auth, so:
//   1. Real password login already works — no duplicate endpoint
//   2. This helper reads the SAME cookie the rest of the app trusts
//   3. Merchant identity is cryptographically verified, not just a
//      plain string cookie
//
// Legacy fallback: a plain `network_merchant_slug` cookie is checked
// when NETWORK_SESSION_STUB=1, exclusively for local testing.

import { cookies } from "next/headers";
import { verifyTradeSession, TRADE_SESSION_COOKIE_NAME } from "@/lib/tradeSession";

export const MERCHANT_COOKIE = "network_merchant_slug";
export const MERCHANT_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

/** Reads the merchant slug from the signed trade-session cookie.
 *  Falls back to the stub cookie only when NETWORK_SESSION_STUB=1.
 *  Returns null when no merchant is signed in. */
export async function getMerchantSlug(): Promise<string | null> {
  const jar = await cookies();
  const signed = jar.get(TRADE_SESSION_COOKIE_NAME)?.value;
  const verified = verifyTradeSession(signed);
  if (verified) return verified.slug;

  if (process.env.NETWORK_SESSION_STUB === "1") {
    return jar.get(MERCHANT_COOKIE)?.value ?? null;
  }
  return null;
}

/** Reads BOTH slug and listing_id from the session — needed by
 *  endpoints that write foreign-key-style identifiers to canteens or
 *  products. Returns null when no merchant is signed in. */
export async function getMerchantIdentity(): Promise<{ slug: string; listingId: string | null } | null> {
  const jar = await cookies();
  const signed = jar.get(TRADE_SESSION_COOKIE_NAME)?.value;
  const verified = verifyTradeSession(signed);
  if (verified) return { slug: verified.slug, listingId: verified.listing_id };

  if (process.env.NETWORK_SESSION_STUB === "1") {
    const slug = jar.get(MERCHANT_COOKIE)?.value;
    if (slug) return { slug, listingId: null };
  }
  return null;
}

/** True when the caller is authenticated as `merchantSlug`. */
export async function isMerchant(merchantSlug: string): Promise<boolean> {
  const current = await getMerchantSlug();
  return current === merchantSlug;
}
