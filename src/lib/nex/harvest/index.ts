// src/lib/nex/harvest/index.ts
//
// NEX 24/7 World Harvest Engine · Wave H1 · public barrel
// Founder-authorised programme · 2026-09-22.

export * from "./types";
export {
  enqueueJob, claimNextJob, heartbeatJob, completeJob, failJob,
  redriveJob, loadJob, loadQueueSummary, backoffMs,
} from "./queue";
export {
  registerWorker, workerHeartbeat, drainWorker, bumpWorkerCounters,
  loadWorker, loadWorkers,
} from "./worker";
export { runHarvestReaper } from "./reaper";
export { recordYield, loadRecentYield, loadYieldSummary, type YieldSummary } from "./yield";
export {
  listAllSources, loadSourceBySlug, loadSourcesForScope,
  disableSource, enableSource, quarantineSource,
  recordProbeAttempt, scheduleSourceProbes,
  _REGISTRY_FOUNDER_SIGNATURE_REQUIRED,
  _REGISTRY_NEVER_RUNTIME_ADDS,
  _REGISTRY_FEEDS_QUEUE,
  _REGISTRY_HEALTH_FROM_EXECUTOR_ONLY,
  type HarvestSource, type SourceType, type DiscoveryMethod,
  type SourceFilter, type ProbeAttemptResult,
  type ScheduleSourceProbesInput, type ScheduleSourceProbesReport,
} from "./source-registry";
export {
  NULL_OVERPASS_ADAPTER, makeFixtureOverpassAdapter,
  buildOverpassQuery, parseOverpassResponse,
  extractCandidateFromElement, canonicaliseWebsite,
  _OVERPASS_NEVER_FABRICATES_WEBSITE, _OVERPASS_NEVER_FABRICATES_EMAIL,
  _OVERPASS_NULL_ADAPTER_DEFAULT, _OVERPASS_EXTERNAL_REF_DETERMINISTIC,
  type OverpassAdapter, type OverpassRawElement, type OverpassProbeInput,
  type OverpassProbeResult, type OverpassProbeKind, type ExtractedCandidate,
} from "./overpass-adapter";
export {
  insertBusinessCandidate, attachWebsiteWalkJob, loadCandidates,
  _CANDIDATE_NEVER_DELETES, _CANDIDATE_IDEMPOTENT_INSERT,
  _CANDIDATE_WEBSITE_URL_NULLABLE,
  type HarvestBusinessCandidate, type InsertCandidateInput,
  type InsertCandidateOutcome, type CandidatesQuery, type CandidatesReport,
} from "./business-candidate";
export {
  executeSourceProbe,
  _EXECUTOR_RETAINS_EVERY_BUSINESS_ELEMENT,
  _EXECUTOR_NEVER_FABRICATES_WEBSITE,
  _EXECUTOR_NEVER_FABRICATES_EMAIL,
  _EXECUTOR_SOURCE_ZERO_NOT_COUNTRY_ZERO,
  _EXECUTOR_WEBSITE_JOBS_ARE_DURABLE,
  type ExecuteSourceProbeInput, type SourceProbeExecuteResult,
} from "./source-probe-executor";
export {
  executeWebsiteWalk,
  _WEBSITE_WALK_NEVER_GENERATES_EMAIL,
  _WEBSITE_WALK_USES_SESSION_2_EXTRACTOR,
  _WEBSITE_WALK_PRESERVES_DISTINCT_COUNTERS,
  _WEBSITE_WALK_NULL_FETCHER_DEFAULT,
  _WEBSITE_WALK_STATUS_TRUTHFUL,
  type ExecuteWebsiteWalkInput, type WebsiteWalkExecuteResult,
  type WebsiteWalkStatus, type WalkerFn,
} from "./website-walk-executor";
export {
  selectNextCountriesForScheduling,
  _SCHEDULER_ASIA_LAST_ENFORCED_AT_RUNTIME,
  _SCHEDULER_CADENCE_RESPECTED,
  _SCHEDULER_READS_EXISTING_TABLES_ONLY,
  type CountryEligibility, type SelectCountriesInput, type SelectCountriesReport,
} from "./country-scheduler";
export {
  runHarvestControllerTick,
  _CONTROLLER_PURE_COMPOSITION,
  _CONTROLLER_ADAPTERS_INJECTABLE_NULL_DEFAULTS,
  _CONTROLLER_ASIA_LAST_ENFORCED_AT_SCHEDULER,
  _CONTROLLER_ACTIVE_MEANS_YIELD_NOT_HEARTBEAT,
  type ControllerTickInput, type ControllerTickResult,
} from "./controller";
export {
  ProductionOverpassAdapter,
  _PRODUCTION_OVERPASS_REQUIRES_EXPLICIT_ALLOWLIST,
  _PRODUCTION_OVERPASS_NULL_ADAPTER_REMAINS_DEFAULT,
  _PRODUCTION_OVERPASS_USES_SESSION_6_PARSER,
  _PRODUCTION_OVERPASS_NEVER_FABRICATES,
  _PRODUCTION_OVERPASS_TIMEOUT_AND_SIZE_CAPPED,
  type ProductionOverpassAdapterOptions,
  type HttpClient as ProductionOverpassHttpClient,
} from "./production-overpass-adapter";
export {
  resolveProductionHarvestAdapters,
  _PRODUCTION_BOOT_GATED_BY_ACTIVATION_ENV,
  _PRODUCTION_BOOT_HOSTS_FROM_FOUNDER_SIGNED_ALLOWLIST,
  _PRODUCTION_BOOT_NEVER_THROWS,
  _PRODUCTION_BOOT_IS_THE_ONLY_PRODUCTION_CONSTRUCTOR,
  type ProductionBootDeps,
  type ResolvedProductionAdapters,
} from "./production-boot";
