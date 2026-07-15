import type { MoodSlug } from "./yardMoods";

// Canteens — group feature layered onto The Yard.
//
// Design decisions (brainstormed 2026-07-10):
//   - Open groups, not private — anyone can browse
//   - Feed stays inside the canteen by default; individual posts can be
//     promoted to the main Yard feed by the poster
//   - The Counter on the right = merchant marketing river + Trade Center
//     product syndication; free for now, quality-gated by relevance score
//   - Post lifetime: 30-day baseline, +15 days when engagement fires, 90-day cap
//   - Header: constrained — name + trade tag + gradient-treated bg image
//   - Payment: platform never touches money; buyer-protected rails only
//   - Activity gate: 50 posts/mo × 3mo (quality-weighted 3+ reactions = ×2)
//     → free "topic app" of the canteen's primary trade for 12 months
//
// This module ships the types + mock seeds so the UI can render before
// we cut the Supabase migration. Real data-access functions land in a
// follow-up commit against `network_canteens*` tables.

export type CanteenTradeSlug = string;

export type Canteen = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  /** The canteen's primary trade — determines topic app unlock, The Counter
   *  syndication, discoverability filters. */
  tradeSlug: CanteenTradeSlug;
  /** Trade label for display (e.g. "Kitchen Fitters"). */
  tradeLabel: string;
  /** Host / founder of the canteen — a merchant listing slug. */
  hostSlug: string;
  hostDisplayName: string;
  /** Live member count. */
  memberCount: number;
  /** Post count (main canteen feed) in the trailing 30 days. */
  postsLast30d: number;
  /** Consecutive months meeting the 50-post activity threshold. */
  activityStreakMonths: number;
  /** Header background — URL or gradient-only. */
  headerBgUrl: string | null;
  /** ISO timestamp. */
  createdAt: string;
  /** Founding-100 badge — true for the first 100 canteens (first-100
   *  perk pipeline attaches here). */
  isFounding100: boolean;
  /** Native palette for demo canteens — set when the canteen exists
   *  primarily to showcase a specific palette in the templates picker
   *  (e.g. uk-master-carpenters = Oak). Used as fallback when the
   *  merchant's hammerex_trade_off_listings row has no palette_slug
   *  and no `?preview_palette=` query override is present. Real
   *  merchant canteens leave this undefined — their palette comes
   *  from their listing row. Slug is a string here (not PaletteSlug)
   *  to avoid a client-side type import loop; validated at read time. */
  paletteSlug?: string | null;
};

/** Live offer on a make-me-an-offer listing. Displayed inline on the
 *  side-lane card underneath the seller's asking price. Capped at 3
 *  visible entries (newest first); older offers fall off / expire in
 *  24h if the seller doesn't respond. */
export type SideLaneOffer = {
  id: string;
  buyerSlug: string;
  buyerDisplayName: string;
  buyerAvatarUrl: string | null;
  amountGbp: number;
  postedAt: string;
};

export type SideLanePost = {
  id: string;
  canteenId: string;
  /** Merchant marketing / Trade Center product / member listing. */
  kind: "merchant-marketing" | "trade-center-product" | "member-listing";
  /** Poster — always a listing slug. */
  posterSlug: string;
  posterDisplayName: string;
  /** Short blurb — capped at 90 chars for The Counter. */
  headline: string;
  /** Small square image. */
  imageUrl: string | null;
  /** For product posts. */
  priceGbp?: number;
  /** Rolling 7-day click count — drives the auto-extension logic. */
  clicksTrailing7d: number;
  /** State machine — see design notes. */
  state:
    | "live"
    | "sold"
    | "expired"
    | "archived";
  /** When the post entered The Counter. */
  postedAt: string;
  /** When it drops out of the lane unless extended. */
  expiresAt: string;
  /** Cross-syndication ref — the same listing appears on Trade Center. */
  tradeCenterListingId?: string;
  /** Seller-selectable mood. When set to "make-me-offer", the card
   *  renders the mood character + inline offer input + live offer log.
   *  Any other mood renders as a decoration only. */
  mood?: MoodSlug;
  /** Live offers on this listing — only meaningful when mood is
   *  "make-me-offer". Capped rendering handled at card level. */
  offers?: SideLaneOffer[];
  /** Seller privacy toggle — when true, offers below asking price are
   *  hidden from other buyers to prevent race-to-the-bottom anchoring. */
  hideBelowAsking?: boolean;
  /** ISO — set when the sale is agreed (reserve matched OR seller
   *  manually accepted). Card stays visible with a Sold banner for
   *  MAKE_OFFER_SOLD_TAIL_DAYS after this timestamp, then archives. */
  soldAt?: string;
  /** ISO — set when the seller cancels the listing. Seller can only
   *  cancel after MAKE_OFFER_MIN_LIVE_DAYS have elapsed from postedAt. */
  cancelledAt?: string;
  /** Seller-set reserve. Auto-flip to sold when any offer matches it. */
  reserveGbp?: number;
  /** Seller's currency — every offer must be made in this currency.
   *  Buyer sees a warning when their locale currency differs so there's
   *  no "I thought it was in my currency" dispute later. Defaults to
   *  GBP for UK-hosted listings. */
  currency?: "GBP" | "EUR" | "USD" | "AUD" | "CAD";
  /** Sponsored / boosted listing — paid to float above organic posts
   *  in The Counter flow. Extension of Pro-tier billing (via the same
   *  Stripe subscription flow — no separate payment surface). Renders
   *  with a "Sponsored" chip so trades know it's paid placement. */
  boost?: {
    expiresAt: string;
    targetTradeSlugs?: readonly string[];
    paidGbp: number;
  };
  /** Service-inquiry listing — no fixed price, no offers, buyer needs
   *  to contact the poster for details. Renders a "More Information"
   *  chip top-right instead of a Make-Offer banner / Hot chip. Used
   *  for distribution-partner calls (DeWalt agent), recruitment ads,
   *  and other listings that don't fit the product / product-hire /
   *  offer model. Takes priority over the Hot chip but not the sold
   *  banner or make-me-offer mood. */
  serviceInquiry?: boolean;
};

/** Minimum live window on a make-me-offer listing. Seller cannot cancel
 *  before this elapses — protects buyers who spent time crafting an
 *  offer. See project_makeoffer_listing_timing.md. */
export const MAKE_OFFER_MIN_LIVE_DAYS = 5;

/** Post-sale visibility tail. After the listing flips to sold it stays
 *  in The Counter with a Sold banner for this many days (social
 *  proof / FOMO), then archives. */
export const MAKE_OFFER_SOLD_TAIL_DAYS = 7;

/** True when the seller is allowed to cancel a make-me-offer listing
 *  (must be past the minimum live window and not already sold). */
export function canSellerCancelListing(post: SideLanePost, now = new Date()): boolean {
  if (post.state !== "live" || post.mood !== "make-me-offer") return false;
  if (post.soldAt || post.cancelledAt) return false;
  const posted = new Date(post.postedAt).getTime();
  const elapsedMs = now.getTime() - posted;
  return elapsedMs >= MAKE_OFFER_MIN_LIVE_DAYS * 24 * 60 * 60 * 1000;
}

/** True when a sold listing should still show in The Counter inside
 *  its 7-day post-sale visibility tail. */
export function isWithinSoldTail(post: SideLanePost, now = new Date()): boolean {
  if (!post.soldAt) return false;
  const sold = new Date(post.soldAt).getTime();
  return now.getTime() - sold < MAKE_OFFER_SOLD_TAIL_DAYS * 24 * 60 * 60 * 1000;
}

// ─── Mock seed data (design-preview only) ────────────────────

