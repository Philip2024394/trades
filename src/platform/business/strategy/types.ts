// growthStrategyRegistry — types.
//
// WHAT the merchant wants NOW. Dynamic — changes quarterly. Per-
// merchant instances persist in studio_growth_strategy with an active
// window and historical archive.

export type BusinessGoal =
  | "lead-generation"
  | "bookings"
  | "quotes"
  | "portfolio-showcase"
  | "ecommerce"
  | "brand-awareness"
  | "trust-building"
  | "increase-average-job-value"
  | "increase-conversion-rate"
  | "increase-repeat-work"
  | "increase-reviews"
  | "increase-referrals"
  | "expand-service-area"
  | "hire-staff";

export type GrowthStrategyManifest = {
  manifestVersion: 1;
  slug: string;
  name: string;
  description: string;
  version: string;

  appliesToTrades: readonly string[];        // ["*"] = any
  appliesToPositioning?: readonly string[];  // ["premium", "luxury"]

  currentGoal: BusinessGoal;
  secondaryGoal?: BusinessGoal;
  quarterGoal?: string;                       // free-text quarterly target

  pushServices: readonly string[];            // service slugs to emphasise
  reduceServices?: readonly string[];         // service slugs to de-emphasise
  hideServices?: readonly string[];           // service slugs to hide entirely

  targetJobValueMin?: number;
  targetCustomers?: readonly string[];        // customer archetypes

  seasonalPriorities?: readonly {
    season: "spring" | "summer" | "autumn" | "winter";
    pushServices: readonly string[];
  }[];

  kpiTargets?: readonly {
    metric: string;
    target: number;
    unit: string;
    horizonDays: number;
  }[];

  publisher?: { name: string; verified: boolean };
};

export type FrozenGrowthStrategyManifest = Readonly<GrowthStrategyManifest>;
