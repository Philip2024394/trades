// Trust ladder — Bronze → Silver → Gold → Platinum.
//
// Single source of truth for the criteria + tier computation.
// Used by:
//   • /api/merchant/trust-ladder            (read for merchant)
//   • /api/cron/recompute-trust-ladders     (nightly recompute)
//   • listing update triggers (post-review, post-subscription)
//
// Every tier requires the tier below it PLUS the new criteria. This
// keeps promotion / demotion logic simple: recompute the highest
// tier where all criteria are met.

export type TrustTier = "bronze" | "silver" | "gold" | "platinum";

export const TRUST_TIER_ORDER: TrustTier[] = ["bronze", "silver", "gold", "platinum"];

export const TRUST_TIER_META: Record<TrustTier, {
  label:        string;
  color:        string;   // badge chip colour
  accentText:   string;   // dark accent text on the chip
  bumpSort:     number;   // yard-sort algorithmic boost points
  perks:        string[];
}> = {
  bronze: {
    label:      "Bronze",
    color:      "#CD7F32",
    accentText: "#FFFFFF",
    bumpSort:   0,
    perks: [
      "Live canteen profile at thenetworkers.app/{slug}",
      "10 washer signup credit",
      "Reviews you can request from customers"
    ]
  },
  silver: {
    label:      "Silver Verified",
    color:      "#C0C0C0",
    accentText: "#111111",
    bumpSort:   50,
    perks: [
      "Silver Verified badge on canteen + yard",
      "Small algorithmic boost in yard sort",
      "Access to Reviews inbox + response tools",
      "Access to Insights dashboard"
    ]
  },
  gold: {
    label:      "Gold Trusted",
    color:      "#FFB300",
    accentText: "#0A0A0A",
    bumpSort:   200,
    perks: [
      "Gold Trusted badge (higher visibility)",
      "Priority in yard sort",
      "Response-time badge on canteen page",
      "Trust score change analytics — see why weekly",
      "Featured-slot rotation eligibility"
    ]
  },
  platinum: {
    label:      "Platinum Elite",
    color:      "#4A5568",
    accentText: "#FFFFFF",
    bumpSort:   500,
    perks: [
      "Platinum Elite badge (max visibility)",
      "Top algorithmic priority in every yard search",
      "Cover-slot feature in canteen search",
      "Custom badge colour unlock (£2.99 one-time)",
      "Landing-page rotation eligibility",
      "Detailed benchmark reports vs local peers"
    ]
  }
};

export type Criterion = {
  slug:        string;
  label:       string;
  hint?:       string;
  /** Which tier this criterion is REQUIRED for. Merchant sees it
   *  as an unlock on the ladder for that tier. */
  requiredFor: TrustTier;
  /** Points awarded to the merchant's trust_score when met. Higher
   *  than the tier gate itself so merchants can see progress even
   *  before they hit the tier. */
  points:      number;
  /** When TRUE, merchant can pay to skip this criterion (currently
   *  only the manual insurance queue). */
  payToSkip?:  { priceGbp: number; skus: string };
};

export const CRITERIA: Criterion[] = [
  // ─── Silver criteria ───
  { slug: "profile_complete",    label: "Profile 100% complete",       requiredFor: "silver", points: 30,  hint: "Bio · avatar · trade · location · hours" },
  { slug: "whatsapp_verified",   label: "WhatsApp connected",          requiredFor: "silver", points: 20,  hint: "The primary lead channel for UK trades" },
  { slug: "min_photos_3",        label: "3+ portfolio photos",         requiredFor: "silver", points: 20,  hint: "Show your work" },
  { slug: "min_reviews_1",       label: "1+ customer review",          requiredFor: "silver", points: 30,  hint: "Any rating — proves you have customers" },

  // ─── Gold criteria ───
  { slug: "days_active_30",      label: "30+ days active on platform", requiredFor: "gold",   points: 40,  hint: "You've been here a while" },
  { slug: "min_reviews_10",      label: "10+ customer reviews",        requiredFor: "gold",   points: 80 },
  { slug: "min_avg_rating_4_0",  label: "4.0+ average rating",         requiredFor: "gold",   points: 60 },
  { slug: "tier_pro_sub",        label: "Pro tier subscription (£14.99/mo)", requiredFor: "gold", points: 100 },
  { slug: "insurance_verified",  label: "Public liability insurance verified", requiredFor: "gold", points: 80, hint: "Manual queue OR £4.99 to skip", payToSkip: { priceGbp: 499, skus: "trust_skip_queue" } },

  // ─── Platinum criteria ───
  { slug: "min_reviews_25",       label: "25+ customer reviews",       requiredFor: "platinum", points: 120 },
  { slug: "min_avg_rating_4_5",   label: "4.5+ average rating",        requiredFor: "platinum", points: 100 },
  { slug: "trade_body_verified",  label: "Trade body membership verified", requiredFor: "platinum", points: 100, hint: "FMB, TrustMark, Federation of Master Builders etc" },
  { slug: "tier_business_sub",    label: "Business tier subscription (£24.99/mo)", requiredFor: "platinum", points: 150 }
];

export type CriterionState = Criterion & { met: boolean; valueSnapshot?: unknown };

/** Compute the highest tier a merchant qualifies for given the
 *  criteria states. Every criterion for the target tier AND for
 *  every tier below it must be met. */
export function computeTier(criteria: CriterionState[]): TrustTier {
  const bySlug = new Map(criteria.map((c) => [c.slug, c]));
  const met = (slug: string) => !!bySlug.get(slug)?.met;

  const silverPass   = CRITERIA.filter((c) => c.requiredFor === "silver").every((c) => met(c.slug));
  const goldPass     = silverPass   && CRITERIA.filter((c) => c.requiredFor === "gold").every((c) => met(c.slug));
  const platinumPass = goldPass     && CRITERIA.filter((c) => c.requiredFor === "platinum").every((c) => met(c.slug));

  if (platinumPass) return "platinum";
  if (goldPass)     return "gold";
  if (silverPass)   return "silver";
  return "bronze";
}

/** Sum trust points across met criteria. Ceiling ~1000 with every
 *  criterion met. Used for tie-breaking in yard sort AND for
 *  showing the merchant a growing number they can chase. */
export function computeScore(criteria: CriterionState[]): number {
  return criteria.filter((c) => c.met).reduce((sum, c) => sum + c.points, 0);
}

/** For "you're X% of the way to Silver / Gold / Platinum" progress
 *  bars in the dashboard. */
export function tierProgress(criteria: CriterionState[], target: TrustTier): { met: number; total: number } {
  const idx = TRUST_TIER_ORDER.indexOf(target);
  const requiredForTargetOrBelow = CRITERIA.filter((c) => TRUST_TIER_ORDER.indexOf(c.requiredFor) <= idx);
  const met = requiredForTargetOrBelow.filter((c) => criteria.find((s) => s.slug === c.slug)?.met).length;
  return { met, total: requiredForTargetOrBelow.length };
}

/** Return the next tier above `current` and the criteria that
 *  remain unmet to reach it. Null when merchant is already
 *  Platinum. */
export function nextTierGap(current: TrustTier, criteria: CriterionState[]): { next: TrustTier; missing: CriterionState[] } | null {
  const idx = TRUST_TIER_ORDER.indexOf(current);
  const next = TRUST_TIER_ORDER[idx + 1];
  if (!next) return null;
  const missing = criteria.filter((c) => c.requiredFor === next && !c.met);
  return { next, missing };
}
