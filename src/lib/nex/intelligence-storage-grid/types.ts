// src/lib/nex/intelligence-storage-grid/types.ts
//
// NEX INTELLIGENCE STORAGE GRID · shared foundation contract
// Founder BEGIN AUTHORIZATION 2026-09-08 · §3 STANDARD DOMAIN STORAGE SHAPE
//
// Every specialist agent's storage must satisfy this contract. Shape is
// shared; domain taxonomy is domain-specific. Country is a first-class
// dimension per §4. Speed is a primary requirement per §5.
//
// This module ONLY defines types + contracts. Implementations live in:
//   src/lib/nex/intelligence-storage-grid/accommodation/     (Phase 2 · reference)
//   src/lib/nex/intelligence-storage-grid/relationship-layer/ (Phase 4)
//   src/lib/nex/intelligence-storage-grid/observatory/       (Phase 5)
//
// Additive only. No modifications to Wave 11 or existing brain/agents.

/** Every stored knowledge record has an explicit status per §26. */
export type KnowledgeStatus =
  | "OBSERVED"
  | "VERIFIED"
  | "SUPERSEDED"
  | "REJECTED"
  | "CONFLICT_FLAGGED"
  | "UNRESOLVABLE";

/** Freshness state per §5 · §29 · aligned with master-ai/offline-reservoir.ts. */
export type FreshnessState = "FRESH" | "STALE" | "PERMANENT" | "UNKNOWN" | "REFRESH_REQUIRED";

/** Trust hierarchy · 5-level per audit + already-active accommodation_business_field_provenance.trust_layer. */
export type TrustLayer =
  | "L1_FOUNDER_AUTHORED"     // Highest · Founder-approved canonical
  | "L2_MASTER_AI_VERIFIED"   // Master AI cross-verified via multiple sources
  | "L3_AUTHORITATIVE_SOURCE" // Single high-authority source (gov · official website)
  | "L4_SECONDARY_SOURCE"     // Reputable but not primary
  | "L5_OBSERVED_UNVERIFIED"; // Raw observation · needs verification

/** Evidence label per Op-Truth discipline · already used throughout NEX. */
export type EvidenceLabel = "MEASURED" | "DOCUMENTED" | "MODELED" | "ESTIMATED" | "UNKNOWN";

/** ISO 3166-1 alpha-2 country code · first-class dimension per §4. */
export type CountryCode = string; // "ID" · "JP" · "TH" · "GB" · "US" etc.

/** Common domain agent identity. Enum grows as new specialists are added. */
export type DomainAgentId =
  | "accommodation"
  | "food"
  | "construction"
  | "healthcare"
  | "transport"
  | "business"
  | "vision"
  | "speaking"
  | "travel"
  | "legal"
  | "master_ai"
  | "programmer";

// ═══════════════════════════════════════════════════════════════════
// §3 · Partition hierarchy · Country → Type → City
// ═══════════════════════════════════════════════════════════════════

export interface CountryPartition {
  country_code: CountryCode;
  display_name: string;
  region: string | null;        // e.g. "Asia · Southeast Asia"
  language_primary: string | null; // e.g. "id" · "ja"
  timezone_primary: string | null; // e.g. "Asia/Jakarta"
}

export interface CategoryPartition {
  category_slug: string;         // e.g. "hotel" · "guesthouse" · "kos"
  display_name: string;
  domain_agent_id: DomainAgentId;
  parent_category: string | null;
}

export interface CityPartition {
  city_slug: string;             // e.g. "yogyakarta" · "tokyo" · "london"
  display_name: string;
  country_code: CountryCode;
  region: string | null;         // state / prefecture / province
  district: string | null;
  centroid_lat: number | null;
  centroid_lng: number | null;
}

// ═══════════════════════════════════════════════════════════════════
// §12 · Knowledge / Evidence / Relationship / Freshness records
// ═══════════════════════════════════════════════════════════════════

/**
 * A single knowledge assertion about a canonical entity.
 * Per §26 status is explicit · per §27 provenance is required.
 */
export interface KnowledgeRecord<TValue = unknown> {
  record_id: string;                    // UUID
  domain_agent_id: DomainAgentId;
  entity_kind: string;                  // "property" · "restaurant" · "route" etc.
  entity_ref: string;                   // e.g. public_listing_ref for accommodation
  field_name: string;                   // "wifi" · "checkin_time" · "room_count" etc.
  value: TValue;
  value_normalised: string | null;      // canonical string form for search/dedup
  status: KnowledgeStatus;
  trust_layer: TrustLayer;
  confidence: number;                   // 0..1
  freshness_state: FreshnessState;
  freshness_ttl_seconds: number | null; // null = permanent
  country_code: CountryCode | null;
  language: string | null;              // ISO 639-1
  language_original: string | null;     // preserve original per §28
  value_original: string | null;        // preserve original per §28
  provenance: ProvenanceRecord;
  supersedes: string | null;            // previous record_id if this replaces
  superseded_by: string | null;         // next record_id if this was replaced
  content_hash: string;                 // SHA-256[:24] for dedup
  created_at_iso: string;
  verified_at_iso: string | null;
  refreshed_at_iso: string | null;
  cycle_run_id: string | null;          // links to research cycle if applicable
}

