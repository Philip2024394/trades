// WO-NEX-RUNTIME-02 · durable mission persistence.
//
// Founder-locked 2026-09-13. Append-only JSONL under GB storage with
// latest-per-key read semantics. Idempotent enqueue by dedupe_key.
// State transitions preserved as separate appended snapshots so the
// full history of every mission is available.

import { randomUUID } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import { provenanceChainHash, sha256Hex } from "@/lib/nex-intelligence/provenance";
import {
  ENGINEERING_MISSIONS_COLLECTION,
  MISSION_CLAIMS_COLLECTION,
  type EngineeringMission,
  type MissionClaim,
  type MissionStatus,
  type MissionSecurityClass,
} from "./types";

// ── Create / enqueue ───────────────────────────────────────────────────

export interface EnqueueInput {
  readonly title: string;
  readonly authored_intent: string;
  readonly source: EngineeringMission["source"];
  readonly cap_id?: string | null;
  readonly work_map_ref?: string | null;
  readonly priority: EngineeringMission["priority"];
  readonly urgency?: EngineeringMission["urgency"];
  readonly security_class: MissionSecurityClass;
  readonly risk_level: EngineeringMission["risk_level"];
  readonly affected_paths?: readonly string[];
  readonly required_capabilities?: readonly string[];
  readonly build_targets?: readonly string[];
  readonly dependencies?: readonly string[];
  readonly conflicts?: readonly string[];
  readonly parent_mission_id?: string | null;
  readonly related_mission_ids?: readonly string[];
  /** Stable dedupe key. Same key → same mission_id · repeated enqueue is a no-op. */
  readonly dedupe_key: string;
}

/** Deterministic mission_id from dedupe_key. Same key → same id. */
function deriveMissionId(dedupe_key: string): string {
  return `MISSION-${sha256Hex(dedupe_key).slice(0, 20)}`;
}

export async function enqueueMission(input: EnqueueInput): Promise<EngineeringMission> {
  const mission_id = deriveMissionId(input.dedupe_key);
  // If it already exists, return the current version (idempotent)
  const existing = await loadMission(mission_id);
  if (existing) return existing;

  const now = new Date().toISOString();
  const base = {
    record_type: "NEX_ENGINEERING_MISSION" as const,
    mission_id,
    created_at: now,
    dedupe_key: input.dedupe_key,
    source: input.source,
    cap_id: input.cap_id ?? null,
    work_map_ref: input.work_map_ref ?? null,
    title: input.title,
    authored_intent: input.authored_intent,
    priority: input.priority,
    urgency: input.urgency ?? "NORMAL",
    security_class: input.security_class,
    risk_level: input.risk_level,
    affected_paths: Object.freeze([...(input.affected_paths ?? [])]) as readonly string[],
    required_capabilities: Object.freeze([...(input.required_capabilities ?? [])]) as readonly string[],
    build_targets: Object.freeze([...(input.build_targets ?? [])]) as readonly string[],
    dependencies: Object.freeze([...(input.dependencies ?? [])]) as readonly string[],
    conflicts: Object.freeze([...(input.conflicts ?? [])]) as readonly string[],
    parent_mission_id: input.parent_mission_id ?? null,
    related_mission_ids: Object.freeze([...(input.related_mission_ids ?? [])]) as readonly string[],
    status: "QUEUED" as MissionStatus,
    queue_position: null as number | null,
    attempt_count: 0,
    last_scheduler_score: null as number | null,
    last_scheduler_reason: null as string | null,
    last_scheduler_at: null as string | null,
    assigned_agent_id: null as string | null,
    lease_expires_at: null as string | null,
    started_at: null as string | null,
    completed_at: null as string | null,
    evidence_refs: Object.freeze([]) as readonly string[],
    last_updated_at: now,
  };
  const mission: EngineeringMission = {
    ...base,
    provenance_chain_hash: provenanceChainHash(base, []),
  };
  await getStorage().save(ENGINEERING_MISSIONS_COLLECTION, mission);
  return mission;
}

// ── Read ───────────────────────────────────────────────────────────────

export async function loadMission(mission_id: string): Promise<EngineeringMission | null> {
  const rows = await getStorage().query<EngineeringMission>(ENGINEERING_MISSIONS_COLLECTION, {
    where: { mission_id },
    limit: 200,
    order_by: "last_updated_at",
    order_dir: "desc",
  }).catch(() => [] as EngineeringMission[]);
  return rows[0] ?? null;
}

export async function loadAllMissions(limit = 50_000): Promise<EngineeringMission[]> {
  const raw = await getStorage().query<EngineeringMission>(ENGINEERING_MISSIONS_COLLECTION, {
    limit, order_by: "last_updated_at", order_dir: "desc",
  }).catch(() => [] as EngineeringMission[]);
  const latest = new Map<string, EngineeringMission>();
  for (const m of raw) if (!latest.has(m.mission_id)) latest.set(m.mission_id, m);
  return Array.from(latest.values());
}

export async function loadMissionsByStatus(status: MissionStatus, limit = 10_000): Promise<EngineeringMission[]> {
  const all = await loadAllMissions(limit);
  return all.filter((m) => m.status === status);
}

// ── Update ─────────────────────────────────────────────────────────────