export const MOCK_CANTEENS: Canteen[] = [
  {
    id: "cant_kitchen_uk",
    slug: "uk-kitchen-fitters",
    name: "Kitchen Fitters",
    tagline: "Where kitchen chippies talk carcasses, worktops and horror-story customers.",
    tradeSlug: "kitchen-fitter",
    tradeLabel: "Kitchen Fitters",
    hostSlug: "demo-mike-watson-drywall-manchester",
    hostDisplayName: "Mike Watson",
    memberCount: 128,
    postsLast30d: 64,
    activityStreakMonths: 2,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2010,%202026,%2006_18_07%20AM.png",
    createdAt: "2026-05-14T12:00:00Z",
    isFounding100: true,
    paletteSlug: "chalk"
  },
  {
    // Iron-palette reference canteen. Same layout as Mike Watson's,
    // rendered in dark theme via `?preview_palette=iron` (or via the
    // merchant's persisted palette_slug once demo listing lands in
    // hammerex_trade_off_listings). Hero image added 2026-07-14.
    // Ordered BEFORE north-uk-sparks so canteenHostedByMerchant()
    // returns this one as Craig's primary hosted canteen — sign-in
    // routes and "your canteen" links land here.
    id: "cant_electrician_rated",
    slug: "uk-rated-electricians",
    name: "Rated Electricians",
    tagline: "Verified sparks. NICEIC + Certsure certificates on file. Domestic + commercial callouts.",
    tradeSlug: "electrician",
    tradeLabel: "Electricians",
    hostSlug: "demo-craig-mcdermott-electrician-leeds",
    hostDisplayName: "Craig McDermott",
    memberCount: 42,
    postsLast30d: 22,
    activityStreakMonths: 1,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2010_51_51%20PM.png",
    createdAt: "2026-07-14T22:00:00Z",
    isFounding100: true,
    paletteSlug: "iron"
  },
  {
    id: "cant_sparks_north",
    slug: "north-uk-sparks",
    name: "North Sparks",
    tagline: "Sparks Yorkshire → Highlands. Consumer units, EICRs, and Certsure gossip.",
    tradeSlug: "electrician",
    tradeLabel: "Electricians",
    hostSlug: "demo-craig-mcdermott-electrician-leeds",
    hostDisplayName: "Craig McDermott",
    memberCount: 87,
    postsLast30d: 41,
    activityStreakMonths: 1,
    headerBgUrl: null,
    createdAt: "2026-06-02T09:30:00Z",
    isFounding100: true
  },
  {
    // Slate-palette reference canteen. Same layout as every other,
    // rendered in navy blue via `?preview_palette=slate` (or via the
    // merchant's persisted palette_slug once demo listing lands in
    // hammerex_trade_off_listings). Hero image placeholder — Philip
    // to swap when ChatGPT mockup lands.
    id: "cant_plumbers_verified",
    slug: "uk-verified-plumbers",
    name: "Verified Plumbers",
    tagline: "Gas Safe registered. Domestic + commercial. Same-day emergency callouts.",
    tradeSlug: "plumber",
    tradeLabel: "Plumbers",
    hostSlug: "demo-james-holt-plumber-nottingham",
    hostDisplayName: "James Holt",
    memberCount: 38,
    postsLast30d: 19,
    activityStreakMonths: 1,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2002_03_04%20PM.png",
    createdAt: "2026-07-15T09:00:00Z",
    isFounding100: true,
    paletteSlug: "slate"
  },
  {
    id: "cant_scaffolders",
    slug: "uk-scaffolders",
    name: "Scaffolders",
    tagline: "Tube-and-fitting to system scaff — everything after 'send a lift'.",
    tradeSlug: "scaffolder",
    tradeLabel: "Scaffolders",
    hostSlug: "demo-jason-hardy-scaffolder-glasgow",
    hostDisplayName: "Jason Hardy",
    memberCount: 54,
    postsLast30d: 18,
    activityStreakMonths: 0,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%208,%202026,%2010_38_31%20PM.png",
    createdAt: "2026-06-20T15:00:00Z",
    isFounding100: true
  },
  // ─── Phase 3 palette demo canteens (2026-07-15) ─────────────────
  // One canteen per palette without an existing demo, so the picker
  // shows 17 distinct app previews (different hero, different name,
  // different trade) instead of one canteen re-coloured 17 times.
  // Hero images sourced from scripts/hero-library.json (2026 ImageKit
  // ChatGPT-generated) where a trade match exists; the remaining 7
  // trades have `headerBgUrl: null` awaiting Philip's ChatGPT mockups.
  // Products / posts / members will be seeded per-canteen as real
  // merchants sign up for each trade — MVP shows canteen + host only.

  // Oak (TP-04+ carpenter family)
  {
    id: "cant_carpenters_uk",
    slug: "uk-master-carpenters",
    name: "Master Carpenters",
    tagline: "1st fix, 2nd fix, and everything the brief forgot.",
    tradeSlug: "carpenter",
    tradeLabel: "Carpenters",
    hostSlug: "demo-owen-thompson-carpenter-bristol",
    hostDisplayName: "Owen Thompson",
    memberCount: 47,
    postsLast30d: 21,
    activityStreakMonths: 2,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2010_56_22%20PM.png",
    createdAt: "2026-07-15T14:00:00Z",
    isFounding100: true,
    paletteSlug: "oak"
  },
  // Blush (TP-15 interior designer)
  {
    id: "cant_interior_designers_uk",
    slug: "uk-interior-designers",
    name: "Interior Designers",
    tagline: "Boutique styling, colour boards, and clients with impossible timelines.",
    tradeSlug: "interior-designer",
    tradeLabel: "Interior Designers",
    hostSlug: "demo-rebecca-ashworth-interior-designer-london",
    hostDisplayName: "Rebecca Ashworth",
    memberCount: 31,
    postsLast30d: 17,
    activityStreakMonths: 1,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2003_45_28%20AM.png",
    createdAt: "2026-07-15T14:00:00Z",
    isFounding100: true,
    paletteSlug: "blush"
  },
  // Sandstone (TP-18 heritage stone)
  {
    id: "cant_heritage_stone_uk",
    slug: "uk-heritage-stone",
    name: "Heritage Stone",
    tagline: "Lime mortar, listed-building consents, and 200-year-old walls.",
    tradeSlug: "heritage-stone-mason",
    tradeLabel: "Heritage Stone Masons",
    hostSlug: "demo-david-whitmore-heritage-stone-bath",
    hostDisplayName: "David Whitmore",
    memberCount: 22,
    postsLast30d: 9,
    activityStreakMonths: 1,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2001_46_00%20PM.png",
    createdAt: "2026-07-15T14:00:00Z",
    isFounding100: true,
    paletteSlug: "sandstone"
  },
  // Brick (TP-22 tile roofer)
  {
    id: "cant_tile_roofers_uk",
    slug: "uk-tile-roofers",
    name: "Tile Roofers",
    tagline: "Clay, concrete, slate. Full re-roofs and heritage tile matching.",
    tradeSlug: "roofer-tile",
    tradeLabel: "Tile Roofers",
    hostSlug: "demo-gary-hughes-roofer-sheffield",
    hostDisplayName: "Gary Hughes",
    memberCount: 63,
    postsLast30d: 28,
    activityStreakMonths: 2,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2001_44_51%20PM.png",
    createdAt: "2026-07-15T14:00:00Z",
    isFounding100: true,
    paletteSlug: "brick"
  },
  // Copper (TP-31 coppersmith)
  {
    id: "cant_coppersmiths_uk",
    slug: "uk-coppersmiths",
    name: "Coppersmiths",
    tagline: "Copper roofing, lead flashing, and the sound of a hammer on sheet.",
    tradeSlug: "coppersmith",
    tradeLabel: "Coppersmiths",
    hostSlug: "demo-nathan-barrett-coppersmith-birmingham",
    hostDisplayName: "Nathan Barrett",
    memberCount: 18,
    postsLast30d: 6,
    activityStreakMonths: 1,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2003_29_09%20AM.png",
    createdAt: "2026-07-15T14:00:00Z",
    isFounding100: true,
    paletteSlug: "copper"
  },
  // Aqua (TP-42 pool builder)
  {
    id: "cant_pool_builders_uk",
    slug: "uk-pool-builders",
    name: "Pool Builders",
    tagline: "Fibreglass, gunite, plunge pools. Coastal spec + inland retrofits.",
    tradeSlug: "pool-builder",
    tradeLabel: "Pool Builders",
    hostSlug: "demo-ben-callaghan-pool-builder-bournemouth",
    hostDisplayName: "Ben Callaghan",
    memberCount: 26,
    postsLast30d: 11,
    activityStreakMonths: 1,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2007_30_54%20AM.png",
    createdAt: "2026-07-15T14:00:00Z",
    isFounding100: true,
    paletteSlug: "aqua"
  },
  // Moss (TP-46 landscaper)
  {
    id: "cant_landscapers_uk",
    slug: "uk-landscapers",
    name: "Landscapers",
    tagline: "Turf, decking, boundaries, planting. Domestic gardens to estate grounds.",
    tradeSlug: "landscaper",
    tradeLabel: "Landscapers",
    hostSlug: "demo-tom-ashfield-landscaper-cambridge",
    hostDisplayName: "Tom Ashfield",
    memberCount: 71,
    postsLast30d: 34,
    activityStreakMonths: 3,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2007_21_23%20AM.png",
    createdAt: "2026-07-15T14:00:00Z",
    isFounding100: true,
    paletteSlug: "moss"
  },
  // Emerald (TP-52 luxury garden designer)
  {
    id: "cant_garden_designers_uk",
    slug: "uk-garden-designers",
    name: "Garden Designers",
    tagline: "Formal gardens, orangeries, sculpted hedges. Cotswolds to Cornwall.",
    tradeSlug: "luxury-garden-designer",
    tradeLabel: "Garden Designers",
    hostSlug: "demo-charlotte-grantham-garden-designer-cotswolds",
    hostDisplayName: "Charlotte Grantham",
    memberCount: 19,
    postsLast30d: 8,
    activityStreakMonths: 1,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2006_41_30%20AM.png",
    createdAt: "2026-07-15T14:00:00Z",
    isFounding100: true,
    paletteSlug: "emerald"
  },
  // Steel (TP-55 welder / fabricator)
  {
    id: "cant_metal_fabricators_uk",
    slug: "uk-metal-fabricators",
    name: "Metal Fabricators",
    tagline: "MIG, TIG, arc. Structural steel, bespoke gates, balustrades.",
    tradeSlug: "welder-fabricator",
    tradeLabel: "Metal Fabricators",
    hostSlug: "demo-wayne-hartley-welder-sheffield",
    hostDisplayName: "Wayne Hartley",
    memberCount: 44,
    postsLast30d: 19,
    activityStreakMonths: 2,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2003_29_09%20AM.png",
    createdAt: "2026-07-15T14:00:00Z",
    isFounding100: true,
    paletteSlug: "steel"
  },
  // Ink (TP-59 architect)
  {
    id: "cant_architects_uk",
    slug: "uk-architects",
    name: "Architects",
    tagline: "RIBA members. Planning, building regs, and the drawings the builder wanted yesterday.",
    tradeSlug: "architect",
    tradeLabel: "Architects",
    hostSlug: "demo-sarah-fenton-architect-london",
    hostDisplayName: "Sarah Fenton",
    memberCount: 38,
    postsLast30d: 15,
    activityStreakMonths: 2,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2008_38_50%20AM.png",
    createdAt: "2026-07-15T14:00:00Z",
    isFounding100: true,
    paletteSlug: "ink"
  },
  // Concrete (TP-65 concrete specialist)
  {
    id: "cant_concrete_specialists_uk",
    slug: "uk-concrete-specialists",
    name: "Concrete Specialists",
    tagline: "Foundations, formwork, polished floors. Domestic to industrial.",
    tradeSlug: "concrete-specialist",
    tradeLabel: "Concrete Specialists",
    hostSlug: "demo-marcus-reeves-concrete-manchester",
    hostDisplayName: "Marcus Reeves",
    memberCount: 33,
    postsLast30d: 14,
    activityStreakMonths: 1,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2008_44_32%20AM.png",
    createdAt: "2026-07-15T14:00:00Z",
    isFounding100: true,
    paletteSlug: "concrete"
  },
  // Mortar (TP-69 bricklayer)
  {
    id: "cant_bricklayers_uk",
    slug: "uk-bricklayers",
    name: "Bricklayers",
    tagline: "Coursed bond, cavity work, extensions. Belfast lads to south coast crews.",
    tradeSlug: "bricklayer",
    tradeLabel: "Bricklayers",
    hostSlug: "demo-kevin-doherty-bricklayer-belfast",
    hostDisplayName: "Kevin Doherty",
    memberCount: 58,
    postsLast30d: 24,
    activityStreakMonths: 2,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2001_46_00%20PM.png",
    createdAt: "2026-07-15T14:00:00Z",
    isFounding100: true,
    paletteSlug: "mortar"
  },
  // Mortar (TP-70 plasterer — added 2026-07-15 alongside the footer
  // background art rollout so this trade has a live demo to attach
  // the plaster-sacks-+-ladder artwork to).
  {
    id: "cant_plasterers_uk",
    slug: "uk-plasterers",
    name: "Plasterers",
    tagline: "Skim finish, feathered joints, external render. From listed cottages to new-build extensions.",
    tradeSlug: "plasterer",
    tradeLabel: "Plasterers",
    hostSlug: "demo-lucas-hensley-plasterer-bristol",
    hostDisplayName: "Lucas Hensley",
    memberCount: 42,
    postsLast30d: 19,
    activityStreakMonths: 2,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2002_18_53%20AM.png",
    createdAt: "2026-07-15T20:00:00Z",
    isFounding100: true,
    paletteSlug: "mortar"
  },
  // Timber (TP-91 bespoke joiner)
  {
    id: "cant_bespoke_joiners_uk",
    slug: "uk-bespoke-joiners",
    name: "Bespoke Joiners",
    tagline: "Workshop-made staircases, sash windows, and doors the merchant can't buy off the shelf.",
    tradeSlug: "bespoke-joiner",
    tradeLabel: "Bespoke Joiners",
    hostSlug: "demo-edward-halliwell-joiner-yorkshire",
    hostDisplayName: "Edward Halliwell",
    memberCount: 27,
    postsLast30d: 12,
    activityStreakMonths: 2,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2012_06_42%20AM.png",
    createdAt: "2026-07-15T14:00:00Z",
    isFounding100: true,
    paletteSlug: "timber"
  },
  // Oak (wood-family — bespoke furniture makers).
  {
    id: "cant_furniture_makers_uk",
    slug: "uk-furniture-makers",
    name: "Furniture Makers",
    tagline: "Bespoke tables, sideboards, and heirloom pieces — commissioned to spec, made to last a century.",
    tradeSlug: "furniture-maker",
    tradeLabel: "Furniture Makers",
    hostSlug: "demo-harriet-blake-furniture-cotswolds",
    hostDisplayName: "Harriet Blake",
    memberCount: 34,
    postsLast30d: 15,
    activityStreakMonths: 2,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/6b868b252c0a43aa5d826da447c349a7.jpg",
    createdAt: "2026-07-15T21:00:00Z",
    isFounding100: true,
    paletteSlug: "oak"
  },
  // Timber (wood-family — hand carvers, decorative + sculptural).
  {
    id: "cant_wood_carvers_uk",
    slug: "uk-wood-carvers",
    name: "Wood Carvers",
    tagline: "Chisel to timber — decorative panels, relief carving, sculptural commissions.",
    tradeSlug: "wood-carver",
    tradeLabel: "Wood Carvers",
    hostSlug: "demo-callum-ford-carver-cornwall",
    hostDisplayName: "Callum Ford",
    memberCount: 19,
    postsLast30d: 9,
    activityStreakMonths: 1,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/93bf4c7289b643b54c98fec085a28aa2.jpg",
    createdAt: "2026-07-15T21:15:00Z",
    isFounding100: true,
    paletteSlug: "timber"
  },
  // Oak (wood-family — antique + heritage timber restoration).
  {
    id: "cant_wood_restorers_uk",
    slug: "uk-wood-restorers",
    name: "Wood Restorers",
    tagline: "Antique furniture repair, timber-frame restoration, reclaimed beam re-use.",
    tradeSlug: "wood-restorer",
    tradeLabel: "Wood Restorers",
    hostSlug: "demo-miles-warrington-restorer-bath",
    hostDisplayName: "Miles Warrington",
    memberCount: 22,
    postsLast30d: 11,
    activityStreakMonths: 2,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/fdfb32014411b6719f4d60a09b4f5292.jpg",
    createdAt: "2026-07-15T21:30:00Z",
    isFounding100: true,
    paletteSlug: "oak"
  },
  // Timber (wood-family — finishing craft, spray + hand-rubbed stain).
  {
    id: "cant_wood_stainers_uk",
    slug: "uk-wood-stainers",
    name: "Wood Stainers",
    tagline: "Spray booths, hand-rubbed oils, French-polish revivals. Making raw timber look right.",
    tradeSlug: "wood-stainer",
    tradeLabel: "Wood Stainers",
    hostSlug: "demo-ryan-hollis-stainer-manchester",
    hostDisplayName: "Ryan Hollis",
    memberCount: 16,
    postsLast30d: 7,
    activityStreakMonths: 1,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/f6906127ca6b272c347366e0ec1049f9.jpg",
    createdAt: "2026-07-15T21:45:00Z",
    isFounding100: true,
    paletteSlug: "timber"
  },
  // Oak (wood-family — bespoke treehouse builders. Niche but photogenic
  // trade with genuine walking-billboard potential for the platform).
  {
    id: "cant_tree_houses_uk",
    slug: "uk-tree-house-builders",
    name: "Tree House Builders",
    tagline: "Kids' hideaways to grown-up cabins in the canopy — engineered platforms, timber joinery, garden-integrated builds.",
    tradeSlug: "tree-house-builder",
    tradeLabel: "Tree House Builders",
    hostSlug: "demo-rowan-ashcroft-tree-houses-devon",
    hostDisplayName: "Rowan Ashcroft",
    memberCount: 24,
    postsLast30d: 20,
    activityStreakMonths: 2,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/2a103a44bcbcea865e53a0eb865667c7.jpg",
    createdAt: "2026-07-15T22:00:00Z",
    isFounding100: true,
    paletteSlug: "oak"
  },
  // Aqua (water-family — bespoke water features / fountains /
  // waterfall walls / lagoon-style plunge pools. Niche off pool
  // building; different design + install skill set).
  {
    id: "cant_water_features_uk",
    slug: "uk-water-feature-specialists",
    name: "Water Feature Specialists",
    tagline: "Fountains, waterfall walls, lagoon-style pools. Engineered from the plumbing up, integrated into the garden design.",
    tradeSlug: "water-feature-specialist",
    tradeLabel: "Water Feature Specialists",
    hostSlug: "demo-tobias-marlow-water-features-bath",
    hostDisplayName: "Tobias Marlow",
    memberCount: 14,
    postsLast30d: 6,
    activityStreakMonths: 1,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/9b08d4bb58890f657a357d12d48e5f6a.jpg",
    createdAt: "2026-07-15T22:15:00Z",
    isFounding100: true,
    paletteSlug: "aqua"
  },
  // Mortar (structural — gutter + downpipe specialists, distinct
  // from general roofing. Fascia/soffit maintenance and rainwater
  // goods sold as its own trade to homeowners).
  {
    id: "cant_guttering_downpipes_uk",
    slug: "uk-guttering-downpipes",
    name: "Guttering + Downpipes",
    tagline: "Cast-iron replicas, modern uPVC, seamless aluminium. Fascia + soffit maintenance and rainwater goods across the UK.",
    tradeSlug: "guttering-specialist",
    tradeLabel: "Guttering Specialists",
    hostSlug: "demo-dylan-reid-guttering-sheffield",
    hostDisplayName: "Dylan Reid",
    memberCount: 26,
    postsLast30d: 12,
    activityStreakMonths: 2,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/85cbf19d75ffa14ffde727e9821f4616.jpg",
    createdAt: "2026-07-15T22:30:00Z",
    isFounding100: true,
    paletteSlug: "mortar"
  },
  // Copper (heritage-metal roof detailing — flashings, dormers,
  // finials, decorative hoppers. Sub-trade off general coppersmith
  // work, specifically roof-focused. Different demo host from
  // Nathan Barrett's coppersmith canteen so both surfaces read as
  // independent trade communities).
  {
    id: "cant_copper_flashing_uk",
    slug: "uk-copper-flashing-specialists",
    name: "Copper Flashing Specialists",
    tagline: "Roof flashings, copper dormers, decorative hoppers. Heritage-grade metalwork for listed and prestige properties.",
    tradeSlug: "copper-flashing-specialist",
    tradeLabel: "Copper Flashing Specialists",
    hostSlug: "demo-wilf-adair-copper-flashing-york",
    hostDisplayName: "Wilf Adair",
    memberCount: 17,
    postsLast30d: 8,
    activityStreakMonths: 2,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/b3785840d16b30030c7caea90d062172.jpg",
    createdAt: "2026-07-15T22:45:00Z",
    isFounding100: true,
    paletteSlug: "copper"
  },
  // Oak (timber-frame family — bespoke canopy specialists. Oak-
  // frame porch canopies, veranda canopies, car canopies. Built
  // in the workshop, hoisted + fitted on-site).
  {
    id: "cant_canopies_uk",
    slug: "uk-canopy-specialists",
    name: "Canopy Specialists",
    tagline: "Oak-frame door canopies, verandas, and car canopies — shop-made, delivered, and installed. From cottage porches to full covered courtyards.",
    tradeSlug: "canopy-specialist",
    tradeLabel: "Canopy Specialists",
    hostSlug: "demo-aidan-frost-canopy-cheshire",
    hostDisplayName: "Aidan Frost",
    memberCount: 21,
    postsLast30d: 11,
    activityStreakMonths: 2,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/15b7014afd1bcaeff30d0013a0fe95d8.jpg",
    createdAt: "2026-07-15T23:00:00Z",
    isFounding100: true,
    paletteSlug: "oak"
  },
  // Charcoal (TP-88 prestige builder)
  {
    id: "cant_prestige_builders_uk",
    slug: "uk-prestige-builders",
    name: "Prestige Builders",
    tagline: "Full-house refurbs, basement digs, heritage conversions. Surrey to Kensington.",
    tradeSlug: "prestige-builder",
    tradeLabel: "Prestige Builders",
    hostSlug: "demo-julian-hartley-prestige-builder-surrey",
    hostDisplayName: "Julian Hartley",
    memberCount: 14,
    postsLast30d: 6,
    activityStreakMonths: 1,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2003_26_58%20AM.png",
    createdAt: "2026-07-15T14:00:00Z",
    isFounding100: true,
    paletteSlug: "charcoal"
  },
  // Marine (TP-97 marina builder)
  {
    id: "cant_marina_builders_uk",
    slug: "uk-marina-builders",
    name: "Marina Builders",
    tagline: "Pontoons, decking, sea walls. Southampton, Poole, Portsmouth marinas.",
    tradeSlug: "marina-builder",
    tradeLabel: "Marina Builders",
    hostSlug: "demo-alistair-ferguson-marina-southampton",
    hostDisplayName: "Alistair Ferguson",
    memberCount: 11,
    postsLast30d: 4,
    activityStreakMonths: 1,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2002_59_22%20AM.png",
    createdAt: "2026-07-15T14:00:00Z",
    isFounding100: true,
    paletteSlug: "marine"
  },
  // Storm (TP-100 emergency repair)
  {
    id: "cant_emergency_repairs_uk",
    slug: "uk-emergency-repairs",
    name: "Emergency Repairs",
    tagline: "Storm damage. Burst pipes. Fallen trees. 24-hour insurance-approved response.",
    tradeSlug: "emergency-repair",
    tradeLabel: "Emergency Repairs",
    hostSlug: "demo-frank-delaney-emergency-newcastle",
    hostDisplayName: "Frank Delaney",
    memberCount: 29,
    postsLast30d: 13,
    activityStreakMonths: 2,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2001_44_51%20PM.png",
    createdAt: "2026-07-15T14:00:00Z",
    isFounding100: true,
    paletteSlug: "storm"
  },
  // Hi-Vis (TP-104 groundworker)
  {
    id: "cant_groundworkers_uk",
    slug: "uk-groundworkers",
    name: "Groundworkers",
    tagline: "Digs, drainage, foundations. Everything under the ground floor slab.",
    tradeSlug: "groundworker",
    tradeLabel: "Groundworkers",
    hostSlug: "demo-barry-rollins-groundworker-liverpool",
    hostDisplayName: "Barry Rollins",
    memberCount: 52,
    postsLast30d: 22,
    activityStreakMonths: 2,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2002_25_52%20PM.png",
    createdAt: "2026-07-15T14:00:00Z",
    isFounding100: true,
    paletteSlug: "hi-vis"
  },
  // Oak (TP — garden sheds / storage sheds / timber outbuildings).
  // Massive market — every homeowner in the UK either has one or
  // wants one. Cross-trade: shed suppliers, carpenters, timber
  // merchants, garden landscapers who fit them.
  {
    id: "cant_garden_sheds_uk",
    slug: "uk-garden-sheds",
    name: "Garden Sheds",
    tagline: "Timber garden sheds, storage sheds, workshop sheds. Delivered flat-pack, on-site assembly, or carpenter-built to spec.",
    tradeSlug: "garden-shed-supplier",
    tradeLabel: "Garden Shed Suppliers",
    hostSlug: "demo-graham-oakley-shed-supplier-yorkshire",
    hostDisplayName: "Graham Oakley",
    memberCount: 31,
    postsLast30d: 14,
    activityStreakMonths: 3,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/d98c46e29d17a06b4a4a8c081984fc21.jpg",
    createdAt: "2026-07-16T10:15:00Z",
    isFounding100: true,
    paletteSlug: "oak"
  },
  // Oak (TP — garden sunrooms / summerhouses).
  // Adjacent to garden houses but distinct product — single-storey,
  // glass-heavy, purpose-built for garden lounging. Sold by cabin
  // manufacturers and fitted by carpenters.
  {
    id: "cant_garden_sunrooms_uk",
    slug: "uk-garden-sunrooms",
    name: "Garden Sunrooms",
    tagline: "Timber garden sunrooms + summerhouses. Warm honey cedar or oak-frame, glass-front — the reading room you always wanted, in the garden.",
    tradeSlug: "garden-sunroom-builder",
    tradeLabel: "Garden Sunroom Builders",
    hostSlug: "demo-imogen-fielding-sunrooms-sussex",
    hostDisplayName: "Imogen Fielding",
    memberCount: 16,
    postsLast30d: 7,
    activityStreakMonths: 2,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2011_29_34%20PM.png",
    createdAt: "2026-07-16T10:30:00Z",
    isFounding100: true,
    paletteSlug: "oak"
  },
  // Oak (TP — small garden houses / studios / annexes).
  // Cross-trade category — Philip 2026-07-16: "small houses mainly
  // for end of garden for workshop, family at retirement, or ordinary
  // people looking for less expensive options with same level of
  // living space in smaller space." Timber-frame construction with
  // stone / dark-clad finishes. Suppliers + carpenters + small-home
  // builders all read this canteen.
  {
    id: "cant_garden_houses_uk",
    slug: "uk-garden-houses",
    name: "Garden Houses",
    tagline: "Two-storey garden studios, backyard annexes, workshop cabins. Full living space in a fraction of the footprint — carpenter-built, planning-friendly.",
    tradeSlug: "garden-house-builder",
    tradeLabel: "Garden House Builders",
    hostSlug: "demo-natalie-kingswood-garden-houses-oxfordshire",
    hostDisplayName: "Natalie Kingswood",
    memberCount: 19,
    postsLast30d: 8,
    activityStreakMonths: 2,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/f92e621a49adef4d30a5665af86a447a.jpg",
    createdAt: "2026-07-16T10:00:00Z",
    isFounding100: true,
    paletteSlug: "oak"
  },
  // Oak (TP — loft ladder specialists / suppliers). Cross-trade
  // category — Philip's clarification 2026-07-16: "loft ladder is
  // building supplies but there are shops that sell only loft ladders,
  // with carpenters offering supply-and-fit as a service." The canteen
  // sits in the timber-supply family (Oak palette) because loft
  // ladders are majority-timber product and are typically sold beside
  // sawn timber + door supplies at the merchant. Carpenters fitting
  // loft ladders as 2nd-fix work also read this canteen for supply
  // updates. Host demo persona = specialist retailer/installer.
  {
    id: "cant_loft_ladders_uk",
    slug: "uk-loft-ladders",
    name: "Loft Ladders",
    tagline: "Timber, aluminium, scissor, sliding. Supply-only, or supply-and-fit through a carpenter on the crew.",
    tradeSlug: "loft-ladder-specialist",
    tradeLabel: "Loft Ladder Specialists",
    hostSlug: "demo-gareth-tomlinson-loft-ladders-birmingham",
    hostDisplayName: "Gareth Tomlinson",
    memberCount: 24,
    postsLast30d: 11,
    activityStreakMonths: 2,
    headerBgUrl: "https://ik.imagekit.io/9mrgsv2rp/9ba3ebd3eb6ff899596cd7155ca83752.jpg",
    createdAt: "2026-07-16T09:00:00Z",
    isFounding100: true,
    paletteSlug: "oak"
  }
];

// ─── Search helpers (powers /trade-off/search Trades tab) ────────
//
// Free-text search over the mock demo canteens. Real DB search will
// follow once we're happy with the surface — this MVP intentionally
// works off MOCK_CANTEENS so the UX can iterate without migrations.
//
// Match target: name, tradeLabel, tradeSlug, tagline, hostDisplayName.
// City proxy: demo hostSlugs embed city as the last dash-token
// (`demo-gary-hughes-roofer-sheffield` → `sheffield`) — good enough
// for the demo. Real merchants read from hammerex_trade_off_listings.
//
// Scoring is intentionally simple: substring hit on any field = point.
// Better matches (name/tradeLabel) score higher than tagline hits so
// the sort surfaces the most relevant canteen first.

