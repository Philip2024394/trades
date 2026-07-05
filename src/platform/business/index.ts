// Business Growth Intelligence — top-level barrel.
//
// Import order matters:
//  1. facetKindRegistry (playbooks reference kinds)
//  2. playbookRegistry (recipes reference playbooks)
//  3. profile + strategy + recipes (independent)
//  4. resolver (consumes all above)

import "./facets";
import "./trades";
import "./playbooks";
import "./profile";
import "./strategy";
import "./recipes";

export { businessProfileRegistry } from "./profile";
export { growthStrategyRegistry } from "./strategy";
export { playbookRegistry } from "./playbooks";
export { websiteRecipeRegistry } from "./recipes";
export { facetKindRegistry } from "./facets";
export { tradeIntelligenceRegistry } from "./trades";
export type {
  BusinessGoalOption,
  CommonFaq,
  CommonObjection,
  ContentFlow,
  ContentFlowPlacement,
  FrozenTradeIntelligenceManifest,
  ImageStrategy,
  PositioningModifiers,
  PositioningOverride,
  SeoKeywordTemplate,
  ServiceEconomics,
  TradeEvidence,
  TradeIntelligenceManifest,
  TrustBuilderKind
} from "./trades";
export { resolve, strategyResolver } from "./resolver";
export type { ResolvedStrategy, FacetProvenance } from "./resolver";
export {
  explainStrategy,
  groupDecisionsByBucket,
  StrategyExplainerPanel
} from "./explainer";
export type {
  ExplanationBucket,
  ExplanationLine,
  StrategyExplanation,
  StrategyExplainerPanelProps
} from "./explainer";
