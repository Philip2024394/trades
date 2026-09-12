// src/lib/nex/agent-runtime/watchdog.ts
//
// NEX Agent Runtime · independent watchdog assessment (§15 · §16)
// Philip 2026-09-06 · FOUNDER AUTHORIZATION
//
// The watchdog OBSERVES agents and issues restart *recommendations*. It
// never runs inside the agent process. Actual spawn/kill decisions
// belong to control-plane.ts, which reads these recommendations.
//
// Restart discipline (§16):
//   healthy → crash → attempt → crash → backoff → attempt → repeated
//   failure → DEGRADED / BLOCKED. Founder STOP override always wins
//   (§17). Watchdog never fights the Founder.

import {
  type AgentStatus,
  type PositionRuntime,
  type AgentId,
} from "./types";
import { readEventsSince } from "./event-bus";
import { readFounderStopOverride } from "./registry";

export type WatchdogRecommendation =
  | { action: "no_op"; reason: string }
  | { action: "start"; reason: string; backoff_ms: number }
  | { action: "restart"; reason: string; backoff_ms: number }
  | { action: "stop_giveup"; reason: string }
  | { action: "wait_backoff"; reason: string; backoff_ms: number };

export type WatchdogDecision = {
  agent_id: AgentId;
  now_iso: string;
  recommendation: WatchdogRecommendation;
  consecutive_crashes: number;
  restarts_last_hour: number;
};

/** Compute how many consecutive crash events precede any RESTARTED /
 *  STARTED event — i.e. how deep are we in the crash-loop right now. */
function countConsecutiveCrashes(agent_id: AgentId, nowMs: number): number {
  const window = readEventsSince(nowMs - 6 * 60 * 60 * 1000, { agent_id });
  // walk backwards until we hit a non-CRASHED event
  let count = 0;
  for (let i = window.length - 1; i >= 0; i--) {
    const e = window[i];
    if (e.kind === "AGENT_CRASHED") { count++; continue; }
    if (e.kind === "AGENT_STARTED" || e.kind === "AGENT_RESTARTED") break;
    // ignore heartbeats etc. — they don't break the consecutive-crash chain
  }
  return count;
}

/** Decide the watchdog recommendation for one agent. Pure function —
 *  returns the recommendation; caller applies it. */
export function watchdogAssess(input: {
  position: PositionRuntime;
  status: AgentStatus;
  nowMs: number;
}): WatchdogDecision {
  const { position, status, nowMs } = input;
  const now_iso = new Date(nowMs).toISOString();

  const stopOverride = readFounderStopOverride();
  const consecutive = countConsecutiveCrashes(position.agent_id, nowMs);
  const restartsHour = status.restart_count_last_hour;

  // §17 — founder override always wins.
  if (stopOverride.active) {
    return {
      agent_id: position.agent_id,
      now_iso,
      recommendation: { action: "no_op", reason: "founder_stop_override_active" },
      consecutive_crashes: consecutive,
      restarts_last_hour: restartsHour,
    };
  }

  // Authorization check
  if (position.authorization_state !== "AUTHORIZED") {
    return {
      agent_id: position.agent_id,
      now_iso,
      recommendation: { action: "no_op", reason: `unauthorized:${position.authorization_state}` },
      consecutive_crashes: consecutive,
      restarts_last_hour: restartsHour,
    };
  }

  // Founder wants it stopped — no restart, ever.
  if (position.desired_state === "STOPPED") {
    return {
      agent_id: position.agent_id,
      now_iso,
      recommendation: { action: "no_op", reason: "desired_stopped" },
      consecutive_crashes: consecutive,
      restarts_last_hour: restartsHour,
    };
  }

  // desired_state === "RUNNING" from here on.

  // Restart-storm circuit breaker
  if (restartsHour >= position.restart_policy.max_restarts_per_hour) {
    return {
      agent_id: position.agent_id,
      now_iso,
      recommendation: {
        action: "stop_giveup",
        reason: `restart_storm:${restartsHour}_in_last_hour_exceeds_${position.restart_policy.max_restarts_per_hour}`,
      },
      consecutive_crashes: consecutive,
      restarts_last_hour: restartsHour,
    };
  }
  // Consecutive-crash budget
  if (consecutive >= position.restart_policy.max_consecutive_crashes) {
    return {
      agent_id: position.agent_id,
      now_iso,
      recommendation: {
        action: "stop_giveup",
        reason: `consecutive_crashes:${consecutive}_reached_${position.restart_policy.max_consecutive_crashes}`,
      },
      consecutive_crashes: consecutive,
      restarts_last_hour: restartsHour,
    };
  }

  // Compute backoff for restart/start actions.
  const backoff = Math.min(
    position.restart_policy.backoff_cap_ms,
    position.restart_policy.backoff_base_ms * Math.pow(2, consecutive),
  );

  switch (status.runtime_state) {
    case "RUNNING":
    case "STARTING":
      return {
        agent_id: position.agent_id,
        now_iso,
        recommendation: { action: "no_op", reason: `healthy:${status.runtime_state.toLowerCase()}` },
        consecutive_crashes: consecutive,
        restarts_last_hour: restartsHour,
      };
    case "DEGRADED":
      // Degraded = process up, heartbeat stale. Give it one backoff
      // cycle before restart (Phase A conservative policy).
      return {
        agent_id: position.agent_id,
        now_iso,
        recommendation: { action: "wait_backoff", reason: "degraded_await_recovery", backoff_ms: backoff },
        consecutive_crashes: consecutive,
        restarts_last_hour: restartsHour,
      };
    case "CRASHED":
      return {
        agent_id: position.agent_id,
        now_iso,
        recommendation: { action: "restart", reason: "crashed_bounded_restart", backoff_ms: backoff },
        consecutive_crashes: consecutive,
        restarts_last_hour: restartsHour,
      };
    case "STOPPED":
      // Desired RUNNING + actually stopped → we should start it.
      return {
        agent_id: position.agent_id,
        now_iso,
        recommendation: { action: "start", reason: "desired_running_actually_stopped", backoff_ms: backoff },
        consecutive_crashes: consecutive,
        restarts_last_hour: restartsHour,
      };
    case "STOPPING":
      return {
        agent_id: position.agent_id,
        now_iso,
        recommendation: { action: "wait_backoff", reason: "stopping_in_progress", backoff_ms: 1000 },
        consecutive_crashes: consecutive,
        restarts_last_hour: restartsHour,
      };
    case "OFFLINE":
    case "BLOCKED":
    default:
      return {
        agent_id: position.agent_id,
        now_iso,
        recommendation: { action: "no_op", reason: `terminal_state:${status.runtime_state}` },
        consecutive_crashes: consecutive,
        restarts_last_hour: restartsHour,
      };
  }
}
