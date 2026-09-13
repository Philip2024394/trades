// WO-INTELLIGENCE-01 · types for the NEX Intelligence Discovery Core
//
// Founder-authorised 2026-09-13 under P-S v2. No external LLM anywhere.
// All records are content-addressable + provenance-chained. Every mutable
// decision (promotion, scoring) is a pure function of the evidence.

// ── Crawler manifest ────────────────────────────────────────────────────

/**
 * Per-source authorisation for the crawler. Every fetch checks its target
 * URL + method against a matching entry. Manifest is signed by the WO-13
 * attestation key; unsigned or badly-signed manifests are rejected.
 */
export interface CrawlerManifestEntry {
  readonly manifest_entry_id: string;
  readonly authorised_hosts: readonly string[];
  readonly authorised_paths: readonly string[];        // path prefix allowlist
  readonly authorised_methods: readonly ("GET")[];    // GET-only in v1
  readonly rate_limit_requests_per_minute: number;
  readonly authorised_categories: readonly string[];
  readonly authorised_query_predicates: readonly string[];
  readonly authorising_wo_id: string;
  readonly expires_at: string;                        // ISO
}

export interface CrawlerManifest {
  readonly record_type: "NEX_INTELLIGENCE_CRAWLER_MANIFEST";
  readonly version: "wo-intel.v0.1";
  readonly entries: readonly CrawlerManifestEntry[];
  readonly attestation_signature_hex: string;         // over canonicalize(entries)
}

// ── Source record (crawler output, immutable) ───────────────────────────

export interface SourceRecord {
  readonly record_type: "NEX_INTELLIGENCE_SOURCE";
  readonly source_id: string;                         // stable, derived
  readonly crawler_manifest_entry_id: string;
  readonly fetched_at: string;
  readonly fetch_url: string;
  readonly fetch_method: "GET";
  readonly response_status: number;
  readonly content_hash_sha256: string;
  readonly content_bytes: number;
  readonly content_type: string;
  readonly raw_content_ref: string;                   // path to immutable raw store OR embedded
  readonly provenance_chain_hash: string;
}

// ── Knowledge fragment (post-ingestion, pre-discovery) ──────────────────

export interface KnowledgeFragment {
  readonly record_type: "NEX_INTELLIGENCE_KNOWLEDGE_FRAGMENT";
  readonly fragment_id: string;
  readonly source_id: string;
  readonly external_id: string;                       // e.g. arXiv "1234.5678"
  readonly title: string;
  readonly abstract: string;
  readonly authors: readonly string[];
  readonly categories: readonly string[];
  readonly primary_category: string;
  readonly published_at: string;
  readonly content_hash_sha256: string;
  readonly provenance_chain_hash: string;
}

// ── Knowledge object (the core artefact) ────────────────────────────────

export type KnowledgeStatus =
  | "DISCOVERED"                    // seen once, no evaluation yet
  | "PROPOSED"                      // has hypothesis + limited evidence
  | "TESTED"                        // has experiment evidence, insufficient for graduation
  | "APPROVED"                      // meets Intelligence Library thresholds; awaiting founder WO
  | "PRODUCTION"                    // founder-signed WO has authorised use
  | "SUPER_INTELLIGENCE_CANDIDATE"  // meets STRICT criteria; awaiting founder WO
  | "SUPER_INTELLIGENCE"            // founder-signed WO has authorised
  | "DEPRECATED";                   // superseded / contradicted

export interface KnowledgeObjectSourceEvidence {
  readonly source_id: string;
  readonly fragment_id: string;
  readonly excerpt_hash: string;
  readonly relevance_score: number;                   // 0..1
}

export interface KnowledgeObjectExperimentEvidence {
  readonly experiment_id: string;
  readonly outcome: "SUCCESS" | "FAILURE" | "LIMITATION";
  readonly evidence_hash: string;
}

export interface KnowledgeObjectLimitation {
  readonly case: string;
  readonly severity: "low" | "moderate" | "high";
}