/** Derive a city hint from the demo hostSlug. Returns empty string
 *  when the slug doesn't match the demo `demo-first-last-trade-city`
 *  shape. */
export function canteenCityHint(canteen: Canteen): string {
  const parts = canteen.hostSlug.split("-");
  if (parts.length < 3 || parts[0] !== "demo") return "";
  return parts[parts.length - 1];
}

function normaliseSearchText(s: string): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
}

/** Score a canteen against a free-text query. Higher = better match. */
function scoreCanteenForQuery(canteen: Canteen, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const name = normaliseSearchText(canteen.name);
  const tradeLabel = normaliseSearchText(canteen.tradeLabel);
  const tradeSlug = normaliseSearchText(canteen.tradeSlug.replace(/-/g, " "));
  const tagline = normaliseSearchText(canteen.tagline);
  const host = normaliseSearchText(canteen.hostDisplayName);
  let score = 0;
  for (const q of tokens) {
    if (name.includes(q)) score += 12;
    if (tradeLabel.includes(q)) score += 10;
    if (tradeSlug.includes(q)) score += 8;
    if (tagline.includes(q)) score += 4;
    if (host.includes(q)) score += 3;
  }
  return score;
}

/** Full-text search across the demo canteens. Filters by query then
 *  boosts entries whose city hint matches the supplied city (for
 *  "3 nearest trades" chip + Trades tab city sort). Returns [] on
 *  empty query — caller decides whether to show all or an empty
 *  state. */
export function searchCanteens(query: string, city?: string, limit = 40): Canteen[] {
  const cleaned = normaliseSearchText(query);
  if (!cleaned) return [];
  const tokens = cleaned.split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length === 0) return [];
  const cityNorm = normaliseSearchText(city ?? "");
  const scored: Array<{ c: Canteen; score: number }> = [];
  for (const c of MOCK_CANTEENS) {
    const base = scoreCanteenForQuery(c, tokens);
    if (base <= 0) continue;
    const cityBoost = cityNorm && canteenCityHint(c) === cityNorm ? 15 : 0;
    scored.push({ c, score: base + cityBoost });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.c);
}

/** Given a trade slug (or slugs — comma-separated), return the top N
 *  canteens for that trade. Used by the "3 nearest trades" chip
 *  under each Inspiration image — we match the image's implied trade
 *  against real canteens so the chip shows real hosts, not
 *  placeholder text. Prefers exact tradeSlug match; falls back to
 *  keyword contains on tradeSlug or name. */
export function canteensForTradeQuery(query: string, city?: string, limit = 3): Canteen[] {
  const q = normaliseSearchText(query);
  if (!q) return [];
  const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length === 0) return [];
  const cityNorm = normaliseSearchText(city ?? "");
  const scored: Array<{ c: Canteen; score: number }> = [];
  for (const c of MOCK_CANTEENS) {
    const tradeSlug = c.tradeSlug.replace(/-/g, " ");
    const label = c.tradeLabel.toLowerCase();
    let s = 0;
    for (const t of tokens) {
      if (tradeSlug === t) s += 30;
      else if (tradeSlug.includes(t)) s += 12;
      if (label.includes(t)) s += 8;
    }
    if (s === 0) continue;
    if (cityNorm && canteenCityHint(c) === cityNorm) s += 20;
    scored.push({ c, score: s });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.c);
}

// The Counter seed images — 12 ChatGPT-generated construction-trade
// banners hosted on ImageKit. Every one of these ships as a live-card
// on the demo canteen. Real listings carry their own image on the DB
// record; these are the design-preview photography only. Refreshed
// 2026-07-14 (Philip's shoot). Old Unsplash IMG lookup deleted with
// this rewrite — nothing else in the app referenced it.
const IMG = {
  workwear:  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2005_33_48%20AM.png",
  screws:    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2005_19_34%20AM.png",
  dewalt:    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2012_40_36%20AM.png",
  staircase: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2012_27_33%20AM.png",
  aggregate: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2012_24_19%20AM.png",
  cementSilo:"https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2012_23_01%20AM.png",
  scaff:     "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2012_19_32%20AM.png",
  mixDrill:  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2012_17_18%20AM.png",
  fuseboard: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2012_10_00%20AM.png",
  mixerHire: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2012_03_42%20AM.png",
  handTools: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2011_59_27%20PM.png",
  plywood:   "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2011_56_11%20PM.png"
} as const;

// The Counter seed — 12 posts total, one per ChatGPT-generated banner.
// Refreshed 2026-07-14 (Philip's shoot) and priced against typical UK
// trade wholesale rates. Kind split: 3 member-listings with make-me-
// offer banner (items 6, 8, 11) · 2 trade-center-products (items 9,
// 12) · 7 merchant-marketing supplier ads. One boost active on item
// 4 (StairMasters). Hot chip auto-fires for entries with
// clicksTrailing7d > 20.
//
// Prices researched 2026-07-14 against Screwfix / Toolstation / Buildbase
// trade rates and typical UK depot pricing — starting-point figures,
// merchants set their own final prices.
export const MOCK_SIDE_LANE_POSTS: SideLanePost[] = [
  // 1. Work wear bundle — steel toe + PPE starter kit for site work
  { id: "sl_1",  canteenId: "cant_kitchen_uk", kind: "merchant-marketing",   posterSlug: "trade-wear-direct",           posterDisplayName: "Trade Wear Direct",     headline: "Full site PPE bundle — steel-toe boots, hi-vis, hard hat, trousers", imageUrl: IMG.workwear,  priceGbp: 85,  clicksTrailing7d: 38, state: "live", postedAt: "2026-07-10T09:00:00Z", expiresAt: "2026-08-09T09:00:00Z" },

  // 2. Trade fastener supplier — mixed wood + self-tap box discount
  { id: "sl_2",  canteenId: "cant_kitchen_uk", kind: "merchant-marketing",   posterSlug: "tradefix-fasteners-uk",       posterDisplayName: "TradeFix Fasteners UK", headline: "Wood + metal self-tap screws — trade discount on bulk boxes",         imageUrl: IMG.screws,    priceGbp: 45,  clicksTrailing7d: 16, state: "live", postedAt: "2026-07-11T11:30:00Z", expiresAt: "2026-08-10T11:30:00Z" },

  // 3. DeWalt partner recruitment — service inquiry (no price, no
  //    offers). "More Information" chip signals contact-for-details.
  { id: "sl_3",  canteenId: "cant_kitchen_uk", kind: "merchant-marketing",   posterSlug: "dewalt-uk-distribution",       posterDisplayName: "DeWalt UK Distribution", headline: "Regional distribution partner call — apply your trade area",         imageUrl: IMG.dewalt,                    clicksTrailing7d: 24, state: "live", postedAt: "2026-07-08T15:00:00Z", expiresAt: "2026-08-07T15:00:00Z", serviceInquiry: true },

  // 4. Staircase refacing service — sponsored (paid boost active)
  { id: "sl_4",  canteenId: "cant_kitchen_uk", kind: "merchant-marketing",   posterSlug: "stairmasters-uk",              posterDisplayName: "StairMasters UK",       headline: "Staircase refacing — timber & concrete cover, nationwide (from £395)", imageUrl: IMG.staircase, priceGbp: 395, clicksTrailing7d: 12, state: "live", postedAt: "2026-07-09T13:00:00Z", expiresAt: "2026-08-08T13:00:00Z",
    boost: {
      expiresAt: "2026-07-25T13:00:00Z",
      targetTradeSlugs: ["kitchen-fitter", "joiner", "carpenter", "builder"],
      paidGbp: 60
    }
  },

  // 5. West London aggregate depot — sand / gravel / ballast per tonne
  { id: "sl_5",  canteenId: "cant_kitchen_uk", kind: "merchant-marketing",   posterSlug: "west-london-aggregates",       posterDisplayName: "West London Aggregates", headline: "Sand · gravel · ballast — West London depot · same-day drops",       imageUrl: IMG.aggregate, priceGbp: 55,  clicksTrailing7d: 29, state: "live", postedAt: "2026-07-10T08:00:00Z", expiresAt: "2026-08-09T08:00:00Z" },

  // 6. Used cement silo — make-me-offer (collection only)
  { id: "sl_6",  canteenId: "cant_kitchen_uk", kind: "member-listing",       posterSlug: "demo-paul-webb-builder-bolton", posterDisplayName: "Paul Webb",             headline: "Used cement silo · good working order · collection only, Bolton",    imageUrl: IMG.cementSilo,                clicksTrailing7d: 18, state: "live", postedAt: "2026-07-09T10:00:00Z", expiresAt: "2026-08-08T10:00:00Z",
    mood: "make-me-offer",
    offers: [
      { id: "of_sl6_1", buyerSlug: "demo-jason-hardy-scaffolder-glasgow",             buyerDisplayName: "Jason H.", buyerAvatarUrl: "https://images.unsplash.com/photo-1548544149-4835e62ee5b3?w=200&h=200&fit=crop&crop=faces", amountGbp: 850, postedAt: "2026-07-11T09:30:00Z" },
      { id: "of_sl6_2", buyerSlug: "demo-alan-walsh-timber-merchant-birmingham",       buyerDisplayName: "Alan W.",  buyerAvatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=faces", amountGbp: 900, postedAt: "2026-07-12T14:15:00Z" }
    ]
  },

  // 7. Scaffolding supplier — Kwikstage standards + fittings nationwide
  { id: "sl_7",  canteenId: "cant_kitchen_uk", kind: "merchant-marketing",   posterSlug: "nationwide-scaff-supply",      posterDisplayName: "Nationwide Scaff Supply", headline: "Kwikstage standards + fittings — nationwide next-day delivery",       imageUrl: IMG.scaff,     priceGbp: 28,  clicksTrailing7d: 14, state: "live", postedAt: "2026-07-11T10:00:00Z", expiresAt: "2026-08-10T10:00:00Z" },

  // 8. Used paddle mixer drill — make-me-offer
  { id: "sl_8",  canteenId: "cant_kitchen_uk", kind: "member-listing",       posterSlug: "demo-mike-watson-drywall-manchester", posterDisplayName: "Mike Watson",     headline: "Used paddle mixer drill · good working order · offers welcome",      imageUrl: IMG.mixDrill,                  clicksTrailing7d: 11, state: "live", postedAt: "2026-07-12T09:00:00Z", expiresAt: "2026-08-11T09:00:00Z",
    mood: "make-me-offer",
    offers: [
      { id: "of_sl8_1", buyerSlug: "demo-kate-morris-plasterer-warrington",            buyerDisplayName: "Kate M.", buyerAvatarUrl: "https://images.unsplash.com/photo-1601456108021-fbdba97b9d47?w=200&h=200&fit=crop&crop=faces", amountGbp: 45,  postedAt: "2026-07-12T14:00:00Z" },
      { id: "of_sl8_2", buyerSlug: "demo-danny-lawson-joiner-hull",                    buyerDisplayName: "Danny L.", buyerAvatarUrl: "https://images.unsplash.com/photo-1583864697784-a0efc8379f70?w=200&h=200&fit=crop&crop=faces", amountGbp: 55,  postedAt: "2026-07-13T09:30:00Z" }
    ]
  },

  // 9. Fuse boards — domestic + industrial (Trade Center product)
  { id: "sl_9",  canteenId: "cant_kitchen_uk", kind: "trade-center-product", posterSlug: "demo-alan-walsh-timber-merchant-birmingham", posterDisplayName: "Alan Walsh Trade", headline: "Fuse boards — domestic 10-way + 3-phase industrial units",           imageUrl: IMG.fuseboard, priceGbp: 120, clicksTrailing7d: 27, state: "live", postedAt: "2026-07-10T14:00:00Z", expiresAt: "2026-08-09T14:00:00Z", tradeCenterListingId: "prod_fuseboards" },

  // 10. Cement mixer hire — Manchester + Sheffield depots
  { id: "sl_10", canteenId: "cant_kitchen_uk", kind: "merchant-marketing",   posterSlug: "northern-plant-hire",          posterDisplayName: "Northern Plant Hire",    headline: "Cement mixer hire — Manchester + Sheffield depots (from £15/day)",  imageUrl: IMG.mixerHire, priceGbp: 15,  clicksTrailing7d: 31, state: "live", postedAt: "2026-07-11T08:30:00Z", expiresAt: "2026-08-10T08:30:00Z" },

  // 11. Hand tool job lot — make-me-offer
  { id: "sl_11", canteenId: "cant_kitchen_uk", kind: "member-listing",       posterSlug: "demo-jason-hardy-scaffolder-glasgow", posterDisplayName: "Jason Hardy",       headline: "Hand tool job lot — mixed selection, contact for full list",         imageUrl: IMG.handTools,                 clicksTrailing7d: 9,  state: "live", postedAt: "2026-07-12T15:00:00Z", expiresAt: "2026-08-11T15:00:00Z",
    mood: "make-me-offer",
    offers: [
      { id: "of_sl11_1", buyerSlug: "demo-anna-forde-decorator-preston",               buyerDisplayName: "Anna F.", buyerAvatarUrl: "https://images.unsplash.com/photo-1583864697784-a0efc8379f70?w=200&h=200&fit=crop&crop=faces", amountGbp: 80,  postedAt: "2026-07-13T10:00:00Z" }
    ]
  },

  // 12. Plywood shuttering panels — 12mm-25mm (Trade Center product)
  { id: "sl_12", canteenId: "cant_kitchen_uk", kind: "trade-center-product", posterSlug: "demo-alan-walsh-timber-merchant-birmingham", posterDisplayName: "Alan Walsh Timber", headline: "Plywood shuttering panels — 12-25mm, weather-protected · trade discount", imageUrl: IMG.plywood, priceGbp: 42,  clicksTrailing7d: 19, state: "live", postedAt: "2026-07-10T11:00:00Z", expiresAt: "2026-08-09T11:00:00Z", tradeCenterListingId: "prod_shuttering_ply" }
];

// ─── Members ──────────────────────────────────────────────

export type CanteenMember = {
  slug: string;
  displayName: string;
  tradeLabel: string;
  city: string;
  avatarUrl: string | null;
  /** Role in this canteen. */
  role: "admin" | "moderator" | "member";
  whatsapp: string | null;
  bioShort: string;
  /** Other canteens this member belongs to — used by the "who's here"
   *  mini-profile popover for cross-canteen discovery. */
  memberOfCanteenSlugs: string[];
  // ─── Flip-side profile fields ───────────────────────
  // All optional so the flip-back conditional renders only sections
  // the trade actually filled in — see project_no_ktp_required.md style
  // (never render empty rows).
  /** Postcode area only — "M14", not the full street. Privacy default. */
  postcodeArea?: string;
  /** ISO-3166-alpha-2 country code. Drives the country-specific
   *  background illustration on the Location card in the profile
   *  focus. Defaults to "UK" (loose ISO — technically GB — matches
   *  the platform's existing country vocabulary). */
  country?: "UK" | "IE" | "AU" | "US" | "DE";
  /** Office / trading hours as a short multi-line string. */
  officeHours?: string;
  /** Public showroom / trade counter address, if the trade has one. */
  showroom?: {
    addressLine: string;
    postcode: string;
  };
  /** Verified stack. */
  verified?: {
    companiesHouse?: boolean;
    /** Public Liability cover in GBP. */
    insuranceGbp?: number;
    /** 0-100 trust score derived from profile completeness + reviews. */
    trustScore?: number;
  };
  /** Free-text availability (e.g., "Available next week"). */
  availability?: string;
  /** Response-time signal (e.g., "Usually replies in 2h"). */
  responseTime?: string;
  phone?: string;
  email?: string;
  socials?: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    youtube?: string;
    x?: string;
    snapchat?: string;
    website?: string;
  };
  /** Reviews summary — used for the chevron link on the flip-back. */
  reviews?: {
    avg: number;
    count: number;
  };
  /** Number of portfolio jobs — used for the chevron link. */
  portfolioCount?: number;
  /** Discrete services the merchant offers. Rendered as yellow-dot
   *  chips below the About Us bio on the profile focus. Free-text
   *  labels — kitchen-fitter examples: "Design", "Fitting service",
   *  "Refacing", "Kitchen spraying", "Worktop replacement". */
  servicesOffered?: string[];
  /** Merchant preference — when true, product quick-view + trending
   *  swipe sheet show a "Buy on Trade Center" button alongside the
   *  WhatsApp button (for products that have a tradeCenterListingId).
   *  Default false — merchants have to opt in so they don't
   *  accidentally send customers to a cart flow they don't understand.
   *  Per-product control still comes from tradeCenterListingId — this
   *  is the master switch on top of that. */
  sendToTradeCenter?: boolean;
};

// Small stable avatar pool (Unsplash portraits, cropped square).
const AV = {
  m1: "https://ik.imagekit.io/9mrgsv2rp/Untitleddasdaasbbbb.png",
  m2: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop&crop=faces",
  m3: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces",
  m4: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2010_58_56%20PM.png",
  m5: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200&h=200&fit=crop&crop=faces",
  m6: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=faces",
  m7: "https://images.unsplash.com/photo-1552058544-f2b08422138a?w=200&h=200&fit=crop&crop=faces",
  m8: "https://images.unsplash.com/photo-1610088441520-4352457e7095?w=200&h=200&fit=crop&crop=faces",
  m9: "https://images.unsplash.com/photo-1548544149-4835e62ee5b3?w=200&h=200&fit=crop&crop=faces",
  m10:"https://images.unsplash.com/photo-1583864697784-a0efc8379f70?w=200&h=200&fit=crop&crop=faces",
  m11:"https://images.unsplash.com/photo-1601456108021-fbdba97b9d47?w=200&h=200&fit=crop&crop=faces",
  m12:"https://images.unsplash.com/photo-1622555094100-5ae7bfe4a3b5?w=200&h=200&fit=crop&crop=faces"
} as const;

