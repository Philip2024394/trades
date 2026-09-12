// src/lib/nex2-review/types.ts
//
// NEX2 · ADVISORY EVIDENCE REVIEW · types only.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// ADVISORY ONLY. NEX2 reviews · never executes · never mutates.

export type ReviewDimension =
  | "correctness"
  | "semantic_preservation"
  | "complexity"
  | "maintainability"
  | "testability"
  | "security"
  | "performance"
  | "project_alignment"
  | "user_objective_alignment"
  | "change_risk";

export type ReviewOutcome =
  | "ACCEPT_NEX1"
  | "PROPOSE_ALTERNATIVE"
  | "BOTH_NEED_REVISION"
  | "REQUEST_EVIDENCE"
  | "HOLD";

export type DimensionConclusion =
  | "regression"
  | "improvement"
  | "equal"
  | "insufficient_evidence"
  | "not_authoritatively_available";

// Reuses the Evidence Engine 8-state vocabulary + Code Health 6-state vocabulary.
// Union is the set of state names that may appear in any measurement NEX2 consumes.
export type ConsumedState =
  | "MEASURED"
  | "PASSED"
  | "FAILED"
  | "NOT_MEASURED"
  | "NOT_APPLICABLE"
  | "INCONCLUSIVE"
  | "BLOCKED"
  | "STALE";

export interface ReviewAttribution {
  readonly external_llm_used: false;
  readonly deterministic: true;
  readonly taught_by: "master_ai_engineer";
  readonly role: "nex2_advisory_review";
  readonly authority: "advisory_review_only";
  readonly produced_by: "nex2_advisory_review";
}

export interface DimensionObservation {
  readonly dimension: ReviewDimension;
  readonly baseline_state: ConsumedState | null;
  readonly nex1_state: ConsumedState | null;
  readonly alternative_state?: ConsumedState | null;
  readonly baseline_value: number | Record<string, unknown> | null;
  readonly nex1_value: number | Record<string, unknown> | null;
  readonly alternative_value?: number | Record<string, unknown> | null;
  readonly delta: { direction: "regression" | "improvement" | "equal" | "unknown"; magnitude?: number } | null;
  readonly conclusion: DimensionConclusion;
  readonly reason: string;
  // evidence_ids MUST be non-empty when conclusion ∈ {regression · improvement · equal}
  readonly evidence_ids: readonly string[];
}

export interface AlternativeCandidate {
  readonly candidate_id: string;
  readonly parent_work_order_id: string;
  readonly parent_candidate_id: string;
  readonly description: string;
  readonly scope: string;
  readonly intended_change: string;
  readonly expected_effect: string;
  readonly known_tradeoffs: string;
  readonly required_evidence: readonly string[];
  readonly status: "candidate_only";
  readonly authorisation: false;
  readonly execution: false;
}

// Minimum shape NEX2 consumes from an Evidence Record. NEX2 does NOT own the
// Evidence Engine schema · this is a narrow read-only view of the fields NEX2
// actually cites. Full record shape lives in src/lib/nex-evidence-engine/types.ts.
export interface EvidenceRecordCitation {
  readonly evidence_id: string;
  readonly measurement_type: string;      // e.g. "compilation" · "type_check" · "tests" · "regression" · "complexity"
  readonly candidate_id: string;
  readonly state: ConsumedState;
  readonly value: number | Record<string, unknown> | null;
  readonly source_hashes: readonly string[];
  readonly tool?: string;
  readonly tool_version?: string;
  readonly methodology?: string;
  readonly recorded_at?: string;          // ISO-8601 · used for STALE detection when baseline hash changed
}

// Minimum shape NEX2 consumes from a Code Health measurement. Narrow view.
export interface CodeHealthCitation {
  readonly metric_id: string;
  readonly kind: string;
  readonly scope: string;
  readonly scope_target: string;
  readonly source_path: string;
  readonly source_hash: string;
  readonly state: ConsumedState;
  readonly value: number | Record<string, unknown> | null;
  readonly reason?: string;
  readonly delegated_from?: { subsystem: string; subsystem_version: string; field_reference: string };
}

// Narrow view of Project Architecture consumed by NEX2 (fan_out for change_risk).
export interface ProjectArchitectureCitation {
  readonly project_architecture_version: string;
  readonly report_id?: string;
  readonly fan_in: ReadonlyArray<{ readonly node_id: string; readonly count: number }>;
  readonly fan_out: ReadonlyArray<{ readonly node_id: string; readonly count: number }>;
  readonly cycles?: ReadonlyArray<{ readonly cycle_id: string; readonly members: readonly string[] }>;
}

// Narrow view of Project Profile consumed by NEX2 (project_alignment).
export interface ProjectProfileCitation {
  readonly profile_id: string;
  readonly conventions?: Readonly<Record<string, string>>;
  readonly detected_languages?: readonly string[];
}

export interface ReviewInput {
  readonly work_order_id: string;
  readonly baseline_candidate_id: string;
  readonly nex1_candidate_id: string;
  readonly changed_files?: readonly string[];              // file paths touched by NEX1 candidate · used for change_risk
  readonly user_objective?: string;
  readonly evidence_records?: readonly EvidenceRecordCitation[];
  readonly code_health_baseline?: readonly CodeHealthCitation[];
  readonly code_health_nex1?: readonly CodeHealthCitation[];
  readonly code_health_alternative?: readonly CodeHealthCitation[];
  readonly project_architecture?: ProjectArchitectureCitation;
  readonly project_profile?: ProjectProfileCitation;
  readonly alternative_candidate?: AlternativeCandidate;   // if the caller supplies a pre-authored alternative to compare
  readonly reject_llm_attempt?: boolean;                   // fail-fast if any caller has hinted an external LLM boundary breach
}

export interface ProvenanceStep {
  readonly step_kind: "review" | "claim" | "evidence_pointer" | "evidence_record" | "source_hash" | "tool" | "methodology" | "reproducibility";
  readonly step_id: string;
  readonly detail: Record<string, unknown>;
  readonly next_step_id: string | null;
}

export interface ProvenanceChain {
  readonly requested_id: string;
  readonly steps: readonly ProvenanceStep[];
  readonly fully_resolvable: boolean;
  readonly broken_links: readonly string[];
  readonly chain_integrity_hash: string;
}

export interface NEX2Review {
  readonly record_type: "NEX2_REVIEW";
  readonly review_id: string;
  readonly schema_version: string;                        // "v0.2.0"
  readonly work_order_id: string;
  readonly baseline_candidate_id: string;
  readonly nex1_candidate_id: string;
  readonly alternative_candidate: AlternativeCandidate | null;
  readonly user_objective: string | null;
  readonly at: string;                                    // ISO-8601
  readonly dimension_observations: readonly DimensionObservation[];
  readonly cited_evidence_ids: readonly string[];
  readonly provenance_chain: ProvenanceChain;
  readonly outcome: ReviewOutcome;
  readonly outcome_reason: string;
  readonly authority_boundary: "advisory_review_only";
  readonly limitations: string;
  readonly attribution: ReviewAttribution;
}
