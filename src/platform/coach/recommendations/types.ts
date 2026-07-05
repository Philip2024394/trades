// recommendationRegistry — types.
//
// A recommendation ≠ a playbook.
//   - Playbook: how to build a website / dashboard / booking flow.
//   - Recommendation: what action to suggest when the merchant's
//     CURRENT state falls short of the STRATEGY-implied ideal.
//
// Each recommendation is a small, testable rule: condition + action
// + rationale + provenance. The Business Coach walks them all and
// fires the ones whose condition returns triggered=true.

import type {
  CoachContext,
  HealthDimension,
  ImpactBand,
  RecommendationEvaluation
} from "../types";

/** Category the recommendation broadly belongs to. Different from
 *  dimension — a "trust-certifications-missing" recommendation is
 *  category "trust" AND dimension "trust". Others may split. */
export type RecommendationCategory =
  | "strategy"
  | "trust"
  | "seo"
  | "portfolio"
  | "conversion"
  | "content"
  | "compliance"
  | "operations";

/** How the merchant's site scopes this recommendation. */
export type RecommendationScope = {
  trades: readonly string[];                     // ["*"] = any
  countries: readonly string[];                  // ["*"] = any
  goals?: readonly string[];
  profileFlags?: readonly string[];
};

/** The evaluatable condition — a pure function against CoachContext. */
export type RecommendationCondition = {
  /** Merchant-facing description of the CHECK — "Portfolio < 10". */
  description: string;
  /** Pure function returning triggered + detail. */
  check: (ctx: CoachContext) => RecommendationEvaluation;
};

/** What to do about it. */
export type RecommendationAction = {
  /** Merchant-facing action label — "Upload more projects". */
  label: string;
  /** Optional auto-fix — Studio maps handler slug to route / wizard. */
  autoFix?: {
    handler: string;
    confirmationRequired?: boolean;
  };
};

/** Why it matters. */
export type RecommendationRationale = {
  whyItMatters: string;
  expectedOutcome: string;
};

export type RecommendationManifest = {
  manifestVersion: 1;
  slug: string;
  title: string;                                 // "Upload more door projects"
  description: string;
  version: string;

  dimension: HealthDimension;
  category: RecommendationCategory;
  scope: RecommendationScope;

  condition: RecommendationCondition;
  action: RecommendationAction;

  /** 1-5, 5 = highest urgency. */
  priority: 1 | 2 | 3 | 4 | 5;
  estimatedImpact: ImpactBand;

  /** Provenance — same pattern as content blocks + playbook rationale. */
  citesPlaybooks?: readonly string[];
  citesPatterns?: readonly string[];
  citesEvidence?: readonly string[];

  rationale: RecommendationRationale;

  publisher?: {
    name: string;
    verified: boolean;
    contactUrl?: string;
  };
};

export type FrozenRecommendationManifest = Readonly<RecommendationManifest>;
