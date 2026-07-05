// Business Operating Coach — types.
//
// The Coach continuously measures the gap between the CURRENT
// business (profile + strategy + published content + measured
// outcomes) and the DESIRED outcome (growth goal + trade defaults +
// playbook expectations). It emits a transparent Business Health
// Score and a prioritised backlog of recommendations.
//
// One question governs every recommendation:
//   "Will this help the tradesperson win more work, save time, or
//    make more money?"

import type { ContentManifest } from "@/platform/content";
import type { ResolvedStrategy } from "@/platform/business/resolver";

/** The six transparent dimensions of the Business Health Score. */
export type HealthDimension =
  | "strategy-alignment"
  | "trust"
  | "local-seo"
  | "portfolio"
  | "conversion"
  | "content-quality";

export const HEALTH_DIMENSIONS: readonly HealthDimension[] = [
  "strategy-alignment",
  "trust",
  "local-seo",
  "portfolio",
  "conversion",
  "content-quality"
] as const;

/** How impactful a recommendation is. Drives scoring + backlog
 *  ordering + merchant-facing badge. */
export type ImpactBand = "high" | "medium" | "low";

/** Numeric weight used when scoring — see BusinessCoach.assess. */
export const IMPACT_WEIGHT: Record<ImpactBand, number> = {
  high: 18,
  medium: 10,
  low: 4
};

/** Everything a recommendation's condition can inspect. Kept
 *  minimal — no side-effects, no I/O. */
export type CoachContext = {
  strategy: ResolvedStrategy;
  /** Currently published (or draft) ContentManifest. Optional — the
   *  coach still assesses strategy alignment even without content. */
  manifest?: ContentManifest;
  /** How many completed projects the merchant has uploaded. */
  projectCount?: number;
  /** How many customer reviews the merchant has published. */
  reviewCount?: number;
  /** Certifications the merchant holds — for compliance check. */
  certificationsHeld?: readonly string[];
  /** ISO 8601 of last strategy review — drives quarterly review nudge. */
  lastStrategyReviewAt?: string;
  /** Live metric values keyed by metricRegistry slug. */
  metricValues?: Record<string, number>;
  /** Which output medium we're coaching for. v1 = "website". */
  outputMedium?: string;
};

/** Result of a recommendation's condition check. */
export type RecommendationEvaluation = {
  triggered: boolean;
  /** Merchant-facing sentence explaining WHY this fired. Fully
   *  interpolated (numbers, service names) — no placeholders. */
  detail: string;
  /** Current observed value, if applicable. */
  currentValue?: number | string;
  /** Target value the recommendation is asking for. */
  targetValue?: number | string;
  /** Gap size 0-100 — 100 means the merchant is 100% short. */
  gapPercentage?: number;
};

/** One backlog item — the merchant-facing thing they click on. */
export type BacklogItem = {
  recommendationSlug: string;
  title: string;
  dimension: HealthDimension;
  priority: 1 | 2 | 3 | 4 | 5;                    // 5 = highest urgency
  estimatedImpact: ImpactBand;
  detail: string;
  actionLabel: string;
  /** Optional handler slug that the Studio maps to a route / wizard. */
  autoFix?: {
    handler: string;
    confirmationRequired?: boolean;
  };
  /** Provenance — same pattern as content blocks. */
  citedPlaybooks: readonly string[];
  citedPatterns: readonly string[];
  citedEvidence: readonly string[];
  whyItMatters: string;
  expectedOutcome: string;
};

/** Prioritised backlog for a given timeframe. */
export type CoachBacklog = {
  timeframe: "today" | "this-week" | "this-month" | "this-quarter";
  items: readonly BacklogItem[];
  generatedAt: string;
};

/** One dimension of the scorecard. */
export type HealthScoreEntry = {
  dimension: HealthDimension;
  score: number;                                  // 0-100
  reasoning: string;                              // "Missing certifications and additional completed projects"
  triggeredRecommendations: readonly string[];    // slugs
};

/** The transparent scorecard. */
export type BusinessHealthScore = {
  overall: number;                                // 0-100
  dimensions: readonly HealthScoreEntry[];
  /** Snapshot of what was assessed. */
  strategySnapshot: {
    profileSlug: string;
    strategySlug: string;
    recipeSlug: string;
    tradeSlug?: string;
    goal: string;
  };
  generatedAt: string;
};

/** Human labels for dimensions — used in the UI. */
export const DIMENSION_LABEL: Record<HealthDimension, string> = {
  "strategy-alignment": "Strategy Alignment",
  trust: "Trust",
  "local-seo": "Local SEO",
  portfolio: "Portfolio",
  conversion: "Conversion",
  "content-quality": "Content Quality"
};