export const MOCK_CANTEEN_MEMBERS: Record<string, CanteenMember[]> = {
  cant_kitchen_uk: [
    {
      slug: "demo-mike-watson-drywall-manchester",
      displayName: "Mike Watson",
      tradeLabel: "Kitchen Fitter",
      city: "Manchester",
      avatarUrl: AV.m1,
      role: "admin",
      whatsapp: "447700900101",
      bioShort: "20 years fitting kitchens across the North West. Full-height carcass and handleless door specialist — Manchester based, covering all NW postcode areas. £45/hr day rate for trade, transparent fixed quotes for homeowners on request. Small dedicated team of two fitters plus one carpenter; every project has a named lead so you always know who's on site. Companies House registered with £5m Public Liability. 4.9 rating across 128 reviews. Available next week — usually reply within 2 hours during working hours.",
      memberOfCanteenSlugs: ["uk-kitchen-fitters", "north-uk-sparks"],
      postcodeArea: "M14",
      officeHours: "Mon–Fri · 8:00–17:00\nSat · 9:00–13:00\nSun · closed",
      showroom: {
        addressLine: "42 Trade Row",
        postcode: "M14 5AB"
      },
      verified: {
        companiesHouse: true,
        insuranceGbp: 5_000_000,
        trustScore: 87
      },
      availability: "Available next week",
      responseTime: "Usually replies in 2h",
      phone: "0161 555 0101",
      email: "mike@watson-kitchens.co.uk",
      socials: {
        instagram: "watsonkitchensmcr",
        facebook: "watsonkitchensmcr",
        tiktok: "watsonkitchensmcr",
        youtube: "@watsonkitchensmcr",
        x: "watsonkitchens",
        snapchat: "watsonkitchens",
        website: "watson-kitchens.co.uk"
      },
      reviews: { avg: 4.9, count: 128 },
      portfolioCount: 48,
      servicesOffered: [
        "Design",
        "Fitting service",
        "Refacing",
        "Kitchen spraying",
        "Worktop replacement",
        "Splashback fit",
        "Appliance install"
      ],
      // Mike Watson opted in to Trade Center routing — his product
      // quick-view + trending sheets show "Buy on Trade Center"
      // alongside WhatsApp for products that have a tradeCenterListingId.
      sendToTradeCenter: true
    },
    { slug: "demo-tom-fisher-kitchen-fitter-leeds", displayName: "Tom Fisher", tradeLabel: "Kitchen Fitter", city: "Leeds", avatarUrl: AV.m2, role: "moderator", whatsapp: "447700900102", bioShort: "Bespoke oak + walnut jobs. Full showroom fit-outs. West Yorks only.", memberOfCanteenSlugs: ["uk-kitchen-fitters"] },
    { slug: "demo-rachel-simms-kitchen-fitter-liverpool", displayName: "Rachel Simms", tradeLabel: "Kitchen Fitter", city: "Liverpool", avatarUrl: AV.m3, role: "member", whatsapp: "447700900103", bioShort: "Insurance jobs + landlord fit-outs. 3-day full-fit turnaround.", memberOfCanteenSlugs: ["uk-kitchen-fitters"] },
    { slug: "demo-craig-mcdermott-electrician-leeds", displayName: "Craig McDermott", tradeLabel: "Electrician", city: "Leeds", avatarUrl: AV.m4, role: "member", whatsapp: "447700900104", bioShort: "18th edition sparks. Kitchen circuit + island power specialist.", memberOfCanteenSlugs: ["uk-kitchen-fitters", "north-uk-sparks", "uk-rated-electricians"] },
    { slug: "demo-nick-brown-quartz-fitter-manchester", displayName: "Nick Brown", tradeLabel: "Quartz Fitter", city: "Manchester", avatarUrl: AV.m5, role: "member", whatsapp: "447700900105", bioShort: "48-hour quartz templating + fit. Trade-only pricing.", memberOfCanteenSlugs: ["uk-kitchen-fitters"] },
    { slug: "demo-alan-walsh-timber-merchant-birmingham", displayName: "Alan Walsh", tradeLabel: "Timber Merchant", city: "Birmingham", avatarUrl: AV.m6, role: "member", whatsapp: "447700900106", bioShort: "40 years selling worktops + carcass ply to fitters. Cut-to-size.", memberOfCanteenSlugs: ["uk-kitchen-fitters"] },
    { slug: "demo-james-holt-plumber-nottingham", displayName: "James Holt", tradeLabel: "Plumber", city: "Nottingham", avatarUrl: AV.m7, role: "member", whatsapp: null, bioShort: "Kitchen plumbing + boiler moves. Gas Safe #451189.", memberOfCanteenSlugs: ["uk-kitchen-fitters"] },
    { slug: "demo-sarah-yates-tiler-sheffield", displayName: "Sarah Yates", tradeLabel: "Tiler", city: "Sheffield", avatarUrl: AV.m8, role: "member", whatsapp: null, bioShort: "Splashbacks + full kitchen floors. Porcelain + natural stone.", memberOfCanteenSlugs: ["uk-kitchen-fitters"] },
    { slug: "demo-danny-lawson-joiner-hull", displayName: "Danny Lawson", tradeLabel: "Joiner", city: "Hull", avatarUrl: AV.m9, role: "member", whatsapp: null, bioShort: "Corner units + bespoke carcass work. Small workshop.", memberOfCanteenSlugs: ["uk-kitchen-fitters"] },
    { slug: "demo-anna-forde-decorator-preston", displayName: "Anna Forde", tradeLabel: "Decorator", city: "Preston", avatarUrl: AV.m10, role: "member", whatsapp: null, bioShort: "Kitchen paint + cabinet respray. Farrow & Ball colourist.", memberOfCanteenSlugs: ["uk-kitchen-fitters"] },
    { slug: "demo-kate-morris-plasterer-warrington", displayName: "Kate Morris", tradeLabel: "Plasterer", city: "Warrington", avatarUrl: AV.m11, role: "member", whatsapp: null, bioShort: "Skim + boarding for kitchen extensions. 15-year Reference.", memberOfCanteenSlugs: ["uk-kitchen-fitters"] },
    { slug: "demo-paul-webb-builder-bolton", displayName: "Paul Webb", tradeLabel: "Builder", city: "Bolton", avatarUrl: AV.m12, role: "member", whatsapp: null, bioShort: "Structural work + open-plan knock-throughs. RSJ specialist.", memberOfCanteenSlugs: ["uk-kitchen-fitters"] }
  ],
  cant_sparks_north: [
    { slug: "demo-craig-mcdermott-electrician-leeds", displayName: "Craig McDermott", tradeLabel: "Electrician", city: "Leeds", avatarUrl: AV.m4, role: "admin", whatsapp: "447700900104", bioShort: "18th edition sparks. Domestic + light commercial. NICEIC.", memberOfCanteenSlugs: ["north-uk-sparks", "uk-kitchen-fitters", "uk-rated-electricians"] },
    { slug: "demo-mike-watson-drywall-manchester", displayName: "Mike Watson", tradeLabel: "Electrician", city: "Manchester", avatarUrl: AV.m1, role: "member", whatsapp: "447700900101", bioShort: "Board changes + rewires. NW callouts.", memberOfCanteenSlugs: ["north-uk-sparks", "uk-kitchen-fitters"] }
  ],
  cant_electrician_rated: [
    {
      slug: "demo-craig-mcdermott-electrician-leeds",
      displayName: "Craig McDermott",
      tradeLabel: "Electrician",
      city: "Leeds",
      avatarUrl: AV.m4,
      role: "admin",
      whatsapp: "447700900104",
      bioShort: "18 years wiring homes and light-commercial units across Yorkshire. NICEIC + Certsure certified — every job leaves with a signed EIC or MWC. Domestic full rewires, EV charger installs, consumer-unit swaps, EICRs and fault-finding. £55/hr day rate for trade, transparent fixed quotes for homeowners. Two-man team plus one apprentice; every job has a named lead so you always know who's holding the meter. Companies House registered with £5m Public Liability. 4.8 rating across 96 verified reviews. Available this month — usually reply within 90 minutes during working hours.",
      memberOfCanteenSlugs: ["uk-rated-electricians", "north-uk-sparks", "uk-kitchen-fitters"],
      postcodeArea: "LS12",
      officeHours: "Mon–Fri · 7:30–17:30\nSat · 9:00–13:00\nSun · emergency callouts only",
      showroom: {
        addressLine: "18 Kirkstall Industrial Park",
        postcode: "LS12 4RD"
      },
      verified: {
        companiesHouse: true,
        insuranceGbp: 5_000_000,
        trustScore: 84
      },
      availability: "Available this month",
      responseTime: "Usually replies in 90m",
      phone: "0113 555 0104",
      email: "craig@mcdermott-electrical.co.uk",
      socials: {
        instagram: "mcdermott.sparks",
        facebook: "mcdermottelectrical",
        tiktok: "mcdermottsparks",
        youtube: "@mcdermottelectrical",
        x: "mcdermottsparks",
        website: "mcdermott-electrical.co.uk"
      },
      reviews: { avg: 4.8, count: 96 },
      portfolioCount: 34,
      servicesOffered: [
        "Full rewires",
        "EV charger install",
        "Consumer unit swap",
        "EICR + testing",
        "Fault-finding",
        "Kitchen circuits",
        "Outdoor lighting"
      ],
      sendToTradeCenter: true
    },
    { slug: "demo-terry-nolan-electrician-manchester", displayName: "Terry Nolan", tradeLabel: "Electrician", city: "Manchester", avatarUrl: AV.m7, role: "moderator", whatsapp: "447700900204", bioShort: "Industrial + commercial control panels. Machine wiring specialist.", memberOfCanteenSlugs: ["uk-rated-electricians"] },
    { slug: "demo-anna-forde-decorator-preston", displayName: "Anna Forde", tradeLabel: "Decorator", city: "Preston", avatarUrl: AV.m10, role: "member", whatsapp: null, bioShort: "Snag-list finishes after sparks jobs — patch, skim, repaint.", memberOfCanteenSlugs: ["uk-kitchen-fitters", "uk-rated-electricians"] },
    { slug: "demo-james-holt-plumber-nottingham", displayName: "James Holt", tradeLabel: "Plumber", city: "Nottingham", avatarUrl: AV.m7, role: "member", whatsapp: "447700900107", bioShort: "Wet-side installs paired with sparks work. Gas Safe #451189.", memberOfCanteenSlugs: ["uk-kitchen-fitters", "uk-rated-electricians", "uk-verified-plumbers"] },
    { slug: "demo-paul-webb-builder-bolton", displayName: "Paul Webb", tradeLabel: "Builder", city: "Bolton", avatarUrl: AV.m12, role: "member", whatsapp: null, bioShort: "Extension work — cuts chases + first-fixes for sparks partners.", memberOfCanteenSlugs: ["uk-kitchen-fitters", "uk-rated-electricians"] }
  ],
  cant_scaffolders: [
    { slug: "demo-jason-hardy-scaffolder-glasgow", displayName: "Jason Hardy", tradeLabel: "Scaffolder", city: "Glasgow", avatarUrl: AV.m9, role: "admin", whatsapp: "447700900109", bioShort: "System scaff + tube-and-fitting. Central belt.", memberOfCanteenSlugs: ["uk-scaffolders"] }
  ],
  cant_plumbers_verified: [
    {
      slug: "demo-james-holt-plumber-nottingham",
      displayName: "James Holt",
      tradeLabel: "Plumber",
      city: "Nottingham",
      avatarUrl: AV.m7,
      role: "admin",
      whatsapp: "447700900107",
      bioShort: "22 years plumbing + heating across the East Midlands. Gas Safe registered (#451189) — domestic + light commercial. Full bathroom refurbs, boiler installs (Worcester Bosch + Vaillant accredited), central heating design, powerflush, emergency callouts. £65/hr day rate for trade, transparent fixed quotes for homeowners. Three-man team plus one apprentice; every job has a named lead so you always know who's holding the spanners. Companies House registered with £5m Public Liability. 4.9 rating across 74 verified reviews. Available this month — usually reply within 60 minutes during working hours. Same-day emergency callouts within a 20-mile radius of Nottingham.",
      memberOfCanteenSlugs: ["uk-verified-plumbers", "uk-kitchen-fitters", "uk-rated-electricians"],
      postcodeArea: "NG7",
      officeHours: "Mon–Fri · 7:00–18:00\nSat · 8:00–14:00\nSun · emergency callouts only",
      showroom: {
        addressLine: "24 Beeston Trade Park",
        postcode: "NG9 2LH"
      },
      verified: {
        companiesHouse: true,
        insuranceGbp: 5_000_000,
        trustScore: 89
      },
      availability: "Available this month",
      responseTime: "Usually replies in 60m",
      phone: "0115 555 0107",
      email: "james@holt-plumbing.co.uk",
      socials: {
        instagram: "holtplumbing",
        facebook: "holtplumbingheating",
        tiktok: "holtplumbing",
        youtube: "@holtplumbingheating",
        x: "holtplumbing",
        website: "holt-plumbing.co.uk"
      },
      reviews: { avg: 4.9, count: 74 },
      portfolioCount: 42,
      servicesOffered: [
        "Boiler install",
        "Full bathroom refurb",
        "Central heating design",
        "Powerflush",
        "Radiator swap",
        "Leak repair",
        "Emergency callout"
      ],
      sendToTradeCenter: true
    },
    { slug: "demo-craig-mcdermott-electrician-leeds", displayName: "Craig McDermott", tradeLabel: "Electrician", city: "Leeds", avatarUrl: AV.m4, role: "moderator", whatsapp: "447700900104", bioShort: "Sparks + gas combo jobs. Kitchen circuits + first-fix rewires.", memberOfCanteenSlugs: ["uk-rated-electricians", "uk-verified-plumbers"] },
    { slug: "demo-sarah-yates-tiler-sheffield", displayName: "Sarah Yates", tradeLabel: "Tiler", city: "Sheffield", avatarUrl: AV.m8, role: "member", whatsapp: null, bioShort: "Bathroom + wet room tiling. Porcelain + natural stone.", memberOfCanteenSlugs: ["uk-kitchen-fitters", "uk-verified-plumbers"] },
    { slug: "demo-kate-morris-plasterer-warrington", displayName: "Kate Morris", tradeLabel: "Plasterer", city: "Warrington", avatarUrl: AV.m11, role: "member", whatsapp: null, bioShort: "Skim + boarding for bathroom refurbs + boiler moves.", memberOfCanteenSlugs: ["uk-kitchen-fitters", "uk-verified-plumbers"] },
    { slug: "demo-paul-webb-builder-bolton", displayName: "Paul Webb", tradeLabel: "Builder", city: "Bolton", avatarUrl: AV.m12, role: "member", whatsapp: null, bioShort: "Extensions + wet room builds. Coordinates with plumbing lead.", memberOfCanteenSlugs: ["uk-kitchen-fitters", "uk-rated-electricians", "uk-verified-plumbers"] }
  ],

  // ─── Phase 3 palette demo admin members (2026-07-15) ─────────
  // One admin per demo canteen so hostWhatsapp is truthy → Business
  // Card button + Enquire Now (Designs footer) + Contact us fallbacks
  // all render correctly. Mock whatsapp numbers are auto-substituted
  // with adminWhatsapp() at load time by demoSafeMember() in
  // canteens.server.ts — merchants never see the fake number.

  cant_carpenters_uk: [
    { slug: "demo-owen-thompson-carpenter-bristol", displayName: "Owen Thompson", tradeLabel: "Carpenter", city: "Bristol", avatarUrl: AV.m9, role: "admin", whatsapp: "447700900201", bioShort: "1st + 2nd fix carpenter across Bristol + Bath. Studs, joists, roof carcassing to skirting + architrave. Small team, direct-quote, no middlemen.", memberOfCanteenSlugs: ["uk-master-carpenters"], reviews: { avg: 4.8, count: 62 }, verified: { companiesHouse: true, insuranceGbp: 2_000_000, trustScore: 82 }, phone: "0117 555 0201", email: "owen@thompson-carpentry.co.uk", showroom: { addressLine: "12 Ashley Trade Yard", postcode: "BS5 6EE" } }
  ],
  cant_interior_designers_uk: [
    { slug: "demo-rebecca-ashworth-interior-designer-london", displayName: "Rebecca Ashworth", tradeLabel: "Interior Designer", city: "London", avatarUrl: AV.m3, role: "admin", whatsapp: "447700900202", bioShort: "Boutique residential interior design across London zones 1-4. Full colour schemes, sourcing, project management. Farrow & Ball colourist + BIID member.", memberOfCanteenSlugs: ["uk-interior-designers"], reviews: { avg: 4.9, count: 41 }, verified: { companiesHouse: true, insuranceGbp: 2_000_000, trustScore: 88 }, phone: "020 7555 0202", email: "rebecca@ashworth-interiors.co.uk", showroom: { addressLine: "8 Clerkenwell Studios", postcode: "EC1M 5RJ" } }
  ],
  cant_heritage_stone_uk: [
    { slug: "demo-david-whitmore-heritage-stone-bath", displayName: "David Whitmore", tradeLabel: "Heritage Stone Mason", city: "Bath", avatarUrl: AV.m6, role: "admin", whatsapp: "447700900203", bioShort: "Lime mortar + Bath stone restoration on Grade I/II listed buildings. NHTG-registered. 30 years across Cotswolds + South West heritage estates.", memberOfCanteenSlugs: ["uk-heritage-stone"], reviews: { avg: 4.9, count: 38 }, verified: { companiesHouse: true, insuranceGbp: 5_000_000, trustScore: 91 }, phone: "01225 555 203", email: "david@whitmore-heritage.co.uk", showroom: { addressLine: "Widcombe Yard", postcode: "BA2 4DL" } }
  ],
  cant_tile_roofers_uk: [
    { slug: "demo-gary-hughes-roofer-sheffield", displayName: "Gary Hughes", tradeLabel: "Roofer", city: "Sheffield", avatarUrl: AV.m4, role: "admin", whatsapp: "447700900204", bioShort: "Full re-roofs + heritage tile matching. Clay, concrete, natural slate. NFRC accredited. South Yorkshire + Peak District coverage.", memberOfCanteenSlugs: ["uk-tile-roofers"], reviews: { avg: 4.7, count: 89 }, verified: { companiesHouse: true, insuranceGbp: 5_000_000, trustScore: 85 }, phone: "0114 555 0204", email: "gary@hughes-roofing.co.uk", showroom: { addressLine: "Attercliffe Trade Estate", postcode: "S9 3EQ" } }
  ],
  cant_coppersmiths_uk: [
    { slug: "demo-nathan-barrett-coppersmith-birmingham", displayName: "Nathan Barrett", tradeLabel: "Coppersmith", city: "Birmingham", avatarUrl: AV.m9, role: "admin", whatsapp: "447700900205", bioShort: "Handmade copper + lead work. Roof covering, guttering, decorative flashings. Small workshop, direct-quote — no franchise pricing.", memberOfCanteenSlugs: ["uk-coppersmiths"], reviews: { avg: 4.8, count: 22 }, verified: { companiesHouse: true, insuranceGbp: 2_000_000, trustScore: 79 }, phone: "0121 555 0205", email: "nathan@barrett-coppersmith.co.uk", showroom: { addressLine: "Jewellery Quarter Workshop", postcode: "B18 6HH" } }
  ],
  cant_pool_builders_uk: [
    { slug: "demo-ben-callaghan-pool-builder-bournemouth", displayName: "Ben Callaghan", tradeLabel: "Pool Builder", city: "Bournemouth", avatarUrl: AV.m5, role: "admin", whatsapp: "447700900206", bioShort: "Fibreglass, gunite + plunge pools. Coastal spec + inland retrofits. SPATA member. South coast + New Forest coverage.", memberOfCanteenSlugs: ["uk-pool-builders"], reviews: { avg: 4.9, count: 34 }, verified: { companiesHouse: true, insuranceGbp: 5_000_000, trustScore: 87 }, phone: "01202 555 206", email: "ben@callaghan-pools.co.uk", showroom: { addressLine: "Poole Trade Park", postcode: "BH15 4AL" } }
  ],
  cant_landscapers_uk: [
    { slug: "demo-tom-ashfield-landscaper-cambridge", displayName: "Tom Ashfield", tradeLabel: "Landscaper", city: "Cambridge", avatarUrl: AV.m2, role: "admin", whatsapp: "447700900207", bioShort: "Turf, decking, boundaries, planting. Domestic gardens to estate grounds. APL member. Cambridgeshire + surrounding villages.", memberOfCanteenSlugs: ["uk-landscapers"], reviews: { avg: 4.8, count: 71 }, verified: { companiesHouse: true, insuranceGbp: 2_000_000, trustScore: 84 }, phone: "01223 555 207", email: "tom@ashfield-landscapes.co.uk", showroom: { addressLine: "Waterbeach Yard", postcode: "CB25 9NW" } }
  ],
  cant_garden_designers_uk: [
    { slug: "demo-charlotte-grantham-garden-designer-cotswolds", displayName: "Charlotte Grantham", tradeLabel: "Garden Designer", city: "Cotswolds", avatarUrl: AV.m3, role: "admin", whatsapp: "447700900208", bioShort: "Formal gardens, orangeries, sculpted hedges. SGD-registered. Cotswolds, Chilterns + Home Counties private estates.", memberOfCanteenSlugs: ["uk-garden-designers"], reviews: { avg: 4.9, count: 27 }, verified: { companiesHouse: true, insuranceGbp: 2_000_000, trustScore: 90 }, phone: "01608 555 208", email: "charlotte@grantham-gardens.co.uk", showroom: { addressLine: "Chipping Norton Studio", postcode: "OX7 5NN" } }
  ],
  cant_metal_fabricators_uk: [
    { slug: "demo-wayne-hartley-welder-sheffield", displayName: "Wayne Hartley", tradeLabel: "Welder / Fabricator", city: "Sheffield", avatarUrl: AV.m12, role: "admin", whatsapp: "447700900209", bioShort: "MIG, TIG, arc. Structural steel, bespoke gates, balustrades. Coded welder. Small workshop, quick turnaround.", memberOfCanteenSlugs: ["uk-metal-fabricators"], reviews: { avg: 4.7, count: 53 }, verified: { companiesHouse: true, insuranceGbp: 2_000_000, trustScore: 81 }, phone: "0114 555 0209", email: "wayne@hartley-fabrication.co.uk", showroom: { addressLine: "Neepsend Works", postcode: "S3 8QE" } }
  ],
  cant_architects_uk: [
    { slug: "demo-sarah-fenton-architect-london", displayName: "Sarah Fenton", tradeLabel: "Architect", city: "London", avatarUrl: AV.m3, role: "admin", whatsapp: "447700900210", bioShort: "RIBA-chartered. Planning, building regs, sensitive extensions + new-build. Residential focus, small practice, direct-lead architect on every job.", memberOfCanteenSlugs: ["uk-architects"], reviews: { avg: 4.9, count: 46 }, verified: { companiesHouse: true, insuranceGbp: 5_000_000, trustScore: 92 }, phone: "020 7555 0210", email: "sarah@fenton-architects.co.uk", showroom: { addressLine: "Old Street Studio", postcode: "EC1V 9BW" } }
  ],
  cant_concrete_specialists_uk: [
    { slug: "demo-marcus-reeves-concrete-manchester", displayName: "Marcus Reeves", tradeLabel: "Concrete Specialist", city: "Manchester", avatarUrl: AV.m4, role: "admin", whatsapp: "447700900211", bioShort: "Foundations, formwork, polished floors. Domestic to industrial concrete. CIOB member. Greater Manchester + North West.", memberOfCanteenSlugs: ["uk-concrete-specialists"], reviews: { avg: 4.7, count: 44 }, verified: { companiesHouse: true, insuranceGbp: 5_000_000, trustScore: 84 }, phone: "0161 555 0211", email: "marcus@reeves-concrete.co.uk", showroom: { addressLine: "Trafford Trade Park", postcode: "M17 1PA" } }
  ],
  cant_bricklayers_uk: [
    { slug: "demo-kevin-doherty-bricklayer-belfast", displayName: "Kevin Doherty", tradeLabel: "Bricklayer", city: "Belfast", avatarUrl: AV.m6, role: "admin", whatsapp: "447700900212", bioShort: "Coursed bond, cavity work, extensions + garden walls. 22 years across Belfast + Antrim. FMB member. Direct-quote, no franchise pricing.", memberOfCanteenSlugs: ["uk-bricklayers"], reviews: { avg: 4.8, count: 67 }, verified: { companiesHouse: true, insuranceGbp: 2_000_000, trustScore: 83 }, phone: "028 9555 0212", email: "kevin@doherty-brickwork.co.uk", showroom: { addressLine: "Sydenham Trade Yard", postcode: "BT3 9EJ" } }
  ],
  cant_plasterers_uk: [
    { slug: "demo-lucas-hensley-plasterer-bristol", displayName: "Lucas Hensley", tradeLabel: "Plasterer", city: "Bristol", avatarUrl: AV.m4, role: "admin", whatsapp: "447700900218", bioShort: "Skim + float finish, external K-Rend, lime restoration on listed jobs. 15 years across Bristol + Bath. Small crew, no subbies.", memberOfCanteenSlugs: ["uk-plasterers"], reviews: { avg: 4.8, count: 44 }, verified: { companiesHouse: true, insuranceGbp: 2_000_000, trustScore: 82 }, phone: "0117 555 0218", email: "lucas@hensley-plastering.co.uk", showroom: { addressLine: "St Philips Trade Yard", postcode: "BS2 0RA" } }
  ],
  cant_furniture_makers_uk: [
    { slug: "demo-harriet-blake-furniture-cotswolds", displayName: "Harriet Blake", tradeLabel: "Furniture Maker", city: "Cotswolds", avatarUrl: AV.m3, role: "admin", whatsapp: "447700900219", bioShort: "Commissioned tables, sideboards, and heirloom cabinetry. Cotswold workshop, English hardwood only, no MDF. Delivery UK-wide.", memberOfCanteenSlugs: ["uk-furniture-makers"], reviews: { avg: 4.9, count: 31 }, verified: { companiesHouse: true, insuranceGbp: 2_000_000, trustScore: 88 }, phone: "01608 555 219", email: "harriet@blake-furniture.co.uk", showroom: { addressLine: "Stow-on-the-Wold Workshop", postcode: "GL54 1AJ" } }
  ],
  cant_wood_carvers_uk: [
    { slug: "demo-callum-ford-carver-cornwall", displayName: "Callum Ford", tradeLabel: "Wood Carver", city: "Cornwall", avatarUrl: AV.m9, role: "admin", whatsapp: "447700900220", bioShort: "Relief panels, church restoration, sculptural commissions in native oak + walnut. Trained in Bavaria, based in Truro.", memberOfCanteenSlugs: ["uk-wood-carvers"], reviews: { avg: 4.9, count: 18 }, verified: { companiesHouse: true, insuranceGbp: 2_000_000, trustScore: 86 }, phone: "01872 555 220", email: "callum@fordcarving.co.uk", showroom: { addressLine: "Truro Studio", postcode: "TR1 3JQ" } }
  ],
  cant_wood_restorers_uk: [
    { slug: "demo-miles-warrington-restorer-bath", displayName: "Miles Warrington", tradeLabel: "Wood Restorer", city: "Bath", avatarUrl: AV.m12, role: "admin", whatsapp: "447700900221", bioShort: "Antique furniture repair, timber-frame conservation, reclaimed oak salvage. BAFRA-accredited. Bath + West Country listed-property specialist.", memberOfCanteenSlugs: ["uk-wood-restorers"], reviews: { avg: 4.9, count: 27 }, verified: { companiesHouse: true, insuranceGbp: 2_000_000, trustScore: 89 }, phone: "01225 555 221", email: "miles@warrington-restoration.co.uk", showroom: { addressLine: "Widcombe Workshop", postcode: "BA2 4DL" } }
  ],
  cant_wood_stainers_uk: [
    { slug: "demo-ryan-hollis-stainer-manchester", displayName: "Ryan Hollis", tradeLabel: "Wood Stainer", city: "Manchester", avatarUrl: AV.m6, role: "admin", whatsapp: "447700900222", bioShort: "Spray-booth finishing, hand-rubbed oils, French-polish revivals. Kitchen doors, furniture, floors. 12 years in Manchester.", memberOfCanteenSlugs: ["uk-wood-stainers"], reviews: { avg: 4.8, count: 23 }, verified: { companiesHouse: true, insuranceGbp: 2_000_000, trustScore: 84 }, phone: "0161 555 0222", email: "ryan@hollis-finishing.co.uk", showroom: { addressLine: "Ancoats Trade Estate", postcode: "M4 5HR" } }
  ],
  cant_tree_houses_uk: [
    { slug: "demo-rowan-ashcroft-tree-houses-devon", displayName: "Rowan Ashcroft", tradeLabel: "Tree House Builder", city: "Devon", avatarUrl: AV.m9, role: "admin", whatsapp: "447700900223", bioShort: "Bespoke treehouses — kids' hideaways to canopy cabins. Engineered on live-tree platforms with slings + limb-safe fasteners. Devon, Somerset, Dorset.", memberOfCanteenSlugs: ["uk-tree-house-builders"], reviews: { avg: 4.9, count: 29 }, verified: { companiesHouse: true, insuranceGbp: 5_000_000, trustScore: 89 }, phone: "01392 555 223", email: "rowan@ashcroft-treehouses.co.uk", showroom: { addressLine: "Dartmoor Workshop", postcode: "EX20 1PW" } }
  ],
  cant_water_features_uk: [
    { slug: "demo-tobias-marlow-water-features-bath", displayName: "Tobias Marlow", tradeLabel: "Water Feature Specialist", city: "Bath", avatarUrl: AV.m12, role: "admin", whatsapp: "447700900224", bioShort: "Bespoke water features — fountains, waterfall walls, natural-rock lagoon pools. Full design, plumb + fit. Bath, Cotswolds, Home Counties private estates.", memberOfCanteenSlugs: ["uk-water-feature-specialists"], reviews: { avg: 4.9, count: 21 }, verified: { companiesHouse: true, insuranceGbp: 5_000_000, trustScore: 88 }, phone: "01225 555 224", email: "tobias@marlow-water.co.uk", showroom: { addressLine: "Bathwick Studio", postcode: "BA2 4EL" } }
  ],
  cant_guttering_downpipes_uk: [
    { slug: "demo-dylan-reid-guttering-sheffield", displayName: "Dylan Reid", tradeLabel: "Guttering Specialist", city: "Sheffield", avatarUrl: AV.m6, role: "admin", whatsapp: "447700900225", bioShort: "Fascia + soffit + rainwater goods. Cast-iron replicas, modern uPVC, seamless aluminium. 14 years across Sheffield + South Yorkshire. Insurance-approved.", memberOfCanteenSlugs: ["uk-guttering-downpipes"], reviews: { avg: 4.8, count: 51 }, verified: { companiesHouse: true, insuranceGbp: 2_000_000, trustScore: 84 }, phone: "0114 555 0225", email: "dylan@reid-guttering.co.uk", showroom: { addressLine: "Attercliffe Trade Yard", postcode: "S9 3HG" } }
  ],
  cant_copper_flashing_uk: [
    { slug: "demo-wilf-adair-copper-flashing-york", displayName: "Wilf Adair", tradeLabel: "Copper Flashing Specialist", city: "York", avatarUrl: AV.m9, role: "admin", whatsapp: "447700900226", bioShort: "Copper flashings, dormers, decorative hoppers. Listed-building + prestige property specialist. Yorkshire + North of England, 20 years bench-formed sheet copper.", memberOfCanteenSlugs: ["uk-copper-flashing-specialists"], reviews: { avg: 4.9, count: 34 }, verified: { companiesHouse: true, insuranceGbp: 5_000_000, trustScore: 90 }, phone: "01904 555 226", email: "wilf@adair-copperwork.co.uk", showroom: { addressLine: "Layerthorpe Workshop", postcode: "YO31 7UW" } }
  ],
  cant_canopies_uk: [
    { slug: "demo-aidan-frost-canopy-cheshire", displayName: "Aidan Frost", tradeLabel: "Canopy Specialist", city: "Cheshire", avatarUrl: AV.m4, role: "admin", whatsapp: "447700900227", bioShort: "Bespoke oak-frame canopies — door porches, verandas, car canopies. Shop-made in Cheshire, delivered + installed UK-wide. Green-oak, air-dried, hand-cut mortise-and-tenon joinery.", memberOfCanteenSlugs: ["uk-canopy-specialists"], reviews: { avg: 4.9, count: 26 }, verified: { companiesHouse: true, insuranceGbp: 2_000_000, trustScore: 87 }, phone: "01565 555 227", email: "aidan@frost-canopies.co.uk", showroom: { addressLine: "Knutsford Workshop", postcode: "WA16 9AR" } }
  ],
  cant_bespoke_joiners_uk: [
    { slug: "demo-edward-halliwell-joiner-yorkshire", displayName: "Edward Halliwell", tradeLabel: "Bespoke Joiner", city: "Yorkshire", avatarUrl: AV.m9, role: "admin", whatsapp: "447700900213", bioShort: "Workshop-made staircases, sash windows, bespoke doors. 30 years bench joinery in North Yorkshire. Heritage + modern work.", memberOfCanteenSlugs: ["uk-bespoke-joiners"], reviews: { avg: 4.9, count: 51 }, verified: { companiesHouse: true, insuranceGbp: 2_000_000, trustScore: 88 }, phone: "01423 555 213", email: "edward@halliwell-joinery.co.uk", showroom: { addressLine: "Harrogate Workshop", postcode: "HG3 1PY" } }
  ],
  cant_prestige_builders_uk: [
    { slug: "demo-julian-hartley-prestige-builder-surrey", displayName: "Julian Hartley", tradeLabel: "Prestige Builder", city: "Surrey", avatarUrl: AV.m12, role: "admin", whatsapp: "447700900214", bioShort: "Full-house refurbs, basement digs, heritage conversions. Surrey → Kensington. £500k+ projects, single point of contact throughout.", memberOfCanteenSlugs: ["uk-prestige-builders"], reviews: { avg: 4.9, count: 19 }, verified: { companiesHouse: true, insuranceGbp: 10_000_000, trustScore: 94 }, phone: "01483 555 214", email: "julian@hartley-prestige.co.uk", showroom: { addressLine: "Guildford Trade Centre", postcode: "GU1 3JB" } }
  ],
  cant_marina_builders_uk: [
    { slug: "demo-alistair-ferguson-marina-southampton", displayName: "Alistair Ferguson", tradeLabel: "Marina Builder", city: "Southampton", avatarUrl: AV.m9, role: "admin", whatsapp: "447700900215", bioShort: "Pontoons, sea walls, decking. Southampton, Poole, Portsmouth marinas. Marine-grade materials, tide-window scheduling.", memberOfCanteenSlugs: ["uk-marina-builders"], reviews: { avg: 4.8, count: 14 }, verified: { companiesHouse: true, insuranceGbp: 5_000_000, trustScore: 86 }, phone: "023 8055 0215", email: "alistair@ferguson-marine.co.uk", showroom: { addressLine: "Ocean Village Workshop", postcode: "SO14 3TL" } }
  ],
  cant_emergency_repairs_uk: [
    { slug: "demo-frank-delaney-emergency-newcastle", displayName: "Frank Delaney", tradeLabel: "Emergency Repair", city: "Newcastle", avatarUrl: AV.m4, role: "admin", whatsapp: "447700900216", bioShort: "Storm damage, burst pipes, fallen trees. 24-hour insurance-approved response across Newcastle + Tyneside. Coded roofer + plumber on call.", memberOfCanteenSlugs: ["uk-emergency-repairs"], reviews: { avg: 4.8, count: 36 }, verified: { companiesHouse: true, insuranceGbp: 5_000_000, trustScore: 83 }, phone: "0191 555 0216", email: "frank@delaney-emergency.co.uk", showroom: { addressLine: "Team Valley Yard", postcode: "NE11 0PZ" } }
  ],
  cant_groundworkers_uk: [
    { slug: "demo-barry-rollins-groundworker-liverpool", displayName: "Barry Rollins", tradeLabel: "Groundworker", city: "Liverpool", avatarUrl: AV.m6, role: "admin", whatsapp: "447700900217", bioShort: "Digs, drainage, foundations. Everything under the ground floor slab. 18 years across Merseyside + Cheshire. Domestic to light commercial.", memberOfCanteenSlugs: ["uk-groundworkers"], reviews: { avg: 4.7, count: 58 }, verified: { companiesHouse: true, insuranceGbp: 5_000_000, trustScore: 82 }, phone: "0151 555 0217", email: "barry@rollins-groundworks.co.uk", showroom: { addressLine: "Speke Trade Estate", postcode: "L24 8QB" } }
  ]
};

