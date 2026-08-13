// End-to-End Pipeline · public exports.
//
// Doctrine: docs/brains/nex-end-to-end-pipeline-philip-2026-08-03.md
// Recommendation Engine: docs/brains/nex-recommendation-engine-philip-2026-08-03.md

export { converse } from "./converse";
export { generateRecommendations } from "./recommend";
export type {
  PipelineRequest,
  PipelineResponse,
  PipelineTrace,
  LayeredConfidence,
  CoverageCheck,
  AssembledResponse,
} from "./types";
export type {
  Recommendation,
  RecommendationCategory,
  RecommendationSet,
} from "./recommend";
