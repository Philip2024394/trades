// Nex Project Intelligence — public barrel.
//
// Callers should never reach into adapters/ or registry.ts directly.
// Use buildProjectSnapshot / classifyProjectQuestion / buildSiteBriefing.

export type {
  AspectMetrics,
  Evidence,
  Metric,
  Observation,
  PIAdapter,
  PIAdapterContext,
  ProjectAspect,
  ProjectIdentity,
  ProjectSnapshot,
  TimelineEvent,
  ViewerContext,
  ViewerType
} from "./types";
export { evidenceFor } from "./types";

export { buildProjectSnapshot, _clearPiCache } from "./engine";
export type { BuildProjectOptions, BuildResult } from "./engine";
export { computeProjectHealth, bandFor, scoreMetric } from "./health";
export { assertHomeownerAccess, assertMerchantAccess, assertAccess } from "./permissions";
export type { AccessDecision } from "./permissions";
export { classifyProjectQuestion, answerProjectQuestion } from "./answer";
export type { PIQuestion } from "./answer";
export { buildSiteBriefing, siteBriefingToText } from "./site-briefing";
export type { SiteBriefing, SiteBriefingOptions } from "./site-briefing";
