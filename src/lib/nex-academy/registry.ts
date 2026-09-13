// WO-ACADEMY-01 · agent registry (persistence + state transitions).
//
// AcademyRecord is the source of truth for each agent's current career
// state + scores. Every state transition goes through this module —
// pure functions for decisions, storage helpers for persistence.

import { randomUUID } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { provenanceChainHash, sha256Hex } from "@/lib/nex-intelligence/provenance";
import { canDecommission } from "./knowledge-harvest";
import type {
  AcademyRecord,
  CareerHistoryEntry,
  CareerState,
} from "./types";

// ── Build + persist ────────────────────────────────────────────────────

export interface BuildAcademyRecordInput {
  readonly agent_id: string;
  readonly agent_name: string;
  readonly domain: string;
  readonly initial_career_state: CareerState;
  readonly initial_reason: string;
  readonly capability_profile_version: number;
  readonly initial_scores?: {
    readonly task_completion_score?: number;
    readonly knowledge_contribution_score?: number;
    readonly regression_score?: number;
  };
  readonly antecedent_provenance_hashes?: readonly string[];
}

export function buildAcademyRecord(input: BuildAcademyRecordInput): AcademyRecord {
  const now = new Date().toISOString();
  const scores = input.initial_scores ?? {};
  const initialHistory: CareerHistoryEntry = {
    state: input.initial_career_state,
    entered_at: now,
    reason: input.initial_reason,
    evidence_pointer: null,
  };
  const base = {
    record_type: "NEX_ACADEMY_AGENT_RECORD" as const,
    agent_id: input.agent_id,
    agent_name: input.agent_name,
    domain: input.domain,
    career_state: input.initial_career_state,
    career_history: Object.freeze([initialHistory]) as readonly CareerHistoryEntry[],
    capability_profile_version: input.capability_profile_version,
    task_completion_score: clamp01(scores.task_completion_score ?? 0),
    knowledge_contribution_score: clamp01(scores.knowledge_contribution_score ?? 0),
    regression_score: clamp01(scores.regression_score ?? 1),
    notice_count: Object.freeze({ notice_1: 0, notice_2: 0, notice_3: 0 }) as { readonly notice_1: number; readonly notice_2: number; readonly notice_3: number },
    last_updated_at: now,
  };
  return { ...base, provenance_chain_hash: provenanceChainHash(base, input.antecedent_provenance_hashes ?? []) };
}

export async function persistAcademyRecord(r: AcademyRecord): Promise<void> {
  await getStorage().save(COLLECTIONS.nex_academy_agents, r);
}

// ── State transition (pure + storage-guarded) ──────────────────────────

/**
 * Apply a career state change to an existing AcademyRecord. Returns a NEW
 * record; the previous one is not modified (immutable pattern).
 *
 * DECOMMISSIONED requires a matching KnowledgeHarvest — caller must
 * verify via canDecommission() first. This function refuses to output
 * a DECOMMISSIONED state without the harvest guard call being passed.
 */
export function applyCareerTransition(input: {
  readonly previous: AcademyRecord;
  readonly to: CareerState;
  readonly reason: string;
  readonly evidence_pointer: string | null;
  /** If `to == DECOMMISSIONED`, caller MUST pass true after verifying via canDecommission(). */
  readonly harvest_verified?: boolean;
}): AcademyRecord | { readonly refused: true; readonly reason: string } {
  if (input.to === "DECOMMISSIONED" && input.harvest_verified !== true) {
    return { refused: true, reason: "DECOMMISSIONED requires prior KnowledgeHarvest (see canDecommission)" };
  }
  const entry: CareerHistoryEntry = {
    state: input.to,
    entered_at: new Date().toISOString(),
    reason: input.reason,
    evidence_pointer: input.evidence_pointer,
  };
  const base = {
    ...input.previous,
    career_state: input.to,
    career_history: Object.freeze([...input.previous.career_history, entry]) as readonly CareerHistoryEntry[],
    last_updated_at: entry.entered_at,
  };
  // Recompute provenance chain hash covering the new state
  const stripped: Record<string, unknown> = { ...base };
  delete stripped.provenance_chain_hash;
  return { ...base, provenance_chain_hash: provenanceChainHash(stripped, [input.previous.provenance_chain_hash]) };
}

/** Guarded decommission — verifies harvest exists then applies transition. */
export async function applyDecommissionWithGuard(input: {
  readonly previous: AcademyRecord;
  readonly reason: string;
  readonly evidence_pointer: string | null;
}): Promise<AcademyRecord | { readonly refused: true; readonly reason: string }> {
  const has = await canDecommission(input.previous.agent_id);
  if (!has) {
    return { refused: true, reason: `no KnowledgeHarvest found for agent ${input.previous.agent_id}` };
  }
  return applyCareerTransition({
    previous: input.previous,
    to: "DECOMMISSIONED",
    reason: input.reason,
    evidence_pointer: input.evidence_pointer,
    harvest_verified: true,
  }) as AcademyRecord;
}

// ── Updated scores + notice count ──────────────────────────────────────

/**
 * Recompute an AcademyRecord with updated scores. Returns a NEW record;
 * previous is untouched.
 */
export function updateScores(input: {
  readonly previous: AcademyRecord;
  readonly task_completion_score: number;
  readonly knowledge_contribution_score: number;
  readonly regression_score: number;
  readonly notice_delta?: { readonly notice_1?: number; readonly notice_2?: number; readonly notice_3?: number };
}): AcademyRecord {
  const delta = input.notice_delta ?? {};
  const nc = {
    notice_1: input.previous.notice_count.notice_1 + (delta.notice_1 ?? 0),
    notice_2: input.previous.notice_count.notice_2 + (delta.notice_2 ?? 0),
    notice_3: input.previous.notice_count.notice_3 + (delta.notice_3 ?? 0),
  };
  const base = {
    ...input.previous,
    task_completion_score: clamp01(input.task_completion_score),
    knowledge_contribution_score: clamp01(input.knowledge_contribution_score),
    regression_score: clamp01(input.regression_score),
    notice_count: Object.freeze(nc) as { readonly notice_1: number; readonly notice_2: number; readonly notice_3: number },
    last_updated_at: new Date().toISOString(),
  };
  const stripped: Record<string, unknown> = { ...base };
  delete stripped.provenance_chain_hash;
  return { ...base, provenance_chain_hash: provenanceChainHash(stripped, [input.previous.provenance_chain_hash]) };
}

// ── List / find ────────────────────────────────────────────────────────

export async function listAllAgents(): Promise<AcademyRecord[]> {
  return getStorage().query<AcademyRecord>(COLLECTIONS.nex_academy_agents, { limit: 10000 });
}

export async function findAgent(agent_id: string): Promise<AcademyRecord | null> {
  const rows = await getStorage().query<AcademyRecord>(COLLECTIONS.nex_academy_agents, { where: { agent_id }, limit: 1 });
  return rows[0] ?? null;
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}
