// src/lib/nex/discovery-intel/types.ts
//
// NEX Fresh World Discovery + Search Intelligence · types
// Founder-authorised programme · bounded wave 2026-09-21.
//
// Sibling to (not part of) `src/lib/nex/discovery/` (Wave 3.3 fetch/robots
// orchestration). This module concerns search-vocabulary governance +
// evidence-backed relationships + cycle reporting only.
//
// Discovery ≠ Marketing permission. The lifecycle is:
//   Discovered → Stored → Classified → Eligibility → Addressable → Approved → Sent
// This module concerns itself with the first three arrows only.

export type SearchTermStatus = "seed" | "candidate" | "validated" | "rejected";

export type RelationshipStatus = "candidate" | "validated" | "rejected" | "superseded";

export type RelationshipKind =
  | "trade_of"
  | "commercial_service_of"
  | "equipment_of"
  | "industry_context_of"
  | "synonym_of";

export type SourceOutcome =
  | "responded"
  | "responded_zero"
  | "unavailable"
  | "rate_limited"
  | "parse_error"
  | "blocked_by_governance";

export type CycleOutcome =
  | "in_progress"
  | "complete"
  | "partial"
  | "zero_results"
  | "source_unavailable"
  | "failed";

export interface SearchTerm {
  readonly term_id: string;
  readonly term: string;
  readonly topic: string;
  readonly family: string | null;
  readonly language: string;
  readonly country_applicability: ReadonlyArray<string>;
  readonly status: SearchTermStatus;
  readonly source: string;
  readonly primary_relationship: string | null;
  readonly discovery_date: string;
  readonly evidence_count: number;
  readonly last_evidence_at: string | null;
  readonly first_promoted_at: string | null;
  readonly first_promoted_by: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface DiscoveryRelationship {
  readonly relationship_id: string;
  readonly parent_term: string;
  readonly child_term: string;
  readonly relationship_kind: RelationshipKind;
  readonly topic: string;
  readonly evidence_count: number;
  readonly confidence: number;
  readonly first_observed_cycle: string | null;
  readonly last_observed_cycle: string | null;
  readonly first_observed_at: string;
  readonly last_observed_at: string;
  readonly status: RelationshipStatus;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface SourceOutcomeRecord {
  readonly source: string;
  readonly outcome: SourceOutcome;
  readonly elements: number;
  readonly bytes: number | null;
  readonly ms: number;
  readonly note: string | null;
}

export interface DiscoveryCycleReport {
  readonly cycle_id: string;
  readonly cycle_seq: number;
  readonly topic: string;
  readonly started_at: string;
  readonly finished_at: string | null;
  readonly duration_ms: number | null;

  readonly searches_attempted: number;
  readonly terms_used: ReadonlyArray<string>;
  readonly countries_touched: ReadonlyArray<string>;
  readonly sources_attempted: ReadonlyArray<string>;

  readonly businesses_discovered: number;
  readonly new_emails: number;
  readonly existing_matched: number;
  readonly rejected_emails: number;
  readonly newly_classified: number;
  readonly newly_eligible: number;
  readonly categories_touched: ReadonlyArray<string>;

  readonly source_outcomes: ReadonlyArray<SourceOutcomeRecord>;
  readonly outcome: CycleOutcome;
  readonly note: string | null;

  // Governance canaries — MUST always be 0 in this wave
  readonly sends_triggered: 0;
  readonly addresses_exposed: 0;
}

export class DiscoveryGovernanceError extends Error {
  constructor(reason: string) {
    super(`Discovery governance violation · ${reason}`);
    this.name = "DiscoveryGovernanceError";
  }
}

export const _DISCOVERY_INTEL_BOUNDARY_NO_ADDRESSES = "counts_and_relationships_only_no_addresses";
export const _DISCOVERY_INTEL_BOUNDARY_NO_SEND = "cycle_never_triggers_send";
