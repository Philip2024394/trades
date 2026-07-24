// Nex Business Intelligence — public barrel.
//
// One import for the engine, one for the answer path, one for the
// briefing integration. Adapters + registry are implementation
// details; callers should never reach into them directly.

export type {
  BIAdapter,
  BIAdapterContext,
  BusinessHealth,
  DomainKey,
  DomainMetrics,
  Evidence,
  Metric,
  Observation
} from "./types";
export { evidenceFor } from "./types";

export { buildBusinessSnapshot, _clearBiCache } from "./engine";
export { computeHealth, bandFor, scoreMetric } from "./health";
export { answerBIQuestion, classifyBIQuestion } from "./answer";
export { streamObservations, briefingBullets } from "./observations";
export { adapterByDomain, ADAPTERS } from "./registry";
