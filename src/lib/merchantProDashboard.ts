// Merchant Pro dashboard — section catalogue + next-best-step picker.
//
// The Merchant Pro dashboard (building-merchant + builders-supplies on
// the £14.99/mo tier) presents the public profile as a grid of SECTIONS
// rather than a hub of paid ADD-ONS. Every section here is included with
// the tier — the tradesperson's job is to fill what they'll use and
// toggle off what they won't. Empty + ON = hidden from the public profile
// (no broken-looking gaps). OFF = explicitly hidden, won't nag.

import type { HammerexTradeOffListing } from "@/lib/supabase";

export type MerchantProSectionCounts = {
  /** Live products in hammerex_xrated_products. */
  live_products: number;
  /** Live products that have a merchant_category set — drives the
   *  Material Calculators section ("X of Y products categorised"). */
  categorised_products: number;
  /** Total newsletter subscribers (active + unsubscribed all-time). */
  newsletter_subscribers: number;
  /** Downloads (PDFs/brochures) uploaded. */
  downloads_count: number;
  /** Q&A items in the dedicated FAQ Page add-on. */
  faq_page_items: number;
  /** Trade Center Picks (promo / arrival banners). */
  picks_count: number;
  /** Materials Network — merchants they've picked. */
  materials_picks: number;
  /** Wholesale shipping zones configured. */
  wholesale_zones: number;
  /** Trusted Trades — recommendations made. */
  trusted_trades_count: number;
  /** Lead alerts — push subscriptions registered on this listing. */
  lead_alerts_subscriptions: number;
  /** Custom domain status — "live" when the domain is routing traffic. */
  custom_domain_status: string | null;
};

export type MerchantProSection = {
  /** Stable key matching the AddOnsEnabled JSONB column. Toggling on/off
   *  flips listing.addons_enabled[key]. Reuses the existing add-on slugs
   *  so the data model doesn't fork. */
  key: string;
  /** Display name on the section card. */
  name: string;
  /** One-line description shown under the name. */
  tagline: string;
  /** Single-character glyph rendered in the card's yellow circle. */
  glyph: string;
  /** Dashboard sub-route used by the "Manage" CTA. Combined with
   *  /trade-off/edit/<slug>/<editorPath>?token=<token>. */
  editorPath: string;
  /** True = section is filled (renders on the public profile). False =
   *  empty (won't render even if the toggle is ON — keeps the profile
   *  from looking broken). */
  isFilled: (counts: MerchantProSectionCounts) => boolean;
  /** Short label describing the count state — "12 products", "Empty",
   *  "0 of 12 picks". */
  countLabel: (counts: MerchantProSectionCounts) => string;
  /** True = this section is fundamental to the merchant being useful —
   *  drives the "Next best step" ordering. Products first, then
   *  wholesale, then promo, then everything else. */
  weight: number;
  /** Default state when the listing is brand-new (no explicit toggle).
   *  Most sections default ON; lead-alerts defaults OFF because it
   *  requires a separate PWA install action. */
  defaultOn: boolean;
};

