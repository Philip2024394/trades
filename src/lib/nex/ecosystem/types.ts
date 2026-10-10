// src/lib/nex/ecosystem/types.ts
//
// UWI · Wave 8.A · Ecosystem judgement machinery shared types.
// Founder-authorised programme (extension per Rule 5o).
//
// Distinct from src/lib/nex/discovery/ (which handles the generic
// crawl/robots/politeness/fetch/extract pipeline) — this module adds
// the ecosystem-specific judgement layer that turns a discovered
// resource into a typed EcosystemFinding carrying licence + supply-
// chain + runtime-purity + capability audit results.

// ─── Ecosystem identity ─────────────────────────────────────────────
export type EcosystemKind =
  | "hugging_face"
  | "github"
  | "arxiv"
  | "openalex"
  | "crossref"
  | "papers_with_code"
  | "common_crawl"
  | "npm_registry"
  | "pypi"
  | "other";

export type ResourceKindInEcosystem =
  // Hugging Face
  | "model" | "dataset" | "benchmark" | "space"
  // GitHub
  | "repository" | "release" | "gist"
  // arXiv / OpenAlex / Crossref
  | "paper" | "author" | "work"
  // Common Crawl
  | "warc_slice" | "cdx_index"
  // Package registries
  | "package";

export interface EcosystemResource {
  readonly ecosystem: EcosystemKind;
  readonly resource_kind: ResourceKindInEcosystem;
  readonly id: string;                       // ecosystem-scoped id (e.g. "google/flan-t5-base")
  readonly source_url: string;               // canonical source URL (the crawl target)
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly fetched_at_iso: string;
}

// ─── Licence forensics output ───────────────────────────────────────
export type CopyleftClass =
  | "permissive"          // MIT · Apache-2.0 · BSD · ISC · public-domain
  | "weak_copyleft"       // LGPL · MPL
  | "strong_copyleft"     // GPL
  | "network_copyleft"    // AGPL · SSPL
  | "commercial"          // proprietary · BSL · commercial-only
  | "unknown_or_missing";

export interface LicenseSignals {
  readonly requires_attribution: boolean;
  readonly requires_source_redistribution: boolean;
  readonly requires_modification_disclosure: boolean;
  readonly network_use_clause: boolean;      // triggers on serving via network
  readonly patent_grant: boolean;
  readonly commercial_use_permitted: boolean;
}

export interface LicenseForensicsReport {
  readonly checked_at_iso: string;
  readonly spdx_identifier: string | null;   // e.g. "MIT" · "Apache-2.0" · "AGPL-3.0" · null if unknown
  readonly raw_license_text: string | null;
  readonly copyleft_class: CopyleftClass;
  readonly signals: LicenseSignals;
  readonly nex_compatible: boolean;          // permissive → true; strong/network copyleft → false; unknown → false with escalation
  readonly requires_legal_review: boolean;
  readonly notes: readonly string[];
}

// ─── Supply-chain audit output ──────────────────────────────────────
export interface SupplyChainSignals {
  readonly has_postinstall_script: boolean;
  readonly has_binary_download: boolean;
  readonly has_dynamic_code_execution: boolean;
  readonly has_telemetry: boolean;
  readonly has_phone_home: boolean;
  readonly maintainer_count: number;
  readonly transitive_dep_count: number;
  readonly typosquat_similarity_score: number;  // 0-1 · 1 = perfect match to a well-known package name
  readonly suspicious_deps: ReadonlyArray<string>;
}

export interface SupplyChainReport {
  readonly checked_at_iso: string;
  readonly signals: SupplyChainSignals;
  readonly risk_level: "low" | "medium" | "high" | "critical";
  readonly notes: readonly string[];
}

// ─── Runtime-purity check for one resource ──────────────────────────
export interface EcosystemRuntimePurityReport {
  readonly checked_at_iso: string;
  readonly external_llm_dependencies: readonly string[];
  readonly external_embedding_apis: readonly string[];
  readonly hosted_ai_services: readonly string[];
  readonly cloud_service_dependencies: readonly string[];
  readonly model_download_at_runtime: boolean;
  readonly is_pure_for_nex_runtime: boolean;
  readonly notes: readonly string[];
}

// ─── Capability extraction · what the useful technique is ───────────
export interface CapabilityExtractionReport {
  readonly checked_at_iso: string;
  readonly capability_summary: string;               // plain-language description
  readonly underlying_technique: string;             // the algorithmic/architectural idea
  readonly nex_reusable_directly: boolean;           // can we use it as-is?
  readonly nex_rebuildable_natively: boolean;        // can we reimplement clean?
  readonly capability_category: string;              // e.g. "OCR" · "signal detection" · "graph algorithm"
  readonly notes: readonly string[];
}

// ─── Founder-locked 8-question output shape (Rule 5o.Q) ─────────────
export interface WorldClassResourceVerdict {
  // 1 · what it does
  readonly what_it_does: string;
  // 2 · licence
  readonly licence: LicenseForensicsReport;
  // 3 · dependencies
  readonly dependencies_summary: {
    readonly direct_count: number;
    readonly transitive_count: number;
    readonly notable: readonly string[];
  };
  // 4 · external AI/network requirements
  readonly runtime_purity: EcosystemRuntimePurityReport;
  // 5 · useful technique
  readonly useful_technique: CapabilityExtractionReport;
  // 6 · direct reuse verdict
  readonly direct_reuse_verdict: {
    readonly appropriate: boolean;
    readonly reason: string;
  };
  // 7 · clean-rebuild verdict
  readonly clean_rebuild_verdict: {
    readonly possible: boolean;
    readonly reason: string;
  };
  // 8 · opportunity connection
  readonly opportunity_recommendation: {
    readonly create_finding: boolean;                // always true if worth recording
    readonly create_hypothesis: boolean;             // true if underlying technique is testable
    readonly create_opportunity: boolean;            // true if NEX relevance high AND novel
    readonly downgrade_to_observation: boolean;      // true if not falsifiable / not novel / not relevant
    readonly reason: string;
  };
}

// ─── Combined ecosystem-scoped finding (extends Wave 5 Finding) ─────
export interface EcosystemFinding {
  readonly finding_id: string;                       // deterministic (Wave 2 D2 idempotency-key derivation)
  readonly resource: EcosystemResource;
  readonly verdict: WorldClassResourceVerdict;
  readonly disposition: "REUSE" | "REBUILD" | "REFERENCE" | "REJECT" | "LEGAL-REVIEW" | "DEFER";
  readonly created_at_iso: string;
  readonly nex_relevance: number;                    // 0-1 · kept SEPARATE from user_relevance (Rule 5o.C · M22)
  readonly user_relevance: number;
  readonly novelty_score: number;                    // from Wave 4 dedup cascade
  readonly provenance_chain: ReadonlyArray<{ stage: string; at_iso: string; detail?: string }>;
}

// ─── Adapter contract ───────────────────────────────────────────────
export interface EcosystemAdapter {
  readonly ecosystem: EcosystemKind;
  /** Return metadata for a single named resource (no downloads · uses public API). */
  fetchMetadata(id: string): Promise<EcosystemResource | null>;
  /** Enumerate a bounded page of resources of a given kind (no downloads). */
  listResources(input: {
    resource_kind: ResourceKindInEcosystem;
    query?: string;
    limit?: number;
    offset?: number;
  }): Promise<ReadonlyArray<EcosystemResource>>;
}