export function membersForCanteen(canteenId: string): CanteenMember[] {
  return MOCK_CANTEEN_MEMBERS[canteenId] ?? [];
}

export function adminForCanteen(canteenId: string): CanteenMember | null {
  const list = membersForCanteen(canteenId);
  return list.find((m) => m.role === "admin") ?? null;
}

// ─── Helpers ──────────────────────────────────────────────

export function canteensForTrade(tradeSlug: string): Canteen[] {
  return MOCK_CANTEENS.filter((c) => c.tradeSlug === tradeSlug);
}

export function canteenBySlug(slug: string): Canteen | null {
  return MOCK_CANTEENS.find((c) => c.slug === slug) ?? null;
}

/** DEPRECATED — kept for legacy callers. The Counter is one platform
 *  -wide feed; use `platformSideLane()` for new code. */
export function sideLaneForCanteen(_canteenId: string): SideLanePost[] {
  return platformSideLane();
}

/** The Counter is a single flowing feed shown on every canteen page,
 *  regardless of which canteen the user is viewing. Every trade on the
 *  platform sees the same content — this is what makes marketplace
 *  posts reach across the whole network instead of being siloed per
 *  canteen. Sorted by engagement so hot posts float up. */
export function platformSideLane(canteenTradeSlug?: string): SideLanePost[] {
  const now = new Date();
  const isBoostActive = (p: SideLanePost): boolean => {
    if (!p.boost) return false;
    if (new Date(p.boost.expiresAt) <= now) return false;
    if (!p.boost.targetTradeSlugs || p.boost.targetTradeSlugs.length === 0) return true;
    return canteenTradeSlug ? p.boost.targetTradeSlugs.includes(canteenTradeSlug) : true;
  };
  return MOCK_SIDE_LANE_POSTS
    .filter((p) => p.state === "live" || p.state === "sold")
    .sort((a, b) => {
      // Active sponsored boosts float to the top, sorted by amount paid.
      const aBoost = isBoostActive(a);
      const bBoost = isBoostActive(b);
      if (aBoost && !bBoost) return -1;
      if (!aBoost && bBoost) return 1;
      if (aBoost && bBoost) return b.boost!.paidGbp - a.boost!.paidGbp;
      return b.clicksTrailing7d - a.clicksTrailing7d;
    });
}

