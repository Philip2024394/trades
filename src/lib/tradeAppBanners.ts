// Default per-trade hero banner shown on the premium app profile page
// (/trade/<slug>) under the header. Annual paid members can override
// with their own upload via `listing.custom_app_hero_url`; everyone else
// gets the curated default for their primary trade.
//
// Fill the map as new trade banners are migrated to Supabase Storage at
// branding/trade-app-banner-<slug>.png.

import { tradeHeroFor } from "./tradeOffHeroes";

export const TRADE_APP_BANNERS: Record<string, string> = {
  drywaller:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/branding/trade-app-banner-drywaller.png"
};

export function appBannerFor(tradeSlug: string | null | undefined): string | null {
  if (!tradeSlug) return null;
  return TRADE_APP_BANNERS[tradeSlug] ?? null;
}

// Resolve the banner the page should actually render:
//   1. Annual paid member's custom upload (when set), else
//   2. Curated Supabase-hosted app banner (when defined), else
//   3. Per-trade landing hero from the ImageKit registry, else
//   4. null — page renders no banner.
export function resolveAppHero(input: {
  custom_app_hero_url: string | null;
  primary_trade: string | null;
  tier: string;
  last_payment_plan: string | null;
  /** Optional slug — used to bypass the annual-tier gate for seeded
   *  demo profiles (slug LIKE 'demo-%'). Demos are always shown with
   *  their custom hero because they're the platform's showcase. */
  slug?: string | null;
}): string | null {
  // Demo profiles always render their custom hero when set — they're
  // the showcase, so the tier gate doesn't apply.
  const isDemo = typeof input.slug === "string" && input.slug.startsWith("demo-");
  if (isDemo && input.custom_app_hero_url) {
    return input.custom_app_hero_url;
  }
  // Verified annual members get the same custom-hero override as paid
  // annual members — they pay more, not less, so they deserve at least
  // every paid annual perk.
  const isAnnualPaid =
    (input.tier === "app_paid" || input.tier === "app_verified") &&
    input.last_payment_plan === "annual";
  if (isAnnualPaid && input.custom_app_hero_url) {
    return input.custom_app_hero_url;
  }
  const app = appBannerFor(input.primary_trade);
  if (app) return app;
  return input.primary_trade ? tradeHeroFor(input.primary_trade) : null;
}
