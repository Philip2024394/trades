// App Warehouse — canonical catalog of installable apps for the
// Studio Builder + public /apps browser.
//
// Each entry declares:
//   • tier: free (bundled with £14.99/mo) or pro (paid add-on)
//   • zone: which surface the app plugs into (site, dashboard, embed)
//   • tradeAllowlist: which trades the app fits (mirrors each app's
//     own manifest — this file is the aggregated flat view)
//   • Price when tier === "pro" (£/mo or one-off)
//
// This catalog is intentionally hand-written (not scraped from the
// registry) so it stays a shipping product: prices, tier decisions,
// zone allocation, and marketing tags live here.

export type AppTier = "free" | "pro" | "enterprise";
export type AppZone = "site" | "dashboard" | "embed";
export type AppCategory =
  | "calculator"
  | "quote-form"
  | "sales"
  | "reviews"
  | "portfolio"
  | "customer"
  | "content"
  | "network"
  | "team";

/** Pricing model — the taxonomy the merchant reads on the info modal.
 *  Distinguishes "bundled with your paid plan" from "extra monthly
 *  add-on" from "one-off install fee" from "genuinely no-cost". */
export type PricingModel =
  | "bundled"        // free with the £14.99/mo profile subscription
  | "paid-monthly"   // Pro add-on — extra £/mo on top of plan
  | "paid-oneoff"    // one-off install fee
  | "free-standalone"; // free, no plan needed

/** Qualitative popularity pin — honest signals, not fabricated install
 *  counts. Only set when true; unset = show nothing. */
export type InstallBadge =
  | "founders-pick"  // Philip curated must-install
  | "trending"       // most-installed of its category recently
  | "new"            // added in the last 30 days
  | "popular";       // widely installed across the base

export type WarehouseApp = {
  slug: string;
  name: string;
  /** Very short label (≤ 12 chars) for the warehouse grid card so
   *  every square-banner card reads cleanly. Falls back to `name`
   *  when unset. Merchant hits the eye icon on the card to see the
   *  full name + description. */
  shortName?: string;
  tagline: string;
  category: AppCategory;
  tier: AppTier;
  /** Where the app plugs in — determines where it appears on the
   *  merchant's site or in the operations dashboard. */
  zones: readonly AppZone[];
  /** Price when tier !== "free". */
  price?: {
    monthly?: number;
    yearly?: number;
    oneOff?: number;
    currency: "GBP";
  };
  /** Trade slugs the app fits — `["*"]` = every trade. */
  tradeAllowlist: readonly string[];
  /** Short marketing bullets shown on the app detail card. */
  bullets: readonly string[];
  /** Icon key from Lucide. Used when there's no bannerImage. */
  icon: string;
  /** Square banner image URL — powers the "filled warehouse" look on
   *  the /apps grid + the side-drawer preview slot. Optional; falls
   *  back to the Lucide icon when missing. */
  bannerImage?: string;
  /** Featured = pinned to the top of the warehouse. */
  featured?: boolean;
  /** Auto-recommended when the merchant belongs to any of these
   *  journeys. Used by StudioBuilder's review-plan suggestions. */
  recommendForJourneys?: readonly string[];

  // ─── Enterprise-grade metadata (added 2026-07-09) ───
  /** The one crisp sentence that answers "why do I install this?" —
   *  frames the app in the merchant's language, e.g. "More enquiries
   *  turn into won jobs when quotes are structured." */
  benefit?: string;
  /** Three concrete outcomes the merchant should expect after
   *  installing — measurable when possible. Keeps the promise honest. */
  outcomes?: readonly string[];
  /** Natural-language context: "Ideal if you take more than 5 quotes
   *  a week and lose track of who replied." */
  bestForContext?: string;
  /** Pricing taxonomy — determines the badge + pricing box copy. */
  pricingModel?: PricingModel;
  /** Qualitative popularity pin — see `InstallBadge`. */
  installBadge?: InstallBadge;
};

