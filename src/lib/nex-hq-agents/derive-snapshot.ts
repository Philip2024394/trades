// WO-HQ-AGENTS-01 · deterministic snapshot derivation.
//
// Given the raw record list from an agent's source collection, produce the
// AgentSnapshot honouring the Continuous Operation Doctrine §2 lifecycle
// contract. Pure function of inputs — no I/O.

import type {
  AcademyStateSummary,
  AgentDescriptor,
  AgentLifecycleState,
  AgentSnapshot,
} from "./types";

const SIXTY_SECONDS_MS = 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 3600 * 1000;

export interface DeriveInput {
  readonly agent: AgentDescriptor;
  readonly records: readonly Record<string, unknown>[];
  readonly now: Date;
  /** WO-ACADEMY-01 · optional Academy state overlay. null when the agent
   *  has not yet been onboarded to the Academy. */
  readonly academy?: AcademyStateSummary | null;
}

/**
 * Field conventions the derivation reads from records (best-effort per-kind):
 *   - `*_at` fields for timestamps (e.g. `fetched_at`, `started_at`, `run_at`, `emitted_at`, `created_at`)
 *   - `outcome` / `status` / `exit_code` for success/failure classification
 *   - `*_id` fields as record identifiers
 *
 * Records that don't fit these conventions still count for total_records_observed
 * but may leave last_activity_at as null. This is deliberate — we do NOT fabricate
 * timestamps; the absence is honest.
 */
export function deriveSnapshot(input: DeriveInput): AgentSnapshot {
  const { agent, records, now } = input;
  const nowMs = now.getTime();

  const total_records_observed = records.length;

  // Extract usable timestamp + id from every record
  type Entry = { record: Record<string, unknown>; timestampMs: number | null; id: string; success: boolean | null };
  const entries: Entry[] = records.map((r) => {
    return {
      record: r,
      timestampMs: extractTimestampMs(r),
      id: extractId(r),
      success: extractSuccess(r),
    };
  });

  // Sort by timestamp descending (records with no timestamp go last)
  const sorted = [...entries].sort((a, b) => {
    if (a.timestampMs === null && b.timestampMs === null) return 0;
    if (a.timestampMs === null) return 1;
    if (b.timestampMs === null) return -1;
    return b.timestampMs - a.timestampMs;
  });

  const last_activity_at = sorted[0]?.timestampMs != null ? new Date(sorted[0].timestampMs).toISOString() : null;
  const most_recent_success = sorted.find((e) => e.success === true);
  const last_successful_task = most_recent_success && most_recent_success.timestampMs != null
    ? { record_id: most_recent_success.id, at: new Date(most_recent_success.timestampMs).toISOString() }
    : null;
  const recent_record_ids = sorted.slice(0, 3).map((e) => e.id).filter((s) => s.length > 0);

  // Time windows
  const inLast60s = sorted.filter((e) => e.timestampMs !== null && (nowMs - e.timestampMs) <= SIXTY_SECONDS_MS);
  const inLast24h = sorted.filter((e) => e.timestampMs !== null && (nowMs - e.timestampMs) <= TWENTY_FOUR_HOURS_MS);
  const succ24h = inLast24h.filter((e) => e.success === true);
  const fail24h = inLast24h.filter((e) => e.success === false);
  const mostRecent = sorted[0];

  // State classification (deterministic, ordered)
  let state: AgentLifecycleState;
  if (total_records_observed === 0) {
    state = "WAITING";
  } else if (inLast60s.length > 0) {
    state = agent.lane === "intelligence" ? "RESEARCHING" : "WORKING";
  } else if (fail24h.length > 0 && succ24h.length === 0) {
    state = "FAILED";
  } else if (fail24h.length > 0 && succ24h.length > 0) {
    state = "DEGRADED";
  } else if (mostRecent && mostRecent.success === false) {
    state = "BLOCKED";
  } else if (inLast24h.length > 0) {
    state = "READY";
  } else {
    state = "WAITING";
  }

  // Assignment string
  const current_assignment = inLast60s.length > 0
    ? `Processing ${inLast60s.length} record(s) in last 60s`
    : state === "READY"
      ? "IDLE — awaiting authorised task"
      : state === "WAITING"
        ? total_records_observed === 0
          ? "IDLE — never observed this session"
          : "IDLE — no activity in last 24h"
        : `state=${state}`;

  // Health colour derived from state
  const health: AgentSnapshot["health"] =
    state === "WORKING" || state === "RESEARCHING" ? "green"
    : state === "READY" ? "green"
    : state === "DEGRADED" || state === "BLOCKED" ? "amber"
    : state === "FAILED" || state === "QUARANTINED" ? "red"
    : "grey";

  // Non-normal state details (per doctrine §2)
  const non_normal_state: AgentSnapshot["non_normal_state"] =
    (state === "BLOCKED" || state === "DEGRADED" || state === "FAILED" || state === "QUARANTINED" || state === "DECOMMISSIONED")
      ? {
          reason: nonNormalReason(state, agent, mostRecent, fail24h.length, succ24h.length),
          entered_at: mostRecent?.timestampMs != null ? new Date(mostRecent.timestampMs).toISOString() : (last_activity_at ?? new Date(nowMs).toISOString()),
          responsible_subsystem: agent.name,
          evidence_pointer: mostRecent?.id ?? null,
          recovery_path: recoveryPath(state, agent),
        }
      : null;

  const last_state_transition_at = last_activity_at ?? new Date(nowMs).toISOString();

  return {
    id: agent.id,
    name: agent.name,
    kind: agent.kind,
    lane: agent.lane,
    state,
    last_activity_at,
    last_successful_task,
    current_assignment,
    total_records_observed,
    recent_record_ids: Object.freeze([...recent_record_ids]) as readonly string[],
    health,
    non_normal_state,
    last_state_transition_at,
    academy: input.academy ?? null,
    heartbeat: null,   // populated by the API-route caller (WO-HQ-HEARTBEAT-01)
  };
}

