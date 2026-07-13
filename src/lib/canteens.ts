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
    name: "UK Kitchen Fitters",
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
    isFounding100: true
  },
  {
    id: "cant_sparks_north",
    slug: "north-uk-sparks",
    name: "North UK Sparks",
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
    id: "cant_scaffolders",
    slug: "uk-scaffolders",
    name: "UK Scaffolders",
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
  }
];

// Placeholder product photos — reused across the seed. Real listings
// carry their own image on the DB record.
const IMG = {
  worktop:   "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop",
  kitchen:   "https://images.unsplash.com/photo-1556909013-2ea78b906f60?w=400&h=400&fit=crop",
  tools:     "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=400&h=400&fit=crop",
  paint:     "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=400&h=400&fit=crop",
  bricks:    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=400&fit=crop",
  cabinets:  "https://images.unsplash.com/photo-1600607686527-6fb886090705?w=400&h=400&fit=crop",
  drill:     "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400&h=400&fit=crop",
  timber:    "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400&h=400&fit=crop",
  copper:    "https://images.unsplash.com/photo-1621600411688-4be93c2c1208?w=400&h=400&fit=crop",
  scaff:     "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400&h=400&fit=crop",
  fuse:      "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&h=400&fit=crop",
  cable:     "https://images.unsplash.com/photo-1620788373811-eee62a68ffb9?w=400&h=400&fit=crop",
  tile:      "https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=400&h=400&fit=crop",
  ply:       "https://images.unsplash.com/photo-1616627052131-9d3f6f0f7d1c?w=400&h=400&fit=crop",
  ladder:    "https://images.unsplash.com/photo-1585909695284-32d2985ac9c0?w=400&h=400&fit=crop",
  van:       "https://images.unsplash.com/photo-1519666336592-e225a99dcd2f?w=400&h=400&fit=crop",
  screws:    "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=400&h=400&fit=crop",
  concrete:  "https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=400&h=400&fit=crop",
  saw:       "https://images.unsplash.com/photo-1608222351212-18fe0ec7b13b?w=400&h=400&fit=crop",
  handle:    "https://images.unsplash.com/photo-1615873968403-89e068629265?w=400&h=400&fit=crop"
} as const;

