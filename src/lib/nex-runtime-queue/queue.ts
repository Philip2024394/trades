// WO-NEX-RUNTIME-02 · queue public API.
//
// Founder-locked 2026-09-13. High-level operations agents + tests use.
// Composes persistence + scheduler + lease/claim management.
//
// This module is the ONLY orchestration entry point. It does NOT
// execute code, modify files, reach the workstation, or grant any
// authority. It moves mission state records through a state machine.

import { getStorage } from "@/lib/nex/storage/registry";
import {
  enqueueMission,
  loadAllMissions,
  loadMission,
  updateMission,
  createClaim,
  releaseClaim,
  loadActiveClaimsForMission,
  reapExpiredLeases,
  type EnqueueInput,
} from "./persistence";
import {
  schedulerPickNext,
  type SchedulingResult,
} from "./scheduler";
import {
  SCHEDULER_DECISIONS_COLLECTION,
  type EngineeringMission,
  type MissionStatus,
  type SchedulerDecision,
} from "./types";

// ── Queue configuration (founder-locked defaults) ──────────────────────

export interface QueueConfig {
  readonly claim_lease_ms: number;                       // how long a claim lasts before expiry · default 5 min
  readonly starvation_threshold_ms: number;              // wait time before age-boost kicks in · default 60s
  readonly age_boost_per_minute: number;                 // score bump per minute over threshold · default 1
  readonly locality_bonus: number;                       // score bump for same-subsystem work · default 5
  readonly recently_completed_locality_root: string;     // path root · empty = no locality preference
  readonly available_capabilities: readonly string[];    // workforce catalog
}

export const DEFAULT_QUEUE_CONFIG: QueueConfig = Object.freeze({
  claim_lease_ms: 5 * 60 * 1000,
  starvation_threshold_ms: 60_000,
  age_boost_per_minute: 1,
  locality_bonus: 5,
  recently_completed_locality_root: "",
  available_capabilities: [],
});

// ── Enqueue ────────────────────────────────────────────────────────────

export async function enqueue(input: EnqueueInput): Promise<EngineeringMission> {
  return enqueueMission(input);
}

// ── Snapshot queue ─────────────────────────────────────────────────────

export async function queueSnapshot(): Promise<{
  total: number;
  by_status: Record<MissionStatus | "other", number>;
  missions: EngineeringMission[];
}> {
  const missions = await loadAllMissions();
  const by_status: Record<string, number> = {};
  for (const m of missions) by_status[m.status] = (by_status[m.status] ?? 0) + 1;
  return { total: missions.length, by_status: by_status as Record<MissionStatus | "other", number>, missions };
}

// ── Reap expired leases before scheduling ──────────────────────────────

/** Reap expired leases and reset the affected missions from CLAIMED back
 *  to QUEUED so they can be picked up again. Returns the mission_ids
 *  that were reset. */
export async function reapAndResetExpiredLeases(now_ms = Date.now()): Promise<string[]> {
  const reapedMissionIds = await reapExpiredLeases(now_ms);
  for (const mid of reapedMissionIds) {
    const m = await loadMission(mid);
    if (m && m.status === "CLAIMED") {
      await updateMission({
        mission_id: mid,
        status: "QUEUED",
        assigned_agent_id: null,
        lease_expires_at: null,
      });
    }
  }
  return reapedMissionIds;
}

// ── Pick next + persist the decision ───────────────────────────────────

export interface PickNextOptions {
  readonly config?: Partial<QueueConfig>;
  readonly now_ms?: number;
}

export async function pickNextMission(opts: PickNextOptions = {}): Promise<SchedulingResult> {
  const now_ms = opts.now_ms ?? Date.now();
  const cfg = { ...DEFAULT_QUEUE_CONFIG, ...(opts.config ?? {}) };

  // Reap expired leases so stuck missions become claimable again
  await reapAndResetExpiredLeases(now_ms);

  const all = await loadAllMissions();
  // Only non-terminal missions are candidates
  const NON_TERMINAL: ReadonlySet<MissionStatus> = new Set(["QUEUED", "ELIGIBLE", "CLAIMED", "IN_PROGRESS", "AWAITING_VERIFICATION", "BLOCKED"]);
  const candidates = all.filter((m) => NON_TERMINAL.has(m.status));

  // Compute active-claim set
  const claimedIds = new Set<string>();
  for (const m of candidates) {
    if (m.status === "CLAIMED" || m.status === "IN_PROGRESS") claimedIds.add(m.mission_id);
  }

  // Build the full mission map so the scheduler can look up terminal
  // dependency records (COMPLETED / FAILED / CANCELLED).
  const allById = new Map<string, EngineeringMission>();
  for (const m of all) allById.set(m.mission_id, m);
  const result = schedulerPickNext({
    missions: candidates,
    all_missions_by_id: allById,
    claimed_mission_ids: claimedIds,
    available_capabilities: new Set(cfg.available_capabilities),
    recently_completed_locality_root: cfg.recently_completed_locality_root,
    now_ms,
    starvation_threshold_ms: cfg.starvation_threshold_ms,
    locality_bonus: cfg.locality_bonus,
    age_boost_per_minute: cfg.age_boost_per_minute,
  });

  // Persist the scheduling decision (audit)
  await getStorage().save(SCHEDULER_DECISIONS_COLLECTION, result.decision);

  // Update the winner's last_scheduler_* fields
  if (result.winner) {
    const winnerScored = result.scored[0];
    await updateMission({
      mission_id: result.winner.mission_id,
      last_scheduler_score: winnerScored.score,
      last_scheduler_reason: winnerScored.reason_summary,
      last_scheduler_at: result.decision.evaluated_at,
    });
  }
  return result;
}

