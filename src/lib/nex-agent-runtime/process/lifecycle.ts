// WO-NEX-RUNTIME-01 · process lifecycle state machine + external state derivation.
//
// Founder-locked 2026-09-13:
//   "Heartbeat proves liveness, not useful work."
//
// A daemon sending heartbeats every 5 seconds while doing nothing must
// NOT appear as a productive WORKING agent. This module keeps the
// dual-signal doctrine: WORKING requires four conditions all present
// (mission + heartbeat + progress + evidence).

import type { ProcessLifecycleState, AgentRuntimeHeartbeat } from "./types";

// ── Internal state machine transitions ─────────────────────────────────

const ALLOWED_TRANSITIONS: Readonly<Record<ProcessLifecycleState, readonly ProcessLifecycleState[]>> = Object.freeze({
  INITIALISING:     ["ALIVE_IDLE", "STOPPING", "FAILED"],
  ALIVE_IDLE:       ["MISSION_ASSIGNED", "STOPPING", "FAILED"],
  MISSION_ASSIGNED: ["WORKING", "MISSION_STALLED", "FAILED", "ALIVE_IDLE"],   // ALIVE_IDLE = mission dropped
  WORKING:          ["MISSION_ASSIGNED", "ALIVE_IDLE", "MISSION_STALLED", "FAILED", "STOPPING"],
  MISSION_STALLED:  ["WORKING", "FAILED", "ALIVE_IDLE", "STOPPING"],
  FAILED:           ["STOPPING", "STOPPED", "ALIVE_IDLE"],       // recovery may re-arm
  STOPPING:         ["STOPPED"],
  STOPPED:          [],
});

export function canTransition(from: ProcessLifecycleState, to: ProcessLifecycleState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

// ── External state derivation from heartbeats ──────────────────────────

/**
 * Given a stream of heartbeats for one agent (newest first) and the
 * current wall-clock time, derive the founder-facing state.
 *
 * Doctrine:
 *   - Fresh heartbeat + NO mission          → ALIVE_IDLE
 *   - Fresh heartbeat + mission + no progress          → MISSION_ASSIGNED
 *   - Fresh heartbeat + mission + progress + evidence  → WORKING
 *   - Fresh heartbeat + mission + progress + NO evidence → MISSION_ASSIGNED (progress alone is not enough — evidence must be persisted)
 *   - Fresh heartbeat + mission + no progress > stall  → MISSION_STALLED
 *   - Stale heartbeat but agent WAS alive              → FAILED
 *   - NO heartbeat ever                                → NO_LIVENESS_EVIDENCE (rendered as UNVERIFIED at rest)
 *   - Explicit STOPPED in most recent heartbeat        → STOPPED
 */
export type ExternalDerivedState =
  | "UNVERIFIED"             // no heartbeat evidence at all
  | "NO_LIVENESS_EVIDENCE"   // instance exists but no heartbeat
  | "ALIVE_IDLE"
  | "MISSION_ASSIGNED"
  | "WORKING"
  | "MISSION_STALLED"
  | "FAILED"
  | "STOPPING"
  | "STOPPED";

export interface DerivationInput {
  readonly newest_heartbeat: AgentRuntimeHeartbeat | null;
  readonly now_ms: number;
  readonly heartbeat_interval_ms: number;
  /** Multiplier for freshness. If age > interval * factor, heartbeat is
   *  stale. Default 3. */
  readonly stale_factor?: number;
  /** Mission-stall threshold in ms (no progress increment for this long
   *  while mission is assigned). Default 60_000. */
  readonly stall_threshold_ms?: number;
}

export interface DerivedStateResult {
  readonly state: ExternalDerivedState;
  readonly reason: string;
  readonly age_ms: number | null;
}

export function deriveExternalState(input: DerivationInput): DerivedStateResult {
  const hb = input.newest_heartbeat;
  if (!hb) return { state: "UNVERIFIED", reason: "no heartbeat ever emitted · no liveness evidence", age_ms: null };

  const stale_factor = input.stale_factor ?? 3;
  const stall_ms = input.stall_threshold_ms ?? 60_000;
  const emitted_ms = Date.parse(hb.emitted_at);
  if (Number.isNaN(emitted_ms)) return { state: "UNVERIFIED", reason: `unparseable emitted_at: ${hb.emitted_at}`, age_ms: null };
  const age = input.now_ms - emitted_ms;
  const stale_threshold = input.heartbeat_interval_ms * stale_factor;

  // Explicit terminal / drain state comes first
  if (hb.lifecycle_state === "STOPPED") return { state: "STOPPED", reason: "agent emitted final STOPPED heartbeat", age_ms: age };
  if (hb.lifecycle_state === "STOPPING") return { state: "STOPPING", reason: "agent draining · STOPPING", age_ms: age };
  if (hb.lifecycle_state === "FAILED") return { state: "FAILED", reason: "agent self-reported FAILED", age_ms: age };

  // Stale heartbeat (agent was alive at some point but hasn't refreshed)
  if (age > stale_threshold) {
    return { state: "FAILED", reason: `heartbeat stale: age ${age}ms > threshold ${stale_threshold}ms (interval ${input.heartbeat_interval_ms}ms × ${stale_factor})`, age_ms: age };
  }

  // Fresh heartbeat · look at mission + progress + evidence
  const has_mission = hb.mission_id !== null;
  const has_progress = hb.progress_counter > 0;
  const has_evidence = hb.evidence_refs.length > 0;

  if (!has_mission) {
    return { state: "ALIVE_IDLE", reason: "fresh heartbeat · no mission assigned · liveness only", age_ms: age };
  }
  if (has_mission && has_progress && has_evidence) {
    // The four-condition WORKING: mission + heartbeat (implicit · fresh) + progress + evidence
    return { state: "WORKING", reason: "mission + fresh heartbeat + progress + evidence · all four", age_ms: age };
  }
  if (has_mission && has_progress && !has_evidence) {
    // Progress without evidence is not WORKING · dual-signal doctrine
    return { state: "MISSION_ASSIGNED", reason: "mission + progress claimed but no persisted evidence · not WORKING", age_ms: age };
  }
  // Mission assigned, no progress · check stall threshold
  if (has_mission && !has_progress) {
    // We do not have age-since-mission-assigned in the heartbeat itself; approximate via emitted_at.
    // If the agent has been holding this mission for > stall_ms with 0 progress, call it stalled.
    // For the RUNTIME-01 primitive we lean on the daemon's own lifecycle_state which already
    // encodes MISSION_ASSIGNED vs MISSION_STALLED.
    if (hb.lifecycle_state === "MISSION_STALLED") {
      return { state: "MISSION_STALLED", reason: `agent reported MISSION_STALLED (no progress > ${stall_ms}ms)`, age_ms: age };
    }
    return { state: "MISSION_ASSIGNED", reason: "mission received · no progress yet · not WORKING", age_ms: age };
  }
  return { state: "MISSION_ASSIGNED", reason: "fallback · mission present · insufficient progress+evidence for WORKING", age_ms: age };
}
