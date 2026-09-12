// src/lib/nex3-arbitration/types.ts
//
// NEX3 · ENGINEERING ARBITER · types only.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// EVIDENCE-BASED ARBITRATION. Advisory. Never executes.

export type ArbitrationVerdict =
  | "NEX1_BETTER"
  | "NEX2_BETTER"
  | "EXISTING_CODE_BETTER"
  | "BOTH_INFERIOR"
  | "HOLD_INSUFFICIENT_EVIDENCE"
  | "USER_CLARIFICATION_REQUIRED";

export type CandidateType = "baseline" | "nex1" | "nex2";

export type CriterionId =
  | "correctness"
  | "semantic_preservation"
  | "security"
  | "user_objective_alignment"
  | "project_alignment"
  | "complexity"
  | "maintainability"
  | "testability"
  | "performance"
  | "change_risk";

export type GateId =
  | "correctness"
  | "semantic_preservation"
  | "security"
  | "user_objective"
  | "project_alignment"
  | "engineering_tradeoffs";

// Reused vocabulary · NEX3 never introduces a new state family.
export type ConsumedState =
  | "MEASURED"
  | "PASSED"
  | "FAILED"
  | "NOT_MEASURED"
  | "NOT_APPLICABLE"
  | "INCONCLUSIVE"
  | "BLOCKED"
  | "STALE";

export interface ArbiterAttribution {
  readonly external_llm_used: false;
  readonly deterministic: true;
  readonly taught_by: "master_ai_engineer";
  readonly role: "nex3_engineering_arbiter";
  readonly authority: "arbitration_advisory";
  readonly produced_by: "nex3_engineering_arbiter";
}

export interface CandidateRecord {
  readonly candidate_id: string;
  readonly candidate_type: CandidateType;
  readonly parent_work_order_id: string;
  readonly source_review_id?: string;       // REQUIRED when candidate_type='nex2'
  readonly source_hash: string | null;
  readonly scope: string;
  readonly authorisation: false;             // literal-false
  readonly execution_status: "candidate_only";
}

export interface GateResult {
  readonly gate: number;                     // 1..6
  readonly gate_id: GateId;
  readonly priority: "load_bearing" | "descriptive";
  readonly survivors: readonly CandidateType[];  // candidates still eligible after this gate
  readonly eliminations: ReadonlyArray<{ candidate: CandidateType; reason: string; evidence_ids: readonly string[] }>;
  readonly evidence_ids: readonly string[];
  readonly reason: string;
}

export interface CriterionResult {
  readonly criterion: CriterionId;
  readonly baseline_state: ConsumedState | null;
  readonly nex1_state: ConsumedState | null;
  readonly nex2_state: ConsumedState | null;
  readonly baseline_value: number | Record<string, unknown> | null;
  readonly nex1_value: number | Record<string, unknown> | null;
  readonly nex2_value: number | Record<string, unknown> | null;
  readonly conclusion: "candidate_advantaged" | "none_advantaged" | "insufficient_evidence" | "not_authoritatively_available" | "contradictory";
  readonly advantaged_candidate: CandidateType | null;
  readonly reason: string;
  readonly evidence_ids: readonly string[];
}

// ─── Input contracts ─────────────────────────────────────────────

export interface EvidenceRecordCitation {
  readonly evidence_id: string;
  readonly measurement_type: string;
  readonly candidate_id: string;
  readonly state: ConsumedState;
  readonly value: number | Record<string, unknown> | null;
  readonly source_hashes: readonly string[];
  readonly tool?: string;
  readonly tool_version?: string;
  readonly methodology?: string;
  readonly recorded_at?: string;
}

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
}

export interface NEX2ReviewCitation {
  readonly review_id: string;
  readonly nex1_candidate_id: string;
  readonly outcome: "ACCEPT_NEX1" | "PROPOSE_ALTERNATIVE" | "BOTH_NEED_REVISION" | "REQUEST_EVIDENCE" | "HOLD";
  readonly cited_evidence_ids: readonly string[];
  readonly alternative_candidate_id?: string;
}

