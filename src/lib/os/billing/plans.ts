// OS Billing — the plan catalog.
//
// Static. Every plan is code, not DB rows. This keeps price + quota +
// entitlement logic type-safe and lets us render pricing pages
// straight from the source of truth.
//
// Adding a new plan: add an entry here + the matching Stripe price id
// in the env var mapping. Nothing else.
import "server-only";

export type PlanTier = "bundled" | "starter" | "growth" | "unlimited" | "bundle";

export type OsBillingPlan = {
  key: string;                    // 'ai-visualiser.starter'
  appSlug: string;                // 'ai-visualiser' | 'merchant-pro-bundle'
  tier: PlanTier;
  displayName: string;
  pricePence: number;             // monthly, GBP
  monthlyQuota: number | null;    // null = unlimited
  overageRatePence: number;       // 0 = no overage
  /** Env var name holding the Stripe price id for this plan in prod.
   *  Testing/dev uses a matching *_TEST variant. */
  stripePriceEnvVar: string;
  /** Apps included when this plan is a bundle. */
  bundledAppSlugs?: string[];
};

export const OS_BILLING_PLANS: OsBillingPlan[] = [
  // ─── AI Visualiser ─────────────────────────────────────────────
  {
    key: "ai-visualiser.starter",
    appSlug: "ai-visualiser",
    tier: "starter",
    displayName: "AI Visualiser · Starter",
    pricePence: 1900,
    monthlyQuota: 100,
    overageRatePence: 30,
    stripePriceEnvVar: "STRIPE_PRICE_AI_VISUALISER_STARTER"
  },
  {
    key: "ai-visualiser.growth",
    appSlug: "ai-visualiser",
    tier: "growth",
    displayName: "AI Visualiser · Growth",
    pricePence: 4900,
    monthlyQuota: 400,
    overageRatePence: 20,
    stripePriceEnvVar: "STRIPE_PRICE_AI_VISUALISER_GROWTH"
  },
  {
    key: "ai-visualiser.unlimited",
    appSlug: "ai-visualiser",
    tier: "unlimited",
    displayName: "AI Visualiser · Unlimited",
    pricePence: 12900,
    monthlyQuota: 2000, // fair-use cap
    overageRatePence: 15,
    stripePriceEnvVar: "STRIPE_PRICE_AI_VISUALISER_UNLIMITED"
  },

  // ─── Quote Workspace ───────────────────────────────────────────
  {
    key: "quote-workspace.starter",
    appSlug: "quote-workspace",
    tier: "starter",
    displayName: "Quote Workspace · Starter",
    pricePence: 900,
    monthlyQuota: 25,
    overageRatePence: 100,
    stripePriceEnvVar: "STRIPE_PRICE_QUOTE_WORKSPACE_STARTER"
  },
  {
    key: "quote-workspace.growth",
    appSlug: "quote-workspace",
    tier: "growth",
    displayName: "Quote Workspace · Growth",
    pricePence: 2900,
    monthlyQuota: 200,
    overageRatePence: 50,
    stripePriceEnvVar: "STRIPE_PRICE_QUOTE_WORKSPACE_GROWTH"
  },
  {
    key: "quote-workspace.unlimited",
    appSlug: "quote-workspace",
    tier: "unlimited",
    displayName: "Quote Workspace · Unlimited",
    pricePence: 5900,
    monthlyQuota: null,
    overageRatePence: 0,
    stripePriceEnvVar: "STRIPE_PRICE_QUOTE_WORKSPACE_UNLIMITED"
  },

  // ─── Job Diary ─────────────────────────────────────────────────
  {
    key: "job-diary.starter",
    appSlug: "job-diary",
    tier: "starter",
    displayName: "Job Diary · Starter",
    pricePence: 900,
    monthlyQuota: 5,
    overageRatePence: 500,
    stripePriceEnvVar: "STRIPE_PRICE_JOB_DIARY_STARTER"
  },
  {
    key: "job-diary.growth",
    appSlug: "job-diary",
    tier: "growth",
    displayName: "Job Diary · Growth",
    pricePence: 1900,
    monthlyQuota: 25,
    overageRatePence: 200,
    stripePriceEnvVar: "STRIPE_PRICE_JOB_DIARY_GROWTH"
  },
  {
    key: "job-diary.unlimited",
    appSlug: "job-diary",
    tier: "unlimited",
    displayName: "Job Diary · Unlimited",
    pricePence: 3900,
    monthlyQuota: null,
    overageRatePence: 0,
    stripePriceEnvVar: "STRIPE_PRICE_JOB_DIARY_UNLIMITED"
  },

  // ─── Products ──────────────────────────────────────────────────
  //
  // Three entitlements for the three commercial personas. One
  // business may hold multiple (a merchant that also manufactures
  // own-brand accessories, a supplier that also runs retail counters).
  // Split across three distinct app_slugs so entitlement checks are
  // cheap 1-row lookups regardless of which persona a route serves.
  {
    key: "products.merchant",
    appSlug: "products",
    tier: "starter",
    displayName: "Products · Merchant",
    pricePence: 0,               // bundled with Merchant Pro
    monthlyQuota: null,
    overageRatePence: 0,
    stripePriceEnvVar: "STRIPE_PRICE_PRODUCTS_MERCHANT"
  },
  {
    key: "products.supplier",
    appSlug: "products-supplier",
    tier: "growth",
    displayName: "Products · Supplier",
    pricePence: 4900,
    monthlyQuota: null,
    overageRatePence: 0,
    stripePriceEnvVar: "STRIPE_PRICE_PRODUCTS_SUPPLIER"
  },
  {
    key: "products.manufacturer",
    appSlug: "products-manufacturer",
    tier: "unlimited",
    displayName: "Products · Manufacturer",
    pricePence: 9900,
    monthlyQuota: null,
    overageRatePence: 0,
    stripePriceEnvVar: "STRIPE_PRICE_PRODUCTS_MANUFACTURER"
  },

  // ─── Merchant Pro bundle ───────────────────────────────────────
  {
    key: "merchant-pro-bundle",
    appSlug: "merchant-pro-bundle",
    tier: "bundle",
    displayName: "Merchant Pro Bundle",
    pricePence: 1499,
    monthlyQuota: null, // per-app fair-use inside the bundle
    overageRatePence: 0,
    stripePriceEnvVar: "STRIPE_PRICE_MERCHANT_PRO_BUNDLE",
    bundledAppSlugs: [
      "ai-visualiser",
      "quote-workspace",
      "job-diary",
      "reviews",
      "crm",
      "products"                // merchant tier included in the bundle
    ]
  }
];

export const OS_BILLING_PLANS_BY_KEY: Record<string, OsBillingPlan> =
  Object.fromEntries(OS_BILLING_PLANS.map((p) => [p.key, p]));

export function planForStripePrice(
  stripePriceId: string
): OsBillingPlan | null {
  for (const plan of OS_BILLING_PLANS) {
    const configured = process.env[plan.stripePriceEnvVar];
    if (configured && configured === stripePriceId) return plan;
  }
  return null;
}

/** Free tier apps always in the entitlement projection. */
export const FREE_TIER_APPS: string[] = ["reviews", "crm"];
