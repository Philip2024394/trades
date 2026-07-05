// Business Operating Coach — barrel. Side-effect registers 10 seed
// recommendations.

import "./recommendations";

export { BusinessCoach, assess, backlog, DIMENSION_LABEL } from "./BusinessCoach";
export { BusinessCoachPanel } from "./BusinessCoachPanel";
export type { BusinessCoachPanelProps } from "./BusinessCoachPanel";
export {
  recommendationRegistry,
  REGISTRY_METADATA as RECOMMENDATION_REGISTRY_METADATA
} from "./recommendations";
export type {
  FrozenRecommendationManifest,
  RecommendationAction,
  RecommendationCategory,
  RecommendationCondition,
  RecommendationManifest,
  RecommendationRationale,
  RecommendationScope
} from "./recommendations";
export { HEALTH_DIMENSIONS, IMPACT_WEIGHT } from "./types";
export type {
  BacklogItem,
  BusinessHealthScore,
  CoachBacklog,
  CoachContext,
  HealthDimension,
  HealthScoreEntry,
  ImpactBand,
  RecommendationEvaluation
} from "./types";
