// "Welcome Knife" voucher helpers. Every tradie who completes Xrated
// Trades signup gets a unique XRATED-XXXX-XXXX code redeemable for a free
// Hammerex Folding Safety Cutting Knife inside their next Hammerex order.
//
// Codes are short, readable (no 0/O/1/I) and case-insensitive in spirit.
// Phone-screen friendly: 8 chars of entropy split into two groups of four.

import crypto from "crypto";

export const WELCOME_KNIFE_PRODUCT_SLUG = "folding-safety-cutting-knife";
export const WELCOME_KNIFE_NAME = "Hammerex Folding Safety Cutting Knife";

// Static product reference used by the WelcomeKnifePopup so the done-page
// client component can hand a CartLine straight to `cart.add()` without
// having to fetch the product row at runtime. Refresh the constants if the
// canonical knife product is ever moved or replaced.
export const WELCOME_KNIFE_PRODUCT = {
  id: "d1495eda-92de-4150-8f97-41d252bb5946",
  slug: WELCOME_KNIFE_PRODUCT_SLUG,
  name: WELCOME_KNIFE_NAME,
  sku: "HX-FSCK-001",
  image_url:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/migrated/fa5b92ce94f3cb83.png"
} as const;

// Compact, readable code: XRATED-XXXX-XXXX (8 chars of base32-ish entropy
// from random bytes). Reads cleanly on a phone screen, hard to typo.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // omit 0/O/1/I for clarity

export function generateVoucherCode(): string {
  const bytes = crypto.randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `XRATED-${out.slice(0, 4)}-${out.slice(4, 8)}`;
}

// Normalise a buyer-typed code to the canonical XRATED-XXXX-XXXX shape.
// Strips spaces, uppercases, collapses dashes. Returns null if it can't be
// coerced into the right shape so callers can short-circuit on bad input.
export function normaliseVoucherCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input.trim().toUpperCase().replace(/\s+/g, "");
  if (!cleaned) return null;
  // Accept "XRATED-XXXX-XXXX" or "XRATEDXXXXXXXX" — re-insert dashes.
  const m = cleaned.match(/^XRATED-?([A-Z2-9]{4})-?([A-Z2-9]{4})$/);
  if (!m) return null;
  return `XRATED-${m[1]}-${m[2]}`;
}
