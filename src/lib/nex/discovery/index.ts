// src/lib/nex/discovery/index.ts
//
// UWI · Wave 3.3 · Discovery + governance public API.
// Founder-authorised programme.
//
// The ONLY sanctioned entry point for outbound discovery/fetch is
// `discoverAndFetch` from `./discovery-orchestrator`. Every other export
// here is a primitive that the orchestrator composes internally. Direct
// use of the primitives is permitted for tests + specialised callers but
// carries the responsibility of following the founder's 10-stage
// acceptance chain manually.

export * from "./types";
export {
  evaluate as evaluateRobots,
  assertAllowed as assertRobotsAllowed,
  RobotsDeniedError,
  NEX_USER_AGENT,
  _resetRobotsCacheForTests,
} from "./robots-gate";
export {
  canonicalise as canonicaliseUrl,
  tryCanonicalise as tryCanonicaliseUrl,
  UrlDedupLedger,
} from "./url-canonicalisation";
export {
  PolitenessScheduler,
  DEFAULT_POLITENESS,
  PolitenessDeadlineExceededError,
  PolitenessScheduleError,
  type PolitenessConfig,
} from "./politeness-scheduler";
export {
  conditionalFetch,
  FreshnessIndex,
  DEFAULT_CONDITIONAL_FETCH,
  RedirectChainExceededError,
  ConditionalFetchTimeoutError,
  type ConditionalFetchConfig,
} from "./conditional-fetch";
export {
  parseSitemap,
} from "./sitemap-parser";
export {
  extractContent,
  DEFAULT_EXTRACTOR,
  type ExtractorConfig,
} from "./content-extractor";
export {
  buildEvidenceRecord,
  withProvenanceStage,
  withExtraction,
  withFailure,
  type EvidenceRecordInput,
} from "./evidence-record";
export {
  discoverAndFetch,
  GLOBAL_JURISDICTION,
  DefaultJurisdiction,
  type OrchestratorDeps,
  type DiscoveryResult,
} from "./discovery-orchestrator";