// ── Claim ──────────────────────────────────────────────────────────────

export interface ClaimInput {
  readonly mission_id: string;
  readonly agent_id: string;
  readonly instance_id: string;
  readonly lease_ms?: number;
}

export type ClaimResult =
  | { ok: true; mission: EngineeringMission; claim_id: string }
  | { ok: false; reason_code: "MISSION_NOT_FOUND" | "MISSION_ALREADY_CLAIMED" | "MISSION_NOT_ELIGIBLE" | "MISSION_TERMINAL"; reason: string };

export async function claimMission(input: ClaimInput): Promise<ClaimResult> {
  const m = await loadMission(input.mission_id);
  if (!m) return { ok: false, reason_code: "MISSION_NOT_FOUND", reason: `mission ${input.mission_id} not found` };

  // Refuse terminal states
  const TERMINAL: ReadonlySet<MissionStatus> = new Set(["COMPLETED", "FAILED", "CANCELLED", "QUARANTINED"]);
  if (TERMINAL.has(m.status)) {
    return { ok: false, reason_code: "MISSION_TERMINAL", reason: `mission ${input.mission_id} is ${m.status}` };
  }

  // Refuse if already actively claimed
  const active = await loadActiveClaimsForMission(input.mission_id);
  if (active.length > 0) {
    return { ok: false, reason_code: "MISSION_ALREADY_CLAIMED", reason: `mission ${input.mission_id} already claimed by ${active[0].claimed_by_agent_id} (claim ${active[0].claim_id})` };
  }

  // Only QUEUED and ELIGIBLE can be claimed by scheduler flow
  if (m.status !== "QUEUED" && m.status !== "ELIGIBLE") {
    return { ok: false, reason_code: "MISSION_NOT_ELIGIBLE", reason: `mission ${input.mission_id} has status ${m.status}` };
  }

  const lease_ms = input.lease_ms ?? DEFAULT_QUEUE_CONFIG.claim_lease_ms;
  const claim = await createClaim({
    mission_id: input.mission_id,
    agent_id: input.agent_id,
    instance_id: input.instance_id,
    lease_duration_ms: lease_ms,
  });
  const updated = await updateMission({
    mission_id: input.mission_id,
    status: "CLAIMED",
    assigned_agent_id: input.agent_id,
    lease_expires_at: claim.expires_at,
    attempt_count: m.attempt_count + 1,
  });
  return { ok: true, mission: updated!, claim_id: claim.claim_id };
}

// ── Progress + evidence tracking ───────────────────────────────────────

export async function markMissionInProgress(mission_id: string): Promise<EngineeringMission | null> {
  return updateMission({
    mission_id, status: "IN_PROGRESS",
    started_at: new Date().toISOString(),
  });
}

export async function attachEvidence(mission_id: string, evidence_refs: readonly string[]): Promise<EngineeringMission | null> {
  return updateMission({
    mission_id,
    additional_evidence_refs: evidence_refs,
  });
}

// ── Complete ───────────────────────────────────────────────────────────

export async function completeMission(mission_id: string, claim_id?: string): Promise<EngineeringMission | null> {
  const now = new Date().toISOString();
  const m = await updateMission({
    mission_id, status: "COMPLETED",
    completed_at: now,
    lease_expires_at: null,
    assigned_agent_id: null,
  });
  if (claim_id) await releaseClaim(claim_id, "COMPLETED");
  return m;
}

export async function failMission(mission_id: string, claim_id?: string, reason?: string): Promise<EngineeringMission | null> {
  const m = await updateMission({
    mission_id, status: "FAILED",
    completed_at: new Date().toISOString(),
    lease_expires_at: null,
    assigned_agent_id: null,
  });
  if (claim_id) await releaseClaim(claim_id, "FAILED");
  void reason;
  return m;
}

// ── Read scheduler audit trail ─────────────────────────────────────────

export async function loadRecentSchedulerDecisions(limit = 50): Promise<SchedulerDecision[]> {
  return getStorage().query<SchedulerDecision>(SCHEDULER_DECISIONS_COLLECTION, {
    limit, order_by: "evaluated_at", order_dir: "desc",
  }).catch(() => [] as SchedulerDecision[]);
}
