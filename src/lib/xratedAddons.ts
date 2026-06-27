// Xrated Trades — Add-ons registry.
//
// Single source of truth for every add-on a tradesperson can switch on.
// The dashboard hub, the public marketing page, and the public profile
// renderer all import from this file so a new add-on appears in three
// places at once.
//
// To add a new add-on: append an entry to XRATED_ADDONS and (if it
// changes the rendered profile) wire its `slug` into the relevant
// component swap.

import type { HammerexTradeOffListing } from "@/lib/supabase";

export type XratedAddonPricing =
  | { kind: "free" }
  | { kind: "paid"; monthly_pence: number };

export type XratedAddonAvailability = "ready" | "coming_soon";

/** Editorial badge — honest categorisation we set ourselves, not a
 *  fabricated popularity number. Real "X tradies use this" counter is
 *  Phase 2 when we have 50+ paying users to source from. */
export type XratedAddonBadge =
  | "most_flexible"
  | "best_for_solos"
  | "built_for_merchants"
  | "viral_growth"
  | "premium_credibility"
  | "any_trade";

export type XratedAddon = {
  /** Stable identifier persisted in listings.addons_enabled. Never
   *  rename — that would orphan every tradesperson who already enabled
   *  the add-on. */
  slug: string;
  /** Display name on hub + marketing. Plain English, tradesperson
   *  audience — no SaaS jargon. */
  name: string;
  /** Short one-line hook for the hub tile + marketing card. */
  tagline: string;
  /** Two-three sentences for the marketing card detail view. */
  summary: string;
  /** Brand emoji or short icon glyph rendered in the hub tile.
   *  Keep to a single character — Tailwind sizes treat it as text. */
  glyph: string;
  /** Optional hero image URL. When null, the marketing card falls back
   *  to a yellow gradient + glyph composition. User supplies real images
   *  over time; null is fine for v1. */
  image_url?: string | null;
  /** Persona chips — small list of trades / business types this add-on
   *  best serves. Rendered as outline pills on the landscape card. 2-4
   *  entries reads cleanly; more starts to look like noise. */
  personas: string[];
  /** Editorial badge — honest categorisation, not a fake popularity
   *  signal. See XratedAddonBadge for the controlled vocabulary. */
  editorial_badge: XratedAddonBadge;
  pricing: XratedAddonPricing;
  availability: XratedAddonAvailability;
  /** When true, the dashboard renders a "Manage →" link to a dedicated
   *  editor surface. False = the add-on has no per-tradesperson config
   *  (just a toggle). */
  hasEditor: boolean;
  /** Optional dashboard route fragment. Combined with the edit base
   *  URL when hasEditor is true. */
  editorPath?: string;
  /** When true, the add-on is included automatically with any paid tier
   *  — the dashboard shows it as "Included" and skips the toggle. The
   *  customer-facing render of the feature is governed by the relevant
   *  component, not this flag. */
  includedWithPaid: boolean;
  /** Three short benefit bullets shown on the marketing card. */
  benefits: string[];
};

/** Display label for the editorial badge chips. */
export const ADDON_BADGE_LABEL: Record<XratedAddonBadge, string> = {
  most_flexible: "Most flexible",
  best_for_solos: "Best for solos",
  built_for_merchants: "Built for merchants",
  viral_growth: "Viral growth",
  premium_credibility: "Premium credibility",
  any_trade: "Works for any trade"
};

