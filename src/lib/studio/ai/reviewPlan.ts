// reviewPlan — post-generation review affordances.
//
// After the pipeline composes the merchant's app, the Studio UI shows:
//   [ Accept & Publish ]     [ Edit ]
//
// If the merchant taps Edit, we walk them page-by-page with three
// prompts each: "anything to change?" "anything to add?" "anything to
// delete?" — plus contextual app + banner suggestions and a
// "what-works-well" nudge.
//
// The Live Feed app is *always* suggested on merchant-facing journeys
// because Philip's core design thesis is that low activity should read
// as active — the Live Feed surfaces network posts so the profile
// looks alive even before the merchant posts anything themselves.

import type { FrozenJourneyManifest, JourneyPage } from "@/platform/journey";

export type ReviewAction =
  | { id: "accept-publish"; label: string; primary: true; tone: "primary" }
  | { id: "edit"; label: string; primary: false; tone: "secondary" };

export type PageRefinementPrompt = {
  pageId: string;
  purpose: string;
  prompts: {
    change: string;
    add: string;
    delete: string;
  };
  suggestions: {
    apps: readonly RecommendedApp[];
    banners: readonly RecommendedBanner[];
    whatWorks: readonly string[];
  };
};

export type RecommendedApp = {
  slug: string;
  name: string;
  reason: string;
  /** Priority = the order the Studio surfaces recommendations. Lower
   *  first. Live Feed always wins priority 0 on merchant-facing pages. */
  priority: number;
};

export type RecommendedBanner = {
  slug: string;
  headline: string;
  reason: string;
};

export type BrandingStep = {
  logoUpload: {
    prompt: string;
    /** Extraction plan Studio runs after the user uploads. We pull
     *  the dominant background colour from the logo, plus one accent,
     *  and derive an "ink" contrast pair. */
    extract: {
      background: true;
      accent: true;
      ink: true;
      mode: "auto";
    };
    acceptedMimeTypes: readonly string[];
    /** Merchant-facing note shown next to the upload button. */
    note: string;
  };
  palette: {
    prompt: string;
    /** Curated options the merchant can pick instead of a logo-derived
     *  palette. Studio can also let the user override each colour. */
    options: readonly BrandPalette[];
  };
};

export type BrandPalette = {
  slug: string;
  name: string;
  description: string;
  background: string;
  surface: string;
  ink: string;
  accent: string;
  accentInk: string;
  mode: "light" | "dark";
};

export type ReviewPlan = {
  actions: readonly ReviewAction[];
  /** Branding step — always the first walkthrough step when the
   *  merchant taps Edit. Comes before any page-level refinement. */
  branding: BrandingStep | null;
  /** One entry per page in the journey's pageSet (required + optional
   *  suggested). Empty when the journey is the platform-side directory. */
  pages: readonly PageRefinementPrompt[];
  /** Framed pitch surfaced during the walkthrough about why the Live
   *  Feed matters. Read verbatim by Studio's coach-mark UI. */
  liveFeedPitch: string | null;
};

const BRAND_PALETTES: BrandPalette[] = [
  {
    slug: "trades-classic",
    name: "Trades Classic",
    description: "Cool blue + amber accent — the default UK-trades palette.",
    background: "#F5F7FA",
    surface: "#FFFFFF",
    ink: "#0F172A",
    accent: "#E87500",
    accentInk: "#FFFFFF",
    mode: "light"
  },
  {
    slug: "safety-orange",
    name: "Safety Orange",
    description: "Charcoal + safety-orange — reads durable, high-vis.",
    background: "#F0F2F5",
    surface: "#FFFFFF",
    ink: "#1A1C1E",
    accent: "#E87500",
    accentInk: "#FFFFFF",
    mode: "light"
  },
  {
    slug: "hi-vis-yellow",
    name: "Hi-Vis Yellow",
    description: "Charcoal + hi-vis yellow — construction-site energy.",
    background: "#F0F2F5",
    surface: "#FFFFFF",
    ink: "#1A1C1E",
    accent: "#FFC107",
    accentInk: "#1A1C1E",
    mode: "light"
  },
  {
    slug: "gas-safe-blue",
    name: "Gas Safe Blue",
    description: "White + trade-blue — trusted, regulated, professional.",
    background: "#F5F7FA",
    surface: "#FFFFFF",
    ink: "#0F172A",
    accent: "#0057A3",
    accentInk: "#FFFFFF",
    mode: "light"
  },
  {
    slug: "premium-black",
    name: "Premium Black",
    description: "Deep black + brass accent — luxury showroom trades.",
    background: "#0B0B0C",
    surface: "#161618",
    ink: "#F8FAFC",
    accent: "#C08A2E",
    accentInk: "#0B0B0C",
    mode: "dark"
  },
  {
    slug: "workshop-green",
    name: "Workshop Green",
    description: "Warm off-white + forest accent — landscaping, garden, timber.",
    background: "#F4F1EA",
    surface: "#FFFFFF",
    ink: "#1F2A24",
    accent: "#2E6D3A",
    accentInk: "#FFFFFF",
    mode: "light"
  }
];

