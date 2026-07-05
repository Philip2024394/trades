// recommendationRegistry — barrel. Side-effect registers 10 seeds.

import "./seeds";

export { recommendationRegistry, REGISTRY_METADATA } from "./registry";
export type {
  FrozenRecommendationManifest,
  RecommendationAction,
  RecommendationCategory,
  RecommendationCondition,
  RecommendationManifest,
  RecommendationRationale,
  RecommendationScope
} from "./types";
