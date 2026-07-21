// visitorIntent — server-side classifier that turns a request's
// referrer + UTM + query into one of a small set of "visitor faces".
// Each face gets a different top hook on shared landing pages so
// homeowners, trades, and B2B design agencies see the message that
// clicks with them (Philip's surface-area strategy 2026-07-17).
//
// Called from server components with `headers()` + `searchParams` so
// the SSR'd HTML already carries the right hook — no client flash,
// no post-hydration swap. Google crawls whatever the default face
// serves.
//
// Faces (mutually exclusive, one wins per request):
//
//   homeowner  — arrived via search for "{trade} near me / in {city}",
//                Google Maps, or a direct hit on /find/*
//   trade      — arrived via "join trade community", trade Facebook
//                groups, or utm_source=trade-*
//   b2b-image  — arrived via "UK trade stock photo", "construction
//                imagery", or /store referral
//   merchant   — arrived via a referral link (?ref=abc) — someone
//                already joined and shared
//   default    — no signal — show the balanced landing

export type VisitorFace = "homeowner" | "trade" | "b2b-image" | "merchant" | "default";

export type VisitorContext = {
  face:      VisitorFace;
  referrer:  string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmTerm:   string | null;
  refCode:   string | null;
  reason:    string; // debug — which rule fired
};

const HOMEOWNER_REFERRERS = [
  "google.com", "google.co.uk", "bing.com", "duckduckgo.com",
  "search.brave.com", "yahoo.com", "yahoo.co.uk"
];
const HOMEOWNER_QUERY_TOKENS = [
  "near me", "in ", "electrician", "plumber", "roofer", "plasterer",
  "kitchen fitter", "bathroom fitter", "landscaper", "boiler",
  "quote", "cost", "hire"
];
const TRADE_QUERY_TOKENS = [
  "join", "community", "network", "forum", "trades", "self employed",
  "signup", "sign up", "listing", "list my", "list your"
];
const B2B_QUERY_TOKENS = [
  "stock photo", "stock image", "construction imagery", "trade photo",
  "trade image", "commercial photo", "royalty free", "licence", "license",
  "site interest"
];
const TRADE_REFERRERS = [
  "facebook.com/groups", "reddit.com/r/tradesmen", "reddit.com/r/electricians",
  "reddit.com/r/plumbing", "reddit.com/r/carpentry"
];
const B2B_REFERRERS = [
  "pinterest.com", "unsplash.com", "shutterstock.com", "gettyimages",
  "envato.com", "istockphoto"
];

/** Classify a request's intent. Priority order matters: `merchant`
 *  (explicit referral link) beats everything, then B2B (specific
 *  keyword hit), then trade, then homeowner, then default. */
