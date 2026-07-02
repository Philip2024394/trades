// Xrated Trades — App Store registry (legacy filename kept for
// backward compatibility of imports; content is "Apps" catalogue).
//
// Single source of truth for every App a merchant can install from
// the App Store. The dashboard hub, the public App Store page, and
// the public profile renderer all import from this file so a new App
// appears in three places at once.
//
// To add a new App: append an entry to XRATED_ADDONS and (if it
// changes the rendered profile) wire its `slug` into the relevant
// component swap.
//
// Terminology note: internal type + variable names retain the
// `Addon` prefix (XratedAddon, XRATED_ADDONS, isAddonEnabled) because
// the DB column `addons_enabled` and every helper consumer already
// binds to those names. User-facing copy across the platform uses
// "App" / "Apps" / "App Store".

import type { HammerexTradeOffListing } from "@/lib/supabase";
import {
  isMerchantGradeTrade,
  isMerchantProTrade,
  MERCHANT_PRO_PRODUCT_CAP
} from "@/lib/tradeOff";

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
  /** Audience targeting for the dashboard add-ons hub. When set,
   *  AddOnsHub filters the registry against the listing's
   *  primary_trade so an add-on whose mental model doesn't match the
   *  trade never appears. Undefined ⇒ shown to every trade. */
  audience?: "all" | "merchant" | "service";
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
    name: "Trade Center",
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
    ],
    audience: "service"
  },
  {
    slug: "trade_center_picks",
    name: "Trade Center Picks",
    tagline: "Promo, arrival and stock-status banners on your products",
    summary:
      "Built for merchants. Pin up to 24 products with banners customers spot in a glance — On promo / New arrival / Just arrived / In stock / Pre-order. Optional arrival date lets customers reserve ahead. When a promo expires the banner falls off the profile automatically, so the page never reads stale.",
    glyph: "🏷️",
    image_url: null,
    personas: ["Merchants", "Tool suppliers", "Materials yards"],
    editorial_badge: "built_for_merchants",
    callouts: ["Status chip", "Arrival date", "Product link"],
    pricing: { kind: "paid", monthly_pence: 400 },
    availability: "ready",
    hasEditor: true,
    editorPath: "trade-center-picks",
    includedWithPaid: false,
    benefits: [
      "Pin up to 24 products with promo / new-arrival / pre-order banners",
      "Arrival dates so customers reserve ahead of the pallet landing",
      "Falls off the profile when promo expires — no stale banners"
    ],
    audience: "merchant"
  },
  {
    slug: "newsletter",
    name: "Newsletter",
    tagline: "Capture customer emails — straight into your own list",
    summary:
      "Built for merchants. A footer signup form on your profile lets customers opt in to your stock, promo and arrival updates. Xrated stores the list with full UK GDPR + PECR consent records — you export the CSV and send through your own tool (Mailchimp, Brevo, anything). Every subscriber gets a one-click unsubscribe link you include in your emails.",
    glyph: "✉",
    image_url: null,
    personas: ["Merchants", "Tool suppliers", "Materials yards"],
    editorial_badge: "built_for_merchants",
    callouts: ["Consent box", "CSV export", "Unsubscribe link"],
    pricing: { kind: "free" },
    availability: "ready",
    hasEditor: true,
    editorPath: "newsletter",
    includedWithPaid: true,
    benefits: [
      "Footer signup form on your public profile — GDPR-compliant by default",
      "Dashboard table of subscribers + one-click CSV export",
      "Per-subscriber unsubscribe link you paste into every email"
    ],
    audience: "merchant"
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
    slug: "key_cutting",
    name: "Key Cutting",
    tagline: "Walk-in cutting, photo-scan submission, or postal — 8 key categories, merchant-priced",
    summary:
      "The full in-store key-cutting proposition. Merchant enables the eight service categories they can actually cut — standard cylinder, mortice, padlock, dimple/laser, restricted high-security, mechanical car keys, transponder car keys, remote/laser car keys — and sets a 'from £X' price on each. Merchant picks the fulfilment modes they offer: walk-in, photo-scan via WhatsApp, and full postal service (customer sends the key, they cut and return). A hero-adjacent card on the profile links into a dedicated /<slug>/key-cutting sub-page with the merchant's banner, service grid, prices, three fulfilment tiles and sticky WhatsApp enquiry CTA.",
    glyph: "🔑",
    image_url: null,
    personas: ["Merchants", "Locksmiths"],
    editorial_badge: "built_for_merchants",
    callouts: ["8 key categories", "3 fulfilment modes", "Photo-scan via WhatsApp"],
    pricing: { kind: "free" },
    availability: "ready",
    hasEditor: true,
    editorPath: "key-cutting",
    includedWithPaid: true,
    benefits: [
      "8 key categories the merchant can enable individually with per-category 'from £X' pricing",
      "Walk-in / photo-scan / postal service tiles — customer picks their preferred flow",
      "Dedicated /<slug>/key-cutting sub-page with hero banner, service grid, prices and WhatsApp CTA"
    ]
  },
  {
    slug: "plant_hire",
    name: "Plant Hire",
    tagline: "12 plant categories, self-drive or with operator, day/week/month rates and damage waivers",
    summary:
      "The full plant-hire proposition for builders' merchants and yards competing with TP Hire, HSS and Speedy. Merchant enables the categories they hire — mini/midi excavators, dumpers, telehandlers, rollers, scissor lifts, cherry pickers, skid steers, breakers, generators, welfare units, attachments — and sets day / week / month 'from £X' pricing per machine plus an operator day-rate premium. Four fulfilment modes: collect from yard (self-drive), local delivery with per-mile pricing zones, with a CPCS operator, and long-term contract discount tiers. Configurable damage-waiver options (theft-only / full waiver / bring-your-own-cert), fuel policy, weekend and bank-holiday surcharges, deposit, CPCS-card requirement, and delivery zones with free-radius + per-mile pricing. Hero-adjacent card on the profile links into a dedicated /<slug>/plant-hire sub-page.",
    glyph: "🚜",
    image_url: null,
    personas: ["Merchants", "Plant hirers", "Builders' merchants"],
    editorial_badge: "built_for_merchants",
    callouts: ["12 plant categories", "Self-drive or operator", "Damage waivers + delivery zones"],
    pricing: { kind: "free" },
    availability: "ready",
    hasEditor: true,
    editorPath: "plant-hire",
    includedWithPaid: true,
    benefits: [
      "12 plant categories the merchant enables individually with day / week / month 'from £X' pricing per machine",
      "Self-drive + delivery + operator + long-term contract fulfilment modes — customer picks their preferred flow",
      "Damage waiver, fuel policy, delivery zones and CPCS-card gating fully configurable per merchant"
    ]
  },
  {
    slug: "meet_the_team",
    name: "Meet the Team",
    tagline: "Show your yard staff — profile cards under the hero, boss pinned, others auto-rotate",
    summary:
      "The 4-card team grid that sits directly below your hero. Boss (or owner) is pinned in slot 1 with the yellow Boss tag and never rotates. Slots 2-4 auto-shuffle every 1.7s through the rest of the roster so every team member gets airtime. Each card shows profile photo, name, position, skills, years of experience, and — optionally — the team member's direct dial line as a click-to-call tel: link. Great for building merchants and yards with real customer-facing counter staff.",
    glyph: "👥",
    image_url: null,
    personas: ["Merchants", "Builders", "Carpenters", "Plasterers", "Landscapers", "Roofers"],
    editorial_badge: "premium_credibility",
    callouts: ["4-card auto-rotate", "Boss pinned", "Direct-dial lines"],
    pricing: { kind: "free" },
    availability: "ready",
    hasEditor: true,
    editorPath: "team",
    includedWithPaid: true,
    benefits: [
      "4 team members on-screen at once with seamless rotation across the full roster",
      "Each card shows photo + name + role + skills + years + optional direct dial",
      "Boss card is pinned so the face of the business is always visible"
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
  },
  {
    slug: "trade_connections",
    name: "Trade Connections",
    tagline: "Local trades who install this — auto-carousel on every product page",
    summary:
      "Turns every product page into a two-way local marketplace. Customers see a horizontal auto-scrolling carousel of independent local trades who install that type of product — bricklayers under bricks, tilers under tiles, painters under paint. A clear non-verification disclaimer protects the merchant; a floating 'Back to [Merchant]' button follows the customer onto the trade's app so they always return. Default 25 km radius (configurable). Live on every Merchant Pro app by default — toggle off if you don't want it.",
    glyph: "🤝",
    image_url: null,
    personas: ["Merchants", "Carpenters", "Tilers", "Bricklayers", "Plasterers", "Painters", "Roofers"],
    editorial_badge: "viral_growth",
    callouts: ["Auto-scroll carousel", "25 km radius", "Back-to-merchant button"],
    pricing: { kind: "free" },
    availability: "ready",
    hasEditor: true,
    editorPath: "trade-connections",
    includedWithPaid: true,
    benefits: [
      "Every product page becomes a local marketplace — trades + materials in one place",
      "Floating 'Back to [Merchant]' button keeps customers returning to your store",
      "Open to every trade on the platform — no pay-to-play gating"
    ]
  },
  {
    slug: "online_payments",
    name: "Online Payments",
    tagline: "Cards, Apple Pay, PayPal — funds go direct to your account, we never touch them",
    summary:
      "Connect any UK payment provider in 60 seconds. Stripe, PayPal and Square get one-click OAuth onboarding — Worldpay, SumUp, Klarna, Mollie, Revolut, Tide and every other provider work via Payment Link mode (paste a hosted-pay URL from your existing dashboard). Customers tap Pay Now in the cart, get sent to the provider's hosted checkout (Apple Pay / Google Pay auto-shown), pay direct to your bank, then return to your app's order-success page. xratedtrade is a connector — funds never enter our accounts, we hold no card data, we are not a payment institution. Your provider, your money, your terms.",
    glyph: "💳",
    image_url: null,
    personas: ["Merchants", "Carpenters", "Painters", "Tilers", "Roofers", "Bricklayers", "Plasterers", "Joiners", "Electricians", "Plumbers"],
    editorial_badge: "built_for_merchants",
    callouts: ["100% UK provider coverage", "Direct-to-merchant funds", "Apple Pay + Google Pay built in"],
    pricing: { kind: "free" },
    availability: "ready",
    hasEditor: true,
    editorPath: "payments",
    includedWithPaid: true,
    benefits: [
      "Connect Stripe / PayPal / Square in one click — Worldpay & every other UK provider via paste-a-link",
      "Money settles direct to your bank — xratedtrade never holds funds, never sees card data",
      "Cart 'Pay Now' button works alongside WhatsApp Enquire — buyer picks the lane"
    ]
  },
  {
    slug: "material_calculators",
    name: "Material Calculator Suite",
    tagline: "Paint, flooring, tiles, gravel, concrete — customers buy exactly what they need",
    summary:
      "17 UK-specific calculators that turn 'how much do I need?' into one tap. Customer enters room dimensions, picks options, gets the exact quantity with 10% waste built in — then taps 'Add all to cart'. Paint uses real-world 12 m²/L coverage (not the optimistic tin label). Tile calc accounts for diagonal cuts. Concrete picks the right mix. Trades can attach their installation rate so the calculator quotes materials + labour in one estimate. Every estimate shares as a link the customer can text their contractor.",
    glyph: "🧮",
    image_url: null,
    personas: ["Merchants", "Carpenters", "Tilers", "Plasterers", "Concrete finishers", "Landscapers"],
    editorial_badge: "built_for_merchants",
    callouts: ["Auto by category", "Add all to cart", "Share estimate link"],
    pricing: { kind: "paid", monthly_pence: 600 },
    availability: "ready",
    hasEditor: true,
    editorPath: "calculators",
    includedWithPaid: false,
    benefits: [
      "17 UK calculators — paint, flooring, tiles, gravel, concrete, mortar, bricks, plasterboard, insulation, decking, fencing, paving, skirting, roof tiles, wallpaper, render, turf",
      "Auto-attaches to products by category — no per-product tickboxes",
      "Trades attach a £/m² rate to quote installation labour alongside materials"
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
  listing: Pick<HammerexTradeOffListing, "addons_enabled"> &
    Partial<Pick<HammerexTradeOffListing, "primary_trade">>,
  slug: string
): boolean {
  const map = listing.addons_enabled ?? {};
  if (map[slug] === true) return true;
  const addon = getAddonBySlug(slug);
  if (!addon) return false;
  if (addon.includedWithPaid) return true;
  // Merchant Pro trades (building-merchant + builders-supplies) get every
  // paid add-on bundled with their £14.99/mo tier — the per-add-on toggle
  // is bypassed. See isAddonIncludedForListing.
  if (isAddonIncludedForListing(addon, listing)) return true;
  return false;
}

/** True when the listing's trade qualifies for the add-on as a bundled
 *  inclusion — i.e. the customer doesn't have to pay extra to switch it
 *  on. Two paths:
 *
 *  1. The add-on is marked `includedWithPaid` in the registry (free or
 *     "free with any paid tier" — e.g. trusted_trades, newsletter).
 *  2. The listing's primary trade is a Merchant Pro trade
 *     (building-merchant or builders-supplies) AND the add-on is paid —
 *     the £14.99/mo Merchant Pro tier bundles every paid add-on.
 *
 *  This does NOT check the listing's tier (paid vs free) — the AddOnsHub
 *  layer is still responsible for showing a "subscribe first" gate to
 *  users who haven't paid. This helper only answers "if this user paid,
 *  would this add-on be included for free?". */
export function isAddonIncludedForListing(
  addon: XratedAddon,
  listing: Partial<Pick<HammerexTradeOffListing, "primary_trade">>
): boolean {
  if (addon.includedWithPaid) return true;
  if (
    addon.pricing.kind === "paid" &&
    isMerchantProTrade(listing.primary_trade ?? null)
  ) {
    return true;
  }
  return false;
}

/** Active-product cap for a listing. Returns null = unlimited (Verified
 *  tier, non-Merchant-Pro trades, or free tier where the cap is enforced
 *  elsewhere). Returns a positive integer for hard cap.
 *
 *  Current rule: Merchant Pro trades on paid tier are capped at 200
 *  active products. Verified bypasses (returns null). Non-Merchant-Pro
 *  trades are unlimited by product count — they're metered by add-on
 *  pricing instead. */
export function productCapForListing(
  listing: Partial<Pick<HammerexTradeOffListing, "primary_trade" | "tier">>
): number | null {
  if (listing.tier === "app_verified") return null;
  if (isMerchantProTrade(listing.primary_trade ?? null)) {
    return MERCHANT_PRO_PRODUCT_CAP;
  }
  return null;
}

/** Shop Mode is the canonical "swap the services carousel for products"
 *  flag. Centralised here so a future rename of the slug touches one
 *  file.
 *
 *  Auto-on for merchant-grade trades (kitchen-fitter, stair-fitter,
 *  building-merchant, builders-supplies, tool-hire, heavy-machinery,
 *  window-fitter, security-installer) on EVERY tier — their whole
 *  business is a catalogue, so the profile is "complete" rather than
 *  nickel-and-diming a category whose whole job is selling tangible
 *  items. Gating these merchants behind a paid tier broke the inline
 *  starter-product editor (the form saved into a column whose
 *  front-end gating was OFF). See `isMerchantGradeTrade` in
 *  src/lib/tradeOff.ts. */
export function isShopModeOn(
  listing: Pick<HammerexTradeOffListing, "addons_enabled"> &
    Partial<Pick<HammerexTradeOffListing, "primary_trade" | "tier">>
): boolean {
  if ((listing.addons_enabled ?? {}).shop_mode === true) return true;
  if (
    listing.primary_trade &&
    isMerchantGradeTrade(listing.primary_trade)
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

/** Trade Center Picks add-on — when on, merchant-grade trades can pin
 *  promo / arrival / stock-status banners onto products on their
 *  profile, and the dedicated /<slug>/trade-center-picks page becomes
 *  reachable. Paid-only (£4/mo). The component layer is responsible
 *  for the additional `isMerchantGradeTrade(listing.primary_trade)`
 *  visibility gate — this helper only reflects the tradesperson's
 *  stated preference. */
export function isTradeCenterPicksOn(
  listing: Pick<HammerexTradeOffListing, "addons_enabled">
): boolean {
  return (listing.addons_enabled ?? {}).trade_center_picks === true;
}

/** Newsletter add-on — when on, the public profile footer renders the
 *  NewsletterSignup form (email capture only, Model A — Xrated never
 *  sends emails). Free add-on, auto-included on every paid tier; gated
 *  to merchant-grade trades via the `audience: "merchant"` filter in
 *  XRATED_ADDONS so service trades never see it in AddOnsHub.
 *
 *  The component layer is still responsible for the additional
 *  `isMerchantGradeTrade(listing.primary_trade)` visibility gate on the
 *  footer + editor — this helper only reflects the tradesperson's
 *  stated preference (defaulting to on for paid tiers via
 *  isAddonEnabled). */
export function isNewsletterOn(
  listing: Pick<HammerexTradeOffListing, "addons_enabled">
): boolean {
  return isAddonEnabled(listing, "newsletter");
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

/** Compare-section toggle for the PDP. Lives in `addons_enabled` as
 *  the `compare_section` key. Default is ON — only an explicit `false`
 *  hides the compare-3 strip. This is a per-listing preference, not a
 *  paid add-on (no marketing surface), so it doesn't appear in
 *  XRATED_ADDONS — just the helper + the dashboard toggle. */
export function isCompareSectionOn(
  listing: Pick<HammerexTradeOffListing, "addons_enabled">
): boolean {
  const map = listing.addons_enabled ?? {};
  return map.compare_section !== false;
}

/** Q&A block on the PDP. OFF by default — the PDP gets cluttered fast,
 *  and the value is only there when the tradesperson answers WhatsApp
 *  questions quickly. Switching on surfaces the ProductQABlock CTA. */
export function isQAOn(
  listing: Pick<HammerexTradeOffListing, "addons_enabled">
): boolean {
  return (listing.addons_enabled ?? {}).qa === true;
}

/** Warranty & Returns block on the PDP. Lives in `addons_enabled` as
 *  the `warranty_returns` key. Default is ON — only an explicit `false`
 *  hides the standalone WarrantyReturnsBlock. Per-listing preference,
 *  not a paid add-on (no marketing surface), so it doesn't appear in
 *  XRATED_ADDONS — just the helper + the dashboard toggle. */
export function isWarrantyReturnsOn(
  listing: Pick<HammerexTradeOffListing, "addons_enabled">
): boolean {
  const map = listing.addons_enabled ?? {};
  return map.warranty_returns !== false;
}

/** Spec tab on the PDP details panel. Lives in `addons_enabled` as
 *  the `spec_tab` key. Default is ON — only an explicit `false` hides
 *  the Specifications tab pill (the body still has data, but the pill
 *  + body disappear). Per-listing preference, not a paid add-on, so it
 *  doesn't appear in XRATED_ADDONS — just the helper + the dashboard
 *  toggle. */
export function isSpecTabOn(
  listing: Pick<HammerexTradeOffListing, "addons_enabled">
): boolean {
  const map = listing.addons_enabled ?? {};
  return map.spec_tab !== false;
}

/** Delivery Details tab on the PDP details panel. Lives in
 *  `addons_enabled` as the `delivery_tab` key. Default is ON — only an
 *  explicit `false` hides the tab. Body is a small grid of dispatch +
 *  origin + returns + delivery-cost + tracking facts pulled from the
 *  product and listing. Per-listing preference. */
export function isDeliveryTabOn(
  listing: Pick<HammerexTradeOffListing, "addons_enabled">
): boolean {
  const map = listing.addons_enabled ?? {};
  return map.delivery_tab !== false;
}

/** Trade Connections add-on — when on, every product PDP renders the
 *  auto-scrolling carousel of local trades who install that category
 *  of product. Live by default on every Merchant Pro app (includedWithPaid)
 *  — the toggle is only meaningful for a merchant who explicitly opts out. */
export function isTradeConnectionsOn(
  listing: Pick<HammerexTradeOffListing, "addons_enabled">
): boolean {
  const map = listing.addons_enabled ?? {};
  if (map.trade_connections === false) return false; // explicit opt-out
  return true; // default-on for every listing
}

/** Online Payments add-on — when on, the merchant has connected at
 *  least one payment provider (Stripe Connect, PayPal Commerce, Square
 *  OAuth, or a hosted Payment Link). The cart shows a green "Pay Now"
 *  button alongside the existing yellow WhatsApp Enquire so customers
 *  can pay on the spot. Funds NEVER touch xratedtrade.com — they route
 *  direct to the merchant's connected account or the hosted link's
 *  underlying provider.
 *
 *  Gate logic: add-on flag must be on AND a valid provider must be
 *  configured. The dashboard tile reflects both states. */
export function isOnlinePaymentsOn(
  listing: Pick<
    HammerexTradeOffListing,
    | "addons_enabled"
    | "payment_provider"
    | "payment_provider_data"
    | "payment_link_template"
  >
): boolean {
  const map = listing.addons_enabled ?? {};
  if (map.online_payments !== true) return false;
  return hasConfiguredPaymentProvider(listing);
}

/** True when the listing has finished connecting at least one provider.
 *  Used by the dashboard to decide whether to show the green check on
 *  the Online Payments tile, and by the cart to decide whether the Pay
 *  Now button is enabled. */
export function hasConfiguredPaymentProvider(
  listing: Pick<
    HammerexTradeOffListing,
    "payment_provider" | "payment_provider_data" | "payment_link_template"
  >
): boolean {
  const p = listing.payment_provider;
  if (!p) return false;
  if (p === "payment_link") {
    return (listing.payment_link_template ?? "").trim().length > 0;
  }
  const data = (listing.payment_provider_data ?? {}) as Record<string, unknown>;
  // BYO model: presence of the encrypted key column = configured. For
  // Stripe we ALSO check charges_enabled so we don't route the cart
  // through a key whose account is restricted.
  if (p === "stripe") {
    return (
      typeof data.stripe_key_encrypted === "string" &&
      (data.stripe_key_encrypted as string).length > 0 &&
      data.stripe_charges_enabled === true
    );
  }
  if (p === "paypal") {
    return (
      typeof data.paypal_client_id === "string" &&
      (data.paypal_client_id as string).length > 0 &&
      typeof data.paypal_client_secret_encrypted === "string" &&
      (data.paypal_client_secret_encrypted as string).length > 0
    );
  }
  if (p === "square") {
    return (
      typeof data.square_access_token_encrypted === "string" &&
      (data.square_access_token_encrypted as string).length > 0 &&
      typeof data.square_location_id === "string" &&
      (data.square_location_id as string).length > 0
    );
  }
  return false;
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

/** Meet the team add-on — when on AND the merchant has 2+ configured
 *  team members, the 4-card grid renders below the hero (boss pinned
 *  in slot 0, other 3 auto-rotate through the roster). Off by default;
 *  merchant opts in from AddOns Hub. Solo tradies won't see anything
 *  even with the add-on on until they add team members. */
export function isMeetTheTeamOn(
  listing: Pick<HammerexTradeOffListing, "addons_enabled">
): boolean {
  return (listing.addons_enabled ?? {}).meet_the_team === true;
}

/** Key Cutting service add-on — when on AND the merchant has
 *  configured at least one category + one fulfilment mode, the profile
 *  renders a hero-adjacent card + a dedicated /<slug>/key-cutting
 *  sub-page. Off by default. */
export function isKeyCuttingOn(
  listing: Pick<HammerexTradeOffListing, "addons_enabled">
): boolean {
  return (listing.addons_enabled ?? {}).key_cutting === true;
}

/** Plant Hire service add-on — when on AND the merchant has configured
 *  at least one category + one fulfilment mode, the profile renders a
 *  hero-adjacent card + a dedicated /<slug>/plant-hire sub-page. Off by
 *  default. */
export function isPlantHireOn(
  listing: Pick<HammerexTradeOffListing, "addons_enabled">
): boolean {
  return (listing.addons_enabled ?? {}).plant_hire === true;
}

/** Format a paid add-on's monthly price for UI rendering. */
export function formatAddonPrice(addon: XratedAddon): string {
  if (addon.pricing.kind === "free") return "Free";
  const pounds = (addon.pricing.monthly_pence / 100).toFixed(2);
  return `£${pounds}/mo`;
}
