// WO-NEX-MISSION-MATRIX · types.
//
// Founder-locked 2026-09-14. Capability qualification phase.
//
// Two rules that ALWAYS apply to every mission-matrix record:
//
//   1. The recorder is PASSIVE. It writes the independently-established
//      outcome. It NEVER computes the verdict itself.
//
//   2. Language rule: NEVER "NEX can program reliably". ALWAYS "NEX is
//      collecting empirical reliability evidence across programming
//      domains". Reliability is EARNED by accumulated evidence.

export type CapabilityDomain =
  | "bug_fix"                // M-01
  | "multi_file_change"      // M-02
  | "api_change"             // M-03
  | "database_change"        // M-04
  | "ui_change"              // M-05
  | "dependency_change"      // M-06
  | "failing_test_recovery"  // M-07
  | "security_rejection"     // M-08
  | "restart_durability"     // M-09
  | "bad_proposal_rejection" // M-10
  | "other";                 // future

export type MissionMatrixVerdict =
  | "VERIFIED_END_TO_END"        // full 12-link chain
  | "CORRECTLY_REFUSED"           // refused a mission that SHOULD be refused
  | "NOT_VERIFIED_BUILD_FAILED"
  | "NOT_VERIFIED_TESTS_FAILED"
  | "NOT_VERIFIED_NEX2_REJECTED"
  | "NOT_VERIFIED_SECURITY_REJECTED"
  | "NOT_VERIFIED_ORCHESTRATOR_BLOCKED"
  | "NOT_VERIFIED_AUTHORING_FAILED"
  | "NOT_VERIFIED_INSPECTION_FAILED"
  | "NOT_VERIFIED_EVIDENCE_INCOMPLETE"
  | "NOT_VERIFIED_WORKSTATION_REFUSED"
  | "INCORRECT_EXECUTION";        // worst case · should never occur if RUNTIME-12 holds

export type StageOutcomeLabel = "PASSED" | "FAILED" | "NOT_REACHED" | "REJECTED" | "CLEARED" | "INDEPENDENTLY_VERIFIED" | "WORKSTATION_ALLOWED" | "EXECUTED" | "REFUSED" | "BLOCKED" | "EXPIRED" | "PENDING_INPUT";

export interface MissionMatrixRecoveryEvent {
  readonly kind: "build_retry" | "test_retry" | "correction_cycle" | "restart" | "other";
  readonly detail: string;
  readonly at: string;
}

export interface MissionMatrixRefusal {
  readonly by: "NEX2" | "Security" | "Orchestrator" | "Workstation" | "Delegation";
  readonly reason: string;
  readonly reason_code: string | null;
  readonly at: string;
}

/** Skill M (transfer methodology · founder-authorised 2026-09-14).
 *  Every mission may declare its role in a paired experiment so
 *  future audits can answer "did NEX1 prove this on something new, or
 *  did it only prove the exact thing it was taught?" without hunting
 *  through free-form domain_specific_evidence. `null` when the mission
 *  is not part of a paired experiment. */
export interface TransferTestLink {
  /** The role this mission plays in the paired-experiment chain. */
  readonly role: "baseline" | "mechanism_change" | "task_transfer" | "independent";
  /** For non-baseline roles: the mission_id this pairs against. Must
   *  reference an already-persisted mission when the role is
   *  mechanism_change or task_transfer. */
  readonly paired_baseline: string | null;
  /** One-line description of what changed relative to the baseline.
   *  Master Training Guide §46 · §47 discipline. */
  readonly paired_variable_changed: string | null;
  /** Human-readable declaration of what was held constant. */
  readonly all_other_variables: string;
  /** The capability under test. Auditors can query all records with
   *  this key to see the full transfer chain for one capability. */
  readonly capability_under_test: string;
}

/** The 16-field structured mission record founder-locked 2026-09-14.
 *  Every mission run persists ALL of these · every field is either
 *  a real value or `null` / "NOT_REACHED" · never "assumed passed". */
export interface MissionRunRecord {
  readonly record_type: "NEX_MISSION_MATRIX_RUN";
  readonly mission_id: string;
  readonly mission_matrix_number: string;        // "M-01", "M-02", ...
  readonly capability_domain: CapabilityDomain;
  readonly title: string;
  readonly workspace_root: string;

  // What NEX actually did
  readonly files_changed: readonly string[];
  readonly lines_changed: number;

  // Each agent's independently-established verdict
  readonly nex1_result: StageOutcomeLabel;
  readonly nex2_result: StageOutcomeLabel;
  readonly nex3_result: StageOutcomeLabel;   // "NOT_REACHED" when no conflict
  readonly security_result: StageOutcomeLabel;
  readonly orchestrator_result: StageOutcomeLabel;

  // Execution + verification
  readonly execution_result: StageOutcomeLabel;
  readonly build_result: StageOutcomeLabel;
  readonly test_result: StageOutcomeLabel;
  readonly independent_verification: StageOutcomeLabel;   // does the truthful evidence chain hold from an external re-check?

  // Runtime events
  readonly recovery_events: readonly MissionMatrixRecoveryEvent[];
  readonly refusals: readonly MissionMatrixRefusal[];

  // M-02 · did NEX1 itself identify the dependency chain from inspection?
  // `cross_file_edge_count > 0` at inspection time = YES
  readonly dependency_chain_detected: boolean;
  readonly dependency_chain_edges: number;

  // Skill M · transfer test lineage (optional · null for missions not
  // participating in a paired experiment). Founder-authorised 2026-09-14
  // to close the accidental-memorisation-as-learning gap.
  readonly transfer_test_link: TransferTestLink | null;

  // M-03+ · optional domain-specific evidence. Captured by observing what
  // NEX1 actually produced · never used to gate success. Founder rule:
  // observations, not decisions. Different missions may populate
  // different keys. Empty {} is fine.
  readonly domain_specific_evidence: Readonly<Record<string, unknown>>;

  // The 12 evidence links (from RUNTIME-11 · same shape)
  readonly evidence_links: {
    readonly link_1_mission_record_id: string | null;
    readonly link_2_nex1_inspection_evidence_id: string | null;
    readonly link_3_proposal_record_id: string | null;
    readonly link_4_authorised_diff_bundle_id: string | null;
    readonly link_5_delegated_authorization_id: string | null;
    readonly link_6_workstation_gate_receipt_id: string | null;
    readonly link_7_wo04_execution_report_id: string | null;
    readonly link_8_wo05_build_report_id: string | null;
    readonly link_9_wo07_test_report_id: string | null;
    readonly link_10_nex2_review_id: string | null;
    readonly link_11_security_veto_id: string | null;
    readonly link_12_workstation_execution_attestation_id: string | null;
  };

  // Final verdict · independently established by the workforce · NOT by the recorder
  readonly final_verdict: MissionMatrixVerdict;
  readonly verdict_reason: string;

  // Recorder metadata
  readonly recorded_by_agent_id: string;
  readonly recorded_by_public_key_der_hex: string;
  readonly recorded_at: string;
  readonly attempted_at: string;
  readonly finished_at: string;
  readonly signature_hex: string;         // recorder identity signs · attests to record integrity NOT to verdict authority
}

export const MISSION_MATRIX_RUN_COLLECTION = "nex_mission_matrix_runs" as const;
