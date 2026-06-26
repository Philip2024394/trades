// Xrated Trades — brand wordmark for the public Trade Off surface.
// Shares the Hammerex yellow accent (#FFB300); has its own logo and
// domain. Routes stay under /trade-off and /trade for now;
// xratedtrade.com points at the Hammerex deployment via Vercel.

import type { HammerexTradeOffListing } from "./supabase";

export const XRATED_BRAND = {
  name: "Xrated Trades",
  domain: "xratedtrade.com",
  tagline: "Find Trades. View Real Work. Get Quotes Fast.",
  // Hammerex yellow accent — shared with the core Hammerex brand token.
  accent: "#FFB300",
  accentHover: "#E5A500",
  accentInk: "#FFFFFF",
  logoUrl:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/branding/xrated_logo_v3.png",
  heroImageUrl:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/branding/xrated-landing-hero-v4.png"
} as const;

// Tier system — Standard is free for life, App is a 30-day trial then £8/mo.
export type XratedTier = "standard" | "app_trial" | "app_paid" | "app_expired";

export const XRATED_PRICING = {
  monthlyGbp: 8,
  annualGbp: 80,
  trialDays: 30,
  whatsappPaymentInstructions:
    "Send 'XRATED' + your Trade Off URL to our WhatsApp to renew. We confirm payment manually and flip your tier within 24 hours."
};

export function isAppTier(tier: XratedTier): boolean {
  return tier === "app_trial" || tier === "app_paid";
}

export function isAppTierLive(listing: Pick<HammerexTradeOffListing, "tier" | "trial_expires_at"> & { tier: XratedTier; trial_expires_at: string | null }): boolean {
  if (listing.tier === "app_paid") return true;
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
