// Thenetworkers review system — data model + math library.
//
// Design principles (see full architecture in the reviews brainstorm
// captured in project_the_network_review_system.md):
//   1. Bayesian aggregate, not raw mean — one review can't ghost-
//      cripple or ghost-build a business.
//   2. Time-decay weighting — recent behavior matters more.
//   3. Reviewer accountability weight — serial 1-star trolls lose
//      influence; verified reviewers gain.
//   4. Zero-rating protection — merchants with < 5 reviews render as
//      "Building reputation", not a low aggregate.
//   5. Transparent admin actions — every admin intervention is
//      publicly logged, never a silent rating bump.
//   6. Multi-dimensional — 5 core dimensions + optional trade-
//      specific 6th; overall is DERIVED, not asked separately.
//
// Pure functions. Zero side effects. Unit-testable in isolation.

// ─── Dimensions ────────────────────────────────────────────

export type ReviewDimensionKey =
  | "quality"
  | "communication"
  | "punctuality"
  | "value"
  | "cleanliness"
  | "trade_specific";

export const REVIEW_DIMENSIONS: ReadonlyArray<{
  key: ReviewDimensionKey;
  label: string;
  helper: string;
  /** Ordered helper text at each score level (1 → 5) so users see
   *  what a score MEANS before they click. Kills bimodal collapse. */
  scoreCopy: readonly [string, string, string, string, string];
}> = [
  {
    key: "quality",
    label: "Quality of work",
    helper: "Did the finished job meet expectations?",
    scoreCopy: [
      "Botched, needed redoing",
      "Below expectations, patchy",
      "Fine, met the brief",
      "Well done, would use again",
      "Craftsmanship, beyond spec"
    ]
  },
  {
    key: "communication",
    label: "Communication",
    helper: "Replies on WhatsApp, timely updates, clear pricing",
    scoreCopy: [
      "Silent, missed WhatsApps",
      "Slow, had to chase",
      "Adequate, replied when asked",
      "Good, proactive updates",
      "Excellent, updated me at every stage"
    ]
  },
  {
    key: "punctuality",
    label: "Punctuality & reliability",
    helper: "Showed up when promised, finished when promised",
    scoreCopy: [
      "Late or no-showed",
      "Often late, missed dates",
      "Roughly on schedule",
      "Reliable, minor slips",
      "On time every day, finished when promised"
    ]
  },
  {
    key: "value",
    label: "Value for money",
    helper: "Was the price fair for the work delivered?",
    scoreCopy: [
      "Overcharged for the outcome",
      "A bit steep",
      "Fair market rate",
      "Good value",
      "Excellent value for the standard of work"
    ]
  },
  {
    key: "cleanliness",
    label: "Cleanliness & site care",
    helper: "Left the site tidy, respected the property",
    scoreCopy: [
      "Left mess, damaged property",
      "Untidy, minor damage",
      "Reasonable clean-up",
      "Tidy site, no issues",
      "Immaculate, treated the site with respect"
    ]
  }
] as const;

// Optional per-trade 6th dimension. Editable by admin per trade slug.
export const TRADE_SPECIFIC_DIMENSION: Record<string, {
  label: string;
  helper: string;
  scoreCopy: readonly [string, string, string, string, string];
}> = {
  "kitchen-fitter": {
    label: "Precision of measurements",
    helper: "Cuts, spacings, and level of the finished carcasses",
    scoreCopy: [
      "Doors didn't line up, gaps everywhere",
      "Noticeable inconsistency",
      "Acceptable tolerances",
      "Tight, well set-out",
      "Millimetre-accurate throughout"
    ]
  },
  "electrician": {
    label: "Testing & certificates",
    helper: "Certificates issued, testing shown, Part P where relevant",
    scoreCopy: [
      "No certs, no testing shown",
      "Late or incomplete paperwork",
      "Standard certs issued",
      "Full test results explained",
      "Every cert issued + walkthrough of results"
    ]
  },
  "bricklayer": {
    label: "Consistency of coursing",
    helper: "Even joints, straight courses, clean pointing",
    scoreCopy: [
      "Inconsistent, needs re-doing",
      "Uneven joints, poor pointing",
      "Adequate coursing",
      "Tidy work throughout",
      "Textbook coursing, gallery-standard pointing"
    ]
  },
  "scaffolder": {
    label: "Safety & compliance",
    helper: "Ties, boards, edge protection, handover paperwork",
    scoreCopy: [
      "Missing safety features",
      "Corners cut on ties/boards",
      "Standard install",
      "Safe, well-documented",
      "Textbook safe scaff + full handover pack"
    ]
  }
};