// ─── Canteen products (host's showcase) ──────────────────

export type CanteenProduct = {
  id: string;
  canteenId: string;
  /** The listing slug of the seller (the canteen host). */
  hostSlug: string;
  /** Customer-facing reference code — e.g. "K527" for Mike Watson's
   *  kitchen product #527. Same purpose as CanteenDesign.ref: lets
   *  the merchant instantly know which product a buyer is asking
   *  about ("we have your K527 pulled up"). Shown in the product
   *  card top-left and in the panel header when the product is
   *  focused. Optional so legacy rows keep rendering. */
  ref?: string;
  name: string;
  imageUrl: string;
  /** Extra shots for the product-focus view gallery. */
  galleryUrls?: string[];
  /** Product videos — 60s max each, tier-gated. Uploaded through the
   *  Video app. Empty / absent for the vast majority of products. */
  videoUrls?: string[];
  priceGbp: number;
  currency?: "GBP" | "EUR" | "USD" | "AUD" | "CAD";
  /** Short one-line description shown under the name in the panel. */
  blurb: string;
  /** Full details rendered on the product-focus view. */
  description: string;
  /** Bullet list of specs / what's in the box. */
  specs?: readonly string[];
  /** True when the same SKU is listed on Trade Center — the product-
   *  focus view then shows a "Buy on Trade Center" CTA + syncs stock. */
  tradeCenterListingId?: string;
  /** If bulk-buy is enabled: the target unit count that unlocks the
   *  discounted price. Members can "commit" and the discount applies
   *  when the target is reached. */
  bulkBuy?: {
    committedCount: number;
    targetCount: number;
    discountedPriceGbp: number;
  };
  /** Optional — when true, host is pinning this to the featured strip.
   *  Panel shows only featured products; a "View all" link expands the
   *  full catalogue. */
  featured?: boolean;
  /** Sponsored placement — mirrors the `SideLanePost.boost` shape.
   *  Boosting a canteen product creates a matching sponsored Counter
   *  listing that floats to the top of every canteen page (or every
   *  canteen matching `targetTradeSlugs` if set). Billed via the Pro
   *  Stripe subscription flow as an add-on. */
  boost?: {
    expiresAt: string;
    targetTradeSlugs?: readonly string[];
    paidGbp: number;
  };
  // ─── Per-surface visibility flags ────────────────────────
  // "Upload once, flow to 3 surfaces" model. Each surface has its own
  // flag so a merchant can (for example) show a product on Trade Center
  // but hide it from the trending swipe sheet. Defaults are all true so
  // existing rows behave unchanged. Trade Center visibility is
  // additionally gated by the merchant-wide `sendToTradeCenter` master
  // switch on their member profile.
  /** Product renders in the canteen Products tab. Default true. */
  showInCanteenProducts?: boolean;
  /** Product is eligible for the trending swipe sheet on the canteen
   *  mobile app. Default true. */
  showInTrending?: boolean;
  /** Product is listed on Trade Center. Requires merchant
   *  `sendToTradeCenter = true` AND `tradeCenterListingId` set. Default
   *  true (harmless without the other two). */
  showInTradeCenter?: boolean;
  /** Optional variants — sizes, colors, or both. When absent the
   *  product is a single SKU. When present, the buyer picks a variant
   *  before the WhatsApp / Trade Center action is composed. */
  variants?: CanteenProductVariants;
  /** Commerce metadata: brand, year, condition, country of origin,
   *  warranty, shipping (local + international per-country), multi-buy
   *  discount ladders, and optional trade-specific spec blocks. */
  commerce?: CanteenProductCommerce;
  /** Product category slug from src/lib/productCategories.ts. Drives
   *  the per-category "aspects" schema shown in the editor + the
   *  faceted filter surface on Trade Center browse. */
  categorySlug?: string;
  /** Per-category aspect values (key → string|number). Renders as the
   *  "Item specifics" block on the buyer PDP + powers filters. */
  categoryAspects?: Record<string, string | number>;
};

/** eBay-compatible condition ladder — the extra levels (new-other,
 *  certified-refurbished, seller-refurbished, for-parts) matter for
 *  trade goods where condition drives price and buyer expectations. */
export type CanteenProductCondition =
  | "new"
  | "new-other"
  | "certified-refurbished"
  | "seller-refurbished"
  | "used"
  | "for-parts";

export type CanteenProductCommerce = {
  brand?: string;
  /** Model / part number as printed by the manufacturer. Not the same
   *  as MPN — this is the friendly name (e.g. "Greenstar 30i"). */
  model?: string;
  /** Manufacturer Part Number — the industrial code (e.g. "7716701164"). */
  mpn?: string;
  /** GTIN — EAN-13 / UPC-12 / ISBN. Enables product-catalog matching
   *  and cross-marketplace SEO. */
  gtin?: string;
  yearMade?: number;
  /** Extended eBay-style condition ladder — more granular than the old
   *  new/used/refurbished triple. */
  condition?: CanteenProductCondition;
  /** Free-text detail for used/refurbished — mirrors eBay's
   *  ConditionDescription field. */
  conditionDescription?: string;
  /** Two-letter ISO country code, e.g. "GB", "IE", "IT". */
  countryOfOrigin?: string;
  /** Free-text warranty description e.g. "12 months manufacturer". */
  warranty?: string;
  /** Physical dimensions — feeds shipping calculators + PDP display. */
  weightKg?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  /** Dispatch time in working days. Feeds the "Order in next X for
   *  dispatch today" surface. 0 = same-day. */
  dispatchDays?: number;
  /** Return policy block. */
  returns?: {
    accepted: boolean;
    windowDays?: 14 | 30 | 60;
    /** Who pays for the return shipping. */
    paidBy?: "buyer" | "seller";
    /** Restocking fee percent — 0-25. */
    restockingFeePercent?: number;
  };
  /** Compatibility fitment — free-form pairs like "Boiler: Worcester
   *  Greenstar 30i" or "Consumer unit: Wylex NM806L". Powers "fits X"
   *  buyer-side filter. */
  compatibility?: { label: string; value: string }[];
  /** Age restriction — buyer must confirm. Rare but needed for
   *  chemicals, blades, some paints. */
  ageRestriction?: 16 | 18 | null;
  shipping?: {
    /** When true, local delivery is included in the product price. */
    freeLocalShipping?: boolean;
    /** Cost for local shipping in GBP. Ignored if freeLocalShipping. */
    localShippingGbp?: number;
    /** Master switch for the international-rates block. */
    shipsInternationally?: boolean;
    /** Per-country rates. Buyer picks their country → we quote. */
    internationalRates?: { country: string; priceGbp: number }[];
  };
  multiBuy?: {
    enabled: boolean;
    /** Two mutually exclusive discount models:
     *    tiered   — merchant sets absolute unit prices per qty tier
     *    additive — 2nd unit gets X off, 3rd+ gets Y additional off */
    model: "tiered" | "additive";
    tiers?: { qty: number; unitPriceGbp: number }[];
    additive?: {
      secondUnitDiscountGbp: number;
      thirdPlusUnitDiscountGbp: number;
    };
    /** Whether one delivery charge covers the whole multi-buy order
     *  or each unit gets its own delivery charge (bulky items). */
    deliveryModel: "single" | "per-item";
  };
  /** Electrical spec block — merchant opt-in. Free-text so we don't
   *  gate on a schema for a fast-moving product landscape. */
  electrical?: {
    voltage?: string;
    wattage?: string;
    amps?: string;
    plugType?: string;
    certification?: string;
  };
};

export type CanteenSizePreset =
  | "uk_shoes"
  | "eu_shoes"
  | "uk_clothes"
  | "us_clothes"
  | "numeric"
  | "trade_length"
  | "custom";

export type CanteenProductVariants = {
  axis: "size" | "color" | "size_color";
  sizePreset?: CanteenSizePreset;
  /** The available size labels for this product. Merchant-editable. */
  sizeOptions?: string[];
  /** Colors offered — name is required, hex swatch is optional. */
  colorOptions?: { name: string; hex?: string }[];
  /** Per-combination overrides. Key is:
   *    axis="size"        → the size label ("M", "L", "10")
   *    axis="color"       → the color name ("Ivory Mist")
   *    axis="size_color"  → `${size}|${color}` ("M|Ivory Mist")
   *  Any missing field on an override falls back to the product-level
   *  value. Empty overrides object = no per-variant customisation
   *  (product-level price / image / SKU applies to every combo). */
  overrides?: Record<string, VariantOverride>;
};

export type VariantOverride = {
  sku?: string;
  imageUrl?: string;
  priceGbp?: number;
  /** Stock count — 0 = out of stock, undefined = "not tracking". */
  stock?: number;
  mpn?: string;
  gtin?: string;
};

/** Compute every combo key for the given variants shape. Order is
 *  deterministic (size first, then color) so the editor can render
 *  rows in a predictable order. */
export function comboKeysForVariants(v: CanteenProductVariants): string[] {
  const sizes = v.sizeOptions ?? [];
  const colors = (v.colorOptions ?? []).map((c) => c.name);
  if (v.axis === "size") return sizes;
  if (v.axis === "color") return colors;
  const out: string[] = [];
  for (const s of sizes) {
    for (const c of colors) out.push(`${s}|${c}`);
  }
  return out;
}

/** Human label for a combo key. `size_color` splits back to "M · Ivory Mist". */
export function labelForComboKey(axis: CanteenProductVariants["axis"], key: string): string {
  if (axis !== "size_color") return key;
  const [size, color] = key.split("|");
  return `${size} · ${color}`;
}

/** Preset templates so the merchant can pick "UK clothes" and get
 *  S/M/L/XL/XXL without typing. Custom preset means "I'll type my own". */
export const SIZE_PRESETS: Record<CanteenSizePreset, string[]> = {
  uk_shoes:     ["6", "7", "8", "9", "10", "11", "12"],
  eu_shoes:     ["39", "40", "41", "42", "43", "44", "45", "46"],
  uk_clothes:   ["XS", "S", "M", "L", "XL", "XXL"],
  us_clothes:   ["XS", "S", "M", "L", "XL", "XXL"],
  numeric:      ["30", "32", "34", "36", "38"],
  trade_length: ["1m", "2m", "2.4m", "3m", "4m"],
  custom:       []
};

/** Boost plan taxonomy — offered from the Manage Dashboard when the
 *  host taps "Boost". Every plan is billed via the Pro Stripe flow as
 *  a one-off add-on; no separate payment processor. */
export const CANTEEN_BOOST_PLANS: ReadonlyArray<{
  id: string;
  label: string;
  days: number;
  priceGbp: number;
  reach: "all-canteens" | "target-trades";
}> = [
  { id: "boost-7d",   label: "7-day boost",   days: 7,  priceGbp: 15,  reach: "target-trades" },
  { id: "boost-30d",  label: "30-day boost",  days: 30, priceGbp: 45,  reach: "target-trades" },
  { id: "boost-90d",  label: "90-day boost",  days: 90, priceGbp: 120, reach: "all-canteens" }
];

