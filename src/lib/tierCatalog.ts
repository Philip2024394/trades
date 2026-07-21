// tierCatalog — canonical source of truth for what each package
// tier includes.
//
// Consumed by:
//   src/app/trade-off/pricing/PricingTierCards.tsx (marketing page)
//   src/lib/tierCredits.ts (washer monthly replenish)
//   src/lib/upgradePrompts.ts (upgrade nudges)
//   src/app/trade-off/edit/[slug]/* (feature gates in dashboard)
//   docs/REVENUE_MAP.md (must be regenerated when this changes)
//
// Philip 2026-07-17 launch spec — reconciled from the 3 previously
// competing pricing narratives (live page / CLAUDE.md / REVENUE_MAP).
// This file wins going forward.

export type TierKey = "free" | "starter" | "professional" | "business" | "works";

export type PackageTier = {
  key:                  TierKey;
  label:                string;
  monthlyGbp:           number;
  annualGbp:            number | null;
  washerMonthlyCredit:  number;      // topped up on 1st of each month
  productCap:           number | null; // null = unlimited
  featuresIncluded:     string[];
  featuresHeadline:     string[];    // marketing bullets — short & punchy
  beaconSlots:          number;      // fanout size for this tier's leads
  aiVisualiserMonthly:  number;      // included renders per month
  /** @deprecated Store was folded into The Site (free browse). Kept
   *  as zero for schema stability — remove when all consumers gone. */
  storeDiscountPct:     number;
  /** True when the tier bundles a £14.99/mo The Site unlimited plan
   *  (unlimited image downloads + editor + post-to-Canteen/Yard).
   *  Read by src/lib/siteAccess.ts hasBundlingTier(). */
  siteInterestBundled:  boolean;
  customDomainIncluded: boolean;
  waitlist:             boolean;     // pricing page routes to /waitlist instead of /signup
  recommended:          boolean;     // "Recommended" badge on pricing page
  poweredByFooter:      boolean;     // shows "Powered by The Network" on canteen (viral loop)
  target:               string;      // 1-line target audience
};

/** Canonical tier catalogue — Philip 2026-07-17 launch spec.
 *  Prices in GBP. Annual = 10× monthly (2 months free). */