// ─── Core types ────────────────────────────────────────────

export type ReviewJobVerificationKind =
  | "job-tag"          // Merchant + customer confirmed job completion in-app
  | "whatsapp-thread"  // Customer uploaded WhatsApp export ≥ 3 messages
  | "invoice"          // PDF/photo of merchant invoice
  | null;              // Unverified — currently blocked at submit-time

export type ReviewStatus =
  | "pending"    // In the 72h dispute window
  | "published"  // Visible on the profile
  | "frozen"    // Admin-flagged; excluded from aggregate
  | "removed"   // Admin-removed with reason; body hidden but tombstone visible
  | "withdrawn" // Reviewer withdrew before publish

export type ReviewDimensionScores = {
  quality: number;         // 1-5
  communication: number;   // 1-5
  punctuality: number;     // 1-5
  value: number;           // 1-5
  cleanliness: number;     // 1-5
  trade_specific?: number; // optional
};

export type TradeReview = {
  id: string;
  merchantSlug: string;
  reviewer: {
    slug: string;
    displayName: string;
    tradeLabel: string;
    city: string;
    avatarUrl: string | null;
    /** Accountability multiplier applied to this reviewer's votes.
     *  0.5 = contested history, 1.0 = default, 1.5 = verified. */
    weight: number;
  };
  jobVerification: {
    kind: ReviewJobVerificationKind;
    when: string;    // ISO date of the underlying job
    label: string;   // Display copy, e.g., "Verified job · 12 Feb"
  };
  scores: ReviewDimensionScores;
  body: string;
  photoUrls: string[];
  status: ReviewStatus;
  publishAt: string | null;      // When 72h window ends (null if published)
  createdAt: string;             // ISO
  ownerResponse?: {
    body: string;
    respondedAt: string;
    kind: "public-reply" | "private-resolution";
  };
  disputeTimeline?: ReviewEvent[];
  adminAction?: {
    kind: "verified" | "frozen" | "removed";
    reason: string;
    at: string;
  };
  helpfulCount: number;
};

export type ReviewEvent = {
  kind:
    | "submitted"
    | "owner_replied_private"
    | "owner_replied_public"
    | "owner_disputed"
    | "reviewer_edited"
    | "reviewer_withdrew"
    | "admin_frozen"
    | "admin_removed"
    | "admin_verified"
    | "published";
  actor: "reviewer" | "owner" | "admin" | "system";
  at: string;
  note?: string;
};

// ─── Math ───────────────────────────────────────────────────

/** Raw overall score for a single review — mean of the 5 core
 *  dimensions (+ optional trade-specific with equal weight). */
export function overallForReview(scores: ReviewDimensionScores): number {
  const core = [
    scores.quality,
    scores.communication,
    scores.punctuality,
    scores.value,
    scores.cleanliness
  ];
  const all = scores.trade_specific !== undefined
    ? [...core, scores.trade_specific]
    : core;
  const sum = all.reduce((a, b) => a + b, 0);
  return sum / all.length;
}

/** Time-decay weight for a single review based on age in days. Recent
 *  reviews matter more; ancient reviews still count but with reduced
 *  influence so an old 1-star doesn't ghost-cripple a business that's
 *  improved. */
export function timeDecayWeight(ageInDays: number): number {
  if (ageInDays < 180) return 1.0;   // < 6 months
  if (ageInDays < 365) return 0.75;  // 6-12 months
  if (ageInDays < 730) return 0.5;   // 1-2 years
  return 0.25;                       // 2+ years
}

/** Bayesian aggregate rating for a merchant.
 *  Formula: (v·R + m·C) / (v + m)
 *    v = weighted-count of reviews for this merchant
 *    R = weighted mean overall
 *    m = smoothing threshold (default 20)
 *    C = platform prior (default 4.3 — the observed platform average
 *        across all published reviews; recalculated periodically) */
export const BAYESIAN_SMOOTHING = 20;
export const PLATFORM_PRIOR = 4.3;

