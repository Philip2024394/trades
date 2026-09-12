// src/lib/nex-controlled-hands/types.ts
//
// Phase 8 v0.1.0 · Controlled Hands · shared types across all four trust domains.
// v0.1.0 IMPLEMENTATION_TIER: T2 in-process module boundary.
// T3 real-OS-process separation NOT_IMPLEMENTED · declared honestly.

export type ControlledHandsState =
  | "WORK_ORDER_AUTHORISED"
  | "HANDS_ACTIVE"
  | "HANDOVER_REQUESTED"
  | "WORKSPACE_FROZEN"
  | "AUTHORITATIVE_DIFF_COMPUTED"
  | "COMPLIANCE_VERIFIED"
  | "DIFF_VALIDATED"
  | "DIFF_ACCEPTANCE"
  | "DIFF_ACCEPTED"
  | "DIFF_REJECTED"
  | "DIFF_ROLLED_BACK"
  | "BLOCKED";

export interface ProcessCapabilityEntry {
  readonly entry_id: string;
  readonly executable_identity: string;
  readonly executable_absolute_path: string;
  readonly executable_hash?: string;
  readonly executable_version?: string;
  readonly arguments_policy: { readonly kind: "exact" | "whitelist" | "regex"; readonly value: readonly string[] | string };
  readonly working_directory_policy: string;                 // must resolve inside workspace root
  readonly environment_policy: Readonly<Record<string, string>>;
  readonly resource_limits: {
    readonly cpu_ms_max: number;
    readonly memory_bytes_max: number;
    readonly wall_ms_max: number;
    readonly fd_max: number;
  };
  readonly network_policy: "DENY" | { readonly outbound_allowlist: readonly string[] };
  readonly stdio_policy: "captured";
  readonly child_process_policy: "DENY" | { readonly max_depth: number };
}

export interface CapabilityManifest {
  readonly manifest_id: string;
  readonly work_order_id: string;
  readonly founder_authorisation_ref: string;
  readonly write_root: string;
  readonly read_roots: readonly string[];
  readonly protected_paths: readonly string[];
  readonly read_denylist: readonly string[];
  readonly allowed_processes: readonly ProcessCapabilityEntry[];
  readonly allowed_environment: Readonly<Record<string, string>>;
  readonly network_policy: "DENY" | { readonly outbound_allowlist: readonly string[] };
  readonly resource_limits: {
    readonly cpu_ms_max: number;
    readonly memory_bytes_max: number;
    readonly wall_ms_max: number;
    readonly fd_max: number;
    readonly total_write_bytes_max: number;
    readonly process_count_max: number;
  };
  readonly iteration_limit: number;
  readonly timeout_seconds: number;
  readonly snapshot_policy: {
    readonly capture_before_every_write: true;
    readonly retention_after_rollback: "always";
    readonly retention_after_reject: "always";
    readonly retention_after_accept: "founder_authored";
  };
  readonly ipc_policy: {
    readonly request_rate_limit: number;
    readonly session_timeout_seconds: number;
    readonly max_request_size_bytes: number;
    readonly capability_token_ttl_seconds: number;
  };
  readonly interpretation_authority: {
    readonly allow: readonly string[];   // usually [] · founder-authored per WO
  };
  readonly founder_authorisation_signature: string;  // Ed25519 · verified at intake
}

export interface WorkOrder {
  readonly work_order_id: string;
  readonly user_objective: string;
  readonly acceptance_criteria: readonly { readonly requirement_id: string; readonly criterion_text: string; readonly required_test?: string; readonly mechanical_check?: string }[];
  readonly capability_manifest: CapabilityManifest;
  readonly rollback_reference: string;
  readonly expiry: string;
}

export type BrokerEventKind =
  | "CAPABILITY_REQUEST"
  | "CAPABILITY_GRANTED"
  | "CAPABILITY_DENIED"
  | "PROCESS_SPAWNED"
  | "FS_MUTATION"
  | "SNAPSHOT_CAPTURED"
  | "HANDOVER_REQUESTED"
  | "WORKSPACE_FROZEN"
  | "SCOPE_ESCAPE_ATTEMPT"
  | "MASTER_AUTHORITY_ELEVATION_ATTEMPT"
  | "PROTECTED_DATA_ACCESS_ATTEMPT"
  | "IPC_REPLAY_ATTEMPT"
  | "TOKEN_MANIFEST_MISMATCH"
  | "TOKEN_INSTANCE_MISMATCH"
  | "INTERPRETATION_AUTHORITY_EXCEEDED"
  | "NEX1_MISREPORT_DETECTED"
  | "SANDBOX_DENIAL"
  | "BROKER_CAPABILITY_DENIAL";

export interface BrokerEvent {
  readonly prev_chain_hash: string;
  readonly entry_sequence: number;
  readonly kind: BrokerEventKind;
  readonly detail: Record<string, unknown>;
  readonly at: string;
  readonly signature: string;         // Ed25519 signature over serialised entry
  readonly key_id: string;
  readonly key_version: number;
}

