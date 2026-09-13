// WO-HQ-HEARTBEAT-01 · main monitor entry point.
//
// One "tick" observes every agent in the registry, derives the current
// heartbeat state per agent, decides bounded recovery, and persists
// everything. Called every 3 minutes (founder-locked).
//
// This module never CREATES work. It OBSERVES. If no work is available
// the correct state is WAITING and we leave it there.

import { randomUUID } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { provenanceChainHash } from "@/lib/nex-intelligence/provenance";
import { AGENT_REGISTRY } from "@/lib/nex-hq-agents/registry";
import type { AgentDescriptor } from "@/lib/nex-hq-agents/types";
import {
  HEARTBEAT_THRESHOLDS,
  deriveHeartbeatState,
} from "./state-derivation";
import { buildHealthCheck, decideRecoveryAction, persistHealthCheck } from "./recovery";
import type {
  AgentHeartbeat,
  DegradedIndicators,
  HeartbeatState,
  HeartbeatTickResult,
  LivenessSignal,
  ProgressSignal,
  RecoveryAction,
} from "./types";

const LIVENESS_THRESHOLD_MS = HEARTBEAT_THRESHOLDS.DEFAULT_LIVENESS_THRESHOLD_MS;
const STALL_THRESHOLD_MS = HEARTBEAT_THRESHOLDS.DEFAULT_STALL_THRESHOLD_MS;
const FAIL_THRESHOLD = HEARTBEAT_THRESHOLDS.DEFAULT_DEGRADED_FAIL_THRESHOLD;

export interface RunHeartbeatTickInput {
  readonly at_time?: Date;
  /** Whether an orchestrator scheduler has examined the mandate before
   *  this tick. When false, agents without active missions are ALIVE (not
   *  yet WAITING). When true, agents without active missions are WAITING
   *  (the real signal). */
  readonly scheduler_examined_workload?: boolean;
  /** Test hook: override the registry (used for property tests). */
  readonly _agents?: readonly AgentDescriptor[];
}

// ── Public entry point ──────────────────────────────────────────────────

export async function runHeartbeatTick(input: RunHeartbeatTickInput = {}): Promise<HeartbeatTickResult> {
  const now = input.at_time ?? new Date();
  const cycle_id = `hb-tick-${now.toISOString()}-${randomUUID().slice(0, 8)}`;
  const started_at = now.toISOString();

  const agents = input._agents ?? AGENT_REGISTRY;
  const by_state: Record<HeartbeatState, number> = {
    ALIVE: 0, WORKING: 0, WAITING: 0, STALLED: 0, FAILED: 0, DEGRADED: 0,
  };
  const recovery_actions: { agent_id: string; action: RecoveryAction }[] = [];

  for (const agent of agents) {
    const heartbeat = await observeAgent({ agent, now, scheduler_examined_workload: input.scheduler_examined_workload ?? false });
    by_state[heartbeat.derived_state]++;
    await persistHeartbeat(heartbeat);

    // Recovery: derive previous state, decide action, persist a health check
    const previousState = await getPreviousState(agent.id);
    const failedIn24h = await getFailedCountLast24h(agent.id, now);
    const recovery = decideRecoveryAction({
      current_state: heartbeat.derived_state,
      previous_state: previousState,
      failed_history_count_24h: failedIn24h,
    });

    let action_evidence_pointer: string | null = null;
    if (recovery.action !== "NONE") {
      recovery_actions.push({ agent_id: agent.id, action: recovery.action });
      // Slice-1: NOTICE issuance persists a lightweight audit record via the health-check
      // pointer field. Full WO-ACADEMY-01 NoticeRecord integration is deferred to when
      // the orchestrator produces missions we can retry against.
    }

    const check = buildHealthCheck({
      agent_id: agent.id,
      heartbeat,
      previous_state: previousState,
      action: recovery.action,
      action_evidence_pointer,
      reason: recovery.reason,
      antecedent_provenance_hashes: [heartbeat.provenance_chain_hash],
    });
    await persistHealthCheck(check);
  }

  return {
    cycle_id,
    started_at,
    finished_at: new Date().toISOString(),
    agents_observed: agents.length,
    by_state,
    recovery_actions: Object.freeze([...recovery_actions]) as readonly { agent_id: string; action: RecoveryAction }[],
  };
}

// ── Observe a single agent ─────────────────────────────────────────────