export const MOCK_CANTEEN_PRODUCTS: CanteenProduct[] = [
  {
    id: "prod_oak_worktop_40mm",
    ref: "K101",
    canteenId: "cant_kitchen_uk",
    hostSlug: "demo-mike-watson-drywall-manchester",
    name: "Solid Oak Worktop 40mm",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2009_20_03%20PM.png",
    priceGbp: 120,
    blurb: "Cut to size, oiled, delivered NW · £120/lm",
    description: "40mm solid European oak worktops, kiln-dried and pre-finished with Osmo. Any length up to 4m in one piece. Free NW delivery on orders over £400. Cut and edge-treated to your dimensions before dispatch.",
    specs: [
      "40mm depth · any width up to 900mm",
      "Osmo Polyx-Oil applied both sides",
      "Cut-outs available for hobs & sinks (add £15)",
      "48-hour turnaround on cuts",
      "Free NW delivery over £400"
    ],
    tradeCenterListingId: "prod_oak_worktop_40mm",
    featured: true
  },
  {
    id: "prod_shaker_doors",
    ref: "K102",
    canteenId: "cant_kitchen_uk",
    hostSlug: "demo-mike-watson-drywall-manchester",
    name: "Shaker Cabinet Doors · Pack of 3",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2009_21_27%20PM.png",
    priceGbp: 120,
    blurb: "White painted MDF · £120/pack",
    description: "Classic shaker profile in tulipwood-veneer MDF, primed and top-coated in Dulux Trade satinwood. Three doors per pack in any of five standard sizes.",
    specs: [
      "22mm MDF core · tulipwood veneer",
      "5-panel shaker profile · 40mm rails",
      "Available in white, cream, sage, navy",
      "Hinges pre-drilled to Blum spec",
      "Made to order · 7-day lead time"
    ],
    tradeCenterListingId: "prod_shaker_doors",
    featured: true
  },
  {
    id: "prod_pantry_carcasses",
    ref: "K103",
    canteenId: "cant_kitchen_uk",
    hostSlug: "demo-mike-watson-drywall-manchester",
    name: "Prefab Pantry Carcasses",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2009_22_21%20PM.png",
    priceGbp: 199,
    blurb: "Pack of 3 · 2000×600×580 · £199",
    description: "Pre-assembled tall pantry carcasses. Adjustable shelves + solid back panel. Ships flat-packed with dowels for on-site final assembly (about 8 minutes each).",
    specs: [
      "H2000 × W600 × D580mm",
      "18mm birch ply carcass",
      "5 adjustable shelves + fixed base",
      "Blum runners pre-drilled",
      "Pack of 3 · trade price only"
    ],
    tradeCenterListingId: "prod_pantry_carcasses",
    featured: true,
    bulkBuy: {
      committedCount: 3,
      targetCount: 5,
      discountedPriceGbp: 175
    }
  },
  {
    id: "prod_brass_handles",
    ref: "K104",
    canteenId: "cant_kitchen_uk",
    hostSlug: "demo-mike-watson-drywall-manchester",
    name: "Brushed Brass Handles",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2009_24_55%20PM.png",
    priceGbp: 6,
    blurb: "From £6 trade · pull + knob sets",
    description: "Solid brushed-brass handles and knobs. Threaded stainless bolts included. Fashion-neutral brass tone that goes with cream, sage or dark wood.",
    specs: [
      "Solid brass · brushed satin finish",
      "128mm & 160mm pulls, 32mm knobs",
      "M4 bolts + spacers included",
      "Sold individually or box of 20"
    ],
    featured: true
  },
  {
    id: "prod_quartz_offcuts",
    ref: "K105",
    canteenId: "cant_kitchen_uk",
    hostSlug: "demo-mike-watson-drywall-manchester",
    name: "Quartz Offcuts · Assorted",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2009_29_23%20PM.png",
    priceGbp: 40,
    blurb: "Splash-back pieces · £40+",
    description: "End-of-project quartz offcuts. Great for splash-backs, sills and small vanities. Sizes and colours change weekly — first come first served.",
    featured: true
  },
  {
    id: "prod_undermount_sink",
    ref: "K106",
    canteenId: "cant_kitchen_uk",
    hostSlug: "demo-mike-watson-drywall-manchester",
    name: "Undermount Stainless Sink 1.5 bowl",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2009_28_11%20PM.png",
    priceGbp: 165,
    blurb: "3mm deck · pre-drilled overflow",
    description: "1.5-bowl undermount stainless with sound-deadening. 3mm deck, pre-drilled overflow, all-in fixings included. Fits standard 800mm cabinets.",
    featured: false
  },
  {
    id: "prod_extractor_hood",
    ref: "K107",
    canteenId: "cant_kitchen_uk",
    hostSlug: "demo-mike-watson-drywall-manchester",
    name: "Angled Chimney Extractor 90cm",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2009_30_26%20PM.png",
    priceGbp: 249,
    blurb: "780m³/h · touch controls",
    description: "Modern angled glass extractor, 780m³/h airflow, 3-speed touch controls, LED, carbon filters swappable. Class-A energy.",
    featured: false
  },
  {
    id: "prod_belfast_sink",
    ref: "K108",
    canteenId: "cant_kitchen_uk",
    hostSlug: "demo-mike-watson-drywall-manchester",
    name: "Belfast Ceramic Sink 600mm",
    imageUrl: "https://images.unsplash.com/photo-1600607686527-6fb886090705?w=400&h=400&fit=crop",
    priceGbp: 180,
    blurb: "Fireclay · scratch resistant",
    description: "Classic 600mm fireclay Belfast sink, scratch- and stain-resistant glaze. Weir overflow to code. Ideal for shaker + country kitchens.",
    featured: false
  },
  {
    id: "prod_brass_taps",
    ref: "K109",
    canteenId: "cant_kitchen_uk",
    hostSlug: "demo-mike-watson-drywall-manchester",
    name: "Solid Brass Bridge Mixer Tap",
    imageUrl: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&h=400&fit=crop",
    priceGbp: 145,
    blurb: "Brushed brass · WRAS approved",
    description: "Solid brass bridge mixer in a brushed brass finish, WRAS approved, ceramic disc cartridges, 5-year guarantee.",
    featured: false
  },
  {
    id: "prod_soft_close_bin",
    ref: "K110",
    canteenId: "cant_kitchen_uk",
    hostSlug: "demo-mike-watson-drywall-manchester",
    name: "Pull-out Soft-close Bin · Twin",
    imageUrl: "https://images.unsplash.com/photo-1616627052131-9d3f6f0f7d1c?w=400&h=400&fit=crop",
    priceGbp: 89,
    blurb: "40L · fits 600mm cabinet",
    description: "Twin 20L bin unit, soft-close runners, hand-free foot pedal. Fits any 600mm base cabinet. Cover included.",
    featured: false
  },
  {
    id: "prod_island_lights",
    ref: "K111",
    canteenId: "cant_kitchen_uk",
    hostSlug: "demo-mike-watson-drywall-manchester",
    name: "Kitchen Island Pendant · Pack of 3",
    imageUrl: "https://images.unsplash.com/photo-1556909013-2ea78b906f60?w=400&h=400&fit=crop",
    priceGbp: 220,
    blurb: "Brushed brass · dimmable LED",
    description: "3× brushed-brass dome pendants with dimmable warm-white LED. 1.5m cord adjustable. Perfect trio for a 3m island.",
    featured: false
  },
  {
    id: "prod_cutting_boards",
    ref: "K112",
    canteenId: "cant_kitchen_uk",
    hostSlug: "demo-mike-watson-drywall-manchester",
    name: "End-grain Oak Cutting Board",
    imageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=400&fit=crop",
    priceGbp: 55,
    blurb: "Handmade · Osmo oiled",
    description: "End-grain oak block cutting board, 40 × 30 × 4cm. Osmo-oiled and finished by hand. Every board unique. Local NW milled oak.",
    featured: false
  },

  // ─── Craig McDermott · UK Rated Electricians · 15 services ───
  //
  // Electrician trade doesn't sell physical products the same way a
  // kitchen fitter does — his "shop" is his services. Modelled as
  // CanteenProduct so both surfaces (canteen product panel + Trade
  // Center browse) pick them up automatically via browseAllProducts()
  // and productsForCanteen(). UK 2026 typical trade rates. Images are
  // interim placeholders reused from the trending map + feed post
  // library; Philip will provide dedicated per-service artwork.
  {
    id: "svc_elec_eicr",
    ref: "E01",
    canteenId: "cant_electrician_rated",
    hostSlug: "demo-craig-mcdermott-electrician-leeds",
    name: "EICR · Electrical Installation Condition Report",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2001_41_39%20AM.png",
    priceGbp: 180,
    currency: "GBP",
    blurb: "Up to 3-bed · certificate issued same day · £180 fixed",
    description: "Full periodic Electrical Installation Condition Report to BS 7671:2018 Amendment 2. Covers every accessible circuit, RCD test, insulation resistance, earth continuity. Landlord-ready with signed EIC + schedule of results emailed same day. Fixed price for properties up to 3 bedrooms; larger properties quoted on request.",
    specs: [
      "BS 7671:2018 Amendment 2 compliant",
      "Same-day signed certificate + schedule",
      "Landlord + mortgage lender accepted",
      "1 remedial retest included free within 30 days",
      "Fixed price for up to 3 bedrooms"
    ],
    featured: true
  },
  {
    id: "svc_elec_consumer_unit",
    ref: "E02",
    canteenId: "cant_electrician_rated",
    hostSlug: "demo-craig-mcdermott-electrician-leeds",
    name: "Consumer Unit (Fuse Box) Replacement",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2012_05_53%20AM.png",
    priceGbp: 550,
    currency: "GBP",
    blurb: "Supply & fit · Wylex/Hager/Fusebox · from £550",
    description: "Full replacement of old fuse board / consumer unit with modern 18th-edition compliant board. Includes 10-way RCBO board (Wylex, Hager or Fusebox brand), main switch, SPD, all labour, testing, EIC certificate and BC notification. 2-year workmanship warranty.",
    specs: [
      "10-way RCBO consumer unit (SPD included)",
      "Main switch + surge protection",
      "All 3rd-party BC notification handled",
      "Signed EIC + minor works cert",
      "2-year workmanship warranty"
    ],
    featured: true
  },
  {
    id: "svc_elec_rewire",
    ref: "E03",
    canteenId: "cant_electrician_rated",
    hostSlug: "demo-craig-mcdermott-electrician-leeds",
    name: "Full House Rewire · 3-bed semi",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2001_23_54%20AM.png",
    priceGbp: 4200,
    currency: "GBP",
    blurb: "First + second fix · from £4,200",
    description: "Complete rewire — first fix (chasing, cabling, back boxes) + second fix (accessories, testing, sign-off). Includes new consumer unit, all sockets and lighting circuits, smoke alarms Grade D2, and full BC notification. 3-bed semi baseline; larger properties quoted on visit.",
    specs: [
      "Baseline covers 3-bed semi (approx 90-110sqm)",
      "New consumer unit + smoke alarms included",
      "Chases + patch to make-good (not skim)",
      "Full BS 7671 test + EIC certificate",
      "Typical duration: 5-7 working days"
    ],
    featured: true
  },
  {
    id: "svc_elec_ev_charger",
    ref: "E04",
    canteenId: "cant_electrician_rated",
    hostSlug: "demo-craig-mcdermott-electrician-leeds",
    name: "EV Charger Install · 7kW",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2011_29_45%20PM.png",
    priceGbp: 950,
    currency: "GBP",
    blurb: "Zappi or Ohme · £950 supply & fit",
    description: "7kW smart EV charger installation. Choose Zappi 2.1 (tethered or untethered) or Ohme Home Pro. Includes DNO notification, RCD Type A + earth rod (if required), 5m cable run standard, and OZEV grant paperwork if eligible. Longer cable runs quoted on visit.",
    specs: [
      "Choice of Zappi 2.1 or Ohme Home Pro",
      "DNO application handled end-to-end",
      "5m cable run included (extra @ £8/m)",
      "Earth rod install if TT required (no extra)",
      "3-year warranty on parts + labour"
    ],
    featured: true
  },
  {
    id: "svc_elec_socket_extra",
    ref: "E05",
    canteenId: "cant_electrician_rated",
    hostSlug: "demo-craig-mcdermott-electrician-leeds",
    name: "Additional Socket Installation",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2012_08_09%20AM.png",
    priceGbp: 85,
    currency: "GBP",
    blurb: "Labour + accessory · £85 per socket",
    description: "Add a single or double socket spurred off an existing ring. Includes surface or flush box, MK Logic Plus or LAP branded accessory (choose finish), chase + patch, testing. Price per socket; multi-socket jobs quoted at discount on visit.",
    specs: [
      "Choice of white/chrome/brushed steel finish",
      "MK Logic Plus or LAP branded accessory",
      "Chase + patch (not decorative make-good)",
      "MWC (Minor Works Cert) issued on completion",
      "USB-C variant +£20"
    ],
    featured: false
  },
  {
    id: "svc_elec_led_downlights",
    ref: "E06",
    canteenId: "cant_electrician_rated",
    hostSlug: "demo-craig-mcdermott-electrician-leeds",
    name: "LED Downlight Installation",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2012_14_15%20AM.png",
    priceGbp: 75,
    currency: "GBP",
    blurb: "Supply & fit · £75 per fire-rated downlight",
    description: "Fire-rated (60/90 min) IP65 LED downlights, 6W dimmable, in white / brushed steel / chrome. Includes labour, testing, and safe disposal of old halogen fittings. Chandelier and pendant swaps quoted separately.",
    specs: [
      "Aurora / Ansell / Kosnic brand",
      "Fire-rated 60/90 min + IP65",
      "6W dimmable · 3000K warm white",
      "Choice of white / brushed steel / chrome",
      "Compatible with LED trailing-edge dimmers"
    ],
    featured: false
  },
  {
    id: "svc_elec_extractor_fan",
    ref: "E07",
    canteenId: "cant_electrician_rated",
    hostSlug: "demo-craig-mcdermott-electrician-leeds",
    name: "Bathroom Extractor Fan · Supply & Fit",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2012_08_09%20AM.png",
    priceGbp: 180,
    currency: "GBP",
    blurb: "Manrose Quiet Fan · £180 supply & fit",
    description: "Manrose Quiet 100T timer-controlled extractor fan (or equivalent Silavent / Xpelair). Includes core drill through external wall, cabling from lighting circuit with fused spur, and test. Humidistat option +£40.",
    specs: [
      "Manrose Quiet 100T (26 dB)",
      "Core drill through external wall included",
      "Timer overrun standard (humidistat +£40)",
      "External louvre grille supplied",
      "Certificate issued on completion"
    ],
    featured: false
  },
  {
    id: "svc_elec_outdoor_socket",
    ref: "E08",
    canteenId: "cant_electrician_rated",
    hostSlug: "demo-craig-mcdermott-electrician-leeds",
    name: "Outdoor Socket · IP66 + RCD",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2001_23_54%20AM.png",
    priceGbp: 180,
    currency: "GBP",
    blurb: "Weatherproof · RCD-protected · £180 supply & fit",
    description: "IP66 weatherproof outdoor socket with integrated 30mA RCD, mounted on a garage/exterior wall and spurred from an internal circuit. Includes drilling, brick sealing, and full test. Twin socket variant +£30.",
    specs: [
      "IP66 rated (rain, snow, dust)",
      "Integrated 30mA RCD (Type A)",
      "Metal-clad or plastic finish choice",
      "Twin socket variant +£30",
      "MWC issued"
    ],
    featured: false
  },
  {
    id: "svc_elec_kitchen_circuit",
    ref: "E09",
    canteenId: "cant_electrician_rated",
    hostSlug: "demo-craig-mcdermott-electrician-leeds",
    name: "Kitchen Circuit Installation",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2001_23_54%20AM.png",
    priceGbp: 320,
    currency: "GBP",
    blurb: "Dedicated ring + spurs · labour only · £320",
    description: "New dedicated 32A kitchen ring main + fused spurs for oven, hob and hood. Labour + testing only — you or your kitchen fitter supplies accessories. Ideal for kitchen renovations. Cooker isolator +£45 if required.",
    specs: [
      "32A dedicated ring main",
      "Fused spurs for oven/hob/hood",
      "Labour + test only (accessories BYO)",
      "Cooker isolator +£45",
      "Coordinates with kitchen fitter timeline"
    ],
    featured: false
  },
  {
    id: "svc_elec_shower",
    ref: "E10",
    canteenId: "cant_electrician_rated",
    hostSlug: "demo-craig-mcdermott-electrician-leeds",
    name: "Electric Shower Installation · 9.5kW",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2012_05_53%20AM.png",
    priceGbp: 420,
    currency: "GBP",
    blurb: "Mira / Triton · supply & fit · £420",
    description: "9.5kW electric shower supply & fit — Mira Sprint Multi-fit or Triton T80 Easi-fit. Includes dedicated 40A circuit from consumer unit, pull-cord isolator, and pipework connection. 8.5kW variant available for weaker supplies (from £380).",
    specs: [
      "Mira Sprint or Triton T80",
      "Dedicated 40A shower circuit",
      "Ceiling-mount pull-cord isolator",
      "8.5kW variant -£40",
      "MWC + product warranty"
    ],
    featured: false
  },
  {
    id: "svc_elec_fault_finding",
    ref: "E11",
    canteenId: "cant_electrician_rated",
    hostSlug: "demo-craig-mcdermott-electrician-leeds",
    name: "Fault Finding & Repair",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2011_33_31%20PM.png",
    priceGbp: 75,
    currency: "GBP",
    blurb: "Tripping RCDs, dead circuits, buzzing sockets · £75/hr",
    description: "Diagnose and repair intermittent faults, tripping RCDs, dead circuits, buzzing accessories. £75 per hour, 1-hour minimum. Most faults resolved in the first hour. Full test + certificate issued if a circuit is worked on.",
    specs: [
      "£75/hr · 1-hour minimum",
      "Insulation resistance + earth continuity tests",
      "MWC issued if a circuit is altered",
      "Same-day callout in Leeds/Bradford (Mon-Fri)",
      "Written report on complex faults"
    ],
    featured: false
  },
  {
    id: "svc_elec_smoke_alarm",
    ref: "E12",
    canteenId: "cant_electrician_rated",
    hostSlug: "demo-craig-mcdermott-electrician-leeds",
    name: "Smoke Alarm · Grade D2 hardwired",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2001_41_39%20AM.png",
    priceGbp: 75,
    currency: "GBP",
    blurb: "Aico Ei3016 · interlinked · £75 per alarm supply & fit",
    description: "Aico Ei3016 (or equivalent) BS 5839-6 Grade D2 hardwired smoke alarm with 10-year rechargeable back-up. Wireless interlink between alarms included. Landlord-compliant install. Heat alarm variant for kitchens same price.",
    specs: [
      "Aico Ei3016 Grade D2 hardwired",
      "10-year sealed lithium back-up",
      "Wireless interlink (SmartLINK) included",
      "Heat alarm variant available for kitchens",
      "Landlord + Building Reg compliant"
    ],
    featured: false
  },
  {
    id: "svc_elec_cctv",
    ref: "E13",
    canteenId: "cant_electrician_rated",
    hostSlug: "demo-craig-mcdermott-electrician-leeds",
    name: "CCTV System · 4 Camera HD",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2001_41_39%20AM.png",
    priceGbp: 850,
    currency: "GBP",
    blurb: "Hikvision / Reolink · 4-camera · £850 supply & fit",
    description: "4-camera HD CCTV system — Hikvision ColorVu or Reolink RLC-810A cameras, 4-channel NVR with 2TB storage, remote app viewing, and PoE cabling. Covers driveway, front door, side and rear. Additional cameras +£140 each.",
    specs: [
      "Hikvision ColorVu or Reolink 8MP cameras",
      "4-channel NVR + 2TB HDD",
      "Free remote viewing app (iOS + Android)",
      "PoE single-cable install",
      "Additional cameras +£140 each"
    ],
    featured: true
  },
  {
    id: "svc_elec_intruder_alarm",
    ref: "E14",
    canteenId: "cant_electrician_rated",
    hostSlug: "demo-craig-mcdermott-electrician-leeds",
    name: "Intruder Alarm · Wireless 6-zone",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2001_23_54%20AM.png",
    priceGbp: 480,
    currency: "GBP",
    blurb: "Yale / Texecom · wireless · £480 supply & fit",
    description: "Wireless 6-zone intruder alarm — Yale Sync or Texecom Ricochet. Includes external sounder, keypad, 4 PIR sensors, 2 door contacts, and app control. Grade 2 rated for insurance discount eligibility. Cellular signalling module +£120.",
    specs: [
      "Yale Sync Smart or Texecom Ricochet",
      "External sounder + tamper-proof siren",
      "4 PIR sensors + 2 door contacts",
      "Smartphone app arm/disarm",
      "Cellular signalling module +£120"
    ],
    featured: false
  },
  {
    id: "svc_elec_powered_gate",
    ref: "E15",
    canteenId: "cant_electrician_rated",
    hostSlug: "demo-craig-mcdermott-electrician-leeds",
    name: "Powered Gate · Single leaf",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2011_29_45%20PM.png",
    priceGbp: 2800,
    currency: "GBP",
    blurb: "Sliding or swing · £2,800 supply & fit",
    description: "Single-leaf powered driveway gate — sliding or swing, up to 4m width. Includes motor + control board (BFT / Came / Nice), photocells, remote fobs, and mains supply from consumer unit. Safety edge required for BS EN 12453 compliance (+£180). Larger / double-leaf gates quoted on visit.",
    specs: [
      "BFT / Came / Nice motor",
      "2 remote fobs + wall-mount keypad",
      "Photocells (obstruction detection)",
      "Safety edge for BS EN 12453 compliance +£180",
      "12-month warranty on parts + labour"
    ],
    featured: false
  },

  // ─── James Holt · UK Verified Plumbers · 15 services ───
  //
  // Slate-palette reference canteen. UK 2026 typical plumber trade
  // rates. Images are interim placeholders reused from the trending
  // map + hero library; Philip will provide dedicated per-service
  // artwork. First 5 marked featured (cap = 5 per canteen).
  {
    id: "svc_plumb_boiler_combi",
    ref: "P01",
    canteenId: "cant_plumbers_verified",
    hostSlug: "demo-james-holt-plumber-nottingham",
    name: "Boiler Install · 30kW Combi",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2002_03_04%20PM.png",
    priceGbp: 2200,
    currency: "GBP",
    blurb: "Worcester or Vaillant · supply & fit · from £2,200",
    description: "30kW combi boiler installation — Worcester Bosch 4000 or Vaillant ecoTec Plus. Includes flue, filter, magnetic system filter, thermostat (Nest or Hive compatible), all pipework, powerflush if required, and full Gas Safe commissioning. 10-year manufacturer warranty. Suits 3-4 bed homes with 1-2 bathrooms. Larger homes / system boilers quoted on visit.",
    specs: [
      "Worcester 4000 or Vaillant ecoTec Plus",
      "Magnetic system filter included",
      "Nest / Hive thermostat compatible",
      "10-year manufacturer warranty",
      "Gas Safe commissioning + Benchmark cert"
    ],
    featured: true
  },
  {
    id: "svc_plumb_bathroom_refurb",
    ref: "P02",
    canteenId: "cant_plumbers_verified",
    hostSlug: "demo-james-holt-plumber-nottingham",
    name: "Full Bathroom Refurb",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2012_05_53%20AM.png",
    priceGbp: 3500,
    currency: "GBP",
    blurb: "Strip out, plumb in, tile · from £3,500 labour",
    description: "Full bathroom strip and refit — remove old suite, rework plumbing, install new bath / shower / toilet / basin / vanity, tile walls + floor (materials extra), fit accessories. Labour + plumbing consumables included. Suite + tiles supplied by you or ordered on your behalf at trade rates. Typical duration 5-8 working days. Wet-room and ensuite conversions quoted on visit.",
    specs: [
      "Strip out + waste removal included",
      "Full re-pipe if needed (copper or plastic)",
      "Bath + shower + toilet + basin fit",
      "Wall + floor tiling (materials extra)",
      "5-8 working days typical"
    ],
    featured: true
  },
  {
    id: "svc_plumb_central_heating",
    ref: "P03",
    canteenId: "cant_plumbers_verified",
    hostSlug: "demo-james-holt-plumber-nottingham",
    name: "Central Heating Install · Full System",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2001_41_39%20AM.png",
    priceGbp: 4800,
    currency: "GBP",
    blurb: "New boiler + rads + pipework · from £4,800",
    description: "Complete central heating installation — boiler (combi or system), radiators sized to each room, all pipework in copper or plastic, thermostatic valves, programmer, magnetic filter, and full commissioning. Suits new builds, extensions, or homes converting from electric to gas. 3-bed baseline; larger properties quoted on visit. Includes Building Control notification + 10-year warranty.",
    specs: [
      "Boiler + up to 10 radiators (baseline)",
      "TRVs on every rad",
      "Nest / Hive smart programmer",
      "Building Control notification handled",
      "10-year system warranty"
    ],
    featured: true
  },
  {
    id: "svc_plumb_powerflush",
    ref: "P04",
    canteenId: "cant_plumbers_verified",
    hostSlug: "demo-james-holt-plumber-nottingham",
    name: "Powerflush · Central Heating",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2012_05_53%20AM.png",
    priceGbp: 450,
    currency: "GBP",
    blurb: "Full system flush · £450 fixed",
    description: "Powerflush removes years of black sludge, rust, and limescale build-up from your central heating system. Restores boiler efficiency, fixes cold-spot radiators, and cuts running costs. Uses Kamco CF90 pump + Fernox chemical. Includes X100 inhibitor top-up after flush. Fixed price for up to 10 radiators; larger systems +£30 per additional radiator.",
    specs: [
      "Kamco CF90 industrial powerflush pump",
      "Fernox DS-40 restorer + X100 inhibitor",
      "Up to 10 radiators included",
      "Additional rads +£30 each",
      "Boiler warranty preserved"
    ],
    featured: true
  },
  {
    id: "svc_plumb_leak_repair",
    ref: "P05",
    canteenId: "cant_plumbers_verified",
    hostSlug: "demo-james-holt-plumber-nottingham",
    name: "Leak Repair · Domestic",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2012_05_53%20AM.png",
    priceGbp: 120,
    currency: "GBP",
    blurb: "Detect + fix · £120 labour · 1hr min",
    description: "Diagnose and repair water leaks — pipework, radiator valves, toilet cisterns, tap connections, waste seals. £120 per hour with 1-hour minimum. Most straightforward leaks resolved in the first hour. If leak requires wall / floor access, quoted separately based on scope.",
    specs: [
      "£120/hr with 1-hour minimum",
      "Same-day callout in Nottingham (Mon-Fri)",
      "Insurance-ready written report if requested",
      "Wall access work quoted separately",
      "All standard consumables included"
    ],
    featured: true
  },
  {
    id: "svc_plumb_radiator_swap",
    ref: "P06",
    canteenId: "cant_plumbers_verified",
    hostSlug: "demo-james-holt-plumber-nottingham",
    name: "Radiator Swap",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2001_23_54%20AM.png",
    priceGbp: 180,
    currency: "GBP",
    blurb: "Old out, new in · £180 labour per rad",
    description: "Direct-swap radiator replacement — remove old, install new, refit valves (or upgrade to TRVs +£25 per pair), balance, and refill. Labour per radiator; you supply the radiator or we source at trade prices. Ideal for updating single rooms, kitchen refurbs, or replacing corroded units.",
    specs: [
      "Labour per radiator (BYO or trade-source)",
      "TRV upgrade +£25 per pair",
      "System balance + inhibitor top-up included",
      "Sludge check + flush recommendation",
      "Old radiator disposed of at no extra"
    ],
    featured: false
  },
  {
    id: "svc_plumb_toilet_install",
    ref: "P07",
    canteenId: "cant_plumbers_verified",
    hostSlug: "demo-james-holt-plumber-nottingham",
    name: "Toilet Installation",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2002_03_04%20PM.png",
    priceGbp: 250,
    currency: "GBP",
    blurb: "Supply & fit · from £250",
    description: "New WC install — close-coupled or back-to-wall unit. Includes labour, isolator valve, flexi connectors, wax seal, silicone finish, and disposal of old. Choose Roca / Ideal Standard / Vitra at trade rates or supply your own. Concealed cistern install (into wall / behind panel) quoted on visit.",
    specs: [
      "Close-coupled or back-to-wall",
      "Roca / Ideal Standard / Vitra trade rate",
      "Isolator + flexi connectors included",
      "Old WC disposal included",
      "Concealed cistern +£150"
    ],
    featured: false
  },
  {
    id: "svc_plumb_kitchen_tap",
    ref: "P08",
    canteenId: "cant_plumbers_verified",
    hostSlug: "demo-james-holt-plumber-nottingham",
    name: "Kitchen Tap Install",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2002_01_34%20PM.png",
    priceGbp: 120,
    currency: "GBP",
    blurb: "Supply & fit · £120",
    description: "Kitchen mixer tap install — labour, isolator valves, flexi connectors, silicone finish, and old tap removal. Fits standard 35mm sink holes. Boiling water taps (Quooker / Fohën) install +£120 due to under-sink tank + power feed. Undermount tap in stone worktops quoted on visit.",
    specs: [
      "Mono block or twin-lever mixer",
      "Isolator + flexi connectors",
      "Boiling water tap +£120",
      "Undermount stone install quoted separately",
      "12-month workmanship warranty"
    ],
    featured: false
  },
  {
    id: "svc_plumb_water_softener",
    ref: "P09",
    canteenId: "cant_plumbers_verified",
    hostSlug: "demo-james-holt-plumber-nottingham",
    name: "Water Softener Install",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2001_23_54%20AM.png",
    priceGbp: 550,
    currency: "GBP",
    blurb: "Harvey / Kinetico · supply & fit · £550",
    description: "Whole-house water softener — Harvey HV3 or Kinetico Premier compact. Includes bypass valve, all fittings, salt starter pack, and commissioning. Ideal for hard-water areas (Midlands + South England). Reduces limescale in kettles / showers / boilers by 90%+. Retrofit-friendly — fits under most kitchen sinks.",
    specs: [
      "Harvey HV3 or Kinetico Premier",
      "Bypass valve (retain hard tap for drinking)",
      "Salt starter pack included",
      "Reduces limescale ~90%",
      "5-year manufacturer warranty"
    ],
    featured: false
  },
  {
    id: "svc_plumb_boiler_service",
    ref: "P10",
    canteenId: "cant_plumbers_verified",
    hostSlug: "demo-james-holt-plumber-nottingham",
    name: "Boiler Service · Annual",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2002_03_04%20PM.png",
    priceGbp: 95,
    currency: "GBP",
    blurb: "Full service + Gas Safe cert · £95 fixed",
    description: "Annual boiler service to Gas Safe standard. Includes flue-gas analysis, combustion check, seal inspection, safety-shut-off test, and written report. Keeps manufacturer warranty valid. Landlord Gas Safety Record (CP12) same visit +£40.",
    specs: [
      "Gas Safe accredited engineer",
      "Flue-gas analyser check",
      "Written service report",
      "Warranty preservation",
      "Landlord CP12 +£40"
    ],
    featured: false
  },
  {
    id: "svc_plumb_immersion",
    ref: "P11",
    canteenId: "cant_plumbers_verified",
    hostSlug: "demo-james-holt-plumber-nottingham",
    name: "Immersion Heater Replace",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2001_23_54%20AM.png",
    priceGbp: 280,
    currency: "GBP",
    blurb: "Element swap · supply & fit · £280",
    description: "Immersion heater element replacement — drain cylinder, remove old element, fit new (3kW standard, dual-element available), refill and test. Includes new gasket + thermostat. Suits copper cylinders (unvented systems quoted separately). Same-day callout available.",
    specs: [
      "3kW standard element (dual +£40)",
      "New thermostat + gasket included",
      "Cylinder drain + refill",
      "Suits copper vented cylinders",
      "Unvented systems quoted separately"
    ],
    featured: false
  },
  {
    id: "svc_plumb_drain_unblock",
    ref: "P12",
    canteenId: "cant_plumbers_verified",
    hostSlug: "demo-james-holt-plumber-nottingham",
    name: "Drain Unblock",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2012_05_53%20AM.png",
    priceGbp: 150,
    currency: "GBP",
    blurb: "Rod + jet · £150 fixed",
    description: "Blocked drain clearance — internal (sink / shower / toilet) or external (gully / manhole). Uses drain rods + high-pressure jetting where needed. Fixed price for straightforward blockages; camera survey +£75 if root ingress or collapsed pipe suspected. Emergency callouts within 60 minutes in Nottingham.",
    specs: [
      "Drain rods + jetting",
      "Internal or external blockages",
      "Camera survey +£75",
      "Emergency response 60 min",
      "No-clear-no-fee policy"
    ],
    featured: false
  },
  {
    id: "svc_plumb_outdoor_tap",
    ref: "P13",
    canteenId: "cant_plumbers_verified",
    hostSlug: "demo-james-holt-plumber-nottingham",
    name: "Outdoor Tap · Frost-proof",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2002_01_34%20PM.png",
    priceGbp: 180,
    currency: "GBP",
    blurb: "Frost-proof · supply & fit · £180",
    description: "Outdoor garden tap install — frost-proof (double-check valve required by Water Regs) with dedicated internal isolator. Includes core-drill through external wall, silicone seal, and test. Perfect for gardens, car washing, garden offices with kitchen. Standpipe / long-run installs +£40.",
    specs: [
      "Frost-proof outdoor tap",
      "Double-check valve (Water Regs)",
      "Internal isolator for winter shut-off",
      "Core-drill through cavity wall included",
      "Long-run install +£40"
    ],
    featured: false
  },
  {
    id: "svc_plumb_ensuite",
    ref: "P14",
    canteenId: "cant_plumbers_verified",
    hostSlug: "demo-james-holt-plumber-nottingham",
    name: "Ensuite Install",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2012_05_53%20AM.png",
    priceGbp: 5800,
    currency: "GBP",
    blurb: "Full build + fit · from £5,800",
    description: "New ensuite install into a bedroom — bathroom pod build, waste + supply pipework routing, shower cubicle (1000×800mm), WC, basin + vanity, floor drain, extractor, and tile finish. Coordinates with builder for stud walls + door. Baseline price for a 4-6m² pod; larger or bespoke layouts quoted on visit.",
    specs: [
      "1000×800 shower cubicle",
      "WC + basin + vanity",
      "Extractor fan (100mm ducted)",
      "Tiled walls + floor",
      "5-10 working days typical"
    ],
    featured: false
  },
  {
    id: "svc_plumb_emergency",
    ref: "P15",
    canteenId: "cant_plumbers_verified",
    hostSlug: "demo-james-holt-plumber-nottingham",
    name: "Emergency Callout",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2012_05_53%20AM.png",
    priceGbp: 95,
    currency: "GBP",
    blurb: "24/7 within 20mi of Nottingham · £95 callout",
    description: "24/7 emergency plumbing callout within 20 miles of Nottingham. Burst pipe, no heating, no hot water, uncontained leak, gas smell (gas leaks: call National Gas Emergency Service on 0800 111 999 FIRST, then us). £95 callout fee + £75/hr labour (1hr minimum). Out-of-hours (10pm-6am, weekends, bank holidays) +£40 callout surcharge.",
    specs: [
      "£95 callout + £75/hr labour (1hr min)",
      "24/7 response within 20 mi of Nottingham",
      "Out-of-hours +£40 surcharge",
      "Common parts van-stocked",
      "Follow-up quote for permanent fix"
    ],
    featured: false
  }
];

