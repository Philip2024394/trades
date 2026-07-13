// Xrated Trades — brand wordmark for the public Trade Off surface.
// Shares the Hammerex yellow accent (#FFB300); has its own logo and
// domain. Routes stay under /trade-off and /trade for now;
// thenetworkers.app is the canonical brand domain (purchased 2026-07-13).

import type { HammerexTradeOffListing } from "./supabase";

// 2026-07-13 rebrand — Philip: brand is now "Thenetworkers" and the
// canonical domain is thenetworkers.app (purchased). XRATED_BRAND is
// kept as the config export name so nothing imports break.
export const XRATED_BRAND = {
  name: "Thenetworkers",
  shortName: "Thenetworkers",
  domain: "thenetworkers.app",
  tagline: "The Trades Network. On your phone.",
  // Brand yellow — same as BRAND_YELLOW in tokens.ts.
  accent: "#FFB300",
  accentHover: "#E5A500",
  accentInk: "#0A0A0A",
  // Cream page background (the Yard/Warehouse standard).
  surface: "#FBF6EC",
  logoUrl:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/branding/xrated_logo_v3.png",
  heroImageUrl:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/branding/xrated-landing-hero-v4.png"
} as const;

// Tier system — Standard is free for life, App is a 14-day trial then £14.99/mo.
// `app_verified` (£19.99/mo) is the next tier above app_paid; on waitlist
// until Q3 2026 (see PricingTierCards WAITLIST_MODE). For gating purposes
// it behaves identically to app_paid — every paid-tier feature unlocked —
// plus a verified badge on the public profile hero.
export type XratedTier =
  | "standard"
  | "app_trial"
  | "app_paid"
  | "app_expired"
  | "app_verified";

// Single source of truth for pricing. The marketing pricing page
// (`PricingTierCards.tsx`) and the in-dashboard upgrade page must both
// read from here — never hardcode prices or trial length anywhere else.
// Prices are kept as decimal numbers (not pence) so they render cleanly
// with the existing `£${value}` template strings. Keep the .99 cadence
// across both Paid and Verified tiers.
export const XRATED_PRICING = {
  // Paid tier — the main monetisation lever.
  monthlyGbp: 14.99,
  annualGbp: 139.99,
  // Verified tier — locked behind WAITLIST_MODE in PricingTierCards
  // until verification ops are staffed. Kept here so any future
  // dashboard surface that needs to quote Verified pricing has a
  // single source of truth.
  verifiedMonthlyGbp: 19.99,
  verifiedAnnualGbp: 199.99,
  // Annual saving advertised on the toggle — pre-computed because
  // 14.99*12 - 139.99 = 39.89 which rounds visually to £40 but we
  // don't want UI to surface 39.89 by accident.
  annualSavingGbp: 40,
  // Trial length — Paid features unlocked for this many days after
  // signup. After expiry the listing auto-flips to `app_expired`.
  trialDays: 14,
  whatsappPaymentInstructions:
    "Send 'RENEW' + your thenetworkers.app URL to our WhatsApp to renew. We confirm payment manually and flip your tier within 24 hours."
};

export function isAppTier(tier: XratedTier): boolean {
  return tier === "app_trial" || tier === "app_paid" || tier === "app_verified";
}

/** Canonical "paid-or-trial" check used everywhere `app_paid` is gated.
 *  app_verified is a strict superset of app_paid, so it unlocks every
 *  paid feature too. Prefer this helper over inline `tier === "app_paid"
 *  || tier === "app_trial"` so future tier additions only need one edit. */
export function isPaidTier(tier: XratedTier): boolean {
  return (
    tier === "app_trial" || tier === "app_paid" || tier === "app_verified"
  );
}

/** True when the listing is in a hard-expired state. Trial expiry is
 *  handled by `effectiveTier` / `maybeExpireListingTier` — this only
 *  fires for the persisted `app_expired` value. */
export function isExpiredTier(tier: XratedTier): boolean {
  return tier === "app_expired";
}

/** Human-readable label for dashboard / admin surfaces. */
export function tierLabel(tier: XratedTier): string {
  switch (tier) {
    case "app_trial":
      return "Trial";
    case "app_paid":
      return "Paid";
    case "app_verified":
      return "Verified";
    case "app_expired":
      return "Expired";
    case "standard":
    default:
      return "Standard";
  }
}

export function isAppTierLive(listing: Pick<HammerexTradeOffListing, "tier" | "trial_expires_at"> & { tier: XratedTier; trial_expires_at: string | null }): boolean {
  if (listing.tier === "app_paid" || listing.tier === "app_verified") return true;
  if (listing.tier !== "app_trial") return false;
  if (!listing.trial_expires_at) return false;
  return new Date(listing.trial_expires_at).getTime() > Date.now();
}

export function trialDaysRemaining(trialExpiresAt: string | null): number | null {
  if (!trialExpiresAt) return null;
  const ms = new Date(trialExpiresAt).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

// Effective tier — collapses expired trial down to 'app_expired' for render.
export function effectiveTier(
  listing: { tier: XratedTier; trial_expires_at: string | null }
): XratedTier {
  if (listing.tier === "app_trial") {
    const remaining = trialDaysRemaining(listing.trial_expires_at);
    if (remaining !== null && remaining <= 0) return "app_expired";
  }
  return listing.tier;
}

// Theme effect names — mirrored from the cityapp beautician page.
export type HeroTextEffect = "none" | "shimmer" | "dance" | "underline";
export type CtaButtonEffect = "none" | "pulse" | "glow" | "shake";
export type AvatarFrameStyle = "none" | "ring" | "pulse" | "dance";
export type ProfilePlacement = "center" | "top-left" | "bottom-left";

// Auto-swap CTA text to dark when the theme is too light to read white on.
// Mirrors cityapp's `inkForTheme()` — keeps icons + button text legible
// regardless of which orange / cream / pastel the tradie picks.
export function inkForTheme(hex: string | null | undefined, dark = "#2A1B0E"): string {
  if (!hex) return "#FFFFFF";
  const v = hex.replace("#", "");
  if (v.length !== 6) return "#FFFFFF";
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.72 ? dark : "#FFFFFF";
}