async function observeAgent(input: { agent: AgentDescriptor; now: Date; scheduler_examined_workload: boolean }): Promise<AgentHeartbeat> {
  const { agent, now, scheduler_examined_workload } = input;
  const nowMs = now.getTime();

  // Read recent records from the agent's source collection to derive liveness
  const records = await tryQuery<Record<string, unknown>>(agent.source_collection, 100);
  const latestTs = latestTimestampMs(records);
  const liveness: LivenessSignal = {
    is_alive: latestTs !== null && (nowMs - latestTs) <= LIVENESS_THRESHOLD_MS,
    last_evidence_at: latestTs !== null ? new Date(latestTs).toISOString() : null,
    age_ms: latestTs !== null ? nowMs - latestTs : null,
    threshold_ms: LIVENESS_THRESHOLD_MS,
  };

  // Progress: check for an active mission in the intelligence-orchestrator collection
  // Slice-1: if no missions collection or none active, has_active_mission=false.
  const activeMissionId = await tryFindActiveMissionForAgent(agent.id);
  const progressRecords = activeMissionId
    ? await tryQuery<{ agent_id?: string; observed_at?: string; items_processed?: number }>(COLLECTIONS.nex_hq_agent_progress_snapshots, 100)
    : [];
  const progressForThisAgent = activeMissionId
    ? progressRecords.filter((r) => r.agent_id === agent.id).map((r) => ({
        items_processed: r.items_processed ?? 0,
        ts: r.observed_at ? Date.parse(r.observed_at) : 0,
      })).sort((a, b) => b.ts - a.ts)
    : [];
  const latestProgress = progressForThisAgent[0] ?? null;
  const progress: ProgressSignal = {
    has_active_mission: activeMissionId !== null,
    mission_id: activeMissionId,
    items_processed: latestProgress?.items_processed ?? 0,
    items_expected: null,
    evidence_records_produced: records.length,
    last_progress_at: latestProgress ? new Date(latestProgress.ts).toISOString() : null,
    age_since_progress_ms: latestProgress ? nowMs - latestProgress.ts : null,
    stall_threshold_ms: STALL_THRESHOLD_MS,
  };

  const degraded: DegradedIndicators = {
    recent_failure_count: await countRecentFailures(agent, now),
    resource_pressure: false,   // slice-1: no OS-level pressure reading
    fail_threshold: FAIL_THRESHOLD,
  };

  const { state, reason } = deriveHeartbeatState({
    liveness_signal: liveness,
    progress_signal: progress,
    scheduler_examined_workload,
    degraded_indicators: degraded,
  });

  const heartbeat_id = `hb-${agent.id}-${nowMs}-${randomUUID().slice(0, 8)}`;
  const base = {
    record_type: "NEX_HQ_AGENT_HEARTBEAT" as const,
    heartbeat_id,
    agent_id: agent.id,
    observed_at: now.toISOString(),
    liveness_signal: liveness,
    progress_signal: progress,
    scheduler_examined_workload,
    derived_state: state,
    derivation_reason: reason,
  };
  return { ...base, provenance_chain_hash: provenanceChainHash(base, []) };
}

// ── Storage helpers ────────────────────────────────────────────────────

async function persistHeartbeat(h: AgentHeartbeat): Promise<void> {
  await getStorage().save(COLLECTIONS.nex_hq_agent_heartbeats, h);
}

async function tryQuery<T>(collection: string, limit: number): Promise<T[]> {
  try {
    return await getStorage().query<T>(collection, { limit });
  } catch { return []; }
}

function latestTimestampMs(records: readonly Record<string, unknown>[]): number | null {
  const candidates = ["fetched_at", "started_at", "run_at", "emitted_at", "detected_at", "formed_at", "attempted_at", "created_at", "updated_at", "invoked_at", "wrote_at", "at", "timestamp", "occurred_at"];
  let max: number | null = null;
  for (const r of records) {
    for (const k of candidates) {
      const v = r[k];
      if (typeof v === "string") {
        const ms = Date.parse(v);
        if (!Number.isNaN(ms) && (max === null || ms > max)) max = ms;
      }
    }
  }
  return max;
}

async function tryFindActiveMissionForAgent(agent_id: string): Promise<string | null> {
  // Slice-1: query the (future) missions collection; return null when not found.
  try {
    const missions = await getStorage().query<{ mission_id?: string; agent_assignments?: readonly { agent_id?: string }[]; expires_at?: string }>(
      COLLECTIONS.nex_intel_missions,
      { limit: 100, order_by: "created_at", order_dir: "desc" },
    );
    const now = Date.now();
    for (const m of missions) {
      if (!m.agent_assignments || !Array.isArray(m.agent_assignments)) continue;
      if (m.expires_at && Date.parse(m.expires_at) < now) continue;
      if (m.agent_assignments.some((a) => a.agent_id === agent_id)) {
        return m.mission_id ?? null;
      }
    }
    return null;
  } catch { return null; }
}

async function getPreviousState(agent_id: string): Promise<HeartbeatState | null> {
  try {
    const checks = await getStorage().query<{ agent_id?: string; current_state?: HeartbeatState; checked_at?: string }>(
      COLLECTIONS.nex_hq_agent_health_checks,
      { where: { agent_id }, limit: 5, order_by: "checked_at", order_dir: "desc" },
    );
    return checks[0]?.current_state ?? null;
  } catch { return null; }
}

async function getFailedCountLast24h(agent_id: string, now: Date): Promise<number> {
  try {
    const cutoff = now.getTime() - 24 * 3600 * 1000;
    const checks = await getStorage().query<{ agent_id?: string; current_state?: HeartbeatState; checked_at?: string }>(
      COLLECTIONS.nex_hq_agent_health_checks,
      { where: { agent_id }, limit: 500, order_by: "checked_at", order_dir: "desc" },
    );
    return checks.filter((c) => c.current_state === "FAILED" && c.checked_at && Date.parse(c.checked_at) >= cutoff).length;
  } catch { return 0; }
}

async function countRecentFailures(agent: AgentDescriptor, now: Date): Promise<number> {
  try {
    const cutoff = now.getTime() - 24 * 3600 * 1000;
    const records = await getStorage().query<Record<string, unknown>>(agent.source_collection, { limit: 200 });
    let count = 0;
    for (const r of records) {
      const t = latestTimestampMs([r]);
      if (t === null || t < cutoff) continue;
      // Very conservative failure detection — only count records that are clearly failures
      if (r.record_type === "NEX_INTELLIGENCE_CRAWLER_AUDIT" && typeof r.outcome === "string" && r.outcome.startsWith("REFUSED_")) count++;
      else if (r.record_type === "NEX1_SPECIALIST_RESULT" && r.status === "FAILED") count++;
      else if (r.record_type === "NEX1_BUILD_REPORT" && typeof r.exit_code === "number" && r.exit_code !== 0) count++;
    }
    return count;
  } catch { return 0; }
}
