// Xrated Trades — Materials Network shared helpers.
//
// Centralises the bits that get imported by multiple routes / pages:
// - ref-code generator (deterministic alphabet, collision-resistant)
// - WhatsApp-number hashing (so we can dedupe 24h sticky without
//   storing the e164 in the dedupe lookup itself)
// - commission calculator (rate% × order_pence, floor at min_pence)
// - constants (MAX_PICKS, ATTRIBUTION_WINDOW_HOURS)
//
// All side-effect-free. Re-exported by API routes and the dashboard
// editor so a future tweak (e.g. raising the cap from 12 → 16) lands
// in one place.

import { createHash, randomBytes, timingSafeEqual } from "crypto";

export const MAX_PICKS = 12;
export const ATTRIBUTION_WINDOW_HOURS = 24;
export const REF_CODE_PREFIX = "MN-";

// Crockford-style alphabet — no 0/O/1/I/L confusion. 6 chars = 32^6 ≈
// 1B values; collisions are checked at insert time with a UNIQUE
// constraint and retried.
const REF_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateRefCode(): string {
  const bytes = randomBytes(6);
  let out = REF_CODE_PREFIX;
  for (let i = 0; i < 6; i++) {
    out += REF_CODE_ALPHABET[bytes[i]! % REF_CODE_ALPHABET.length];
  }
  return out;
}

/** Hash a WhatsApp E.164 number for the dedupe lookup. We never log the
 *  raw number with the hash so a leaked log row can't be reversed. */
export function hashWhatsapp(e164: string): string {
  const trimmed = e164.replace(/\D+/g, "");
  if (trimmed.length === 0) return "";
  return createHash("sha256").update(`xrated-mn::${trimmed}`).digest("hex");
}

export function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/** Commission in pence — (rate% × order_pence), floored at min_pence.
 *  Rate of null/0 means the merchant hasn't configured commission so
 *  the calculator returns 0 (no commission booked). */
export function calculateCommissionPence({
  order_pence,
  rate,
  min_pence
}: {
  order_pence: number;
  rate: number | null;
  min_pence: number;
}): number {
  if (!Number.isFinite(order_pence) || order_pence <= 0) return 0;
  if (rate === null || rate <= 0) return 0;
  const raw = Math.round((order_pence * rate) / 100);
  return Math.max(raw, Math.max(0, min_pence | 0));
}

export function formatGbpPence(pence: number): string {
  const pounds = pence / 100;
  return `£${pounds.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}