export interface UpdateMissionInput {
  readonly mission_id: string;
  readonly status?: MissionStatus;
  readonly queue_position?: number | null;
  readonly attempt_count?: number;
  readonly last_scheduler_score?: number | null;
  readonly last_scheduler_reason?: string | null;
  readonly last_scheduler_at?: string | null;
  readonly assigned_agent_id?: string | null;
  readonly lease_expires_at?: string | null;
  readonly started_at?: string | null;
  readonly completed_at?: string | null;
  readonly additional_evidence_refs?: readonly string[];
}

export async function updateMission(input: UpdateMissionInput): Promise<EngineeringMission | null> {
  const existing = await loadMission(input.mission_id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const merged = {
    ...existing,
    status: input.status ?? existing.status,
    queue_position: input.queue_position !== undefined ? input.queue_position : existing.queue_position,
    attempt_count: input.attempt_count ?? existing.attempt_count,
    last_scheduler_score: input.last_scheduler_score !== undefined ? input.last_scheduler_score : existing.last_scheduler_score,
    last_scheduler_reason: input.last_scheduler_reason !== undefined ? input.last_scheduler_reason : existing.last_scheduler_reason,
    last_scheduler_at: input.last_scheduler_at !== undefined ? input.last_scheduler_at : existing.last_scheduler_at,
    assigned_agent_id: input.assigned_agent_id !== undefined ? input.assigned_agent_id : existing.assigned_agent_id,
    lease_expires_at: input.lease_expires_at !== undefined ? input.lease_expires_at : existing.lease_expires_at,
    started_at: input.started_at !== undefined ? input.started_at : existing.started_at,
    completed_at: input.completed_at !== undefined ? input.completed_at : existing.completed_at,
    evidence_refs: input.additional_evidence_refs
      ? Object.freeze([...existing.evidence_refs, ...input.additional_evidence_refs]) as readonly string[]
      : existing.evidence_refs,
    last_updated_at: now,
  };
  const updated: EngineeringMission = {
    ...merged,
    provenance_chain_hash: provenanceChainHash(merged as unknown as Record<string, unknown>, [existing.provenance_chain_hash]),
  };
  await getStorage().save(ENGINEERING_MISSIONS_COLLECTION, updated);
  return updated;
}

// ── Claims / leases ────────────────────────────────────────────────────

export interface CreateClaimInput {
  readonly mission_id: string;
  readonly agent_id: string;
  readonly instance_id: string;
  readonly lease_duration_ms: number;
}

export async function createClaim(input: CreateClaimInput): Promise<MissionClaim> {
  const now = Date.now();
  const claim: MissionClaim = {
    record_type: "NEX_MISSION_CLAIM",
    claim_id: `CLAIM-${randomUUID().slice(0, 16)}`,
    mission_id: input.mission_id,
    claimed_by_agent_id: input.agent_id,
    claimed_by_instance_id: input.instance_id,
    claimed_at: new Date(now).toISOString(),
    expires_at: new Date(now + input.lease_duration_ms).toISOString(),
    released_at: null,
    release_reason: null,
  };
  await getStorage().save(MISSION_CLAIMS_COLLECTION, claim);
  return claim;
}

export async function releaseClaim(claim_id: string, reason: NonNullable<MissionClaim["release_reason"]>): Promise<void> {
  const rows = await getStorage().query<MissionClaim>(MISSION_CLAIMS_COLLECTION, {
    where: { claim_id }, limit: 5, order_by: "claimed_at", order_dir: "desc",
  }).catch(() => [] as MissionClaim[]);
  const existing = rows[0];
  if (!existing) return;
  const released: MissionClaim = {
    ...existing,
    released_at: new Date().toISOString(),
    release_reason: reason,
  };
  await getStorage().save(MISSION_CLAIMS_COLLECTION, released);
}

export async function loadActiveClaimsForMission(mission_id: string): Promise<MissionClaim[]> {
  const rows = await getStorage().query<MissionClaim>(MISSION_CLAIMS_COLLECTION, {
    where: { mission_id }, limit: 200, order_by: "claimed_at", order_dir: "desc",
  }).catch(() => [] as MissionClaim[]);
  // Latest per claim_id
  const latest = new Map<string, MissionClaim>();
  for (const c of rows) if (!latest.has(c.claim_id)) latest.set(c.claim_id, c);
  const now = Date.now();
  return Array.from(latest.values()).filter((c) => {
    if (c.released_at) return false;
    return Date.parse(c.expires_at) > now;
  });
}

/** Reap expired leases: mark them EXPIRED so mission becomes claimable again.
 *  Returns the mission_ids whose leases were reaped. */
export async function reapExpiredLeases(now_ms: number = Date.now()): Promise<string[]> {
  const rows = await getStorage().query<MissionClaim>(MISSION_CLAIMS_COLLECTION, {
    limit: 10_000, order_by: "claimed_at", order_dir: "desc",
  }).catch(() => [] as MissionClaim[]);
  const latest = new Map<string, MissionClaim>();
  for (const c of rows) if (!latest.has(c.claim_id)) latest.set(c.claim_id, c);
  const reaped: string[] = [];
  for (const c of latest.values()) {
    if (c.released_at) continue;
    if (Date.parse(c.expires_at) <= now_ms) {
      await releaseClaim(c.claim_id, "EXPIRED");
      reaped.push(c.mission_id);
    }
  }
  return reaped;
}