/** §27 · Provenance is required for every important fact. */
export interface ProvenanceRecord {
  source: string;                       // "postgres:accommodation_business" · "external:booking.com" · "founder"
  source_url: string | null;
  source_type: "canonical" | "primary" | "secondary" | "user_report" | "master_ai_verified" | "founder";
  collected_at_iso: string;
  agent_id: DomainAgentId;
  cycle_run_id: string | null;
  verification_history: Array<{
    verified_at_iso: string;
    verified_by: string;
    method: "deterministic_match" | "cross_source" | "founder_approval" | "human_blind_eval";
    verdict: "PASS" | "FAIL" | "UNKNOWN";
    notes: string | null;
  }>;
}

/** §7-8 · Evidence supports a claim; separate from the claim itself. */
export interface EvidenceRecord {
  evidence_id: string;                  // UUID
  business_ref: string;                 // links to entity_ref
  field_name: string;                   // which claim this supports
  value: string;
  value_normalised: string | null;
  source: string;
  source_type: string;
  source_url: string | null;
  captured_at_iso: string;
  content_hash: string;
  authority_tier: TrustLayer;
  language: string | null;
  cycle_run_id: string | null;
}

/** §12 · Relationship between two entities · queryable without LLM. */
export interface RelationshipRecord {
  relationship_id: string;              // UUID
  source_domain: DomainAgentId;
  source_entity_kind: string;
  source_entity_ref: string;
  target_domain: DomainAgentId;
  target_entity_kind: string;
  target_entity_ref: string;
  relationship_type: RelationshipType;
  distance_km: number | null;           // for spatial relationships
  distance_meters: number | null;       // fine-grained option
  bearing_degrees: number | null;       // for NEARBY relationships
  evidence: EvidenceRecord | null;
  confidence: number;                   // 0..1
  freshness_state: FreshnessState;
  status: KnowledgeStatus;
  created_at_iso: string;
  verified_at_iso: string | null;
  refreshed_at_iso: string | null;
  supersedes: string | null;
  superseded_by: string | null;
}

/** §11 · §12 · Fixed relationship taxonomy · extensible but governed. */
export type RelationshipType =
  | "NEARBY"                            // spatial · uses distance_km
  | "IN_CITY"
  | "IN_COUNTRY"
  | "IN_DISTRICT"
  | "LOCATED_AT"                        // exact-address containment (e.g., restaurant inside hotel)
  | "LOCATED_IN"                        // hierarchical containment
  | "PART_OF"                           // e.g., room part of hotel · exhibit part of museum
  | "OPERATED_BY"                       // e.g., property operated by chain
  | "SERVES"                            // e.g., restaurant serves cuisine
  | "OFFERS"                            // e.g., hotel offers facility
  | "CONNECTS_TO"                       // e.g., station connects to another
  | "REPLACED_BY"                       // temporal supersession
  | "REFERENCED_BY"                     // cross-reference from another agent
  | "SAME_AS"                           // canonical dedup (entity equivalence)
  | "DIFFERENT_FROM";                   // negative assertion

/** §16 · Growth metric per domain agent · per §20 growth bar. */
export interface GrowthMetrics {
  domain_agent_id: DomainAgentId;
  measured_at_iso: string;
  entities_total: number;
  entities_verified: number;
  entities_observed_unverified: number;
  entities_stale: number;
  entities_conflict_flagged: number;
  entities_superseded: number;
  entities_added_today: number;
  entities_updated_today: number;
  entities_added_this_week: number;
  entities_added_this_month: number;
  countries_covered: number;
  cities_covered: number;
  knowledge_gaps_open: number;
  knowledge_gaps_resolved_today: number;
  research_active: number;
  research_completed_today: number;
  research_failed_today: number;
  verified_knowledge_growth_pct: number;   // for §20 growth bar
  verified_knowledge_growth_denominator_note: string; // "verified / total across measured domain"
  evidence_label: EvidenceLabel;
}

/** §29 · Storage economics · MEASURED not MODELED unless labelled. */
export interface StorageMetrics {
  domain_agent_id: DomainAgentId;
  measured_at_iso: string;
  bytes_total: number;
  bytes_hot_tier: number;
  bytes_canonical: number;
  bytes_archive: number;
  object_count: number;
  average_object_size_bytes: number;
  compression_ratio_measured: number | null;
  dedup_ratio_measured: number | null;
  read_operations_last_hour: number;
  write_operations_last_hour: number;
  cache_hits_last_hour: number;
  cache_misses_last_hour: number;
  retrieval_latency_p50_ms: number;
  retrieval_latency_p95_ms: number;
  retrieval_latency_p99_ms: number;
  projected_monthly_growth_bytes: number;
  projected_monthly_cost_usd: number | null; // null · UNKNOWN pending Founder pricing decision
  evidence_label: EvidenceLabel;
}