export function classifyVisitor(input: {
  referer:      string | null;
  searchParams: Record<string, string | string[] | undefined>;
}): VisitorContext {
  const referrer  = input.referer;
  const utmSource = pick(input.searchParams["utm_source"]);
  const utmMedium = pick(input.searchParams["utm_medium"]);
  const utmTerm   = pick(input.searchParams["utm_term"]);
  const refCode   = pick(input.searchParams["ref"]);
  const q         = (pick(input.searchParams["q"]) ?? utmTerm ?? "").toLowerCase();

  // 1. Explicit referral link — someone shared a "join" link.
  if (refCode) {
    return face("merchant", "explicit ?ref= param", { referrer, utmSource, utmMedium, utmTerm, refCode });
  }

  // 2. UTM source override — marketing campaign explicitly tags the face.
  if (utmSource === "b2b-image" || utmSource === "site-interest") {
    return face("b2b-image", "utm_source=b2b/site-interest", { referrer, utmSource, utmMedium, utmTerm, refCode });
  }
  if (utmSource?.startsWith("trade-")) {
    return face("trade", `utm_source=${utmSource}`, { referrer, utmSource, utmMedium, utmTerm, refCode });
  }
  if (utmSource === "homeowner") {
    return face("homeowner", "utm_source=homeowner", { referrer, utmSource, utmMedium, utmTerm, refCode });
  }

  // 3. B2B image intent — narrow keyword window, high signal-to-noise.
  if (B2B_QUERY_TOKENS.some((t) => q.includes(t))) {
    return face("b2b-image", `q contains b2b token`, { referrer, utmSource, utmMedium, utmTerm, refCode });
  }
  if (referrer && B2B_REFERRERS.some((r) => referrer.includes(r))) {
    return face("b2b-image", `referrer B2B image site`, { referrer, utmSource, utmMedium, utmTerm, refCode });
  }

  // 4. Trade-community intent.
  if (TRADE_QUERY_TOKENS.some((t) => q.includes(t))) {
    return face("trade", `q contains trade token`, { referrer, utmSource, utmMedium, utmTerm, refCode });
  }
  if (referrer && TRADE_REFERRERS.some((r) => referrer.includes(r))) {
    return face("trade", `referrer trade community`, { referrer, utmSource, utmMedium, utmTerm, refCode });
  }

  // 5. Homeowner search intent — broadest signal, applied last.
  if (HOMEOWNER_QUERY_TOKENS.some((t) => q.includes(t))) {
    return face("homeowner", `q contains homeowner token`, { referrer, utmSource, utmMedium, utmTerm, refCode });
  }
  if (referrer && HOMEOWNER_REFERRERS.some((r) => referrer.includes(r))) {
    return face("homeowner", `referrer search engine`, { referrer, utmSource, utmMedium, utmTerm, refCode });
  }

  return face("default", "no signal", { referrer, utmSource, utmMedium, utmTerm, refCode });
}

/** Per-face hook copy — the one thing at the top of the landing page
 *  that has to click for the visitor to stay past 3 seconds. Kept in
 *  one place so tweaking hooks doesn't require touching every surface. */
export const FACE_HOOKS: Record<VisitorFace, {
  eyebrow: string;
  title:   string;
  sub:     string;
  ctaLabel: string;
  ctaHref:  string;
}> = {
  homeowner: {
    eyebrow:  "Real UK trades. No lead fees.",
    title:    "Find a trade. Message them direct.",
    sub:      "Every listing is a verified merchant. Contact on WhatsApp — no middleman, no bidding wars.",
    ctaLabel: "Find a trade near me",
    ctaHref:  "/find"
  },
  trade: {
    eyebrow:  "Free tier · List in 2 minutes",
    title:    "Your own trades page. No commission. Ever.",
    sub:      "Get a live profile, WhatsApp button, and reviews. Free forever if you log in every 30 days.",
    ctaLabel: "List your trade — free",
    ctaHref:  "/trade-off/signup"
  },
  "b2b-image": {
    eyebrow:  "Hand-curated UK trade imagery",
    title:    "Real UK trades, plant, groundworks, finish scenes.",
    sub:      "Scroll The Site — a wall of on-site photos tagged by trade, with a WhatsApp button to the trade behind every image.",
    ctaLabel: "Browse The Site",
    ctaHref:  "/trade-off/search?tab=inspiration"
  },
  merchant: {
    eyebrow:  "Someone thinks you belong here",
    title:    "Your Tradesite is 2 minutes away.",
    sub:      "You've been invited. Free tier includes your own page, WhatsApp button, and reviews.",
    ctaLabel: "Claim your Tradesite",
    ctaHref:  "/trade-off/signup"
  },
  default: {
    eyebrow:  "UK trades platform",
    title:    "The Network for UK trades and the people who hire them.",
    sub:      "Merchant pages, homeowner discovery, image store, and a live trade community — one platform.",
    ctaLabel: "Explore the platform",
    ctaHref:  "/trade-off"
  }
};

function pick(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function face(
  f: VisitorFace,
  reason: string,
  base: Omit<VisitorContext, "face" | "reason">
): VisitorContext {
  return { face: f, reason, ...base };
}
