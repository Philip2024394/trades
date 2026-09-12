// src/lib/nex1-orchestrator/types.ts
// NEX1 Orchestrator · types only. Deterministic. No LLM.

export type StageId =
  | "REQUEST_RECEIVED"
  | "UNDERSTANDING"
  | "REQUIREMENTS"
  | "WORK_ORDER"
  | "ARCHITECTURE"
  | "DESIGN"
  | "BUILD_PLAN"
  | "SPECIALIST_EVIDENCE"
  | "EVIDENCE_VALIDATION"
  | "NEX2_REVIEW"
  | "NEX3_ARBITRATION"
  | "FOUNDER_DECISION"
  | "EXECUTION"
  | "VERIFICATION"
  | "RELEASE"
  | "ORCHESTRATION_COMPLETED"
  | "DELIVERABLE_COMPLETED"
  | "BLOCKED"
  | "REJECTED"
  | "HOLD";

export type StageStatus = "PENDING" | "RUNNING" | "COMPLETE" | "BLOCKED" | "REJECTED" | "HOLD" | "NOT_IMPLEMENTED" | "LIMITED_V0";

export type FounderDecision = "AUTHORISE" | "REJECT" | "HOLD";

export interface StructuredIntent {
  readonly page_type?: string;
  readonly primary_goal?: string;
  readonly audience?: string;
  readonly must_have_features: readonly string[];
  readonly must_not_have: readonly string[];
  readonly deterministic_extractor_version: string;
}

export interface Transition {
  readonly previous: StageId | null;
  readonly next: StageId;
  readonly reason: string;
  readonly at: string;
  readonly actor: "orchestrator" | "founder" | "specialist" | "validator" | "nex2" | "nex3";
  readonly evidence_refs?: readonly string[];
  readonly authorisation_state: "not_required" | "pending" | "granted" | "rejected" | "hold";
}

export interface StageResult {
  readonly stage: StageId;
  readonly status: StageStatus;
  readonly evidence_ref?: string;
  readonly limitation_note?: string;
  readonly at: string;
}

export interface AuditEntry {
  readonly at: string;
  readonly actor: "orchestrator" | "founder" | "specialist" | "validator" | "nex2" | "nex3";
  readonly action: string;
  readonly detail?: string;
}

export interface WorkflowTrace {
  readonly record_type: "NEX1_WORKFLOW_TRACE";
  readonly trace_id: string;
  readonly schema_version: string;
  readonly raw_request: string;
  readonly structured_intent: StructuredIntent | null;
  readonly requirements_evidence: string | null;
  readonly work_order: Record<string, unknown> | null;
  readonly architecture_evidence: string | null;
  readonly design_evidence: string | null;
  readonly builder_plan: string | null;
  readonly specialist_evidence_ids: readonly string[];
  readonly validation_verdicts: readonly string[];
  readonly nex2_review_id: string | null;
  readonly nex3_arbitration_id: string | null;
  readonly nex3_verdict: string | null;
  readonly founder_decision: FounderDecision | null;
  readonly transitions: readonly Transition[];
  readonly current_state: StageId;
  readonly stage_statuses: Readonly<Partial<Record<StageId, StageResult>>>;
  readonly audit_trail: readonly AuditEntry[];
  readonly created_at: string;
  readonly authorisation: false;
  readonly execution: false;
  readonly authority_boundary: "orchestrator_advisory_until_founder_authorises";
  readonly attribution: {
    readonly external_llm_used: false;
    readonly deterministic: true;
    readonly taught_by: "master_ai_engineer";
    readonly role: "nex1_orchestrator";
    readonly authority: "orchestration_advisory";
    readonly produced_by: "nex1_orchestrator";
  };
}

export interface SubmitInput {
  readonly raw_request: string;
  readonly seed?: string;
  readonly structured_hints?: Partial<StructuredIntent>;
  readonly reject_llm_attempt?: boolean;
}

export interface DecisionInput {
  readonly trace_id: string;
  readonly decision: FounderDecision;
  readonly founder_authorisation_token: string;   // must be non-empty for AUTHORISE
  readonly reason?: string;
}
