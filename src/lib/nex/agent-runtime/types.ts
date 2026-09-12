// src/lib/nex/agent-runtime/types.ts
//
// NEX Agent Runtime & Workforce Control Plane · types
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · BUILD AND ACTIVATE
//
// §1 GOVERNING PRINCIPLE: an agent is only RUNNING when an independently
// observable execution process exists and is actively producing valid
// heartbeats. Every state below has an evidence contract; nothing is
// inferred from registry configuration alone.

// ── Position identity ───────────────────────────────────────────────

export type AgentId =
  | "programmer"
  | "accommodation"
  | "master_ai"
  | "speaking"
  | "vision"
  | "travel"
  | "business"
  | "food"
  | "construction"
  | "healthcare"
  | "transport";
// Additional agents may register later without changing the runtime
// contract. The runtime does not know about specific agents beyond their
// IDs and worker entry points.
//
// master_ai (Wave-3): the observer/intelligence daemon. Its worker is
// src/lib/nex/agent-runtime/worker-master-ai.ts and its runtime is
// governed by the same heartbeat/PID/founder-stop discipline as the
// two specialist agents. READ-ONLY against every other agent.
//
// vision · travel · business (WAVE-S-1/2/3 · registered 2026-09-08):
// deterministic Phase 3 specialists (no LLM inference · self-testing
// corpus). Not spawned by default · requires explicit Founder "start"
// authorization to become RUNTIME_ACTIVE. Same heartbeat + event-bus
// pattern as speaking. Phase 4 gains LLM inference which will route
// through the LLM gateway per Self-Sustainment doctrine §8.

// ── State model (§1) ────────────────────────────────────────────────

/** Desired state: what the Founder wants. Written by the control-plane
 *  on START/STOP. The watchdog obeys this. */
export type DesiredState =
  | "RUNNING"
  | "STOPPED";

/** Runtime state: independently observed reality. Never trusted from the
 *  agent itself alone. */
export type RuntimeState =
  | "RUNNING"
  | "STARTING"
  | "STOPPING"
  | "STOPPED"
  | "CRASHED"
  | "DEGRADED"
  | "OFFLINE"
  | "BLOCKED";

// ── Restart policy (§16) ───────────────────────────────────────────

export type RestartPolicy = {
  /** Number of consecutive crashes before the watchdog gives up. */
  max_consecutive_crashes: number;
  /** Base backoff in ms; doubles per attempt. */
  backoff_base_ms: number;
  /** Cap on backoff between attempts. */
  backoff_cap_ms: number;
  /** Number of restarts allowed per hour before restart-storm trip. */
  max_restarts_per_hour: number;
};

// ── Resource governance (§20) ──────────────────────────────────────

export type ResourceBudget = {
  concurrency_limit: number;
  task_budget_per_hour: number;
  network_rate_limit_per_minute: number;
  retry_limit: number;
  execution_timeout_ms: number;
  queue_limit: number;
};

// ── Internet requirement (§9 · §10) ────────────────────────────────

export type InternetRequirement =
  | "NOT_REQUIRED"        // agent can produce useful work fully offline
  | "PREFERRED"           // useful work possible offline, some tasks require internet
  | "REQUIRED";           // agent has no offline mode

// ── Position runtime record ────────────────────────────────────────

export type PositionRuntime = {
  agent_id: AgentId;
  machinery: string;              // matches existing workforce/positions.ts vocab
  domain: string;                 // 'engineering' | 'accommodation' | ...
  authorization_state: "AUTHORIZED" | "PENDING_AUTHORIZATION" | "REVOKED";
  desired_state: DesiredState;
  restart_policy: RestartPolicy;
  internet_requirement: InternetRequirement;
  resource_budget: ResourceBudget;
  heartbeat_interval_ms: number;
  queue_capacity: number;
  registered_at_iso: string;
  last_desired_change_iso: string;
  last_desired_change_reason: string;
};

// ── Heartbeat (§14) ────────────────────────────────────────────────
// Emitted by the worker process. The control-plane READS these; it does
// NOT trust the worker to declare itself alive.

