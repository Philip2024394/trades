// WO-HQ-HEARTBEAT-01 · types.
//
// Founder-authorised 2026-09-13. Doctrine §11.7 golden rule +
// §11.11 dual-signal principle: WORKING requires BOTH liveness AND
// progress. Alive-without-progress = STALLED.

export type HeartbeatState =
  | "ALIVE"      // liveness signal · no active mission
  | "WORKING"    // liveness AND active mission AND recent progress
  | "WAITING"    // liveness · scheduler examined · no eligible work
  | "STALLED"    // liveness · active mission · no progress > stall_threshold
  | "FAILED"     // no liveness beyond threshold
  | "DEGRADED";  // liveness · intermittent failures OR resource pressure

export interface LivenessSignal {
  readonly is_alive: boolean;
  readonly last_evidence_at: string | null;
  readonly age_ms: number | null;
  readonly threshold_ms: number;
}

export interface ProgressSignal {
  readonly has_active_mission: boolean;
  readonly mission_id: string | null;
  readonly items_processed: number;
  readonly items_expected: number | null;
  readonly evidence_records_produced: number;
  readonly last_progress_at: string | null;
  readonly age_since_progress_ms: number | null;
  readonly stall_threshold_ms: number;
}

export interface DegradedIndicators {
  readonly recent_failure_count: number;
  readonly resource_pressure: boolean;
  readonly fail_threshold: number;
}

export interface AgentHeartbeat {
  readonly record_type: "NEX_HQ_AGENT_HEARTBEAT";
  readonly heartbeat_id: string;
  readonly agent_id: string;
  readonly observed_at: string;
  readonly liveness_signal: LivenessSignal;
  readonly progress_signal: ProgressSignal;
  readonly scheduler_examined_workload: boolean;
  readonly derived_state: HeartbeatState;
  readonly derivation_reason: string;
  readonly provenance_chain_hash: string;
}

export interface AgentProgressSnapshot {
  readonly record_type: "NEX_HQ_AGENT_PROGRESS_SNAPSHOT";
  readonly snapshot_id: string;
  readonly agent_id: string;
  readonly mission_id: string;
  readonly observed_at: string;
  readonly items_processed: number;
  readonly items_expected: number | null;
  readonly evidence_record_ids: readonly string[];
  readonly compute_used_ms: number;
  readonly deadline: string | null;
  readonly last_progress_at: string;
  readonly provenance_chain_hash: string;
}

export type RecoveryAction =
  | "NONE"
  | "RETRY_MISSION"
  | "ISSUE_NOTICE_1"
  | "ISSUE_NOTICE_2"
  | "ISSUE_NOTICE_3"
  | "ESCALATE_TO_FOUNDER";

export interface AgentHealthCheck {
  readonly record_type: "NEX_HQ_AGENT_HEALTH_CHECK";
  readonly check_id: string;
  readonly agent_id: string;
  readonly checked_at: string;
  readonly heartbeat_id: string;
  readonly current_state: HeartbeatState;
  readonly previous_state: HeartbeatState | null;
  readonly state_transitioned: boolean;
  readonly action_taken: RecoveryAction;
  readonly action_evidence_pointer: string | null;
  readonly reason: string;
  readonly provenance_chain_hash: string;
}

/** Union used by the tick response payload. */
export interface HeartbeatTickResult {
  readonly cycle_id: string;
  readonly started_at: string;
  readonly finished_at: string;
  readonly agents_observed: number;
  readonly by_state: Readonly<Record<HeartbeatState, number>>;
  readonly recovery_actions: readonly {
    readonly agent_id: string;
    readonly action: RecoveryAction;
  }[];
}
