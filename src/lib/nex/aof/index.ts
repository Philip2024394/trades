// src/lib/nex/aof/index.ts
//
// NEX Autonomous Operations Framework · public barrel
// Founder-authorised programme · 2026-09-22.

export * from "./types";
export {
  registerAgent, signAgent, setAgentStatus,
  loadAgent, loadAgentByName, listAgents, touchAgentLastSeen,
  type RegisterAgentInput, type SignAgentInput, type SetStatusInput,
} from "./agent-registry";
export {
  grantCapability, revokeCapability, hasCapability, requireCapability, listCapabilities,
  CapabilityDenied,
  type GrantCapabilityInput,
} from "./capability";
export {
  logAgentEvent, loadRecentEvents, agentHeartbeat,
  type LogEventInput,
} from "./lifecycle";
export {
  startCycle, updateCycleCounters, endCycle, loadCycle, loadRecentCycles,
  type StartCycleInput, type UpdateCycleCountersInput, type EndCycleInput,
} from "./cycle";
export {
  decideCanProceed, computeBackoffMs, computeCooldownMs, HostStateTracker,
  DEFAULT_RATE_GOVERNOR_CONFIG,
  _GOVERNOR_NEVER_BYPASSES_LIMITS, _GOVERNOR_COOLDOWN_ESCALATES,
  type RateGovernorConfig, type ProceedInput, type ProceedDecision, type HostState,
} from "./governors/rate-governor";
export {
  applyCooldown, clearCooldown, loadCooldown, listActiveCooldowns,
  isSourceOnCooldown, recordSourceSuccess,
  type ApplyCooldownInput,
} from "./governors/source-cooldown";
export {
  selectNextSource,
  _FAILOVER_NEVER_BYPASSES_COOLDOWN, _FAILOVER_NEVER_USES_UNSIGNED_SOURCE,
  type SourceCandidate, type SelectSourceInput, type SelectSourceResult,
} from "./governors/failover";
export {
  NULL_NOMINATIM_ADAPTER, ProductionNominatimAdapter, extractNominatimCandidate,
  _NOMINATIM_NULL_ADAPTER_DEFAULT, _NOMINATIM_REQUIRES_EXPLICIT_ALLOWLIST, _NOMINATIM_NEVER_FABRICATES,
  type NominatimAdapter, type NominatimSearchInput, type NominatimSearchResult,
  type NominatimSearchKind, type NominatimRawElement, type NominatimCandidate,
  type ProductionNominatimAdapterOptions, type NominatimHttpClient,
} from "./adapters/nominatim-adapter";
export {
  NULL_WIKIDATA_ADAPTER, ProductionWikidataAdapter,
  buildScaffoldingSparql, parseWikidataSparqlJson, extractWikidataCandidate,
  _WIKIDATA_NULL_ADAPTER_DEFAULT, _WIKIDATA_REQUIRES_EXPLICIT_ALLOWLIST,
  _WIKIDATA_NEVER_INFERS_WEBSITE, _WIKIDATA_NEVER_FABRICATES_EMAIL,
  _WIKIDATA_QID_IS_EXTERNAL_REF, _WIKIDATA_DOMAIN_ALLOWLIST_BOUNDED,
  type WikidataAdapter, type WikidataSearchInput, type WikidataSearchResult,
  type WikidataSearchKind, type WikidataRawBinding, type WikidataCandidate,
  type WikidataQueryDomain, type ProductionWikidataAdapterOptions, type WikidataHttpClient,
} from "./adapters/wikidata-adapter";
export {
  AdapterRegistry, buildDefaultDiscoveryRegistry,
  _REGISTRY_HAS_NULL_ADAPTERS_UNTIL_ALLOWLISTED,
  type DiscoveryAdapterEntry, type BuildDefaultRegistryInput,
} from "./adapters/registry";
export {
  lookupExistingCandidate, recordRediscovery, normaliseBusinessName, canonicalHost,
  _DEDUP_CANONICAL_WEBSITE_FIRST, _DEDUP_NAME_MATCH_REQUIRES_COUNTRY,
  _DEDUP_REDISCOVERY_LOGS_NEVER_INSERTS_DUPLICATE,
  type CrossSourceIdentityInput, type CrossSourceLookupResult, type RediscoveryInput,
} from "./dedup";
export {
  loadFounderSignedSources, selectSourceFor, recordFailure, recordSuccess,
  type SourceIntelligenceAgentDeps, type SelectForInput,
} from "./agents/source-intelligence-agent";
export {
  discover,
  type DiscoveryAgentDeps, type DiscoverInput, type DiscoverOutcome,
} from "./agents/discovery-agent";
export {
  drainWebsiteWalks,
  type WebsiteWalkAgentDeps, type DrainInput, type DrainOutcome,
} from "./agents/website-walk-agent";
export {
  auditEvidenceChain,
  _EVIDENCE_AUDIT_FAILS_SOFT_ORBITING_DECIDES, _EVIDENCE_AUDIT_NEVER_MUTATES_EVIDENCE,
  type EvidenceAuditDeps, type AuditReport,
} from "./agents/evidence-audit-agent";
export {
  reapStaleLeases, heartbeat,
  type RecoveryDeps,
} from "./agents/recovery-agent";
export {
  streamOperationalSnapshot,
  type StreamDeps, type OperationalSnapshot,
} from "./agents/live-streaming-agent";
export {
  enumerateConnections, decideGateAllowed,
  type ConnectionsDeps, type ConnectionSurface,
  type GateAdapterDeps, type GateDecision,
} from "./agents/connections-agent";
export {
  runOrbit,
  _ORBIT_NEVER_BYPASSES_GATE, _ORBIT_ABORTS_ON_AUDIT_FAIL, _ORBIT_ASIA_LAST_ENFORCED_AT_TERRITORY_ITERATION,
  type AgentBundle, type OrbitDeps, type Territory, type OrbitInput, type OrbitOutcome,
} from "./agents/orbiting-agent";
