// src/lib/nex/discovery-world/index.ts
export * from "./types";
export {
  ISO_3166_1, UN_MEMBER_COUNT, TOTAL_COUNTRY_COUNT, type Iso3166Country,
} from "./iso-3166-1";
export {
  seedWorldCountryRegistry, loadWorldCountries, loadCountryByIso,
} from "./registry";
export {
  upsertProgramme, listProgrammes, loadProgrammeBySlug,
  setProgrammeCountryScope, loadProgrammeCountries,
} from "./programme";
export {
  claimCountry, completeCountryCycle, loadCountryStates, loadCountryState,
  loadWorldOverview,
} from "./country-state";
export {
  recordBusinessEvidence, loadBusinessesForCountry,
  type RecordBusinessInput,
} from "./business-evidence";
export {
  normalizeBusinessName, canonicalWebsite, normalizePhone, matchScore,
  recordEntityObservation, rejectEntity, loadEntitiesForCountry,
  _ENTITY_RESOLUTION_BOUNDARY_NEVER_FABRICATE,
  type EntityState, type EntityRow, type EntityObservation, type RecordEntityOutcome,
} from "./entity-resolution";
export {
  classifyEmail,
  _EMAIL_CLASSIFIER_PROVIDER_AGNOSTIC, _EMAIL_CLASSIFIER_NEVER_FABRICATES,
  type EmailType, type EmailEvidenceTier,
  type EmailClassificationInput, type EmailClassification,
} from "./email-classifier";
export {
  NULL_FETCHER, makeFixtureFetcher,
  type PageFetcher, type FetchInput, type FetchResult, type FetchOutcomeKind,
  type FixturePage,
} from "./page-fetcher";
export {
  extractEmails, _EXTRACTOR_NEVER_FABRICATES,
  type ExtractedEmail, type ExtractionMethod,
} from "./email-extractor";
export {
  walkEntityWebsite, SEED_PATHS, DEFAULT_WALKER,
  _WALKER_NEVER_LEAVES_ENTITY_DOMAIN, _WALKER_NEVER_CALLS_FETCH_DIRECTLY,
  type WalkerConfig, type WalkedPage, type WalkOutcome, type WalkInput,
} from "./website-walker";
export {
  processEntityCandidate, _CYCLE_ADAPTER_NULL_FETCHER_DEFAULT,
  type EntityCandidate, type AdaptedResult, type AdapterConfig,
} from "./cycle-adapter";
export {
  runOrchestrationTick, runReaper, tryAcquireLeader, releaseLeader,
  loadRecentTicks, loadOrchestrationStatus,
  _ORCHESTRATOR_TWO_CLOCK_DISCIPLINE, _ORCHESTRATOR_LEADER_SINGLE_WRITER,
  type OrchestrationTickInput, type OrchestrationTickReport, type OrchestrationStatus, type ReaperOutcome,
} from "./orchestrator";
export {
  loadScaffoldingProgrammeStatus,
  _STATUS_READ_ONLY, _STATUS_NEVER_RETURNS_EMAIL_ADDRESSES,
  _STATUS_ASIA_LAST_FROM_REGISTRY,
  _STATUS_ZERO_RESULTS_AND_SOURCE_UNAVAILABLE_DISTINCT,
  type ScaffoldingProgrammeStatus,
} from "./scaffolding-programme-status";
export {
  ProductionPageFetcher,
  createTargetScopedFetcher,
  _PRODUCTION_FETCHER_REQUIRES_ALLOWLIST_SIGNATURE,
  _PRODUCTION_FETCHER_REQUIRES_ACTIVATION_ENV,
  _PRODUCTION_FETCHER_ENFORCES_POLITENESS,
  _PRODUCTION_FETCHER_REDIRECTS_STAY_ON_ALLOWLIST,
  _PRODUCTION_FETCHER_TARGET_POLICY_DB_VERIFIED,
  type AllowedHost, type AllowlistFile, type ProductionPageFetcherOptions, type HttpClient,
  type PgQueryClient,
} from "./production-page-fetcher";