export type Heartbeat = {
  agent_id: AgentId;
  run_id: string;
  process_id: number;
  timestamp_iso: string;
  status: "STARTING" | "RUNNING" | "DEGRADED" | "OFFLINE" | "STOPPING";
  current_task: string | null;
  last_success_iso: string | null;
  last_failure_iso: string | null;
  internet_state: "ONLINE" | "OFFLINE" | "UNKNOWN";
  runtime_version: string;
};

// ── Command audit (§28) ────────────────────────────────────────────

export type ControlCommandKind =
  | "START"
  | "STOP"
  | "STATUS";

export type ControlCommand = {
  command_id: string;
  founder_user_id: string | null;      // null when unauthorized (recorded then rejected)
  agent_id: AgentId | "ALL";
  command: ControlCommandKind;
  timestamp_iso: string;
  authorization: "AUTHORIZED" | "REJECTED";
  authorization_reason: string;
  previous_desired_state: DesiredState | null;
  new_desired_state: DesiredState | null;
  result: "OK" | "NOOP" | "REJECTED" | "PARTIAL";
  reason: string;
};

// ── Event bus (§13) ────────────────────────────────────────────────

export type EventKind =
  | "AGENT_STARTED"
  | "AGENT_STOP_REQUESTED"
  | "AGENT_STOPPED"
  | "AGENT_HEARTBEAT"
  | "AGENT_HEALTH_CHANGED"
  | "AGENT_CRASHED"
  | "AGENT_RESTARTED"
  | "AGENT_RESTART_GIVEUP"
  | "WORK_STARTED"
  | "WORK_COMPLETED"
  | "WORK_FAILED"
  | "WORK_BLOCKED"
  | "SOURCE_AVAILABLE"
  | "SOURCE_UNAVAILABLE"
  | "INTERNET_ONLINE"
  | "INTERNET_OFFLINE"
  | "LEARNING_OBSERVED"
  | "CANDIDATE_CREATED"
  | "CANDIDATE_REJECTED"
  | "CANDIDATE_VERIFIED"
  | "FRESHNESS_DUE"
  | "REFRESH_STARTED"
  | "REFRESH_COMPLETED"
  | "FOUNDER_STOP_OVERRIDE_SET"
  | "FOUNDER_STOP_OVERRIDE_RELEASED"
  | "WATCHDOG_TICK";

export type AgentEvent = {
  event_id: string;
  kind: EventKind;
  agent_id: AgentId | "control_plane" | "watchdog";
  timestamp_iso: string;
  process_id: number | null;
  attributes: Record<string, string | number | boolean | null>;
};

// ── Composite status shape returned by /status ─────────────────────

export type AgentStatus = {
  agent_id: AgentId;
  desired_state: DesiredState;
  runtime_state: RuntimeState;
  process_id: number | null;
  started_at_iso: string | null;
  last_heartbeat_iso: string | null;
  last_heartbeat_stale_ms: number | null;
  current_task: string | null;
  last_success_iso: string | null;
  last_failure_iso: string | null;
  restart_count_last_hour: number;
  internet_state: "ONLINE" | "OFFLINE" | "UNKNOWN";
  reason: string;
};

export type ControlPlaneStatus = {
  now_iso: string;
  founder_stop_override: boolean;
  host_state: "AVAILABLE" | "UNKNOWN";
  agents: AgentStatus[];
  summary: {
    active: number;
    stopped: number;
    crashed: number;
    blocked: number;
    degraded: number;
    offline: number;
  };
};

// ── Founder-stop override (§17) ────────────────────────────────────

export type FounderStopOverride = {
  active: boolean;
  set_at_iso: string | null;
  set_by_user_id: string | null;
  reason: string;
};

// ── Runtime version pin (§14) ──────────────────────────────────────

export const AGENT_RUNTIME_VERSION = "0.1.0";

// ── Standard defaults ──────────────────────────────────────────────

export function defaultRestartPolicy(): RestartPolicy {
  return {
    max_consecutive_crashes: 5,
    backoff_base_ms: 2000,
    backoff_cap_ms: 60_000,
    max_restarts_per_hour: 12,
  };
}

export function defaultResourceBudget(): ResourceBudget {
  return {
    concurrency_limit: 1,
    task_budget_per_hour: 120,
    network_rate_limit_per_minute: 60,
    retry_limit: 3,
    execution_timeout_ms: 60_000,
    queue_limit: 100,
  };
}