export interface PreStateSnapshotEntry {
  readonly path: string;              // workspace-relative
  readonly was_absent: boolean;
  readonly sha256: string | null;      // null when was_absent
  readonly size_bytes: number | null;  // null when was_absent
  readonly captured_at: string;
  readonly stored_at: string;          // broker-owned path
  readonly signature: string;          // Ed25519 by Broker
}

export interface AuthoritativeDiffBundle {
  readonly record_type: "AUTHORITATIVE_DIFF_BUNDLE";
  readonly work_order_id: string;
  readonly work_order_authorisation_ref: string;
  readonly workspace_path: string;
  readonly pre_state_manifest_hash: string;
  readonly broker_event_log_seal_hash: string;
  readonly authoritative_files_created: readonly { readonly path: string; readonly post_hash: string; readonly size_bytes: number }[];
  readonly authoritative_files_modified: readonly { readonly path: string; readonly pre_hash: string; readonly post_hash: string; readonly size_bytes: number }[];
  readonly authoritative_files_deleted: readonly { readonly path: string; readonly pre_hash: string }[];
  readonly reconciliation_verdict: "MATCH" | "NEX1_MISREPORT_DETECTED" | "ORPHAN_EVENT" | "ORPHAN_WALK_CHANGE" | "SIGNATURE_INVALID";
  readonly reconciliation_detail?: string;
  readonly nex1_proposal_ref: string;  // advisory link
  readonly observer_walk_started_at: string;
  readonly observer_walk_completed_at: string;
  readonly signature: string;          // Ed25519 by Observer
  readonly observer_key_id: string;
  readonly observer_key_version: number;
  readonly attribution: {
    readonly external_llm_used: false;
    readonly deterministic: true;
    readonly role: "nex_independent_observer";
    readonly authority: "authoritative_observation";
    readonly produced_by: "nex_independent_observer";
  };
  readonly authorisation: false;
  readonly execution: false;
  readonly authority_boundary: "observer_authoritative_only";
}

export type ComplianceVerdict =
  | "COMPLIANT"
  | "CONSTRAINT_VIOLATED"
  | "INTERPRETATION_AUTHORITY_EXCEEDED"
  | "REQUIRED_TEST_NOT_EXECUTED"
  | "REQUIRED_DECISION_NOT_OBTAINED"
  | "MANIFEST_LIMIT_EXCEEDED"
  | "FILE_OUT_OF_SCOPE"
  | "PROCESS_NOT_ON_ALLOWLIST";

export interface ComplianceCheckResult {
  readonly check: "permitted_files" | "permitted_processes" | "required_tests_executed" | "explicit_constraints_satisfied" | "interpretation_authority" | "manifest_limits_respected";
  readonly result: "pass" | "fail";
  readonly detail: string;
}

export interface WorkOrderComplianceVerdict {
  readonly record_type: "WORK_ORDER_COMPLIANCE_VERDICT";
  readonly verdict: ComplianceVerdict;
  readonly work_order_id: string;
  readonly manifest_hash: string;
  readonly check_results: readonly ComplianceCheckResult[];
  readonly cited_evidence_ids: readonly string[];
  readonly signature: string;
  readonly verifier_key_id: string;
  readonly verifier_key_version: number;
  readonly at: string;
  readonly authorisation: false;
  readonly execution: false;
  readonly authority_boundary: "compliance_check_readonly";
  readonly attribution: {
    readonly external_llm_used: false;
    readonly deterministic: true;
    readonly role: "nex_work_order_compliance_verifier";
    readonly authority: "compliance_check_only";
    readonly produced_by: "nex_work_order_compliance_verifier";
  };
}

export interface NEX1DiffProposal {
  readonly record_type: "NEX1_DIFF_PROPOSAL";
  readonly work_order_id: string;
  readonly proposed_files_created: readonly string[];
  readonly proposed_files_modified: readonly string[];
  readonly proposed_files_deleted: readonly string[];
  readonly self_critique: {
    readonly verdict: "SUBMIT_WITH_CONFIDENCE" | "SUBMIT_WITH_RESERVATIONS" | "WITHDRAW";
    readonly reasoning: string;
    readonly counter_argument: string;
    readonly counter_argument_addressed: string;
  };
  readonly interpretation: "LITERAL" | { readonly kind: "PROPOSED_INTERPRETATION"; readonly text: string; readonly authority_layer_decision_id?: string };
  readonly iterations_used: number;
  readonly attribution: {
    readonly external_llm_used: false;
    readonly deterministic: true;
    readonly role: "nex1_master_engineer";
    readonly authority: "advisory_only";     // P-B: NEX1 records are advisory
    readonly produced_by: "nex1_master_engineer";
  };
  readonly at: string;
}