export function productsForCanteen(canteenId: string, opts?: { featuredOnly?: boolean }): CanteenProduct[] {
  return MOCK_CANTEEN_PRODUCTS.filter((p) => p.canteenId === canteenId && (opts?.featuredOnly ? p.featured : true));
}

export function canteenProductById(id: string): CanteenProduct | null {
  return MOCK_CANTEEN_PRODUCTS.find((p) => p.id === id) ?? null;
}

// ─── Designs ─────────────────────────────────────────────
//
// Merchant portfolio designs — kitchens for a kitchen fitter,
// bathrooms for a bathroom fitter, etc. Rendered on the Designs tab of
// the canteen mobile app. Customers quote the `ref` when they enquire
// so the merchant knows exactly which design the message is about.

export type CanteenDesign = {
  id: string;
  canteenId: string;
  /** Customer-facing reference code — e.g. "DS-101". Merchant-editable
   *  so their filing / WhatsApp language matches ("we have your DS-101
   *  pulled up"). Unique per canteen. */
  ref: string;
  name: string;
  tagline: string | null;
  description: string | null;
  style: string | null;
  imageUrl: string;
  /** Up to 3 additional shots for the modal thumb gallery. */
  galleryUrls: string[];
  sortOrder: number;
  createdAt: string;
};

export const MOCK_CANTEEN_DESIGNS: CanteenDesign[] = [];

export function designsForCanteen(canteenId: string): CanteenDesign[] {
  return MOCK_CANTEEN_DESIGNS
    .filter((d) => d.canteenId === canteenId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Enriched product row used by the Trade Center browse grid. Joins
 *  the raw product with host + trade metadata so every card can render
 *  the merchant chip, trade tag, and canonical canteen link without a
 *  second lookup on the client. */
export type BrowseProductRow = {
  product: CanteenProduct;
  hostSlug: string;
  hostDisplayName: string;
  canteenSlug: string;
  tradeSlug: string;
  tradeLabel: string;
  /** Absolute pathname buyers land on (canteen product-focus with
   *  `from=trade-center` return pill). */
  href: string;
  /** True when the product's boost window is currently active. */
  isBoosted: boolean;
  /** Host's aggregate rating strip — used by product cards for
   *  browse-time trust density. Null when the host hasn't reached
   *  5 reviews (zero-rating protection per lib/reviews.ts). */
  hostRating: { avg: number; count: number } | null;
};

export type BrowseSort = "boosted" | "price-asc" | "price-desc" | "newest";

export function browseAllProducts(opts?: {
  tradeSlug?: string;
  sort?: BrowseSort;
  q?: string;
}): BrowseProductRow[] {
  const nowMs = Date.now();
  const rows: BrowseProductRow[] = [];
  for (const product of MOCK_CANTEEN_PRODUCTS) {
    const canteen = MOCK_CANTEENS.find((c) => c.id === product.canteenId);
    if (!canteen) continue;
    if (opts?.tradeSlug && canteen.tradeSlug !== opts.tradeSlug) continue;
    if (opts?.q) {
      const needle = opts.q.toLowerCase();
      const hay = `${product.name} ${product.blurb ?? ""} ${product.description ?? ""}`.toLowerCase();
      if (!hay.includes(needle)) continue;
    }
    const isBoosted = !!product.boost && Date.parse(product.boost.expiresAt) > nowMs;
    // Look up the host member in this canteen's members list — the
    // reviews aggregate lives on CanteenMember. Zero-rating protection
    // (< 5 reviews): return null so the card doesn't render a chip.
    const hostMember = MOCK_CANTEEN_MEMBERS[canteen.id]?.find(
      (m) => m.slug === canteen.hostSlug
    );
    const hostRating =
      hostMember?.reviews && hostMember.reviews.count >= 5
        ? { avg: hostMember.reviews.avg, count: hostMember.reviews.count }
        : null;
    rows.push({
      product,
      hostSlug: canteen.hostSlug,
      hostDisplayName: canteen.hostDisplayName,
      canteenSlug: canteen.slug,
      tradeSlug: canteen.tradeSlug,
      tradeLabel: canteen.tradeLabel,
      href: `/trade-off/yard/canteens/${canteen.slug}?focus=${encodeURIComponent(product.id)}&from=trade-center`,
      isBoosted,
      hostRating
    });
  }
  const sort = opts?.sort ?? "boosted";
  if (sort === "price-asc") rows.sort((a, b) => a.product.priceGbp - b.product.priceGbp);
  else if (sort === "price-desc") rows.sort((a, b) => b.product.priceGbp - a.product.priceGbp);
  else if (sort === "newest") rows.reverse();
  // "boosted" default: boosted first, then original order.
  else rows.sort((a, b) => Number(b.isBoosted) - Number(a.isBoosted));
  return rows;
}

/** Distinct trade rows across every product-hosting canteen — used by
 *  the browse filter chip strip. */
export function browseTradeFacets(): Array<{ slug: string; label: string; count: number }> {
  const counts = new Map<string, { label: string; count: number }>();
  for (const product of MOCK_CANTEEN_PRODUCTS) {
    const canteen = MOCK_CANTEENS.find((c) => c.id === product.canteenId);
    if (!canteen) continue;
    const existing = counts.get(canteen.tradeSlug);
    if (existing) existing.count += 1;
    else counts.set(canteen.tradeSlug, { label: canteen.tradeLabel, count: 1 });
  }
  return Array.from(counts.entries())
    .map(([slug, v]) => ({ slug, label: v.label, count: v.count }))
    .sort((a, b) => b.count - a.count);
}

/** Returns the slug of the first canteen a merchant hosts. Used by
 *  reviews-page and leave-a-review-page back links so buyers who came
 *  from a canteen return to that canteen, not to a raw /trade/{slug}
 *  route that may 404 for mock merchants. Multi-canteen hosts
 *  currently pick the first entry — extend when we ship a proper
 *  "which canteen did they come from" query param. */
export function canteenHostedByMerchant(merchantSlug: string): string | null {
  const canteen = MOCK_CANTEENS.find((c) => c.hostSlug === merchantSlug);
  return canteen?.slug ?? null;
}

/** Returns the banner image URL from the first canteen a merchant
 *  hosts. Used by the merchant reviews page to render the same hero
 *  banner as the canteen page + profile focus — the three surfaces
 *  read as one cohesive brand for the merchant. */
export function canteenBannerForMerchant(merchantSlug: string): string | null {
  const canteen = MOCK_CANTEENS.find((c) => c.hostSlug === merchantSlug);
  return canteen?.headerBgUrl ?? null;
}

/** Product routing is canonicalised through the host's canteen. A
 *  product click anywhere on the platform (Trade Center browse,
 *  merchant profile shop, Yard product-mention embed, deep link) lands
 *  on `/trade-off/yard/canteens/{hostCanteenSlug}?focus={productId}` —
 *  the canteen renders CanteenProductFocus with the community rail on
 *  the right. This means:
 *   1. One product-detail surface across the whole platform (no PDP
 *      drift between Trade Center and canteen).
 *   2. Every product click delivers traffic to the merchant's canteen,
 *      giving hosts a reason to invest in the community.
 *   3. Merchants without an actively-hosted canteen still get an
 *      auto-provisioned shell canteen so the routing convention holds.
 */
export function productToCanteenLink(
  productId: string,
  from?: keyof typeof RETURN_ORIGINS
): string | null {
  const product = canteenProductById(productId);
  if (!product) return null;
  const canteen = MOCK_CANTEENS.find((c) => c.id === product.canteenId);
  if (!canteen) return null;
  const base = `/trade-off/yard/canteens/${canteen.slug}?focus=${encodeURIComponent(productId)}`;
  return from ? `${base}&from=${from}` : base;
}

/** Origin-slug → back-pill config. When `CanteenPageShell` sees
 *  `?from=<slug>` in the URL, it looks the slug up here to build the
 *  sticky "Back to X" pill on top of `CanteenProductFocus`. Add a new
 *  entry when a new inbound surface routes into the canteen. */
export const RETURN_ORIGINS = {
  "trade-center": {
    href: "/trade-off/trade-center",
    label: "Trade Center"
  },
  "yard": {
    href: "/trade-off/yard",
    label: "The Yard"
  },
  "warehouse": {
    href: "/trade-off/warehouse",
    label: "The Warehouse"
  }
} as const;
export type ReturnOriginSlug = keyof typeof RETURN_ORIGINS;

/** Post-count target for the free-topic-app perk: 50 posts × 3 months
 *  (quality-weighted, 3+ reactions count double — enforced at count-time
 *  when we cut the DB migration). */
export const CANTEEN_ACTIVITY_TARGET = { postsPerMonth: 50, months: 3 };
