// Networkers TV — The Home of Trade Knowledge
// Built by the trade, trusted by homeowners.
//
// The Networkers Video Knowledge Platform. Config for the /videos
// surface. All brand references route through PLATFORM_NAME +
// PLATFORM_TAGLINE + PLATFORM_STRAPLINE so a rename is a single-const
// change.
//
// See supabase/migrations/20260722150000_sitecast_videos.sql for the
// underlying data model. See docs/NETWORKERS_TV_BUILD_BRIEF.md (TODO)
// for the full 6-phase roadmap.

export const PLATFORM_NAME       = "Networkers TV";
export const PLATFORM_TAGLINE    = "The Home of Trade Knowledge";
export const PLATFORM_STRAPLINE  = "Built by the trade, trusted by homeowners.";

// Placeholder frame image — used inside aspect-video card slots when
// a video has no custom thumbnail_url. Auto-replaced by uploaded
// thumbnails or (Phase 2) AI-extracted poster frames.
// v2 (2026-07-20): swapped to the branded 16:9 charcoal frame with
// amber bottom rule + corner watermark. Prior version 10_21_03 kept
// in hero library as a fallback if the new one needs to be swapped.
export const PLACEHOLDER_FRAME_URL =
  "https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2020,%202026,%2010_37_53%20AM.png";

// Centered play-button icon — decorative on grid cards, interactive
// click-target on the leaf video player.
// v2 (2026-07-20): swapped to the branded amber-circle + charcoal-
// triangle version with transparent background + outer glow.
export const PLAY_BUTTON_URL =
  "https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2020,%202026,%2010_42_17%20AM.png";
export const PLATFORM_INTRO      =
  `${PLATFORM_NAME} is the video knowledge platform for UK trades — permanent portfolios uploaded by verified trades, organised around jobs not creators. Every video is a business asset connected to products, regulations, and the trade that built it. Homeowners hire with proof; trades win with their own work.`;

// ─── Video classes ────────────────────────────────────────────

// ─── Per-tier library caps + max length ───────────────────────
// Tied to the tier catalog. Extra slots buyable via washers up to
// the buyUpCeiling per tier; The Works is uncapped.

export type TierKey = "free" | "starter" | "professional" | "business" | "works";

export const WASHERS_PER_EXTRA_SLOT = 10;
export const WASHERS_PER_FEED_POST  = 0;   // v0.5: reposting to feed is free

export const TIER_VIDEO_LIMITS: Record<TierKey, {
  librarySlots:            number;   // base permanent-slot cap (portfolio + kb)
  maxVideoLengthSeconds:   number;   // longest single video allowed
  buyUpCeiling:            number;   // max additional slots buyable with washers (above base)
}> = {
  free:         { librarySlots: 3,    maxVideoLengthSeconds: 120, buyUpCeiling: 0    },
  starter:      { librarySlots: 25,   maxVideoLengthSeconds: 180, buyUpCeiling: 25   },
  professional: { librarySlots: 100,  maxVideoLengthSeconds: 300, buyUpCeiling: 100  },
  business:     { librarySlots: 500,  maxVideoLengthSeconds: 600, buyUpCeiling: 500  },
  works:        { librarySlots: 9999, maxVideoLengthSeconds: 900, buyUpCeiling: 0    }
};

/** Normalise the raw tier string from hammerex_trade_off_listings.
 *  Legacy 'app_paid' + 'app_expired' + 'os_paid' map appropriately. */
export function normaliseTier(dbTier: string | null | undefined): TierKey {
  const t = (dbTier ?? "free").toLowerCase();
  if (t === "app_paid" || t === "professional" || t === "os_pro") return "professional";
  if (t === "starter" || t === "os_starter")                       return "starter";
  if (t === "business" || t === "os_business")                     return "business";
  if (t === "works"    || t === "os_works")                        return "works";
  return "free";  // 'free', 'app_expired', 'os_free', unknown
}

export type VideoClass = "feed" | "portfolio" | "kb";

export const VIDEO_CLASS_LABEL: Record<VideoClass, string> = {
  feed:      "Feed",
  portfolio: "Portfolio",
  kb:        "Knowledge Base"
};

export const VIDEO_CLASS_DESCRIPTION: Record<VideoClass, string> = {
  feed:      "30-day lifespan. Discovery + activity. Keeps the feed fresh.",
  portfolio: "Permanent. Company showcase. Used in profiles, quotes, websites.",
  kb:        "Permanent. Admin-curated. SEO-optimised public learning library."
};

// ─── Business-metric event types ──────────────────────────────
// Never "likes" or "follows" — always business-value events.