export const TIER_CATALOG: Record<TierKey, PackageTier> = {
  free: {
    key:                 "free",
    label:               "Free",
    monthlyGbp:          0,
    annualGbp:           0,
    washerMonthlyCredit: 0,
    productCap:          10,
    beaconSlots:         3,
    aiVisualiserMonthly: 0,
    storeDiscountPct:    0,
    siteInterestBundled: false,
    customDomainIncluded: false,
    waitlist:            false,
    recommended:         false,
    poweredByFooter:     true,        // ← Linktree-style viral loop
    target:              "Getting started, no card",
    featuresHeadline: [
      "Complete Business App",
      "Studio (visual editor)",
      "Link in Bio App",
      "Up to 10 products",
      "10 free WhatsApp leads (washers) on signup",
      "Powered by The Network footer"
    ],
    featuresIncluded: [
      "Starter Business App",
      "Studio (visual editor)",
      "Basic theme + Link in Bio",
      "Contact details + basic pages",
      "Publish immediately",
      "10 free washers on signup",
      "Beacon leads visible (contact requires washers)",
      "The Site — browse the full image wall"
    ]
  },
  starter: {
    key:                 "starter",
    label:               "Starter",
    monthlyGbp:          9.99,
    annualGbp:           99.99,
    washerMonthlyCredit: 50,          // £4.99 value/mo — pays for half the tier
    productCap:          null,
    beaconSlots:         3,
    aiVisualiserMonthly: 0,
    storeDiscountPct:    0,
    siteInterestBundled: false,
    customDomainIncluded: false,
    waitlist:            false,       // ← taken off waitlist
    recommended:         false,
    poweredByFooter:     false,
    target:              "Small businesses and sole traders",
    featuresHeadline: [
      "Everything in Free",
      "Unlimited products",
      "50 washers/mo included (£4.99 value)",
      "All 20 calculator apps",
      "8 canteen palettes",
      "Trade Center listing"
    ],
    featuresIncluded: [
      "Complete Business App",
      "Product Catalogue — unlimited",
      "All 20 calculator apps",
      "Trade Center listing",
      "50 washers/mo included",
      "Choose from 8 palettes",
      "3 canteen design slots",
      "Contact Forms",
      "Basic AI Assistance"
    ]
  },
  professional: {
    key:                 "professional",
    label:               "Professional",
    monthlyGbp:          14.99,
    annualGbp:           140,
    washerMonthlyCredit: 200,         // £14.99 value/mo — tier pays for itself
    productCap:          null,
    beaconSlots:         3,           // priority-ranked in fanout
    aiVisualiserMonthly: 5,
    storeDiscountPct:    0,
    siteInterestBundled: true,        // ← The Site unlimited bundled (£14.99 value)
    customDomainIncluded: false,      // add-on £4.99/mo
    waitlist:            false,
    recommended:         true,        // ← headline tier
    poweredByFooter:     false,
    target:              "Growing businesses",
    featuresHeadline: [
      "Everything in Starter",
      "200 washers/mo included (£14.99 value — tier pays for itself)",
      "AI Visualiser — 5 renders/mo",
      "The Site — unlimited images + editor included",
      "Priority in beacon lead routing",
      "Analytics dashboard",
      "Custom domain add-on £4.99/mo"
    ],
    featuresIncluded: [
      "Everything in Starter",
      "200 washers/mo included",
      "Trade Circle access",
      "AI Content Tools",
      "AI Visualiser — 5 renders/mo",
      "The Site unlimited (£14.99/mo value bundled)",
      "Priority beacon routing (Tier 1 rank)",
      "Analytics dashboard",
      "Advanced Studio features",
      "Advanced promotions",
      "Custom domain add-on £4.99/mo"
    ]
  },
  business: {
    key:                 "business",
    label:               "Business",
    monthlyGbp:          24.99,
    annualGbp:           240,
    washerMonthlyCredit: 1000,        // £49.99 value/mo
    productCap:          null,
    beaconSlots:         5,
    aiVisualiserMonthly: 20,
    storeDiscountPct:    0,
    siteInterestBundled: false,
    customDomainIncluded: true,       // ← included
    waitlist:            false,       // ← taken off waitlist
    recommended:         false,
    poweredByFooter:     false,
    target:              "Larger merchants and growing companies",
    featuresHeadline: [
      "Everything in Professional",
      "1,000 washers/mo included (£49.99 value)",
      "Multi-user team accounts",
      "Custom domain included",
      "Verified badge fast-track",
      "5-slot beacon fanout (vs 3)",
      "Featured Placement — 1 slot/mo"
    ],
    featuresIncluded: [
      "Everything in Professional",
      "1,000 washers/mo included",
      "Multi-user team accounts",
      "Multiple locations",
      "Custom domain included",
      "Verified badge fast-track",
      "Beacon fanout: 5 slots (vs 3)",
      "Featured Placement — 1 free slot/mo",
      "AI Visualiser — 20 renders/mo",
      "Priority support",
      "Premium Industry Packs",
      "Advanced automation"
    ]
  },
  works: {
    key:                 "works",
    label:               "The Works",
    monthlyGbp:          39.99,
    annualGbp:           399,
    washerMonthlyCredit: 999999,      // effectively unlimited
    productCap:          null,
    beaconSlots:         5,
    aiVisualiserMonthly: 999999,
    storeDiscountPct:    0,
    siteInterestBundled: true,        // ← The Site unlimited bundled
    customDomainIncluded: true,
    waitlist:            false,
    recommended:         false,
    poweredByFooter:     false,
    target:              "Unlimited everything for high-volume merchants",
    featuresHeadline: [
      "Everything in Business",
      "UNLIMITED washers",
      "The Site — unlimited images + editor included",
      "Merchant Pro bundle (all add-ons)",
      "AI Visualiser — unlimited",
      "Priority everything"
    ],
    featuresIncluded: [
      "Everything in Business",
      "Unlimited washers",
      "The Site unlimited (£14.99/mo value bundled)",
      "Merchant Pro bundle (building-merchant + builders-supplies)",
      "AI Visualiser — unlimited renders",
      "Custom domain included",
      "Priority beacon slot everywhere",
      "Priority support (Verified badge auto-granted)"
    ]
  }
};

/** Ordered array for pricing-page rendering. */
export const TIER_ORDER: TierKey[] = ["free", "starter", "professional", "business", "works"];

/** Look up a tier by its DB `tier` column value. Free-tier merchants
 *  in the DB may show as `app_expired`, `app_trial`, or missing — all
 *  resolve to `free` for feature gating. */
export function tierFromDbValue(dbTier: string | null | undefined): PackageTier {
  const t = (dbTier ?? "").toLowerCase();
  if (t === "app_paid" || t === "professional") return TIER_CATALOG.professional;
  if (t === "starter")                          return TIER_CATALOG.starter;
  if (t === "business")                         return TIER_CATALOG.business;
  if (t === "works" || t === "app_verified")   return TIER_CATALOG.works;
  return TIER_CATALOG.free;
}