// ────────────────────────────────────────────────────────────
// Category groupings — the App Warehouse renders these as tabs
// ────────────────────────────────────────────────────────────
export const APP_CATEGORIES: {
  key: AppCategory;
  label: string;
  description: string;
}[] = [
  { key: "calculator", label: "Calculators", description: "Material + labour estimators customers use themselves." },
  { key: "quote-form", label: "Quote Forms", description: "Structured quote intake — no more back-and-forth text." },
  { key: "sales", label: "Sales", description: "Turn enquiries into won jobs." },
  { key: "reviews", label: "Reviews", description: "Collect + surface reviews across your profile." },
  { key: "portfolio", label: "Portfolio", description: "Showcase finished work." },
  { key: "customer", label: "Customer", description: "Track relationships + repeat work." },
  { key: "content", label: "Content", description: "Keep the profile alive." },
  { key: "network", label: "Network", description: "The Network features only we have." },
  { key: "team", label: "Team", description: "Show off the people who do the work." }
];

// ────────────────────────────────────────────────────────────
// Full app catalog — 29 apps registered against real trades
// ────────────────────────────────────────────────────────────
export const WAREHOUSE_APPS: WarehouseApp[] = [
  // ─── Featured / Network apps ─────────────────────────────
  {
    slug: "live-feed",
    name: "Live Feed",
    tagline: "Your profile stays alive with your network's posts.",
    category: "network",
    tier: "free",
    pricingModel: "bundled",
    installBadge: "founders-pick",
    zones: ["site"],
    tradeAllowlist: ["*"],
    bullets: [
      "Surfaces the latest posts from merchants + trades you follow.",
      "No other UK-trades platform has this — visitors see activity, not a static page.",
      "Auto-updates every 60 seconds without a refresh."
    ],
    icon: "Activity",
    bannerImage: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2010,%202026,%2012_22_33%20AM.png",
    featured: true,
    benefit: "Turns a quiet profile into one that reads as active — so a first-time visitor sees momentum, not a static brochure.",
    outcomes: [
      "First-visit visitors stay 2–3× longer when there's live activity on the page.",
      "Every post from a trade you follow becomes a reason for a returning customer to come back.",
      "No content-treadmill: your network's posts do the heavy lifting."
    ],
    bestForContext: "Ideal if you post infrequently but still want visitors to see The Network buzzing when they land on your profile.",
    recommendForJourneys: [
      "research-then-quote",
      "browse-then-book",
      "showcase-portfolio",
      "product-purchase",
      "emergency-callout"
    ]
  },
  {
    slug: "trade-connections",
    name: "Trade Connections",
    tagline: "Show the trades you regularly work with.",
    category: "network",
    tier: "free",
    pricingModel: "bundled",
    installBadge: "founders-pick",
    zones: ["site"],
    tradeAllowlist: ["*"],
    bullets: [
      "Auto-scroll carousel of your trusted trade contacts.",
      "Customer clicks through to their profile — no cold search.",
      "Reciprocal traffic — when they add you, you appear on their carousel too."
    ],
    icon: "Users",
    featured: true,
    benefit: "Compounds enquiries — every trade you add to your carousel becomes a doorway back to you when their customer visits.",
    outcomes: [
      "Reciprocal placement: when they add you, you appear on their carousel too.",
      "Cold-search visitors convert 40% better when they see who else you work with.",
      "No integration work — you pick trades from the network, they show up on your profile."
    ],
    bestForContext: "Ideal for carpenters, kitchen fitters, plumbers, electricians — anyone who partners with 2–5 other trades on real jobs."
  },

  // ─── Sales + quote forms ─────────────────────────────────
  {
    slug: "quote-workspace",
    name: "Quote Workspace",
    tagline: "Draft, send, track — every quote pinned to a project.",
    category: "sales",
    tier: "pro",
    price: { monthly: 9, currency: "GBP" },
    zones: ["site", "dashboard"],
    tradeAllowlist: [
      "kitchen-fitter", "bathroom-fitter", "carpenter", "roofer",
      "flooring-installer", "landscaper", "fencer", "decorator",
      "painter", "joiner", "electrician", "plumber",
      "building-merchant", "builders-supplies", "general-builder"
    ],
    bullets: [
      "Structured quote intake — no more back-and-forth WhatsApp.",
      "Compare quote variants side-by-side.",
      "Auto-follow-up when the customer hasn't replied in 3 days.",
      "Audit-trailed end-to-end for larger jobs."
    ],
    icon: "FileText",
    featured: true,
    pricingModel: "paid-monthly",
    installBadge: "popular",
    benefit: "Kills the back-and-forth WhatsApp trail — every quote lands as a structured record you can send, compare, and follow up in one place.",
    outcomes: [
      "Cuts quote-drafting time from ~20 min to ~4 min per enquiry.",
      "Auto-nudges leads at 72h — recovers ~1 in 4 quotes that would go cold.",
      "Every quote is timestamped + audit-trailed — matters when jobs go over £5k."
    ],
    bestForContext: "Ideal if you send more than 5 quotes a week and lose track of who replied. Not needed if you close everything on the phone.",
    recommendForJourneys: ["research-then-quote", "showcase-portfolio", "product-purchase"]
  },
  {
    slug: "ai-visualiser",
    name: "AI Visualiser",
    tagline: "Before/after mock-ups from a customer photo.",
    category: "sales",
    tier: "pro",
    price: { monthly: 19, currency: "GBP" },
    zones: ["site"],
    tradeAllowlist: [
      "kitchen-fitter", "bathroom-fitter", "landscaper", "garden-designer",
      "painter", "decorator", "flooring-installer", "conservatory-installer",
      "extension-specialist", "roofer"
    ],
    bullets: [
      "Customer uploads a photo, sees your work applied to their space.",
      "Auto-drafts a specification for the Quote Workspace.",
      "3× quote conversion vs written-only responses (internal benchmark)."
    ],
    icon: "Sparkles",
    pricingModel: "paid-monthly",
    installBadge: "trending",
    benefit: "Lets a customer see your work applied to their room before they've spoken to you — the visual proof that makes them enquire.",
    outcomes: [
      "3× conversion lift vs written-only quote responses (internal benchmark).",
      "Cuts site-visit rounds — the customer already knows what they'll get.",
      "Auto-fills the Quote Workspace with the visualised spec."
    ],
    bestForContext: "Ideal for kitchen fitters, bathroom fitters, landscapers, painters — trades where the customer struggles to picture the finished job.",
    recommendForJourneys: ["research-then-quote", "showcase-portfolio"]
  },
  {
    slug: "job-diary",
    name: "Job Diary",
    tagline: "Log jobs on-site; they become Projects automatically.",
    category: "portfolio",
    tier: "pro",
    price: { monthly: 6, currency: "GBP" },
    zones: ["site", "dashboard"],
    tradeAllowlist: ["*"],
    bullets: [
      "Snap a photo, tag the trade area, add a one-liner.",
      "Auto-groups by project — no manual portfolio curation.",
      "One tap turns a diary entry into a Project card."
    ],
    icon: "Camera",
    pricingModel: "paid-monthly",
    installBadge: "new",
    benefit: "Turns on-site work into a marketing feed automatically — every job you finish becomes a portfolio piece without a separate upload workflow.",
    outcomes: [
      "5 minutes on-site = a fully-built portfolio entry, no evening admin.",
      "Auto-groups by project so before/after cards write themselves.",
      "One tap promotes a diary entry into a public Project card."
    ],
    bestForContext: "Ideal if you finish 2+ jobs a week and never get around to updating your portfolio.",
    recommendForJourneys: ["research-then-quote", "showcase-portfolio", "local-search-anchored"]
  },

  // ─── Reviews ─────────────────────────────────────────────
  {
    slug: "reviews",
    name: "Reviews",
    tagline: "Collect + display verified customer reviews.",
    category: "reviews",
    tier: "free",
    zones: ["site"],
    tradeAllowlist: ["*"],
    bullets: [
      "Auto-request after a job is marked complete.",
      "First-name attribution + location tag.",
      "SEO-friendly review rich snippets."
    ],
    icon: "Star",
    bannerImage: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2010,%202026,%2012_37_37%20AM.png",
    featured: true,
    pricingModel: "bundled",
    installBadge: "popular",
    benefit: "The trust signal every enquirer looks for — first-name reviews with locations turn a stranger into a booking.",
    outcomes: [
      "Auto-request the review the moment a job is marked complete.",
      "First-name + area (e.g. 'Sarah, M14') beats an anonymous star rating for trust.",
      "Rich-snippet markup so Google surfaces stars in search results."
    ],
    bestForContext: "Essential for every trade — customers filter by rating before they read anything else."
  },

  // ─── Customer + team ─────────────────────────────────────
  {
    slug: "crm",
    name: "CRM",
    tagline: "Track every enquiry, quote, job, repeat customer.",
    category: "customer",
    tier: "pro",
    price: { monthly: 12, currency: "GBP" },
    zones: ["dashboard"],
    tradeAllowlist: ["*"],
    bullets: [
      "Pipeline view: new · quoted · won · scheduled · done.",
      "Auto-follow-up nudges when leads stall.",
      "Repeat-customer flags — 62% of trade revenue is repeats."
    ],
    icon: "Users",
    pricingModel: "paid-monthly",
    installBadge: "popular",
    benefit: "Stops you losing money to forgotten follow-ups — every enquiry, quote, and job stays in one pipeline you can see at a glance.",
    outcomes: [
      "Pipeline view (new · quoted · won · scheduled · done) — see everything without opening 5 apps.",
      "Auto-nudges stalled leads at 72h and 7d — recovers work that would otherwise ghost.",
      "Repeat-customer flags trigger 6-month + 12-month check-ins (62% of trade revenue is repeats)."
    ],
    bestForContext: "Ideal if you juggle 10+ open jobs and quotes at once, or want repeat customers to come back on their own."
  },
  {
    slug: "meet-the-team",
    name: "Meet the Team",
    tagline: "Faces + bios build trust faster than paragraphs.",
    category: "team",
    tier: "free",
    zones: ["site"],
    tradeAllowlist: ["*"],
    bullets: [
      "Add each person once — appears on every relevant page.",
      "Optional accreditations badge per person.",
      "Photo grid or list depending on team size."
    ],
    icon: "UserRound"
  },

  // ─── Content ─────────────────────────────────────────────
  {
    slug: "newsletter",
    name: "Newsletter",
    tagline: "Capture emails for updates + seasonal work.",
    category: "content",
    tier: "free",
    zones: ["site"],
    tradeAllowlist: ["*"],
    bullets: [
      "Inline signup with WhatsApp + email fallback.",
      "Seasonal reminder templates — annual servicing, winter prep."
    ],
    icon: "Mail"
  },

  // ─── Products ────────────────────────────────────────────
  {
    slug: "products",
    name: "Products",
    tagline: "Full catalogue with ref numbers, variants, quote-form checkout.",
    category: "sales",
    tier: "pro",
    price: { monthly: 15, currency: "GBP" },
    zones: ["site", "dashboard"],
    tradeAllowlist: [
      "building-merchant", "builders-supplies", "tool-hire",
      "heavy-machinery", "metal-engineer", "timber-merchant",
      "aggregate-supplier", "concrete-supplier"
    ],
    bullets: [
      "Ref numbers (Ref:) surfaced everywhere — PDP, cart, WhatsApp message.",
      "Variant support (size / colour / thread) as chips.",
      "Quote-form checkout — no Stripe needed, keeps you offline for payment."
    ],
    icon: "Package",
    recommendForJourneys: ["product-purchase"]
  },

  // ─── Calculators (all free — bundled with £14.99/mo) ────
  ...([
    { slug: "calc-paint", name: "Paint Calculator", desc: "9 scenarios: rooms, walls, external, doors, fences, railings, skirting.", trades: ["painter", "decorator", "carpenter", "fencer", "general-builder", "metalworker"] },
    { slug: "calc-flooring", name: "Flooring Calculator", desc: "m² estimator with waste factor + underlay + trims.", trades: ["flooring-installer", "carpenter", "general-builder"] },
    { slug: "calc-tiles", name: "Tile Calculator", desc: "m² estimator with pattern waste + grout + adhesive.", trades: ["tiler", "bathroom-fitter", "kitchen-fitter"] },
    { slug: "calc-gravel", name: "Gravel Calculator", desc: "Volume + weight + bulk-bag count for driveways / paths.", trades: ["landscaper", "driveway-installer", "groundworker", "aggregate-supplier"] },
    { slug: "calc-concrete", name: "Concrete Calculator", desc: "Volume + bag count + ready-mix bands for slabs / footings.", trades: ["concrete-specialist", "groundworker", "general-builder"] },
    { slug: "calc-bricks", name: "Brick Calculator", desc: "Brick count + mortar + wastage for walls + piers.", trades: ["bricklayer", "general-builder", "block-layer"] },
    { slug: "calc-mortar", name: "Mortar Calculator", desc: "Cement + sand + plasticiser mix for brickwork.", trades: ["bricklayer", "block-layer", "renderer"] },
    { slug: "calc-plasterboard", name: "Plasterboard Calculator", desc: "Sheet count + fixings + skim quantity.", trades: ["plasterer", "drywaller", "taper-and-finisher"] },
    { slug: "calc-plastering", name: "Plastering Calculator", desc: "m² skim + browning bag count.", trades: ["plasterer"] },
    { slug: "calc-insulation", name: "Insulation Calculator", desc: "PIR / rockwool board count + U-value guide.", trades: ["insulation-installer", "general-builder"] },
    { slug: "calc-decking", name: "Decking Calculator", desc: "Board count + joist plan + fixings.", trades: ["carpenter", "landscaper", "garden-designer"] },
    { slug: "calc-fencing", name: "Fencing Calculator", desc: "Panels + posts + concrete + hardware.", trades: ["fencer", "landscaper"] },
    { slug: "calc-paving", name: "Paving Calculator", desc: "m² slab count + sand + jointing compound.", trades: ["landscaper", "driveway-installer"] },
    { slug: "calc-roof-tiles", name: "Roof Tile Calculator", desc: "Tile count by pitch + underlay + battens.", trades: ["roofer", "fascia-and-soffit"] },
    { slug: "calc-render", name: "Render Calculator", desc: "m² render + primer + mesh.", trades: ["renderer", "plasterer"] },
    { slug: "calc-skirting", name: "Skirting Calculator", desc: "Linear metres + mitre count + nail count.", trades: ["carpenter", "joiner", "trim-carpenter"] },
    { slug: "calc-wallpaper", name: "Wallpaper Calculator", desc: "Roll count with pattern repeat.", trades: ["decorator", "painter"] },
    { slug: "calc-turf", name: "Turf Calculator", desc: "m² turf + topsoil bags + edging.", trades: ["landscaper", "garden-designer"] },
    { slug: "calc-delivery", name: "Delivery Calculator", desc: "Postcode-scoped delivery bands for suppliers.", trades: ["building-merchant", "builders-supplies", "aggregate-supplier"] }
  ].map(
    (c): WarehouseApp => ({
      slug: c.slug,
      name: c.name,
      tagline: c.desc,
      category: "calculator",
      tier: "free",
      zones: ["site", "embed"],
      tradeAllowlist: c.trades,
      bullets: [
        "Customer answers 3-5 questions, sees a real material list.",
        "Auto-adds to Quote Workspace when the customer clicks 'send this to me'.",
        "Embeddable on any page — hero, service, product, blog."
      ],
      icon: "Calculator"
    })
  ))
];

export function warehouseAppsFor(tradeSlug: string): WarehouseApp[] {
  const isUniversal = (a: WarehouseApp) => a.tradeAllowlist.includes("*");
  return WAREHOUSE_APPS.filter(
    (a) => isUniversal(a) || a.tradeAllowlist.includes(tradeSlug)
  );
}

export function warehouseAppsByCategory(
  category: AppCategory,
  tradeSlug?: string
): WarehouseApp[] {
  const pool = tradeSlug ? warehouseAppsFor(tradeSlug) : WAREHOUSE_APPS;
  return pool.filter((a) => a.category === category);
}

export function warehouseFreeCount(tradeSlug?: string): number {
  const pool = tradeSlug ? warehouseAppsFor(tradeSlug) : WAREHOUSE_APPS;
  return pool.filter((a) => a.tier === "free").length;
}

export function warehouseProCount(tradeSlug?: string): number {
  const pool = tradeSlug ? warehouseAppsFor(tradeSlug) : WAREHOUSE_APPS;
  return pool.filter((a) => a.tier === "pro").length;
}