export interface ProjectArchitectureCitation {
  readonly project_architecture_version: string;
  readonly report_id?: string;
  readonly fan_in: ReadonlyArray<{ readonly node_id: string; readonly count: number }>;
  readonly fan_out: ReadonlyArray<{ readonly node_id: string; readonly count: number }>;
  readonly cycles?: ReadonlyArray<{ readonly cycle_id: string; readonly members: readonly string[] }>;
}

export interface ProjectProfileCitation {
  readonly profile_id: string;
  readonly conventions?: Readonly<Record<string, string>>;
  readonly detected_languages?: readonly string[];
}

export interface WorkOrderInput {
  readonly work_order_id: string;
  readonly user_objective: string;
  readonly acceptance_criteria?: readonly string[];
  readonly unresolved_objective_choices?: readonly string[];  // if non-empty → USER_CLARIFICATION_REQUIRED
  readonly affects_security_boundary?: boolean;                // triggers Gate 3
  readonly baseline_satisfies_objective?: boolean;             // signal from work-order authoring
}

export interface ArbitrationInput {
  readonly work_order: WorkOrderInput;
  readonly baseline_candidate: CandidateRecord;
  readonly nex1_candidate: CandidateRecord;
  readonly nex2_candidate?: CandidateRecord | null;
  readonly changed_files_nex1?: readonly string[];
  readonly changed_files_nex2?: readonly string[];
  readonly evidence_records?: readonly EvidenceRecordCitation[];
  readonly code_health_baseline?: readonly CodeHealthCitation[];
  readonly code_health_nex1?: readonly CodeHealthCitation[];
  readonly code_health_nex2?: readonly CodeHealthCitation[];
  readonly project_architecture?: ProjectArchitectureCitation;
  readonly project_profile?: ProjectProfileCitation;
  readonly nex2_review?: NEX2ReviewCitation;
  readonly reject_llm_attempt?: boolean;
}

// ─── Provenance ──────────────────────────────────────────────────

export interface ProvenanceStep {
  readonly step_kind: "arbitration" | "verdict" | "criterion" | "claim" | "evidence_pointer" | "evidence_record" | "source_hash" | "tool" | "methodology" | "reproducibility";
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

// ─── Arbitration record ──────────────────────────────────────────

export interface ArbitrationRecord {
  readonly record_type: "NEX3_ARBITRATION";
  readonly arbitration_id: string;
  readonly schema_version: string;             // "v0.3.0"
  readonly work_order_id: string;
  readonly baseline_candidate_id: string;
  readonly nex1_candidate_id: string;
  readonly nex2_candidate_id: string | null;
  readonly candidates: readonly CandidateRecord[];
  readonly gates_evaluated: readonly GateResult[];
  readonly surviving_candidates: readonly CandidateType[];
  readonly eliminated_candidates: ReadonlyArray<{ candidate: CandidateType; gate_id: GateId; reason: string; evidence_ids: readonly string[] }>;
  readonly criteria_results: readonly CriterionResult[];
  readonly cited_evidence_ids: readonly string[];
  readonly tradeoffs: ReadonlyArray<{ dimension_a: CriterionId; dimension_b: CriterionId; description: string; evidence_ids: readonly string[] }>;
  readonly unresolved_questions: readonly string[];
  readonly objective_alignment: {
    readonly user_objective: string;
    readonly unresolved_objective_choices: readonly string[];
    readonly deterministic_outcome: "unresolved_choice_present" | "objective_recorded" | "objective_absent";
  };
  readonly verdict: ArbitrationVerdict;
  readonly verdict_reason: string;
  readonly provenance_chain: ProvenanceChain;
  readonly authorisation: false;
  readonly execution: false;
  readonly authority_boundary: "arbitration_advisory_until_founder_authorises";
  readonly limitations: string;
  readonly at: string;                          // ISO-8601 · excluded from deterministic signature
  readonly attribution: ArbiterAttribution;
}
