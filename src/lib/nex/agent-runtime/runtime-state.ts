// src/lib/nex/agent-runtime/runtime-state.ts
//
// NEX Agent Runtime · derive REAL runtime state from independent evidence
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · §1 · §14 · §43
//
// The single most important discipline seam. `runtime_state` is NEVER
// stored — it is DERIVED at read time from:
//    1. Heartbeat file freshness
//    2. PID file presence
//    3. Actual process aliveness (process.kill(pid, 0))
//    4. desired_state (from registry)
//    5. founder_stop_override
//    6. Restart history
//
// If any of these signals disagree, the derivation resolves conservatively
// toward the LESS ALIVE state — never toward the more alive one.

import {
  type PositionRuntime,
  type RuntimeState,
  type AgentStatus,
  type AgentId,
} from "./types";
import { readHeartbeat, readPidRecord, isPidAlive, heartbeatStalenessMs } from "./heartbeat";
import { readFounderStopOverride, getPosition } from "./registry";
import { readEventsSince } from "./event-bus";

/** How long a heartbeat may age before we consider the worker unhealthy.
 *  Defaults to 3× the position's heartbeat_interval_ms; capped at 30s so
 *  a mis-configured interval doesn't hide a dead worker forever. */
export function heartbeatFreshnessCeilingMs(position: PositionRuntime): number {
  const three = position.heartbeat_interval_ms * 3;
  return Math.min(30_000, Math.max(5000, three));
}

/** Count restarts in the last hour from the event log. Used for the
 *  restart-storm trip in the watchdog. */
export function countRestartsLastHour(agent_id: AgentId, nowMs: number): number {
  const events = readEventsSince(nowMs - 60 * 60 * 1000, { kind: "AGENT_RESTARTED", agent_id });
  return events.length;
}

/** The core derivation. Deliberately verbose so every decision path is
 *  visible in code (and testable). */
export function deriveAgentStatus(
  position: PositionRuntime,
  nowMs: number,
): AgentStatus {
  const pid = readPidRecord(position.agent_id);
  const hb = readHeartbeat(position.agent_id);
  const staleCeiling = heartbeatFreshnessCeilingMs(position);
  const stopOverride = readFounderStopOverride();

  const staleness = hb ? heartbeatStalenessMs(hb, nowMs) : null;
  const heartbeatFresh = staleness !== null && staleness <= staleCeiling;
  const pidAlive = pid ? isPidAlive(pid.pid) : false;

  let runtime_state: RuntimeState;
  let reason: string;

  if (position.authorization_state !== "AUTHORIZED") {
    runtime_state = "BLOCKED";
    reason = `blocked:authorization=${position.authorization_state}`;
  } else if (stopOverride.active && position.desired_state === "STOPPED") {
    // Founder STOP override sticks; the state should still reflect
    // physical reality (stopped/crashed), but the reason mentions the
    // override so a Founder inspecting status sees WHY nothing restarted.
    if (pidAlive && heartbeatFresh) {
      runtime_state = "STOPPING";
      reason = "founder_stop_override:process_still_terminating";
    } else {
      runtime_state = "STOPPED";
      reason = "founder_stop_override:active";
    }
  } else if (position.desired_state === "STOPPED") {
    if (pidAlive && heartbeatFresh) {
      runtime_state = "STOPPING";
      reason = "desired_stopped:process_still_terminating";
    } else if (pidAlive && !heartbeatFresh) {
      runtime_state = "STOPPING";
      reason = "desired_stopped:process_alive_but_heartbeat_stale";
    } else {
      runtime_state = "STOPPED";
      reason = "desired_stopped:no_process";
    }
  } else {
    // desired_state === "RUNNING"
    if (pid === null && hb === null) {
      runtime_state = "STOPPED";
      reason = "desired_running:no_process_yet";
    } else if (pidAlive && heartbeatFresh) {
      // Both signals agree.
      runtime_state = "RUNNING";
      reason = "process_alive_and_heartbeat_fresh";
    } else if (pidAlive && !heartbeatFresh) {
      // Process is up but not producing heartbeats → hung/degraded.
      runtime_state = "DEGRADED";
      reason = staleness === null
        ? "process_alive_but_no_heartbeat"
        : `process_alive_but_heartbeat_stale:${staleness}ms`;
    } else if (!pidAlive && hb !== null) {
      // Heartbeat exists but process dead → crashed since last write.
      runtime_state = "CRASHED";
      reason = "process_dead_but_heartbeat_recorded";
    } else {
      runtime_state = "STOPPED";
      reason = "process_dead_and_no_heartbeat";
    }
  }

  const startedAt = pid?.started_at_iso ?? null;
  const lastHeartbeat = hb?.timestamp_iso ?? null;
  const currentTask = hb?.current_task ?? null;
  const lastSuccess = hb?.last_success_iso ?? null;
  const lastFailure = hb?.last_failure_iso ?? null;
  const internetState = hb?.internet_state ?? "UNKNOWN";
  const restartsHour = countRestartsLastHour(position.agent_id, nowMs);

  return {
    agent_id: position.agent_id,
    desired_state: position.desired_state,
    runtime_state,
    process_id: pid?.pid ?? null,
    started_at_iso: startedAt,
    last_heartbeat_iso: lastHeartbeat,
    last_heartbeat_stale_ms: staleness,
    current_task: currentTask,
    last_success_iso: lastSuccess,
    last_failure_iso: lastFailure,
    restart_count_last_hour: restartsHour,
    internet_state: internetState,
    reason,
  };
}

/** Convenience: derive for a specific agent. Returns null if not
 *  registered (which is the honest answer — do not fabricate). */
export function deriveAgentStatusById(agent_id: AgentId, nowMs: number): AgentStatus | null {
  const pos = getPosition(agent_id);
  if (!pos) return null;
  return deriveAgentStatus(pos, nowMs);
}