// ── Extractors ─────────────────────────────────────────────────────────

function extractTimestampMs(r: Record<string, unknown>): number | null {
  const candidates = ["fetched_at", "started_at", "run_at", "emitted_at", "detected_at", "formed_at", "attempted_at", "created_at", "updated_at", "invoked_at", "wrote_at", "at", "timestamp"];
  for (const k of candidates) {
    const v = r[k];
    if (typeof v === "string" && v.length > 0) {
      const ms = Date.parse(v);
      if (!Number.isNaN(ms)) return ms;
    }
  }
  return null;
}

function extractId(r: Record<string, unknown>): string {
  const candidates = ["source_id", "knowledge_id", "hypothesis_id", "experiment_id", "proposal_id", "audit_id", "report_id", "invocation_id", "result_id", "build_id", "run_id", "trace_id", "event_id", "authorization_id", "id"];
  for (const k of candidates) {
    const v = r[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return "";
}

function extractSuccess(r: Record<string, unknown>): boolean | null {
  // Crawler audit
  if (r.record_type === "NEX_INTELLIGENCE_CRAWLER_AUDIT") {
    if (r.outcome === "PERMITTED") return true;
    if (typeof r.outcome === "string" && r.outcome.startsWith("REFUSED_")) return false;
    if (r.outcome === "PERMITTED_BUT_HTTP_ERROR") return false;
    return null;
  }
  // Specialist result
  if (r.record_type === "NEX1_SPECIALIST_RESULT" || r.record_type === "NEX_INTELLIGENCE_EXPERIMENT") {
    if (r.status === "PASSED") return true;
    if (r.status === "FAILED") return false;
    if (typeof r.success_count === "number" && typeof r.failure_count === "number") {
      return r.success_count > 0 && r.failure_count === 0;
    }
    return null;
  }
  // Build report
  if (r.record_type === "NEX1_BUILD_REPORT") {
    if (r.exit_code === 0) return true;
    if (typeof r.exit_code === "number" && r.exit_code !== 0) return false;
    return null;
  }
  // Runtime report
  if (r.record_type === "NEX1_RUNTIME_REPORT") {
    const health = (r.health ?? null) as { response_status?: number; succeeded_at?: string } | null;
    if (health && typeof health.response_status === "number" && health.response_status >= 200 && health.response_status < 300) return true;
    return false;
  }
  // Execution report — observer verdict
  if (r.record_type === "NEX1_EXECUTION_REPORT") {
    const observer = (r.observer ?? null) as { verdict_kind?: string } | null;
    if (observer?.verdict_kind === "MATCH") return true;
    if (typeof observer?.verdict_kind === "string") return false;
    return null;
  }
  return null;
}

function nonNormalReason(state: AgentLifecycleState, _agent: AgentDescriptor, mostRecent: unknown, failCount: number, succCount: number): string {
  const m = mostRecent as { record?: Record<string, unknown> } | undefined;
  const outcome = m?.record?.outcome;
  const status = m?.record?.status;
  const exit = m?.record?.exit_code;
  switch (state) {
    case "BLOCKED":  return `most recent outcome was ${outcome ?? status ?? `exit_code=${exit}`}`;
    case "DEGRADED": return `${failCount} failure(s) + ${succCount} success(es) in last 24h — intermittent`;
    case "FAILED":   return `${failCount} failure(s) with no success in last 24h`;
    case "QUARANTINED": return "quarantined by Guardian (reserved — Phase 14)";
    case "DECOMMISSIONED": return "decommissioned by Agent Registry (reserved)";
    default: return "";
  }
}

function recoveryPath(state: AgentLifecycleState, agent: AgentDescriptor): string | null {
  switch (state) {
    case "BLOCKED":  return `Investigate the most recent record for ${agent.name}; check upstream inputs`;
    case "DEGRADED": return `Correlate failures with input variance; consider revisit or retest`;
    case "FAILED":   return `Escalate to founder; the WO-09 corrector will attempt deterministic recovery on next authorised cycle`;
    case "QUARANTINED": return "Guardian will initiate recovery per its authorised playbook";
    case "DECOMMISSIONED": return null;
    default: return null;
  }
}