export type VideoMetricEvent =
  | "view" | "view_complete" | "save" | "notebook_save"
  | "quote_attach" | "quote_view" | "product_click"
  | "lead_generated" | "booking" | "sale"
  | "contact_reveal" | "shared" | "ai_assistant_query";

export const METRIC_LABEL: Record<VideoMetricEvent, string> = {
  view:                "Views",
  view_complete:       "Completed views",
  save:                "Saves",
  notebook_save:       "Saved to Notebook",
  quote_attach:        "Attached to quote",
  quote_view:          "Quote views",
  product_click:       "Product clicks",
  lead_generated:      "Leads generated",
  booking:             "Bookings",
  sale:                "Sales",
  contact_reveal:      "Contact reveals",
  shared:              "Shared",
  ai_assistant_query:  "AI Assistant queries"
};

// ─── Seed taxonomy ─────────────────────────────────────────────
// Top-level categories. Full leaf taxonomy (kitchen → cabinets → hinges
// → soft-close → Blum) lands in Phase 2 once we have real videos to
// classify. Starting seed matches the 10 core trades.

export type SeedCategory = {
  slug:         string;
  displayName:  string;
  description:  string;
  tradeSlugs:   string[];
};

export const SEED_CATEGORIES: SeedCategory[] = [
  { slug: "plumbing",       displayName: "Plumbing",        description: "Bathroom refits, boiler installs, drainage, wet-room work.",             tradeSlugs: ["plumber", "gas-safe-engineer"] },
  { slug: "electrical",     displayName: "Electrical",      description: "Rewires, consumer units, EV chargers, sockets, testing.",                tradeSlugs: ["electrician"] },
  { slug: "carpentry",      displayName: "Carpentry + joinery", description: "Kitchens, staircases, doors, bespoke joinery, first + second fix.",   tradeSlugs: ["carpenter"] },
  { slug: "plastering",     displayName: "Plastering",      description: "Skim, browning, wet render, drylining, heritage lime work.",             tradeSlugs: ["plasterer"] },
  { slug: "roofing",        displayName: "Roofing",         description: "Pitched + flat roofs, slate, tile, EPDM, GRP, lead work.",              tradeSlugs: ["roofer"] },
  { slug: "brickwork",      displayName: "Brickwork + masonry", description: "Extensions, garden walls, chimney stacks, repointing, heritage.",     tradeSlugs: ["bricklayer"] },
  { slug: "tiling",         displayName: "Tiling",          description: "Bathrooms, kitchens, wet-rooms, floors, natural stone, feature work.",    tradeSlugs: ["tiler"] },
  { slug: "landscaping",    displayName: "Landscaping",     description: "Patios, decking, driveways, garden walls, planting, drainage.",           tradeSlugs: ["landscaper"] },
  { slug: "painting",       displayName: "Painting + decorating", description: "Interior + exterior, wallpaper, heritage, effect finishes.",         tradeSlugs: ["painter"] },
  { slug: "heat-pumps",     displayName: "Heat pumps + renewables", description: "Air-source, ground-source, solar PV, battery storage, retrofit.", tradeSlugs: ["gas-safe-engineer", "plumber", "electrician"] }
];

// ─── Hub FAQs ─────────────────────────────────────────────────

export const HUB_FAQS = [
  {
    q: `What is ${PLATFORM_NAME}?`,
    a: `${PLATFORM_NAME} — the Home of Trade Knowledge — is The Networkers video platform. Built by the trade, trusted by homeowners. Permanent video portfolios, real-project galleries, and a public knowledge library. Not YouTube. Not TikTok. Organised around jobs, not creators. Every video is a business asset connected to products, regulations, and the trade that built it.`
  },
  {
    q: `How is ${PLATFORM_NAME} different from YouTube?`,
    a: `YouTube optimises for entertainment + ad revenue. ${PLATFORM_NAME} optimises for trades winning work. No likes, no subscribers, no algorithm — just structured business data: leads generated, quotes using the video, bookings, sales. Each video ties into the trade's profile, the products used, the applicable UK regulations, and (from Phase 4) an AI assistant that answers questions about the specific video.`
  },
  {
    q: `Who can upload to ${PLATFORM_NAME}?`,
    a: `Any verified Networkers member. Free tier includes 3 permanent video slots; additional uploads use washers from your monthly balance. Every upload is moderated before it becomes publicly discoverable.`
  },
  {
    q: `What happens to videos over time?`,
    a: `Three classes: Feed (30-day auto-expire — keeps the feed fresh), Portfolio (permanent — your company showcase), Knowledge Base (permanent + admin-curated — the public learning library that ranks on Google). The same video can be re-posted to Feed from your Portfolio any time.`
  }
];
