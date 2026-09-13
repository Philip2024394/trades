// WO-HQ-AGENTS-01 · types for the HQ live-observation page
//
// Read-only observation layer. Every value derives from real GB storage;
// nothing here writes, signs, or mutates.

export type AgentLifecycleState =
  | "WORKING"       // record written in the last 60 seconds
  | "READY"         // has recent records (last 24h) but nothing in last 60s
  | "WAITING"       // collection exists but no records in last 24h
  | "RESEARCHING"   // intelligence-lane agent, currently active
  | "TRAINING"      // reserved for future Agent Academy
  | "TESTING"       // reserved for future Agent Academy
  | "BLOCKED"       // most recent outcome is REFUSED_* or FAILURE
  | "DEGRADED"      // mixed recent outcomes (≥1 failure + ≥1 success in 24h)
  | "FAILED"        // most recent outcome failure AND no success in 24h
  | "QUARANTINED"   // reserved for future Guardian integration
  | "DECOMMISSIONED";// reserved for future Agent Registry

export type AgentLane = "orchestrator" | "intelligence";

export type AgentKind =
  | "orchestrator"
  | "author-stage"
  | "write-stage"
  | "build-stage"
  | "runtime-stage"
  | "validation-stage"
  | "correction-stage"
  | "enforcement"
  | "data-collection"
  | "discovery"
  | "hypothesis"
  | "experiment"
  | "scoring"
  | "proposal";

export interface AgentDescriptor {
  readonly id: string;              // stable id (kebab-case)
  readonly name: string;            // human name
  readonly kind: AgentKind;
  readonly lane: AgentLane;
  readonly source_collection: string;   // primary GB collection observed
  readonly wire_downstream: readonly string[];   // agent ids this feeds into
}

export interface AcademyStateSummary {
  readonly career_state: string;   // CareerState string; no cross-module import to keep this layer thin
  readonly task_completion_score: number;
  readonly knowledge_contribution_score: number;
  readonly regression_score: number;
  readonly notice_count: { readonly notice_1: number; readonly notice_2: number; readonly notice_3: number };
  readonly capability_profile_version: number;
  readonly open_notices: readonly {
    readonly kind: string;
    readonly reason: string;
    readonly issued_at: string;
  }[];
  /** WO-ACADEMY-02 extension: training program count + last verdict summary. */
  readonly training: {
    readonly active_programs: number;
    readonly last_verdict: {
      readonly kind: string;              // TrainingVerdictKind
      readonly at: string;                // ISO
      readonly targeted_weakness: string;
    } | null;
  } | null;
}

export interface AgentSnapshot {
  readonly id: string;
  readonly name: string;
  readonly kind: AgentKind;
  readonly lane: AgentLane;
  readonly state: AgentLifecycleState;
  readonly last_activity_at: string | null;   // ISO or null if never observed
  readonly last_successful_task: {
    readonly record_id: string;
    readonly at: string;
  } | null;
  readonly current_assignment: string;   // human-readable ("IDLE — awaiting authorised task" when READY)
  readonly total_records_observed: number;
  readonly recent_record_ids: readonly string[];   // latest 3, id-only
  readonly health: "green" | "amber" | "grey" | "red";
  readonly non_normal_state: {
    readonly reason: string;
    readonly entered_at: string;
    readonly responsible_subsystem: string;
    readonly evidence_pointer: string | null;
    readonly recovery_path: string | null;
  } | null;
  readonly last_state_transition_at: string;

  /** WO-ACADEMY-01 extension: Academy state overlay. Read-only. */
  readonly academy: AcademyStateSummary | null;

  /** WO-HQ-HEARTBEAT-01 extension: dual-signal heartbeat overlay. Read-only. */
  readonly heartbeat: {
    readonly state: string;                      // HeartbeatState string
    readonly reason: string;
    readonly observed_at: string;
    readonly liveness_alive: boolean;
    readonly liveness_age_ms: number | null;
    readonly progress_has_mission: boolean;
    readonly progress_mission_id: string | null;
    readonly progress_age_ms: number | null;
    readonly last_action: string;                // RecoveryAction string
    readonly last_action_reason: string;
  } | null;
}

export interface HqAgentsSnapshotResponse {
  readonly record_type: "NEX_HQ_AGENTS_SNAPSHOT";
  readonly generated_at: string;
  readonly agents: readonly AgentSnapshot[];
  readonly wire: readonly {
    readonly from: string;
    readonly to: string;
  }[];
}
