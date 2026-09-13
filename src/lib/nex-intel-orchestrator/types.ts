// WO-INTEL-ORCHESTRATOR-01 · types.
//
// Founder-authorised 2026-09-13 (conditional: heartbeat tested first — done).
// Doctrine §11.8 operating-mandate pattern + §11.7 golden rule.
// Capability grows upward, authority stays governed.

export type IntelligenceWorkClass =
  | "crawl_new_authorised_source"
  | "revisit_stale_knowledge"
  | "resolve_contradiction"
  | "detect_new_combinations"
  | "test_promising_hypothesis"
  | "reproduce_previous_finding"
  | "challenge_existing_knowledge"
  | "investigate_stale_knowledge";

export interface IntelligenceOperatingMandate {
  readonly record_type: "NEX_INTEL_OPERATING_MANDATE";
  readonly mandate_id: string;
  readonly version: "wo-intel-orch.v0.1";
  readonly issued_at: string;
  readonly expires_at: string;
  readonly authorised_source_class_ids: readonly string[];
  readonly authorised_crawler_manifest_ids: readonly string[];
  readonly authorised_work_classes: readonly IntelligenceWorkClass[];
  readonly authorised_domains: readonly string[];
  readonly max_concurrent_missions: number;
  readonly max_daily_missions: number;
  readonly max_experiment_budget_ms: number;
  readonly max_storage_bytes_per_mission: number;
  readonly prohibited_actions: readonly string[];
  readonly prohibited_hosts: readonly string[];
  readonly promotion_thresholds_by_tier: {
    readonly INTELLIGENCE: number;
    readonly SUPER_INTELLIGENCE: number;
  };
  readonly authorising_wo_id: string;
  readonly attestation_signature_hex: string;   // signature over canonical form
  readonly provenance_chain_hash: string;
}

export interface IntelligenceMission {
  readonly record_type: "NEX_INTEL_MISSION";
  readonly mission_id: string;
  readonly mandate_id: string;
  readonly kind: IntelligenceWorkClass;
  readonly created_at: string;
  readonly expires_at: string;
  readonly objective: string;
  readonly scope: {
    readonly source_class_ids?: readonly string[];
    readonly source_ids?: readonly string[];
    readonly knowledge_ids?: readonly string[];
    readonly hypothesis_ids?: readonly string[];
  };
  readonly agent_assignments: readonly {
    readonly agent_id: string;
    readonly role: "crawler" | "discovery" | "hypothesis" | "experiment" | "scoring" | "proposal";
  }[];
  readonly compute_budget_ms: number;
  readonly evidence_requirements: {
    readonly min_source_records?: number;
    readonly min_experiment_outcomes?: number;
    readonly min_generalisation_ratio?: number;
  };
  readonly expected_outputs: readonly (
    | "SourceRecord" | "KnowledgeFragment" | "DiscoveryRecord"
    | "HypothesisRecord" | "ExperimentRecord" | "ProposalRecord"
  )[];
  readonly termination_condition: string;
  readonly provenance_chain_hash: string;
}

export type MissionOutcomeKind =
  | "COMPLETED"
  | "FAILED"
  | "TIMED_OUT"
  | "REFUSED_BY_MANDATE"
  | "REFUSED_BY_ENVELOPE"
  | "PARTIAL";

export interface MissionOutcome {
  readonly record_type: "NEX_INTEL_MISSION_OUTCOME";
  readonly outcome_id: string;
  readonly mission_id: string;
  readonly mandate_id: string;
  readonly started_at: string;
  readonly finished_at: string;
  readonly kind: MissionOutcomeKind;
  readonly outputs_produced: {
    readonly source_record_ids: readonly string[];
    readonly knowledge_fragment_ids: readonly string[];
    readonly discovery_ids: readonly string[];
    readonly hypothesis_ids: readonly string[];
    readonly experiment_ids: readonly string[];
    readonly proposal_ids: readonly string[];
  };
  readonly evidence_summary: {
    readonly sources_acquired: number;
    readonly fragments_extracted: number;
    readonly discoveries_produced: number;
    readonly hypotheses_formed: number;
    readonly experiments_run: number;
    readonly experiments_passed: number;
    readonly proposals_emitted: number;
    readonly contradictions_detected: number;
    readonly fabricated_or_unsupported_rejected: number;
  };
  readonly resource_usage: { readonly runtime_ms: number };
  readonly failure_reason: string | null;
  readonly provenance_chain_hash: string;
}
