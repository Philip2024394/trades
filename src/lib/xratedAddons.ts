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
import { isMerchantGradeTrade } from "@/lib/tradeOff";

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
   *  to a phone-frame illustration with the glyph inside + callout
   *  pills along the bottom. User supplies real screenshots over time;
   *  null is fine for v1. */
  image_url?: string | null;
  /** Persona chips — small list of trades / business types this add-on
   *  best serves. Rendered as outline pills on the landscape card. 2-4
   *  entries reads cleanly; more starts to look like noise. */
  personas: string[];
  /** Editorial badge — honest categorisation, not a fake popularity
   *  signal. See XratedAddonBadge for the controlled vocabulary. */
  editorial_badge: XratedAddonBadge;
  /** Pointer callouts — 2-3 short labels (2-3 words each) shown as a
   *  row of white pills along the bottom of the phone-frame
   *  illustration. Each calls out one concrete UI element the
   *  customer would see if the add-on were on. Skipped on mobile to
   *  preserve the visual rhythm. */
  callouts: string[];
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
    callouts: ["Yellow trade pill", "12 entries", "Tap to view"],
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
    callouts: ["4 photos", "Stock badge", "Cart enquiry"],
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
    callouts: ["Per-tree price", "Yellow unit", "Service cart"],
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
    callouts: ["PDF / DOC", "Email gate", "One tap"],
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
    callouts: ["Status chip", "Photo grid", "Social share"],
    pricing: { kind: "paid", monthly_pence: 400 },
    availability: "ready",
    hasEditor: true,
    editorPath: "job-diary",
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
    callouts: ["Bulk tiers", "Set location", "Live quote"],
    pricing: { kind: "paid", monthly_pence: 700 },
    availability: "ready",
    hasEditor: true,
    editorPath: "wholesale-mode",
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
    callouts: ["Your URL", "Free SSL", "Same profile"],
    pricing: { kind: "paid", monthly_pence: 500 },
    availability: "ready",
    hasEditor: true,
    editorPath: "custom-domain",
    includedWithPaid: false,
    benefits: [
      "Pro-grade URL on every quote and van vinyl",
      "Free SSL — we handle the certificate",
      "Keep your Xrated profile, change the address only"
    ]
  },
  {
    slug: "lead_alerts",
    name: "Lead Alerts",
    tagline: "Phone notification + sound the second a customer taps WhatsApp",
    summary:
      "Real-time push notification with custom sound the moment a customer taps WhatsApp on your profile. Runs through the Xrated app installed on your home screen — no SMS, no Twilio costs eating your margin. Install Xrated to your phone, allow notifications, and your phone wakes up the second a lead lands. Works on iPhone (iOS 16.4+) and Android.",
    glyph: "🔔",
    image_url: null,
    personas: ["Field trades", "Emergency callouts", "Always-on-job"],
    editorial_badge: "any_trade",
    callouts: ["Instant push", "Custom sound", "PWA install"],
    pricing: { kind: "paid", monthly_pence: 400 },
    availability: "ready",
    hasEditor: true,
    editorPath: "lead-alerts",
    includedWithPaid: false,
    benefits: [
      "Instant push the moment WhatsApp is tapped — no SMS delay",
      "Custom sound + vibration so you hear it on the ladder",
      "Requires installing Xrated to your home screen — guided setup in-app"
    ]
  },
  {
    slug: "materials_network",
    name: "Materials Network",
    tagline: "Earn from the merchants you buy from every day",
    summary:
      "Pick up to 12 builder's merchants you trust — plasterboard yard, adhesive supplier, tool shop. Customers tap straight through to send a WhatsApp quote, and you earn a referral fee when the merchant fulfils it. Trust-based commission — the merchant marks each lead 'fulfilled' from their dashboard, no payment plumbing in the app. Soft disclosure to the customer keeps it honest: 'this tradesperson may earn a referral fee from these merchants — it costs you nothing extra'.",
    glyph: "🔗",
    image_url: null,
    personas: ["Builders", "Plasterers", "Carpenters", "Roofers"],
    editorial_badge: "viral_growth",
    callouts: ["Up to 12 picks", "Earnings ledger", "Soft disclosure"],
    pricing: { kind: "paid", monthly_pence: 300 },
    availability: "ready",
    hasEditor: true,
    editorPath: "materials-network",
    includedWithPaid: false,
    benefits: [
      "Pick up to 12 builder's merchants you actually buy from",
      "Trust-based commission — merchant marks fulfilled, you see the ledger",
      "Soft disclosure to the customer — honest by design, no hidden fees"
    ]
  },
  {
    slug: "quote_pipeline",
    name: "Quote Pipeline",
    tagline: "Track every quote — sent / chasing / accepted / lost — in one kanban board",
    summary:
      "A minimal CRM built for tradespeople running crews. Drop in each quote, watch it move through Sent → Chasing → Accepted, and never lose track of a job again. Each quote ties to the customer's name + phone with a one-tap WhatsApp follow-up button. Set a follow-up date and the dashboard nudges you when it's time to chase. Pure pipeline view — no email blasts, no automation, no clutter. The opposite of a full CRM: just the four columns that matter on a Monday morning.",
    glyph: "📋",
    image_url: null,
    personas: ["Builders", "Multi-truck operators", "Crew leads"],
    editorial_badge: "any_trade",
    callouts: ["4-column kanban", "Follow-up reminders", "WhatsApp handoffs"],
    pricing: { kind: "paid", monthly_pence: 500 },
    availability: "ready",
    hasEditor: true,
    editorPath: "quote-pipeline",
    includedWithPaid: false,
    benefits: [
      "4-column board: Sent · Chasing · Accepted · Lost — drag to move",
      "One-tap WhatsApp follow-up using the customer's number you saved",
      "Follow-up dates with dashboard nudges so jobs never go cold"
    ]
  },
  {
    slug: "faq_page",
    name: "FAQ Page",
    tagline: "Visual knowledge base — questions, answers and ref-numbered images",
    summary:
      "Upgrade your inline FAQ accordion into a full visual knowledge base. Each question carries an answer plus uploaded reference images, each with its own ref number and title (FAQ-001 'Level 5 skim finish', FAQ-002 'Damp proof course detail'). Customers tap through to a dedicated /<slug>/faq page they can bookmark and share back. Perfect for trades where the customer's question is best answered with a photo.",
    glyph: "?",
    image_url: null,
    personas: ["Plasterers", "Builders", "Tile suppliers", "Landscapers"],
    editorial_badge: "premium_credibility",
    callouts: ["Ref-numbered images", "Dedicated page", "Visual proof"],
    pricing: { kind: "paid", monthly_pence: 200 },
    availability: "ready",
    hasEditor: true,
    editorPath: "faq-page",
    includedWithPaid: false,
    benefits: [
      "Each Q&A carries reference images with ref numbers + titles",
      "Dedicated /<slug>/faq page customers can bookmark and share",
      "Adds a Frequently Asked Questions container alongside Trusted Trades"
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
 *  file.
 *
 *  Auto-on for merchant-grade trades (kitchen-fitter, stair-fitter,
 *  building-merchant, builders-supplies, tool-hire, heavy-machinery,
 *  window-fitter, security-installer) on the paid tier — their whole
 *  business is a catalogue, so the profile is "complete" rather than
 *  nickel-and-diming a category whose whole job is selling tangible
 *  items. See `isMerchantGradeTrade` in src/lib/tradeOff.ts. */
export function isShopModeOn(
  listing: Pick<HammerexTradeOffListing, "addons_enabled"> &
    Partial<Pick<HammerexTradeOffListing, "primary_trade" | "tier">>
): boolean {
  if ((listing.addons_enabled ?? {}).shop_mode === true) return true;
  if (
    listing.primary_trade &&
    isMerchantGradeTrade(listing.primary_trade) &&
    (listing.tier === "app_paid" || listing.tier === "app_trial")
  ) {
    return true;
  }
  return false;
}

/** Storefront gate — true when the dedicated /<slug>/shop page and the
 *  ShopTeaser block on the profile should render. The Phase 3 storefront
 *  is a FREE upgrade for existing Shop Mode users AND is auto-included
 *  with Wholesale Mode (£7/mo) so merchants get the full experience
 *  inside that tier without a second toggle. Centralised so the page,
 *  teaser, editor and API agree on the same predicate. */
export function isStorefrontOn(
  listing: Pick<HammerexTradeOffListing, "addons_enabled"> &
    Partial<Pick<HammerexTradeOffListing, "primary_trade" | "tier">>
): boolean {
  const map = listing.addons_enabled ?? {};
  if (map.shop_mode === true || map.wholesale_mode === true) return true;
  return isShopModeOn(listing);
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

/** Job Diary add-on — when on, the profile surfaces an inline
 *  "currently working on…" teaser plus the swipeable past-projects
 *  strip under the hero, and the dedicated /<slug>/job-diary page
 *  becomes reachable. Paid-only. */
export function isJobDiaryOn(
  listing: Pick<HammerexTradeOffListing, "addons_enabled">
): boolean {
  return (listing.addons_enabled ?? {}).job_diary === true;
}

/** Wholesale Mode add-on — when on, the public cart renders the
 *  WholesaleDeliveryWidget (yard pin + customer-location picker +
 *  banded distance quote) and products surface bulk-tier pricing.
 *  Paid-only. Coexists with Shop Mode — UI gates the shipping config
 *  surface via a "local vans vs national shipping" radio on the
 *  product editor. */
export function isWholesaleModeOn(
  listing: Pick<HammerexTradeOffListing, "addons_enabled">
): boolean {
  return (listing.addons_enabled ?? {}).wholesale_mode === true;
}

/** Lead Alerts add-on — when on, the tradesperson gets real-time PWA
 *  web-push notifications the second a customer taps WhatsApp on their
 *  profile. Per-device subscriptions live in
 *  hammerex_xrated_push_subscriptions; the add-on toggle only governs
 *  whether the subscribe UI is unlocked. Paid-only (£4/mo). */
export function isLeadAlertsOn(
  listing: Pick<HammerexTradeOffListing, "addons_enabled">
): boolean {
  return (listing.addons_enabled ?? {}).lead_alerts === true;
}

/** Materials Network add-on — when on, the public profile surfaces an
 *  inline merchant teaser and a dedicated /<slug>/materials page where
 *  customers can browse the tradesperson's curated merchants. The cart
 *  attribution layer + merchant fulfilment ledger live behind this flag.
 *  Paid-only (£3/mo). */
export function isMaterialsNetworkOn(
  listing: Pick<HammerexTradeOffListing, "addons_enabled">
): boolean {
  return (listing.addons_enabled ?? {}).materials_network === true;
}

/** Custom Domain add-on — true when the tradesperson has switched the
 *  add-on on AND the domain is currently routing traffic (`status='live'`).
 *  The middleware host-router cares about the status field, not this
 *  flag; this helper is for dashboard UI (show the "your domain is live"
 *  green badge) and any future profile-level chrome (e.g. "Powered by
 *  Xrated" footer). Paid-only (£5/mo, first 30 days free). */
export function isCustomDomainOn(
  listing: Pick<
    HammerexTradeOffListing,
    "addons_enabled" | "custom_domain" | "custom_domain_status"
  >
): boolean {
  const enabled = (listing.addons_enabled ?? {}).custom_domain === true;
  if (!enabled) return false;
  return (
    !!listing.custom_domain && listing.custom_domain_status === "live"
  );
}

/** FAQ Page add-on — when on, the public profile renders a yellow CTA
 *  card linking to the dedicated /<slug>/faq sub-page where customers
 *  read ref-numbered Q&As with reference images. Sits ALONGSIDE Trusted
 *  Trades (does not replace it). Paid-only (£2/mo). The free-tier
 *  faq_items JSONB column + FaqAccordion on the contact page remain
 *  untouched so a profile that toggles the add-on off falls back to the
 *  inline accordion without losing data. */
export function isFaqPageOn(
  listing: Pick<HammerexTradeOffListing, "addons_enabled">
): boolean {
  return (listing.addons_enabled ?? {}).faq_page === true;
}

/** Format a paid add-on's monthly price for UI rendering. */
export function formatAddonPrice(addon: XratedAddon): string {
  if (addon.pricing.kind === "free") return "Free";
  const pounds = (addon.pricing.monthly_pence / 100).toFixed(2);
  return `£${pounds}/mo`;
}