export const MERCHANT_PRO_SECTIONS: MerchantProSection[] = [
  {
    key: "shop_mode",
    name: "Products",
    tagline: "Your storefront — up to 200 products, 4 photos each",
    glyph: "🛒",
    editorPath: "shop-mode",
    isFilled: (c) => c.live_products > 0,
    countLabel: (c) =>
      c.live_products === 0
        ? "Empty — add your first product"
        : `${c.live_products} / 200 live`,
    weight: 100,
    defaultOn: true
  },
  {
    key: "wholesale_mode",
    name: "Wholesale + Delivery",
    tagline: "Bulk tiers + yard-radius delivery quote",
    glyph: "🚚",
    editorPath: "wholesale-mode",
    isFilled: (c) => c.wholesale_zones > 0,
    countLabel: (c) =>
      c.wholesale_zones === 0
        ? "Set your yard pin + delivery bands"
        : `${c.wholesale_zones} delivery zone${c.wholesale_zones === 1 ? "" : "s"}`,
    weight: 90,
    defaultOn: true
  },
  {
    key: "trade_center_picks",
    name: "Promo Banners",
    tagline: "Pin promo, arrival and stock-status banners onto products",
    glyph: "🏷️",
    editorPath: "trade-center-picks",
    isFilled: (c) => c.picks_count > 0,
    countLabel: (c) =>
      c.picks_count === 0
        ? "Pin your first promo"
        : `${c.picks_count} pinned`,
    weight: 80,
    defaultOn: true
  },
  {
    key: "material_calculators",
    name: "Material Calculators",
    tagline: "Auto-show paint / flooring / tiles / gravel calc on each product",
    glyph: "🧮",
    editorPath: "product-categories",
    isFilled: (c) =>
      c.live_products > 0 && c.categorised_products >= c.live_products,
    countLabel: (c) =>
      c.live_products === 0
        ? "Add products first"
        : `${c.categorised_products} / ${c.live_products} categorised`,
    weight: 85,
    defaultOn: true
  },
  {
    key: "newsletter",
    name: "Newsletter",
    tagline: "Footer email capture — GDPR-compliant, CSV export",
    glyph: "✉",
    editorPath: "newsletter",
    isFilled: () => true,
    countLabel: (c) =>
      c.newsletter_subscribers === 0
        ? "Live — 0 signups yet"
        : `${c.newsletter_subscribers} signup${c.newsletter_subscribers === 1 ? "" : "s"}`,
    weight: 50,
    defaultOn: true
  },
  {
    key: "downloads",
    name: "Catalogues + PDFs",
    tagline: "Upload brochures, catalogues, RAMS, trade-account forms",
    glyph: "↓",
    editorPath: "downloads",
    isFilled: (c) => c.downloads_count > 0,
    countLabel: (c) =>
      c.downloads_count === 0
        ? "Empty — upload your first PDF"
        : `${c.downloads_count} file${c.downloads_count === 1 ? "" : "s"}`,
    weight: 70,
    defaultOn: true
  },
  {
    key: "faq_page",
    name: "FAQ + photos",
    tagline: "Ref-numbered Q&A with reference images",
    glyph: "?",
    editorPath: "faq-page",
    isFilled: (c) => c.faq_page_items > 0,
    countLabel: (c) =>
      c.faq_page_items === 0
        ? "Add your first Q&A"
        : `${c.faq_page_items} question${c.faq_page_items === 1 ? "" : "s"}`,
    weight: 40,
    defaultOn: true
  },
  {
    key: "materials_network",
    name: "Materials Network",
    tagline: "Recommend merchants you trust — earn referral fees",
    glyph: "🔗",
    editorPath: "materials-network",
    isFilled: (c) => c.materials_picks > 0,
    countLabel: (c) =>
      c.materials_picks === 0
        ? "0 of 12 picks"
        : `${c.materials_picks} of 12 picks`,
    weight: 35,
    defaultOn: true
  },
  {
    key: "trusted_trades",
    name: "Trusted Trades",
    tagline: "Recommend other tradespeople — 12 cards max",
    glyph: "★",
    editorPath: "trusted-trades",
    isFilled: (c) => c.trusted_trades_count > 0,
    countLabel: (c) =>
      c.trusted_trades_count === 0
        ? "0 of 12 cards"
        : `${c.trusted_trades_count} of 12`,
    weight: 30,
    defaultOn: true
  },
  {
    key: "custom_domain",
    name: "Custom Domain",
    tagline: "Use your own URL — yourtrade.co.uk",
    glyph: "🌐",
    editorPath: "custom-domain",
    isFilled: (c) => c.custom_domain_status === "live",
    countLabel: (c) =>
      c.custom_domain_status === "live"
        ? "Live — your domain is active"
        : "Not set — point your own URL",
    weight: 25,
    defaultOn: false
  },
  {
    key: "lead_alerts",
    name: "Lead Alerts",
    tagline: "Phone push the second a customer taps WhatsApp",
    glyph: "🔔",
    editorPath: "lead-alerts",
    isFilled: (c) => c.lead_alerts_subscriptions > 0,
    countLabel: (c) =>
      c.lead_alerts_subscriptions === 0
        ? "Install Xrated on your phone to enable"
        : `${c.lead_alerts_subscriptions} device${c.lead_alerts_subscriptions === 1 ? "" : "s"}`,
    weight: 20,
    defaultOn: false
  }
];

/** True when this listing has the section toggled on. Honours the
 *  per-section `defaultOn` for keys the user has never touched.
 *  Toggling a filled section OFF hides it from the public profile but
 *  preserves its content (we never destructively delete on toggle). */
export function isSectionOn(
  listing: Pick<HammerexTradeOffListing, "addons_enabled">,
  section: MerchantProSection
): boolean {
  const map = listing.addons_enabled ?? {};
  if (section.key in map) return map[section.key] === true;
  return section.defaultOn;
}

/** Compute the "next best step" — the highest-weight section that is
 *  ON but empty. Returns null when every ON section is filled.
 *
 *  Used by the dashboard's single yellow lead card so the tradesperson
 *  always sees the most-impactful empty section first. */
export function nextBestStep(
  listing: Pick<HammerexTradeOffListing, "addons_enabled">,
  counts: MerchantProSectionCounts
): MerchantProSection | null {
  const candidates = MERCHANT_PRO_SECTIONS.filter(
    (s) => isSectionOn(listing, s) && !s.isFilled(counts)
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.weight - a.weight);
  return candidates[0];
}

/** Sections-completed count for the profile-progress chip. Counts ON +
 *  filled. Total is the number of sections that are ON (sections OFF
 *  don't count against the score — the tradesperson explicitly opted
 *  out, so penalising them is wrong). */
export function profileProgress(
  listing: Pick<HammerexTradeOffListing, "addons_enabled">,
  counts: MerchantProSectionCounts
): { filled: number; total: number } {
  const onSections = MERCHANT_PRO_SECTIONS.filter((s) => isSectionOn(listing, s));
  const filled = onSections.filter((s) => s.isFilled(counts)).length;
  return { filled, total: onSections.length };
}