export const MOCK_SIDE_LANE_POSTS: SideLanePost[] = [
  // Kitchen Fitters — the seeded canteen with the most side-lane volume
  { id: "sl_1",  canteenId: "cant_kitchen_uk", kind: "trade-center-product", posterSlug: "demo-alan-walsh-timber-merchant-birmingham", posterDisplayName: "Alan Walsh Timber",   headline: "Solid oak 40mm worktops — cut to size",       imageUrl: IMG.worktop,  priceGbp: 120, clicksTrailing7d: 42, state: "live", postedAt: "2026-07-04T09:00:00Z", expiresAt: "2026-08-03T09:00:00Z", tradeCenterListingId: "prod_oak_worktop_40mm" },
  { id: "sl_2",  canteenId: "cant_kitchen_uk", kind: "merchant-marketing",   posterSlug: "demo-nick-brown-quartz-fitter-manchester",     posterDisplayName: "Nick Brown Quartz",  headline: "Trade-only quartz templating · 48h NW",       imageUrl: IMG.kitchen,                clicksTrailing7d: 34, state: "live", postedAt: "2026-07-06T14:30:00Z", expiresAt: "2026-08-05T14:30:00Z",
    // Sponsored — Nick paid to float this above organic Counter posts
    // when the viewer is on kitchen-fitter, joiner, or carpenter canteens.
    boost: {
      expiresAt: "2026-07-20T14:30:00Z",
      targetTradeSlugs: ["kitchen-fitter", "joiner", "carpenter"],
      paidGbp: 60
    }
  },
  { id: "sl_3",  canteenId: "cant_kitchen_uk", kind: "member-listing",        posterSlug: "demo-tom-fisher-kitchen-fitter-leeds",         posterDisplayName: "Tom Fisher",         headline: "Festool TS55 track saw + rail — barely used", imageUrl: IMG.saw,      priceGbp: 280, clicksTrailing7d: 28, state: "live", postedAt: "2026-07-08T10:15:00Z", expiresAt: "2026-08-07T10:15:00Z",
    mood: "make-me-offer",
    offers: [
      { id: "of_1", buyerSlug: "demo-mike-watson-drywall-manchester",        buyerDisplayName: "Mike W.",   buyerAvatarUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop&crop=faces", amountGbp: 240, postedAt: "2026-07-09T15:22:00Z" },
      { id: "of_2", buyerSlug: "demo-rachel-simms-kitchen-fitter-liverpool",  buyerDisplayName: "Rachel S.", buyerAvatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces", amountGbp: 260, postedAt: "2026-07-09T18:04:00Z" },
      { id: "of_3", buyerSlug: "demo-craig-mcdermott-electrician-leeds",     buyerDisplayName: "Craig M.",  buyerAvatarUrl: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=200&h=200&fit=crop&crop=faces", amountGbp: 270, postedAt: "2026-07-10T09:41:00Z" }
    ]
  },
  { id: "sl_4",  canteenId: "cant_kitchen_uk", kind: "trade-center-product", posterSlug: "demo-alan-walsh-timber-merchant-birmingham", posterDisplayName: "Alan Walsh Timber",   headline: "Prefab pantry carcasses · pack of 3",          imageUrl: IMG.cabinets, priceGbp: 199, clicksTrailing7d: 21, state: "live", postedAt: "2026-06-28T11:00:00Z", expiresAt: "2026-07-28T11:00:00Z" },
  { id: "sl_5",  canteenId: "cant_kitchen_uk", kind: "member-listing",        posterSlug: "demo-craig-mcdermott-electrician-leeds",       posterDisplayName: "Craig McDermott",     headline: "Blum soft-close hinges · box of 100 spare",   imageUrl: IMG.handle,   priceGbp: 45,  clicksTrailing7d: 18, state: "live", postedAt: "2026-07-01T13:00:00Z", expiresAt: "2026-07-31T13:00:00Z" },
  { id: "sl_6",  canteenId: "cant_kitchen_uk", kind: "trade-center-product", posterSlug: "demo-alan-walsh-timber-merchant-birmingham", posterDisplayName: "Alan Walsh Timber",   headline: "Birch ply 18mm 8×4 — pallet of 12",             imageUrl: IMG.ply,      priceGbp: 480, clicksTrailing7d: 14, state: "live", postedAt: "2026-07-05T08:00:00Z", expiresAt: "2026-08-04T08:00:00Z" },
  { id: "sl_7",  canteenId: "cant_kitchen_uk", kind: "member-listing",        posterSlug: "demo-mike-watson-drywall-manchester",           posterDisplayName: "Mike Watson",         headline: "Karcher steam cleaner · barely used",         imageUrl: IMG.tools,    priceGbp: 90,  clicksTrailing7d: 12, state: "live", postedAt: "2026-07-07T09:30:00Z", expiresAt: "2026-08-06T09:30:00Z" },
  { id: "sl_8",  canteenId: "cant_kitchen_uk", kind: "merchant-marketing",   posterSlug: "demo-lucy-mahon-tree-surgeon-glasgow",         posterDisplayName: "Fittipro Handles",   headline: "Brushed brass handles · from £6 trade",       imageUrl: IMG.handle,                 clicksTrailing7d: 10, state: "live", postedAt: "2026-07-03T15:45:00Z", expiresAt: "2026-08-02T15:45:00Z" },
  { id: "sl_9",  canteenId: "cant_kitchen_uk", kind: "trade-center-product", posterSlug: "demo-alan-walsh-timber-merchant-birmingham", posterDisplayName: "Alan Walsh Timber",   headline: "3-pack shaker cabinet doors · white",         imageUrl: IMG.cabinets, priceGbp: 120, clicksTrailing7d: 7,  state: "live", postedAt: "2026-07-02T12:00:00Z", expiresAt: "2026-08-01T12:00:00Z" },
  { id: "sl_10", canteenId: "cant_kitchen_uk", kind: "member-listing",        posterSlug: "demo-tom-fisher-kitchen-fitter-leeds",         posterDisplayName: "Tom Fisher",         headline: "Makita 18v combo drill + impact · with 4 batteries", imageUrl: IMG.drill, priceGbp: 220, clicksTrailing7d: 6, state: "live", postedAt: "2026-07-08T15:00:00Z", expiresAt: "2026-08-07T15:00:00Z" },
  { id: "sl_11", canteenId: "cant_kitchen_uk", kind: "trade-center-product", posterSlug: "demo-alan-walsh-timber-merchant-birmingham", posterDisplayName: "Alan Walsh Timber",   headline: "Countryside cream tiles · 30 boxes",           imageUrl: IMG.tile,     priceGbp: 340, clicksTrailing7d: 5,  state: "live", postedAt: "2026-06-30T10:00:00Z", expiresAt: "2026-07-30T10:00:00Z" },
  { id: "sl_12", canteenId: "cant_kitchen_uk", kind: "merchant-marketing",   posterSlug: "demo-nick-brown-quartz-fitter-manchester",     posterDisplayName: "Nick Brown Quartz",  headline: "Free A0 quartz swatch pack · trade only",     imageUrl: IMG.kitchen,                clicksTrailing7d: 4,  state: "live", postedAt: "2026-07-06T16:00:00Z", expiresAt: "2026-08-05T16:00:00Z" },
  { id: "sl_13", canteenId: "cant_kitchen_uk", kind: "member-listing",        posterSlug: "demo-mike-watson-drywall-manchester",           posterDisplayName: "Mike Watson",         headline: "Kreg pocket-hole jig · complete kit",         imageUrl: IMG.saw,      priceGbp: 65,  clicksTrailing7d: 3,  state: "live", postedAt: "2026-07-07T11:00:00Z", expiresAt: "2026-08-06T11:00:00Z" },
  { id: "sl_14", canteenId: "cant_kitchen_uk", kind: "trade-center-product", posterSlug: "demo-alan-walsh-timber-merchant-birmingham", posterDisplayName: "Alan Walsh Timber",   headline: "Bulk 100mm decking screws · box of 500",       imageUrl: IMG.screws,   priceGbp: 22,  clicksTrailing7d: 3,  state: "live", postedAt: "2026-07-05T13:30:00Z", expiresAt: "2026-08-04T13:30:00Z" },
  { id: "sl_15", canteenId: "cant_kitchen_uk", kind: "trade-center-product", posterSlug: "demo-alan-walsh-timber-merchant-birmingham", posterDisplayName: "Alan Walsh Timber",   headline: "Ready-mix concrete · 20 bags · click & collect", imageUrl: IMG.concrete, priceGbp: 60,  clicksTrailing7d: 2, state: "live", postedAt: "2026-07-06T09:00:00Z", expiresAt: "2026-08-05T09:00:00Z" },
  { id: "sl_16", canteenId: "cant_kitchen_uk", kind: "member-listing",        posterSlug: "demo-tom-fisher-kitchen-fitter-leeds",         posterDisplayName: "Tom Fisher",         headline: "Multitool oscillating blades · 50 spare",     imageUrl: IMG.tools,    priceGbp: 15,  clicksTrailing7d: 2,  state: "live", postedAt: "2026-07-08T09:00:00Z", expiresAt: "2026-08-07T09:00:00Z" },
  { id: "sl_17", canteenId: "cant_kitchen_uk", kind: "merchant-marketing",   posterSlug: "demo-nick-brown-quartz-fitter-manchester",     posterDisplayName: "Nick Brown Quartz",  headline: "£50 off first quartz install · trade referral", imageUrl: IMG.kitchen,               clicksTrailing7d: 2,  state: "live", postedAt: "2026-07-04T18:00:00Z", expiresAt: "2026-08-03T18:00:00Z" },
  { id: "sl_18", canteenId: "cant_kitchen_uk", kind: "member-listing",        posterSlug: "demo-craig-mcdermott-electrician-leeds",       posterDisplayName: "Craig McDermott",     headline: "Copper pipe offcuts · 15mm mix · £15",         imageUrl: IMG.copper,   priceGbp: 15,  clicksTrailing7d: 1,  state: "live", postedAt: "2026-07-03T09:00:00Z", expiresAt: "2026-08-02T09:00:00Z" },
  { id: "sl_19", canteenId: "cant_kitchen_uk", kind: "member-listing",        posterSlug: "demo-jason-hardy-scaffolder-glasgow",           posterDisplayName: "Jason Hardy",         headline: "Alu triple ladder · 10 tread · fully serviced", imageUrl: IMG.ladder,  priceGbp: 140, clicksTrailing7d: 1,  state: "live", postedAt: "2026-07-01T09:00:00Z", expiresAt: "2026-07-31T09:00:00Z" },
  { id: "sl_20", canteenId: "cant_kitchen_uk", kind: "trade-center-product", posterSlug: "demo-alan-walsh-timber-merchant-birmingham", posterDisplayName: "Alan Walsh Timber",   headline: "Reclaimed victorian brick pallet · London stock", imageUrl: IMG.bricks, priceGbp: 380, clicksTrailing7d: 0, state: "sold", postedAt: "2026-06-25T09:00:00Z", expiresAt: "2026-07-25T09:00:00Z" },

  // Sparks + Scaffolders canteens — a few each so those pages don't look empty
  { id: "sl_s1", canteenId: "cant_sparks_north", kind: "trade-center-product", posterSlug: "demo-alan-walsh-timber-merchant-birmingham", posterDisplayName: "Alan Walsh Trade",    headline: "6mm T&E twin+earth · 100m drum",              imageUrl: IMG.cable,    priceGbp: 165, clicksTrailing7d: 22, state: "live", postedAt: "2026-07-05T10:00:00Z", expiresAt: "2026-08-04T10:00:00Z" },
  { id: "sl_s2", canteenId: "cant_sparks_north", kind: "member-listing",        posterSlug: "demo-craig-mcdermott-electrician-leeds",       posterDisplayName: "Craig McDermott",     headline: "Wiska 407 boxes · 20 spare",                    imageUrl: IMG.fuse,     priceGbp: 25,  clicksTrailing7d: 9,  state: "live", postedAt: "2026-07-08T13:00:00Z", expiresAt: "2026-08-07T13:00:00Z" },
  { id: "sl_c1", canteenId: "cant_scaffolders",  kind: "trade-center-product", posterSlug: "demo-alan-walsh-timber-merchant-birmingham", posterDisplayName: "Alan Walsh Trade",    headline: "Kwikstage standards · 10ft · pack of 20",     imageUrl: IMG.scaff,    priceGbp: 320, clicksTrailing7d: 15, state: "live", postedAt: "2026-07-06T08:00:00Z", expiresAt: "2026-08-05T08:00:00Z" }
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
};

// Small stable avatar pool (Unsplash portraits, cropped square).
const AV = {
  m1: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop&crop=faces",
  m2: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop&crop=faces",
  m3: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces",
  m4: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=200&h=200&fit=crop&crop=faces",
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
      bioShort: "20 years fitting kitchens across NW. Full-height carcass specialist. £45/hr day rate.",
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
      portfolioCount: 48
    },
    { slug: "demo-tom-fisher-kitchen-fitter-leeds", displayName: "Tom Fisher", tradeLabel: "Kitchen Fitter", city: "Leeds", avatarUrl: AV.m2, role: "moderator", whatsapp: "447700900102", bioShort: "Bespoke oak + walnut jobs. Full showroom fit-outs. West Yorks only.", memberOfCanteenSlugs: ["uk-kitchen-fitters"] },
    { slug: "demo-rachel-simms-kitchen-fitter-liverpool", displayName: "Rachel Simms", tradeLabel: "Kitchen Fitter", city: "Liverpool", avatarUrl: AV.m3, role: "member", whatsapp: "447700900103", bioShort: "Insurance jobs + landlord fit-outs. 3-day full-fit turnaround.", memberOfCanteenSlugs: ["uk-kitchen-fitters"] },
    { slug: "demo-craig-mcdermott-electrician-leeds", displayName: "Craig McDermott", tradeLabel: "Electrician", city: "Leeds", avatarUrl: AV.m4, role: "member", whatsapp: "447700900104", bioShort: "18th edition sparks. Kitchen circuit + island power specialist.", memberOfCanteenSlugs: ["uk-kitchen-fitters", "north-uk-sparks"] },
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
    { slug: "demo-craig-mcdermott-electrician-leeds", displayName: "Craig McDermott", tradeLabel: "Electrician", city: "Leeds", avatarUrl: AV.m4, role: "admin", whatsapp: "447700900104", bioShort: "18th edition sparks. Domestic + light commercial. NICEIC.", memberOfCanteenSlugs: ["north-uk-sparks", "uk-kitchen-fitters"] },
    { slug: "demo-mike-watson-drywall-manchester", displayName: "Mike Watson", tradeLabel: "Electrician", city: "Manchester", avatarUrl: AV.m1, role: "member", whatsapp: "447700900101", bioShort: "Board changes + rewires. NW callouts.", memberOfCanteenSlugs: ["north-uk-sparks", "uk-kitchen-fitters"] }
  ],
  cant_scaffolders: [
    { slug: "demo-jason-hardy-scaffolder-glasgow", displayName: "Jason Hardy", tradeLabel: "Scaffolder", city: "Glasgow", avatarUrl: AV.m9, role: "admin", whatsapp: "447700900109", bioShort: "System scaff + tube-and-fitting. Central belt.", memberOfCanteenSlugs: ["uk-scaffolders"] }
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
  name: string;
  imageUrl: string;
  /** Extra shots for the product-focus view gallery. */
  galleryUrls?: string[];
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
    canteenId: "cant_kitchen_uk",
    hostSlug: "demo-mike-watson-drywall-manchester",
    name: "Solid Oak Worktop 40mm",
    imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop",
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
    canteenId: "cant_kitchen_uk",
    hostSlug: "demo-mike-watson-drywall-manchester",
    name: "Shaker Cabinet Doors · Pack of 3",
    imageUrl: "https://images.unsplash.com/photo-1600607686527-6fb886090705?w=400&h=400&fit=crop",
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
    canteenId: "cant_kitchen_uk",
    hostSlug: "demo-mike-watson-drywall-manchester",
    name: "Prefab Pantry Carcasses",
    imageUrl: "https://images.unsplash.com/photo-1616627052131-9d3f6f0f7d1c?w=400&h=400&fit=crop",
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
    canteenId: "cant_kitchen_uk",
    hostSlug: "demo-mike-watson-drywall-manchester",
    name: "Brushed Brass Handles",
    imageUrl: "https://images.unsplash.com/photo-1615873968403-89e068629265?w=400&h=400&fit=crop",
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
    canteenId: "cant_kitchen_uk",
    hostSlug: "demo-mike-watson-drywall-manchester",
    name: "Quartz Offcuts · Assorted",
    imageUrl: "https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=400&h=400&fit=crop",
    priceGbp: 40,
    blurb: "Splash-back pieces · £40+",
    description: "End-of-project quartz offcuts. Great for splash-backs, sills and small vanities. Sizes and colours change weekly — first come first served.",
    featured: true
  },
  {
    id: "prod_undermount_sink",
    canteenId: "cant_kitchen_uk",
    hostSlug: "demo-mike-watson-drywall-manchester",
    name: "Undermount Stainless Sink 1.5 bowl",
    imageUrl: "https://images.unsplash.com/photo-1584622781564-1d987f7333c1?w=400&h=400&fit=crop",
    priceGbp: 165,
    blurb: "3mm deck · pre-drilled overflow",
    description: "1.5-bowl undermount stainless with sound-deadening. 3mm deck, pre-drilled overflow, all-in fixings included. Fits standard 800mm cabinets.",
    featured: true
  },
  {
    id: "prod_extractor_hood",
    canteenId: "cant_kitchen_uk",
    hostSlug: "demo-mike-watson-drywall-manchester",
    name: "Angled Chimney Extractor 90cm",
    imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop",
    priceGbp: 249,
    blurb: "780m³/h · touch controls",
    description: "Modern angled glass extractor, 780m³/h airflow, 3-speed touch controls, LED, carbon filters swappable. Class-A energy.",
    featured: true
  },
  {
    id: "prod_belfast_sink",
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
    canteenId: "cant_kitchen_uk",
    hostSlug: "demo-mike-watson-drywall-manchester",
    name: "End-grain Oak Cutting Board",
    imageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=400&fit=crop",
    priceGbp: 55,
    blurb: "Handmade · Osmo oiled",
    description: "End-grain oak block cutting board, 40 × 30 × 4cm. Osmo-oiled and finished by hand. Every board unique. Local NW milled oak.",
    featured: false
  }
];

export function productsForCanteen(canteenId: string, opts?: { featuredOnly?: boolean }): CanteenProduct[] {
  return MOCK_CANTEEN_PRODUCTS.filter((p) => p.canteenId === canteenId && (opts?.featuredOnly ? p.featured : true));
}

export function canteenProductById(id: string): CanteenProduct | null {
  return MOCK_CANTEEN_PRODUCTS.find((p) => p.id === id) ?? null;
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
