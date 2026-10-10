// src/lib/nex/aof/types.ts
//
// NEX Autonomous Operations Framework · shared types
// Founder-authorised programme · 2026-09-22.

export type AgentRole =
  | "source_intelligence"
  | "rate_governor"
  | "country_scheduler"
  | "api_adapter_registry"
  | "heartbeat_recovery"
  | "discovery"
  | "website_walk"
  | "evidence_audit"
  | "orbiting"
  | "live_streaming"
  | "connections"
  | "gate_adapter";

export type AgentStatus = "registered" | "active" | "paused" | "stopped" | "error";

export type Capability =
  | "source_probe"
  | "website_walk"
  | "publish_evidence"
  | "manage_cooldown"
  | "schedule_country"
  | "failover_source"
  | "recover_worker"
  | "emit_heartbeat"
  | "stream_events"
  | "connect_adapter"
  | "audit_evidence"
  | "orbit_territories";

export type EventKind =
  | "registered" | "signed" | "activated" | "paused" | "stopped"
  | "heartbeat" | "decision" | "failover" | "cooldown_applied"
  | "error" | "audit_pass" | "audit_fail"
  | "cycle_start" | "cycle_end";

export type CooldownFailureKind =
  | "rate_limited" | "source_unavailable" | "parse_error"
  | "network_error" | "ip_blocked" | "robots_denied" | "other";

export interface AofAgent {
  readonly agent_id: string;
  readonly agent_name: string;
  readonly agent_role: AgentRole;
  readonly description: string | null;
  readonly status: AgentStatus;
  readonly founder_signed: boolean;
  readonly founder_signed_at: string | null;
  readonly founder_signed_by: string | null;
  readonly last_seen_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly metadata: Record<string, unknown>;
}

export interface AofCapabilityGrant {
  readonly agent_id: string;
  readonly capability: Capability;
  readonly scope: Record<string, unknown>;
  readonly granted_by: string;
  readonly granted_at: string;
  readonly revoked_at: string | null;
}

export interface AofAgentEvent {
  readonly event_id: number;
  readonly agent_id: string;
  readonly event_kind: EventKind;
  readonly event_at: string;
  readonly worker_id: string | null;
  readonly cycle_id: string | null;
  readonly payload: Record<string, unknown>;
}

export interface AofSourceCooldown {
  readonly source_slug: string;
  readonly cooldown_until: string;
  readonly last_failure_kind: CooldownFailureKind;
  readonly last_failure_at: string;
  readonly consecutive_failures: number;
  readonly applied_by_agent_id: string | null;
  readonly metadata: Record<string, unknown>;
}

export interface AofCycle {
  readonly cycle_id: string;
  readonly cycle_seq: number;
  readonly started_at: string;
  readonly ended_at: string | null;
  readonly ended_kind: "completed" | "aborted" | "interrupted" | null;
  readonly triggered_by: string;
  readonly programme_id: string | null;
  readonly countries_touched: readonly string[];
  readonly sources_attempted: readonly string[];
  readonly sources_succeeded: readonly string[];
  readonly sources_cooled_down: readonly string[];
  readonly candidates_added: number;
  readonly walks_completed: number;
  readonly evidence_added: number;
  readonly emails_captured: number;
  readonly metadata: Record<string, unknown>;
}

// Minimal client shape (avoids hard pg dependency at module level)
export interface PgClient {
  query(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount?: number | null }>;
}

// ─── Doctrine locks ─────────────────────────────────────────────────
export const _AOF_AGENT_INACTIVE_UNTIL_FOUNDER_SIGNED =
  "agent_transitions_to_active_only_when_founder_signed_true_and_founder_signed_at_present";

export const _AOF_CAPABILITY_MUST_BE_EXPLICITLY_GRANTED =
  "no_ambient_authority_every_capability_must_appear_in_aof_agent_capability_or_call_refuses";

export const _AOF_EVENT_LOG_IS_APPEND_ONLY =
  "aof_agent_event_rows_are_only_ever_inserted_never_updated_never_deleted_by_agents";

export const _AOF_HAS_NO_AMBIENT_AUTHORITY =
  "agents_never_bypass_governors_never_rotate_identity_never_break_walls_route_around_only";

export const _AOF_GOVERNING_RESPONSE_TO_BLOCK =
  "SLOW_COOLDOWN_RETRY_FAILOVER_RECORD_never_BYPASS_EVADE_ROTATE_FORCE";
