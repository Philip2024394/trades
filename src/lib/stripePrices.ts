// Xrated Trades — Stripe price ID map.
//
// Maps tier + billing cadence (e.g. "paid:monthly") and add-on slug to
// the Stripe price ID configured in the dashboard. The actual price IDs
// live in env vars so we can swap test → live without a redeploy and
// without ever committing live keys.
//
// See docs/STRIPE_SETUP.md for the exact products + prices the user
// must create in their Stripe dashboard, and the env-var names below.
//
// Missing env vars fall back to empty strings on purpose: it lets dev
// mode boot without Stripe wired up. The checkout route validates that
// the resolved price ID is non-empty before calling Stripe, so an
// unconfigured price returns a 400 — not a 500 — to the client.

export type StripeTierKey =
  | "paid:monthly"
  | "paid:annual"
  | "verified:monthly"
  | "verified:annual";

/** Add-on slugs that map to a recurring Stripe price. Keep in sync
 *  with XRATED_ADDONS in `src/lib/xratedAddons.ts` — these must match
 *  the `slug` strings used in addons_enabled exactly. The env-var names
 *  use the older marketing label (e.g. TRADE_CENTER for shop_mode) for
 *  backwards compatibility with the existing Stripe dashboard config. */
export type StripeAddonSlug =
  | "shop_mode"
  | "services_grid"
  | "downloads"
  | "job_diary"
  | "wholesale_mode"
  | "custom_domain"
  | "lead_alerts"
  | "materials_network"
  | "quote_pipeline"
  | "faq_page";

export const STRIPE_PRICE_IDS: {
  "paid:monthly": string;
  "paid:annual": string;
  "verified:monthly": string;
  "verified:annual": string;
  addon: Record<StripeAddonSlug, string>;
} = {
  "paid:monthly": process.env.STRIPE_PRICE_PAID_MONTHLY ?? "",
  "paid:annual": process.env.STRIPE_PRICE_PAID_ANNUAL ?? "",
  "verified:monthly": process.env.STRIPE_PRICE_VERIFIED_MONTHLY ?? "",
  "verified:annual": process.env.STRIPE_PRICE_VERIFIED_ANNUAL ?? "",
  addon: {
    shop_mode: process.env.STRIPE_PRICE_ADDON_TRADE_CENTER ?? "",
    services_grid: process.env.STRIPE_PRICE_ADDON_SERVICES_GRID ?? "",
    downloads: process.env.STRIPE_PRICE_ADDON_DOWNLOADS ?? "",
    job_diary: process.env.STRIPE_PRICE_ADDON_JOB_DIARY ?? "",
    wholesale_mode: process.env.STRIPE_PRICE_ADDON_WHOLESALE_MODE ?? "",
    custom_domain: process.env.STRIPE_PRICE_ADDON_CUSTOM_DOMAIN ?? "",
    lead_alerts: process.env.STRIPE_PRICE_ADDON_LEAD_ALERTS ?? "",
    materials_network: process.env.STRIPE_PRICE_ADDON_MATERIALS_NETWORK ?? "",
    quote_pipeline: process.env.STRIPE_PRICE_ADDON_QUOTE_PIPELINE ?? "",
    faq_page: process.env.STRIPE_PRICE_ADDON_FAQ_PAGE ?? ""
  }
};

/** Resolve the tier price ID for a given tier + billing cadence. Returns
 *  empty string if the env var isn't configured (caller MUST treat empty
 *  as "not set" and bail with a 400). */
export function resolveTierPriceId(
  tier: "paid" | "verified",
  billing: "monthly" | "annual"
): string {
  const key = `${tier}:${billing}` as StripeTierKey;
  return STRIPE_PRICE_IDS[key];
}

/** Resolve an add-on price ID by slug. Returns empty string for any
 *  slug that isn't in the controlled vocabulary OR has no env var
 *  configured. */
export function resolveAddonPriceId(slug: string): string {
  if (!(slug in STRIPE_PRICE_IDS.addon)) return "";
  return STRIPE_PRICE_IDS.addon[slug as StripeAddonSlug];
}

/** Reverse lookup — given a Stripe price ID, return the add-on slug
 *  it corresponds to (or null if it's a tier price / unknown).
 *  Used by the webhook to walk a subscription's line items and rebuild
 *  the listing's addons_enabled map. */
export function resolveAddonSlugFromPriceId(priceId: string): StripeAddonSlug | null {
  if (!priceId) return null;
  const entries = Object.entries(STRIPE_PRICE_IDS.addon) as Array<
    [StripeAddonSlug, string]
  >;
  for (const [slug, id] of entries) {
    if (id && id === priceId) return slug;
  }
  return null;
}

/** All add-on slugs that have a configured Stripe price ID. Used by
 *  the webhook to know which keys to clear from addons_enabled when
 *  rebuilding from a subscription (we mustn't clobber free add-ons
 *  like `trusted_trades` or UI prefs like `compare_section`). */
export function allAddonSlugs(): StripeAddonSlug[] {
  return Object.keys(STRIPE_PRICE_IDS.addon) as StripeAddonSlug[];
}
