// Default per-trade hero banner shown on the premium app profile page
// (/trade/<slug>) under the header. Annual paid members can override
// with their own upload via `listing.custom_app_hero_url`; everyone else
// gets the curated default for their primary trade.
//
// Fill the map as new trade banners are migrated to Supabase Storage at
// branding/trade-app-banner-<slug>.png.

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
//   2. Per-trade default (when defined for the primary trade), else
//   3. null — page renders no banner.
export function resolveAppHero(input: {
  custom_app_hero_url: string | null;
  primary_trade: string | null;
  tier: string;
  last_payment_plan: string | null;
}): string | null {
  const isAnnualPaid =
    input.tier === "app_paid" && input.last_payment_plan === "annual";
  if (isAnnualPaid && input.custom_app_hero_url) {
    return input.custom_app_hero_url;
  }
  return appBannerFor(input.primary_trade);
}