const ACCEPT_LABEL = "Accept & Publish";
const EDIT_LABEL = "Edit — walk me through each page";

const LIVE_FEED_PITCH = `Turn on Live Feed and your profile stays alive even when you're on the tools. It surfaces the latest posts from your network — merchants you follow, suppliers you work with, the trades you're near. A visitor lands and sees activity moving, not a static page. No other platform gives you this.`;

/** Suggested apps by page id — merchant-facing journeys only. */
const APPS_BY_PAGE: Record<string, RecommendedApp[]> = {
  home: [
    {
      slug: "live-feed",
      name: "Live Feed",
      reason: "Keeps the profile alive with your network's posts — no other platform does this.",
      priority: 0
    },
    {
      slug: "reviews",
      name: "Reviews",
      reason: "Star rating + latest review floats near the hero.",
      priority: 1
    },
    {
      slug: "trade-connections",
      name: "Trade Connections",
      reason: "Shows the trades you regularly work with — social proof.",
      priority: 2
    }
  ],
  about: [
    {
      slug: "meet-the-team",
      name: "Meet the Team",
      reason: "Faces + short bios build trust faster than paragraphs.",
      priority: 0
    },
    {
      slug: "live-feed",
      name: "Live Feed",
      reason: "About page feels less static when your network is active.",
      priority: 1
    }
  ],
  contact: [
    {
      slug: "quote-workspace",
      name: "Quote Workspace",
      reason: "Structured quote intake instead of a plain form.",
      priority: 0
    }
  ],
  projects: [
    {
      slug: "job-diary",
      name: "Job Diary",
      reason: "Turn each finished job into a project card — writes itself.",
      priority: 0
    },
    {
      slug: "ai-visualiser",
      name: "AI Visualiser",
      reason: "Before/after mock-ups from a customer photo.",
      priority: 1
    }
  ],
  services: [
    {
      slug: "quote-workspace",
      name: "Quote Workspace",
      reason: "Convert a service tap into a scoped quote.",
      priority: 0
    }
  ],
  "product-grid": [
    {
      slug: "products",
      name: "Products",
      reason: "Structured catalogue with variants, ref numbers, quote-form checkout.",
      priority: 0
    }
  ],
  "product-detail": [
    {
      slug: "reviews",
      name: "Reviews",
      reason: "Per-product reviews boost conversion.",
      priority: 0
    }
  ],
  cart: [],
  checkout: [],
  reviews: [
    {
      slug: "reviews",
      name: "Reviews",
      reason: "Auto-populated from your rating history.",
      priority: 0
    }
  ],
  coverage: [],
  faq: []
};

const BANNERS_BY_PAGE: Record<string, RecommendedBanner[]> = {
  home: [
    { slug: "usp-strip", headline: "3-USP strip under the hero", reason: "Repeats the three reasons to pick you — Gas Safe, insured, response time." },
    { slug: "trust-bar", headline: "Accreditation logo strip", reason: "CPCS / NICEIC / Gas Safe visible = instant credibility." }
  ],
  about: [
    { slug: "years-active", headline: "Years-on-the-tools counter", reason: "Auto-computed from your join date + prior experience field." }
  ],
  projects: [
    { slug: "before-after-strip", headline: "Before/after showcase strip", reason: "Best-performing project format for portfolio-heavy trades." }
  ],
  contact: [
    { slug: "response-time", headline: "Typical response time", reason: "Sets expectations and reduces bounce." }
  ],
  services: [
    { slug: "price-from", headline: "\"From £X\" pricing strip", reason: "Answers the question every visitor has first." }
  ],
  "product-grid": [
    { slug: "delivery-promise", headline: "Delivery / collection promise", reason: "Ships-today badges lift conversion." }
  ],
  "product-detail": [
    { slug: "ref-number", headline: "Ref number banner", reason: "Trade customers ring with a Ref: — surface it prominently." }
  ]
};