export function bayesianAggregate(
  reviews: TradeReview[],
  opts?: { platformPrior?: number; smoothing?: number; asOf?: number }
): { rating: number | null; weightedCount: number; rawCount: number } {
  const published = reviews.filter((r) => r.status === "published");
  if (published.length === 0) return { rating: null, weightedCount: 0, rawCount: 0 };

  const smoothing = opts?.smoothing ?? BAYESIAN_SMOOTHING;
  const prior = opts?.platformPrior ?? PLATFORM_PRIOR;
  const asOf = opts?.asOf ?? Date.now();

  let weightedSum = 0;
  let weightedCount = 0;
  for (const r of published) {
    const ageDays = (asOf - Date.parse(r.createdAt)) / (24 * 60 * 60 * 1000);
    const w = timeDecayWeight(ageDays) * (r.reviewer.weight ?? 1);
    weightedSum += overallForReview(r.scores) * w;
    weightedCount += w;
  }
  const R = weightedSum / weightedCount;
  const rating = (weightedCount * R + smoothing * prior) / (weightedCount + smoothing);
  return { rating, weightedCount, rawCount: published.length };
}

/** Dimension-level aggregates for the radar / bar breakdown chart on
 *  the reviews page. Same time-decay + reviewer weight applied. */
export function dimensionAverages(
  reviews: TradeReview[],
  opts?: { asOf?: number }
): Record<ReviewDimensionKey, number | null> {
  const asOf = opts?.asOf ?? Date.now();
  const published = reviews.filter((r) => r.status === "published");
  const dims: ReviewDimensionKey[] = ["quality", "communication", "punctuality", "value", "cleanliness", "trade_specific"];
  const out: Record<ReviewDimensionKey, number | null> = {
    quality: null, communication: null, punctuality: null, value: null, cleanliness: null, trade_specific: null
  };
  for (const dim of dims) {
    let sum = 0;
    let count = 0;
    for (const r of published) {
      const score = r.scores[dim];
      if (score === undefined) continue;
      const ageDays = (asOf - Date.parse(r.createdAt)) / (24 * 60 * 60 * 1000);
      const w = timeDecayWeight(ageDays) * (r.reviewer.weight ?? 1);
      sum += score * w;
      count += w;
    }
    out[dim] = count > 0 ? sum / count : null;
  }
  return out;
}

// ─── Zero-rating protection ────────────────────────────────

export type ReputationBadge =
  | { kind: "building"; reviewCount: number }             // < 5 reviews
  | { kind: "early"; reviewCount: number; rating: number } // 5-19 reviews
  | { kind: "established"; reviewCount: number; rating: number }; // 20+

/** The badge shown in place of a bare number on merchant surfaces.
 *  Fewer than 5 reviews = no numeric rating (protects new merchants
 *  from being crushed by a single hostile review). This is automatic,
 *  transparent, and time-limited by review volume — no admin fudging. */
export function reputationBadge(reviews: TradeReview[]): ReputationBadge {
  const { rating, rawCount } = bayesianAggregate(reviews);
  if (rawCount < 5 || rating === null) return { kind: "building", reviewCount: rawCount };
  if (rawCount < 20) return { kind: "early", reviewCount: rawCount, rating };
  return { kind: "established", reviewCount: rawCount, rating };
}

// ─── Filtering + sorting for the reviews page ──────────────

export type ReviewFilter = "all" | "verified-job" | "with-photos" | "recent";
export type ReviewSort = "relevance" | "newest" | "highest" | "lowest";

export function filterReviews(reviews: TradeReview[], filter: ReviewFilter): TradeReview[] {
  const base = reviews.filter((r) => r.status === "published");
  switch (filter) {
    case "verified-job":
      return base.filter((r) => r.jobVerification.kind === "job-tag");
    case "with-photos":
      return base.filter((r) => r.photoUrls.length > 0);
    case "recent": {
      const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
      return base.filter((r) => Date.parse(r.createdAt) >= cutoff);
    }
    case "all":
    default:
      return base;
  }
}

export function sortReviews(reviews: TradeReview[], sort: ReviewSort): TradeReview[] {
  const copy = [...reviews];
  const asOf = Date.now();
  switch (sort) {
    case "newest":
      return copy.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    case "highest":
      return copy.sort((a, b) => overallForReview(b.scores) - overallForReview(a.scores));
    case "lowest":
      return copy.sort((a, b) => overallForReview(a.scores) - overallForReview(b.scores));
    case "relevance":
    default:
      // Recency + helpfulness + reviewer weight — the "signal" sort.
      return copy.sort((a, b) => {
        const aScore = relevanceScore(a, asOf);
        const bScore = relevanceScore(b, asOf);
        return bScore - aScore;
      });
  }
}