export const XRATED_ADDONS: XratedAddon[] = [
  {
    slug: "trusted_trades",
    name: "Trusted Trades",
    tagline: "Recommend other tradespeople you work with",
    summary:
      "Build a personal directory of the sparkies, brickies and roofers you trust. Customers tap any card to see that tradesperson's full Xrated profile — and you start a recommendation network that compounds.",
    glyph: "★",
    image_url: null,
    personas: ["Any trade"],
    editorial_badge: "viral_growth",
    pricing: { kind: "free" },
    availability: "ready",
    hasEditor: true,
    editorPath: "trusted-trades",
    includedWithPaid: true,
    benefits: [
      "Up to 12 recommendations on your profile",
      "Dedicated /trusted-trades shareable page",
      "Yellow trade pills so customers spot the right trade fast"
    ]
  },
  {
    slug: "shop_mode",
    name: "Shop Mode",
    tagline: "Sell products alongside your services",
    summary:
      "Turn your services carousel into a full product catalog. Add up to four photos per product, set a price, track stock, configure per-country shipping, and let customers send a structured WhatsApp enquiry with everything in their cart. You confirm the final price — no card payments in the app.",
    glyph: "🛒",
    image_url: null,
    personas: ["Drywallers", "Plumbers", "Locksmiths", "Plasterers"],
    editorial_badge: "best_for_solos",
    pricing: { kind: "paid", monthly_pence: 500 },
    availability: "ready",
    hasEditor: true,
    editorPath: "shop-mode",
    includedWithPaid: false,
    benefits: [
      "Product cards replace services — same trust, new revenue line",
      "Per-country air / sea shipping you control",
      "Customer cart → structured WhatsApp enquiry to you"
    ]
  },
  {
    slug: "services_grid",
    name: "Services Prices",
    tagline: "Grid pricing for jobs you sell by the hour, sqm, tree or day",
    summary:
      "Built for trades that price by something other than 'a job' — landscapers, machinery hire, tool rental, mobile car valets. Add each service with an image, a price, and a unit (per hour / per sqm / per tree / per day). Customers tap a tile, see the detail, and either send a quick WhatsApp enquiry or batch several services into one structured message.",
    glyph: "£",
    image_url: null,
    personas: ["Landscapers", "Tool hire", "Machinery hire"],
    editorial_badge: "most_flexible",
    pricing: { kind: "paid", monthly_pence: 400 },
    availability: "ready",
    hasEditor: true,
    editorPath: "services-prices",
    includedWithPaid: false,
    benefits: [
      "Tile grid + dedicated /services-prices page customers can share",
      "Per-service unit picker — hour / sqm / tree / day / kg / item",
      "Cart bundles services + products in one WhatsApp enquiry"
    ]
  },
  {
    slug: "downloads",
    name: "Downloads",
    tagline: "Brochures, catalogues, forms and compliance docs — one tap to download",
    summary:
      "Upload PDF brochures, full product catalogues, trade-account applications, RAMS, method statements, insurance certs and qualifications. Customers tap to download. Per-file email-gate option turns marketing brochures into lead-capture forms. Auto-grouped by category.",
    glyph: "↓",
    image_url: null,
    personas: ["Architects", "Project managers", "Merchants"],
    editorial_badge: "any_trade",
    pricing: { kind: "paid", monthly_pence: 200 },
    availability: "ready",
    hasEditor: true,
    editorPath: "downloads",
    includedWithPaid: false,
    benefits: [
      "PDF / Word / Excel / images — 10 MB cap, up to 20 files",
      "Per-file email-gate — turn brochures into lead capture",
      "Auto-grouped by category — Brochures / Forms / Compliance / Catalogue"
    ]
  },
  {
    slug: "job_diary",
    name: "Job Diary",
    tagline: "Live updates from every job — built-in social proof",
    summary:
      "Turn every project you run into a public update stream. Post photos and a quick status (running to plan / weather delay / scope changed), share each post to your socials with a tap, and let new customers see you're genuinely busy. Completed projects scroll into a swipeable strip under your profile hero.",
    glyph: "📔",
    image_url: null,
    personas: ["Builders", "Roofers", "Plasterers", "Carpenters"],
    editorial_badge: "viral_growth",
    pricing: { kind: "paid", monthly_pence: 400 },
    availability: "coming_soon",
    hasEditor: false,
    includedWithPaid: false,
    benefits: [
      "Post-by-post job updates with status chips and photos",
      "One-tap share to Instagram / Facebook / TikTok / X",
      "Completed projects auto-archive into a swipeable hero strip"
    ]
  },
  {
    slug: "wholesale_mode",
    name: "Wholesale Mode",
    tagline: "Tiered pricing + distance-based delivery for merchants",
    summary:
      "Built for builder's merchants, materials yards, and tool suppliers. Set bulk pricing tiers per product, define a free-delivery radius from your yard, and charge a per-km or banded rate beyond it. Customers tap 'Set my location' to see real delivery costs added straight into their cart — no more 'phone for quote' friction.",
    glyph: "🚚",
    image_url: null,
    personas: ["Merchants", "Tool suppliers", "Materials yards"],
    editorial_badge: "built_for_merchants",
    pricing: { kind: "paid", monthly_pence: 700 },
    availability: "coming_soon",
    hasEditor: false,
    includedWithPaid: false,
    benefits: [
      "Bulk tiers — e.g. 10 sheets £8 each, 50 sheets £6 each",
      "Free-delivery radius from your address — postcode whitelist optional",
      "Customer 'Set my location' → live delivery quote into cart"
    ]
  },
  {
    slug: "custom_domain",
    name: "Custom domain",
    tagline: "Use your own domain — yourtrade.co.uk",
    summary:
      "Point your own domain at your Xrated profile so the URL on your van and business cards reads yourtrade.co.uk — no path, no platform name. We handle SSL.",
    glyph: "🌐",
    image_url: null,
    personas: ["Any trade"],
    editorial_badge: "premium_credibility",
    pricing: { kind: "paid", monthly_pence: 500 },
    availability: "coming_soon",
    hasEditor: false,
    includedWithPaid: false,
    benefits: [
      "Pro-grade URL on every quote and van vinyl",
      "Free SSL — we handle the certificate",
      "Keep your Xrated profile, change the address only"
    ]
  },
  {
    slug: "lead_sms",
    name: "Lead-alert SMS",
    tagline: "Text you the moment a customer taps WhatsApp",
    summary:
      "Every WhatsApp click on your profile fires an instant SMS to your phone with the customer's profile link — so you know to check WhatsApp even when you're on a ladder.",
    glyph: "📲",
    image_url: null,
    personas: ["Field trades", "Emergency callouts"],
    editorial_badge: "any_trade",
    pricing: { kind: "paid", monthly_pence: 400 },
    availability: "coming_soon",
    hasEditor: false,
    includedWithPaid: false,
    benefits: [
      "Never miss a customer who's ready to message",
      "Includes the WhatsApp tap-source so you know who's hot",
      "Cancel any month — no contract"
    ]
  }
];