export interface KnowledgeObject {
  readonly record_type: "NEX_INTELLIGENCE_KNOWLEDGE_OBJECT";
  readonly knowledge_id: string;
  readonly version: number;
  readonly name: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly domain: string;
  readonly source_evidence: readonly KnowledgeObjectSourceEvidence[];
  readonly experiments: readonly KnowledgeObjectExperimentEvidence[];
  readonly limitations: readonly KnowledgeObjectLimitation[];
  readonly recommended_use: readonly string[];
  readonly agent_capability_affected: string | null;
  readonly confidence: number;                        // 0..1
  readonly reproducibility_score: number;             // 0..1
  readonly correlation_count: number;
  readonly generalisation_passed: boolean;
  readonly status: KnowledgeStatus;
  readonly supersedes: readonly string[];
  readonly superseded_by: readonly string[];
  readonly synthesised_from: readonly string[];       // fragment_ids or knowledge_ids combined
  readonly authorised_by: string | null;              // Founder WO id, null until signed
  readonly authorising_wo_id: string | null;
  readonly revisit_scheduled_at: string | null;
  readonly provenance_chain_hash: string;
}

// ── Discovery record (Discovery Engine output) ──────────────────────────

export type DiscoveryPattern = "pattern" | "conflict" | "connection" | "combination";

export interface DiscoveryRecord {
  readonly record_type: "NEX_INTELLIGENCE_DISCOVERY";
  readonly discovery_id: string;
  readonly detected_at: string;
  readonly pattern: DiscoveryPattern;
  readonly input_fragment_ids: readonly string[];     // ≥ 2 for combination
  readonly detail: string;
  readonly signal_score: number;                      // 0..1 — statistical strength
  readonly provenance_chain_hash: string;
}

// ── Hypothesis record ───────────────────────────────────────────────────

export interface HypothesisRecord {
  readonly record_type: "NEX_INTELLIGENCE_HYPOTHESIS";
  readonly hypothesis_id: string;
  readonly formed_at: string;
  readonly discovery_id: string;
  readonly formed_from_fragment_ids: readonly string[];
  readonly claim: string;
  readonly expected_outcome: string;                  // machine-comparable, canonicalised JSON
  readonly measurable_criterion: string;              // human-readable
  readonly provenance_chain_hash: string;
}

// ── Experiment record ───────────────────────────────────────────────────

export interface ExperimentTestCaseOutcome {
  readonly case_id: string;
  readonly expected: unknown;
  readonly actual: unknown;
  readonly matched: boolean;
}

export interface ExperimentRecord {
  readonly record_type: "NEX_INTELLIGENCE_EXPERIMENT";
  readonly experiment_id: string;
  readonly hypothesis_id: string;
  readonly run_at: string;
  readonly sandbox_id: string;
  readonly test_cases: readonly { case_id: string; input_hash: string }[];
  readonly outcomes: readonly ExperimentTestCaseOutcome[];
  readonly success_count: number;
  readonly failure_count: number;
  readonly limitation_count: number;
  readonly runtime_ms: number;
  readonly provenance_chain_hash: string;
}

// ── Proposal record (to founder) ────────────────────────────────────────

export type ProposalKind = "PROMOTION_INTELLIGENCE" | "PROMOTION_SUPER_INTELLIGENCE" | "DEPRECATION";

export interface ProposalRecord {
  readonly record_type: "NEX_INTELLIGENCE_PROPOSAL";
  readonly proposal_id: string;
  readonly emitted_at: string;
  readonly kind: ProposalKind;
  readonly target_knowledge_id: string;
  readonly evidence_summary: string;                  // human-readable
  readonly recommended_wo_action: string;             // human-readable WO recommendation
  readonly deterministic_score: number;               // recomputed at review time
  readonly provenance_chain_hash: string;
}

// ── Crawler audit record ────────────────────────────────────────────────

export interface CrawlerAuditRecord {
  readonly record_type: "NEX_INTELLIGENCE_CRAWLER_AUDIT";
  readonly audit_id: string;
  readonly attempted_at: string;
  readonly manifest_entry_id: string | null;
  readonly attempted_url: string;
  readonly attempted_method: string;
  readonly outcome: "PERMITTED" | "REFUSED_UNAUTHORISED_HOST" | "REFUSED_UNAUTHORISED_PATH" | "REFUSED_UNAUTHORISED_METHOD" | "REFUSED_RATE_LIMIT" | "REFUSED_MANIFEST_INVALID" | "REFUSED_CATEGORY_MISMATCH" | "PERMITTED_BUT_HTTP_ERROR";
  readonly refusal_reason: string | null;
  readonly response_status: number | null;
}

// ── Union of all persistable records for storage helpers ───────────────

export type IntelligenceRecord =
  | SourceRecord
  | KnowledgeFragment
  | KnowledgeObject
  | DiscoveryRecord
  | HypothesisRecord
  | ExperimentRecord
  | ProposalRecord
  | CrawlerAuditRecord;
