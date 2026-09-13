// WO-HQ-HEARTBEAT-01 · pure state-derivation function.
//
// Founder-locked (§11.11 dual-signal): WORKING requires BOTH liveness
// AND progress. Alive-without-progress = STALLED. Anti-fake-activity:
// this function OBSERVES, it never CREATES work.

import type {
  DegradedIndicators,
  HeartbeatState,
  LivenessSignal,
  ProgressSignal,
} from "./types";

export const HEARTBEAT_THRESHOLDS = Object.freeze({
  /** Default liveness threshold: 3 minutes (founder-locked). */
  DEFAULT_LIVENESS_THRESHOLD_MS: 3 * 60 * 1000,
  /** Default stall threshold: 3 minutes of no progress on an active mission. */
  DEFAULT_STALL_THRESHOLD_MS: 3 * 60 * 1000,
  /** How fresh progress needs to be to count as WORKING (rule 4). */
  WORKING_FRESH_MS: 90 * 1000,
  /** Recent-failure count threshold for DEGRADED. */
  DEFAULT_DEGRADED_FAIL_THRESHOLD: 3,
});

export interface DeriveStateInput {
  readonly liveness_signal: LivenessSignal;
  readonly progress_signal: ProgressSignal;
  readonly scheduler_examined_workload: boolean;
  readonly degraded_indicators: DegradedIndicators;
}

export interface DeriveStateResult {
  readonly state: HeartbeatState;
  readonly reason: string;
}

/**
 * Pure function. Same inputs → same state, always.
 *
 * Rule order (founder-locked · first match wins). Refined 2026-09-13 after
 * real observation revealed that "no recent evidence" for an invocation-
 * triggered agent (e.g. WO-04 Broker) that has NO active mission is
 * WAITING, not FAILED. FAILED means the agent had an obligation to signal
 * (a dispatched mission) and did NOT.
 *
 *   1. FAILED   · has_active_mission AND no liveness beyond threshold
 *                 (mission dispatched · agent stopped signalling)
 *   2. STALLED  · has_active_mission AND age_since_progress > stall_threshold
 *   3. DEGRADED · liveness AND (intermittent failures OR resource pressure)
 *   4. WORKING  · has_active_mission AND fresh progress (dual-signal §11.11)
 *   5. ALIVE    · !has_active_mission AND !scheduler_examined
 *                 (invocation-triggered · scheduler has not offered work)
 *   6. WAITING  · !has_active_mission AND scheduler_examined
 *                 (scheduler examined authorised workload · nothing eligible)
 *   fallback: ALIVE
 */
export function deriveHeartbeatState(input: DeriveStateInput): DeriveStateResult {
  const { liveness_signal: L, progress_signal: P, scheduler_examined_workload: schedRan, degraded_indicators: D } = input;

  const livenessExpired = !L.is_alive || (L.age_ms !== null && L.age_ms > L.threshold_ms);

  // Rule 1 · FAILED — requires (has_active_mission AND liveness expired)
  // Without a dispatched mission, an idle invocation-triggered agent is
  // NOT failed; it's WAITING (rule 6).
  if (P.has_active_mission && livenessExpired) {
    return { state: "FAILED", reason: `mission ${P.mission_id ?? "?"} dispatched but no liveness signal · age_ms=${L.age_ms} > threshold=${L.threshold_ms}` };
  }

  // Rule 2 · STALLED (liveness + mission + no progress)
  if (P.has_active_mission && P.age_since_progress_ms !== null && P.age_since_progress_ms > P.stall_threshold_ms) {
    return { state: "STALLED", reason: `mission ${P.mission_id ?? "?"} active but no progress for ${P.age_since_progress_ms}ms > stall_threshold ${P.stall_threshold_ms}ms` };
  }

  // Rule 3 · DEGRADED (intermittent failures OR resource pressure)
  if (D.recent_failure_count >= D.fail_threshold || D.resource_pressure) {
    return { state: "DEGRADED", reason: `${D.recent_failure_count} recent failure(s) >= threshold ${D.fail_threshold}${D.resource_pressure ? " · resource pressure detected" : ""}` };
  }

  // Rule 4 · WORKING (DUAL-SIGNAL required — §11.11)
  if (P.has_active_mission
      && P.age_since_progress_ms !== null
      && P.age_since_progress_ms <= HEARTBEAT_THRESHOLDS.WORKING_FRESH_MS) {
    return { state: "WORKING", reason: `mission ${P.mission_id ?? "?"} · ${P.items_processed}/${P.items_expected ?? "?"} items · progress ${P.age_since_progress_ms}ms ago` };
  }

  // Rule 5 · ALIVE (no scheduler pass yet)
  if (!P.has_active_mission && !schedRan) {
    return { state: "ALIVE", reason: "recent liveness · scheduler has not yet examined mandate" };
  }

  // Rule 6 · WAITING (scheduler examined + no eligible mission for this agent)
  if (!P.has_active_mission && schedRan) {
    return { state: "WAITING", reason: "scheduler examined authorised workload · no eligible mission for this agent" };
  }

  // Guarded fallback: ALIVE
  return { state: "ALIVE", reason: "liveness observed · state fallback" };
}