const WHAT_WORKS_BY_PAGE: Record<string, string[]> = {
  home: [
    "One clear promise in the hero. If your customer reads only the hero, they know what you do + where + a way to contact you.",
    "Reviews above the fold — even one 5-star quote outperforms a 5-star badge.",
    "Photo of a real job, not a stock plumbing wrench."
  ],
  about: [
    "Story in first-person plural (\"we\"). Real names. Real photos.",
    "Accreditations with dates — Gas Safe #123456, insured to £5m.",
    "A single line about why you started — trades customers hire people, not brands."
  ],
  contact: [
    "Three ways to reach you visible without scrolling: phone, WhatsApp, form.",
    "Response-time promise (\"we reply within 1 working day\") reduces bounce by ~30%.",
    "A postcode field pre-qualifies the enquiry."
  ],
  projects: [
    "Before / after images beat single-shot every time on portfolio trades.",
    "Each project needs a one-line story: what the customer asked for, what you did, how long it took.",
    "Group by trade area, not by year — customers browse by need."
  ],
  services: [
    "Group services by outcome (\"Emergency callout\", \"Planned work\", \"Small jobs\") not by price.",
    "One line per service — customers scan, they don't read.",
    "\"From £X\" prices ease the ring-around cost customers do."
  ],
  "product-grid": [
    "Ref numbers everywhere — Ref: F045 not just \"F045\".",
    "Category chips filter faster than a dropdown.",
    "Delivery / collection badges close conversion on the grid, not the PDP."
  ],
  "product-detail": [
    "Ref number in the buy column, on the cart, and in the WhatsApp quote message.",
    "Variants (size / colour / thread) as chips, not a select.",
    "Deal-Breaker upsell inline in the buy column."
  ],
  reviews: [
    "First-name attribution, not \"Anonymous customer\".",
    "Location tag on each review — tells Google your reach.",
    "Latest 3 pinned to the top."
  ],
  coverage: [
    "Postcode list, not just a map. Google reads the text.",
    "\"We work across…\" line at the top so it's scannable."
  ],
  faq: [
    "Real questions your customers actually ask, not marketing questions.",
    "Answer in one sentence when possible.",
    "Link to services or contact from the answer."
  ]
};

const GENERIC_WHAT_WORKS = [
  "One clear promise per page.",
  "Real photos of real work — not stock imagery.",
  "Every claim has a fact behind it (accreditations, dates, numbers)."
];

const BRANDING_STEP: BrandingStep = {
  logoUpload: {
    prompt:
      "Upload your logo — I'll pull the background colour from it and use it across your site.",
    extract: { background: true, accent: true, ink: true, mode: "auto" },
    acceptedMimeTypes: ["image/png", "image/jpeg", "image/svg+xml", "image/webp"],
    note: "PNG with a transparent background works best. I'll auto-derive a contrast pair and let you tweak."
  },
  palette: {
    prompt:
      "Prefer to pick a palette instead? Choose one — you can still override any colour.",
    options: BRAND_PALETTES
  }
};

/** Build the full review plan for a chosen journey. */
export function buildReviewPlan(
  journey: FrozenJourneyManifest,
  opts: { isMerchantFacing: boolean }
): ReviewPlan {
  const actions: ReviewAction[] = [
    { id: "accept-publish", label: ACCEPT_LABEL, primary: true, tone: "primary" },
    { id: "edit", label: EDIT_LABEL, primary: false, tone: "secondary" }
  ];

  if (!opts.isMerchantFacing) {
    return { actions, branding: null, pages: [], liveFeedPitch: null };
  }

  const pages: PageRefinementPrompt[] = journey.pageSet.map((p: JourneyPage) => {
    const apps = APPS_BY_PAGE[p.id] ?? [];
    const banners = BANNERS_BY_PAGE[p.id] ?? [];
    const whatWorks = WHAT_WORKS_BY_PAGE[p.id] ?? GENERIC_WHAT_WORKS;
    return {
      pageId: p.id,
      purpose: p.purpose,
      prompts: {
        change: `On your ${p.id} page — anything you'd like to change?`,
        add: `Anything you'd like to add to your ${p.id} page? I can suggest apps or banners.`,
        delete: `Anything on your ${p.id} page you'd rather not show?`
      },
      suggestions: { apps, banners, whatWorks }
    };
  });

  return {
    actions,
    branding: BRANDING_STEP,
    pages,
    liveFeedPitch: LIVE_FEED_PITCH
  };
}