export function getAddonBySlug(slug: string): XratedAddon | null {
  return XRATED_ADDONS.find((a) => a.slug === slug) ?? null;
}

/** True if the listing has switched the add-on on (or it's included
 *  with their paid tier). The component layer is still responsible for
 *  honouring the actual paid-tier gate — this just reflects the
 *  tradesperson's stated preference. */
export function isAddonEnabled(
  listing: Pick<HammerexTradeOffListing, "addons_enabled">,
  slug: string
): boolean {
  const map = listing.addons_enabled ?? {};
  if (map[slug] === true) return true;
  const addon = getAddonBySlug(slug);
  if (addon?.includedWithPaid) return true;
  return false;
}

/** Shop Mode is the canonical "swap the services carousel for products"
 *  flag. Centralised here so a future rename of the slug touches one
 *  file. */
export function isShopModeOn(
  listing: Pick<HammerexTradeOffListing, "addons_enabled">
): boolean {
  return (listing.addons_enabled ?? {}).shop_mode === true;
}

/** Services Prices add-on — when on, the public profile renders the
 *  services-priced grid section (and the dedicated /services-prices
 *  sub-page becomes reachable). Independent of Shop Mode — a trade can
 *  run both, neither, or one. */
export function isServicesGridOn(
  listing: Pick<HammerexTradeOffListing, "addons_enabled">
): boolean {
  return (listing.addons_enabled ?? {}).services_grid === true;
}

/** Downloads add-on — when on, the profile surfaces an inline downloads
 *  teaser and a dedicated /<slug>/downloads page where customers can
 *  fetch PDFs / brochures / forms. Paid-only. */
export function isDownloadsOn(
  listing: Pick<HammerexTradeOffListing, "addons_enabled">
): boolean {
  return (listing.addons_enabled ?? {}).downloads === true;
}

/** Format a paid add-on's monthly price for UI rendering. */
export function formatAddonPrice(addon: XratedAddon): string {
  if (addon.pricing.kind === "free") return "Free";
  const pounds = (addon.pricing.monthly_pence / 100).toFixed(2);
  return `£${pounds}/mo`;
}