function relevanceScore(r: TradeReview, asOf: number): number {
  const ageDays = (asOf - Date.parse(r.createdAt)) / (24 * 60 * 60 * 1000);
  const recency = timeDecayWeight(ageDays);
  const helpful = Math.log(1 + r.helpfulCount);
  const reviewerWeight = r.reviewer.weight;
  return recency * 3 + helpful * 1.5 + reviewerWeight;
}

// ─── Mock seed data ────────────────────────────────────────

const MERCHANT_SLUG = "demo-mike-watson-drywall-manchester";

const AV = {
  a: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop&crop=faces",
  b: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop&crop=faces",
  c: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces",
  d: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=200&h=200&fit=crop&crop=faces",
  e: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200&h=200&fit=crop&crop=faces",
  f: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=faces",
  g: "https://images.unsplash.com/photo-1552058544-f2b08422138a?w=200&h=200&fit=crop&crop=faces",
  h: "https://images.unsplash.com/photo-1610088441520-4352457e7095?w=200&h=200&fit=crop&crop=faces"
};

const PROJECT_PHOTOS = {
  kitchen: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop",
  handleless: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=400&fit=crop",
  utility: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=400&h=400&fit=crop"
};

const daysAgoISO = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

export const MOCK_REVIEWS: TradeReview[] = [
  {
    id: "rev_1",
    merchantSlug: MERCHANT_SLUG,
    reviewer: {
      slug: "demo-rachel-simms-kitchen-fitter",
      displayName: "Rachel Simms",
      tradeLabel: "Kitchen Fitter",
      city: "Manchester",
      avatarUrl: AV.a,
      weight: 1.5
    },
    jobVerification: { kind: "job-tag", when: daysAgoISO(6), label: "Verified job · 6 days ago" },
    scores: { quality: 5, communication: 5, punctuality: 5, value: 5, cleanliness: 5, trade_specific: 5 },
    body: "Turned up on time, worktops arrived perfect, invoice matched the quote. That's the whole game.",
    photoUrls: [PROJECT_PHOTOS.kitchen],
    status: "published",
    publishAt: null,
    createdAt: daysAgoISO(3),
    helpfulCount: 24
  },
  {
    id: "rev_2",
    merchantSlug: MERCHANT_SLUG,
    reviewer: {
      slug: "demo-tom-fisher-joiner",
      displayName: "Tom Fisher",
      tradeLabel: "Joiner",
      city: "Sheffield",
      avatarUrl: AV.b,
      weight: 1.5
    },
    jobVerification: { kind: "job-tag", when: daysAgoISO(14), label: "Verified job · 2 weeks ago" },
    scores: { quality: 5, communication: 5, punctuality: 4, value: 5, cleanliness: 5, trade_specific: 5 },
    body: "Mike sorted a bulk-buy on shaker doors for 4 flats. Saved £600 across the run, quality was spot on. One delivery was a day late but he called ahead — no fuss.",
    photoUrls: [PROJECT_PHOTOS.handleless],
    status: "published",
    publishAt: null,
    createdAt: daysAgoISO(9),
    helpfulCount: 17
  },
  {
    id: "rev_3",
    merchantSlug: MERCHANT_SLUG,
    reviewer: {
      slug: "demo-craig-mcdermott-electrician-leeds",
      displayName: "Craig McDermott",
      tradeLabel: "Electrician",
      city: "Leeds",
      avatarUrl: AV.c,
      weight: 1.5
    },
    jobVerification: { kind: "whatsapp-thread", when: daysAgoISO(21), label: "Verified WhatsApp · 3 weeks ago" },
    scores: { quality: 5, communication: 4, punctuality: 5, value: 5, cleanliness: 5, trade_specific: 4 },
    body: "Recommended by two other sparks in the canteen. Delivery quick, product held up to a rough fit.",
    photoUrls: [],
    status: "published",
    publishAt: null,
    createdAt: daysAgoISO(16),
    helpfulCount: 9
  },
  {
    id: "rev_4",
    merchantSlug: MERCHANT_SLUG,
    reviewer: {
      slug: "demo-sarah-whitmore-kitchen-fitter",
      displayName: "Sarah Whitmore",
      tradeLabel: "Kitchen Fitter",
      city: "Chester",
      avatarUrl: AV.d,
      weight: 1.0
    },
    jobVerification: { kind: "job-tag", when: daysAgoISO(28), label: "Verified job · 1 month ago" },
    scores: { quality: 4, communication: 5, punctuality: 4, value: 4, cleanliness: 4, trade_specific: 4 },
    body: "One panel arrived scuffed, replaced next-day no argument. Communication was the difference.",
    photoUrls: [],
    status: "published",
    publishAt: null,
    createdAt: daysAgoISO(21),
    ownerResponse: {
      body: "Thanks Sarah — the pallet took a knock in transit. Glad we caught it before install. If it happens again the replacement goes on our tab, no questions.",
      respondedAt: daysAgoISO(20),
      kind: "public-reply"
    },
    helpfulCount: 12
  },
  {
    id: "rev_5",
    merchantSlug: MERCHANT_SLUG,
    reviewer: {
      slug: "demo-jamie-blake-developer",
      displayName: "Jamie Blake",
      tradeLabel: "Property Developer",
      city: "Bristol",
      avatarUrl: AV.e,
      weight: 1.5
    },
    jobVerification: { kind: "job-tag", when: daysAgoISO(45), label: "Verified job · 6 weeks ago" },
    scores: { quality: 5, communication: 5, punctuality: 5, value: 5, cleanliness: 5, trade_specific: 5 },
    body: "12-unit refurb, everything shipped in staged deliveries so we weren't drowning in flat-packs. Would use again.",
    photoUrls: [PROJECT_PHOTOS.utility],
    status: "published",
    publishAt: null,
    createdAt: daysAgoISO(38),
    helpfulCount: 21
  },
  {
    id: "rev_6",
    merchantSlug: MERCHANT_SLUG,
    reviewer: {
      slug: "demo-dean-whitaker-bathroom",
      displayName: "Dean Whitaker",
      tradeLabel: "Bathroom Fitter",
      city: "Leeds",
      avatarUrl: AV.f,
      weight: 1.0
    },
    jobVerification: { kind: "job-tag", when: daysAgoISO(60), label: "Verified job · 2 months ago" },
    scores: { quality: 5, communication: 5, punctuality: 5, value: 5, cleanliness: 5 },
    body: "Only place I've found that stocks the 720mm units without a 3-week wait. Life-saver on tight timelines.",
    photoUrls: [],
    status: "published",
    publishAt: null,
    createdAt: daysAgoISO(52),
    helpfulCount: 8
  },
  {
    id: "rev_7",
    merchantSlug: MERCHANT_SLUG,
    reviewer: {
      slug: "demo-priya-menon-interior",
      displayName: "Priya Menon",
      tradeLabel: "Site Manager",
      city: "London",
      avatarUrl: AV.g,
      weight: 1.0
    },
    jobVerification: { kind: "whatsapp-thread", when: daysAgoISO(90), label: "Verified WhatsApp · 3 months ago" },
    scores: { quality: 5, communication: 5, punctuality: 5, value: 4, cleanliness: 5 },
    body: "Sent a joiner over to help re-plan a run when the room dimensions changed on-site. That's real service. Not cheap but worth it.",
    photoUrls: [PROJECT_PHOTOS.kitchen],
    status: "published",
    publishAt: null,
    createdAt: daysAgoISO(78),
    helpfulCount: 14
  },
  {
    id: "rev_8",
    merchantSlug: MERCHANT_SLUG,
    reviewer: {
      slug: "demo-alex-hughes-kitchen-fitter",
      displayName: "Alex Hughes",
      tradeLabel: "Kitchen Fitter",
      city: "Salford",
      avatarUrl: AV.h,
      weight: 1.0
    },
    jobVerification: { kind: "invoice", when: daysAgoISO(120), label: "Verified invoice · 4 months ago" },
    scores: { quality: 4, communication: 4, punctuality: 4, value: 4, cleanliness: 4, trade_specific: 4 },
    body: "Prices bang on trade rate. Only ding is the showroom is Manchester-only — would love a Leeds pickup for those of us further out.",
    photoUrls: [],
    status: "published",
    publishAt: null,
    createdAt: daysAgoISO(105),
    ownerResponse: {
      body: "Cheers Alex — a Leeds pickup point is on the roadmap for Q3. Follow the canteen for the launch date.",
      respondedAt: daysAgoISO(104),
      kind: "public-reply"
    },
    helpfulCount: 6
  }
];

export function reviewsForMerchant(merchantSlug: string): TradeReview[] {
  return MOCK_REVIEWS.filter((r) => r.merchantSlug === merchantSlug);
}