/** §5 · §16 · Coverage percentage per country · MUST be based on measurable definition. */
export interface CoverageMetrics {
  domain_agent_id: DomainAgentId;
  country_code: CountryCode;
  measured_at_iso: string;
  entities_present: number;
  entities_target: number;                // reference baseline (e.g., estimated total for country)
  entities_target_source: string;         // "MODELED" · "external_reference" · "unknown"
  coverage_percentage: number;            // 0..100
  coverage_definition: string;            // e.g. "verified entities / target city set size"
  evidence_label: EvidenceLabel;
}

// ═══════════════════════════════════════════════════════════════════
// §18-22 · Agent Observatory contract (shared)
// ═══════════════════════════════════════════════════════════════════

export type AgentActiveStatus =
  | "ACTIVE"       // 🟢 recent heartbeat + successful work
  | "DEGRADED"     // 🟡 heartbeat but low activity or errors
  | "FAILED"       // 🔴 crashed
  | "STOPPED"      // ⚪ no heartbeat file / intentionally stopped
  | "RESEARCHING"; // 🔵 alive and executing research task

export interface AgentObservationSnapshot {
  domain_agent_id: DomainAgentId;
  display_name: string;
  status: AgentActiveStatus;
  status_reason: string;
  last_heartbeat_at_iso: string | null;
  last_successful_collection_at_iso: string | null;
  pid: number | null;
  growth: GrowthMetrics;
  storage: StorageMetrics;
  coverage_by_country: CoverageMetrics[];
  category_breakdown: Record<string, number>; // e.g. { "hotel": 6840, "guesthouse": 1706 }
  research_metrics: {
    active_tasks: number;
    completed_last_hour: number;
    failed_last_hour: number;
    unresolved_gaps: number;
  };
  quality: {
    verified_percentage: number;
    unresolved_conflicts: number;
    provenance_coverage_percentage: number;
    source_reliability_average: number | null;
  };
  evidence_label: EvidenceLabel;
}

// ═══════════════════════════════════════════════════════════════════
// §14 · Continuous collection loop state
// ═══════════════════════════════════════════════════════════════════

export type CollectionLoopPhase =
  | "OBSERVE"
  | "IDENTIFY_UNKNOWN"
  | "IDENTIFY_STALE"
  | "IDENTIFY_CONFLICTS"
  | "PRIORITISE"
  | "RESEARCH"
  | "COLLECT"
  | "DEDUPLICATE"
  | "RECONCILE"
  | "VERIFY"
  | "STORE"
  | "INDEX"
  | "UPDATE_RELATIONSHIPS"
  | "MEASURE"
  | "FIND_NEXT_GAP"
  | "IDLE";

export interface CollectionLoopTick {
  tick_id: string;
  domain_agent_id: DomainAgentId;
  started_at_iso: string;
  completed_at_iso: string | null;
  phase: CollectionLoopPhase;
  work_performed: string;
  outcome: "SUCCESS" | "SKIPPED" | "BLOCKED" | "UNKNOWN" | "FAILED";
  outcome_detail: string;
  next_phase: CollectionLoopPhase | null;
}

// ═══════════════════════════════════════════════════════════════════
// §4 · Query patterns (contract signatures · not implementation)
// ═══════════════════════════════════════════════════════════════════

/** The shape every domain-storage adapter must expose. */
export interface DomainStorageAdapter {
  domain_agent_id: DomainAgentId;

  // Country/Type/City partition access · §4
  listCountries(): Promise<CountryPartition[]>;
  listCategories(): Promise<CategoryPartition[]>;
  listCitiesInCountry(country_code: CountryCode): Promise<CityPartition[]>;

  // Entity access · §5 speed-first
  getEntityByRef(entity_ref: string): Promise<Record<string, unknown> | null>;
  listEntitiesInCity(country_code: CountryCode, city_slug: string, category_slug?: string, limit?: number): Promise<Array<Record<string, unknown>>>;
  countEntitiesInCity(country_code: CountryCode, city_slug: string, category_slug?: string): Promise<number>;

  // Growth + storage metrics · §16 §20 §29
  currentGrowthMetrics(): Promise<GrowthMetrics>;
  currentStorageMetrics(): Promise<StorageMetrics>;
  currentCoverageMetrics(): Promise<CoverageMetrics[]>;

  // Observability · §17-22
  currentObservationSnapshot(): Promise<AgentObservationSnapshot>;
}
