// WO-HQ-HEARTBEAT-01 · bounded auto-recovery.
//
// The ONLY permitted actions are enumerated below. Any attempt to expand
// this list at runtime is refused. Recovery never grants authority,
// never modifies the substrate, never dispatches new missions beyond
// a single RETRY_MISSION on a STALLED agent.

import { randomUUID } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { provenanceChainHash, sha256Hex } from "@/lib/nex-intelligence/provenance";
import type { AgentHealthCheck, AgentHeartbeat, HeartbeatState, RecoveryAction } from "./types";

export const ALLOWED_RECOVERY_ACTIONS: readonly RecoveryAction[] = Object.freeze([
  "NONE",
  "RETRY_MISSION",
  "ISSUE_NOTICE_1",
  "ISSUE_NOTICE_2",
  "ISSUE_NOTICE_3",
  "ESCALATE_TO_FOUNDER",
]);

export interface RecoveryPolicyInput {
  readonly current_state: HeartbeatState;
  readonly previous_state: HeartbeatState | null;
  readonly failed_history_count_24h: number;   // how many FAILED heartbeats for this agent in 24h
}

export interface RecoveryPolicyResult {
  readonly action: RecoveryAction;
  readonly reason: string;
}

/** Deterministic recovery policy. Pure function. */
export function decideRecoveryAction(input: RecoveryPolicyInput): RecoveryPolicyResult {
  const { current_state, failed_history_count_24h } = input;

  switch (current_state) {
    case "WORKING":
    case "ALIVE":
    case "WAITING":
      return { action: "NONE", reason: `state ${current_state} is normal · no recovery needed` };

    case "STALLED":
      return { action: "RETRY_MISSION", reason: "mission stalled · retry with new mission_id · same content · budget refreshed" };

    case "DEGRADED":
      return { action: "ISSUE_NOTICE_1", reason: "intermittent failures OR resource pressure · notice recorded" };

    case "FAILED": {
      if (failed_history_count_24h >= 3) {
        return { action: "ESCALATE_TO_FOUNDER", reason: `${failed_history_count_24h} FAILED heartbeats in 24h · persistent · escalate` };
      }
      if (failed_history_count_24h >= 2) {
        return { action: "ISSUE_NOTICE_3", reason: `${failed_history_count_24h} FAILED heartbeats in 24h · Notice 3` };
      }
      if (failed_history_count_24h >= 1) {
        return { action: "ISSUE_NOTICE_2", reason: `${failed_history_count_24h + 1} FAILED heartbeats in 24h · Notice 2` };
      }
      return { action: "ISSUE_NOTICE_1", reason: "first FAILED heartbeat in 24h · Notice 1" };
    }
  }
}

// ── Build + persist AgentHealthCheck ────────────────────────────────────

export function buildHealthCheck(input: {
  readonly agent_id: string;
  readonly heartbeat: AgentHeartbeat;
  readonly previous_state: HeartbeatState | null;
  readonly action: RecoveryAction;
  readonly action_evidence_pointer: string | null;
  readonly reason: string;
  readonly antecedent_provenance_hashes: readonly string[];
}): AgentHealthCheck {
  // Defence-in-depth: refuse to record an action outside the allowlist.
  if (!ALLOWED_RECOVERY_ACTIONS.includes(input.action)) {
    throw new Error(`[nex-hq-heartbeat/recovery] refused: action "${input.action}" is not in the allowlist`);
  }
  const check_id = `hq-health-${sha256Hex(input.agent_id + input.heartbeat.heartbeat_id).slice(0, 16)}-${randomUUID()}`;
  const base = {
    record_type: "NEX_HQ_AGENT_HEALTH_CHECK" as const,
    check_id,
    agent_id: input.agent_id,
    checked_at: new Date().toISOString(),
    heartbeat_id: input.heartbeat.heartbeat_id,
    current_state: input.heartbeat.derived_state,
    previous_state: input.previous_state,
    state_transitioned: input.previous_state !== input.heartbeat.derived_state,
    action_taken: input.action,
    action_evidence_pointer: input.action_evidence_pointer,
    reason: input.reason,
  };
  return { ...base, provenance_chain_hash: provenanceChainHash(base, input.antecedent_provenance_hashes) };
}

export async function persistHealthCheck(c: AgentHealthCheck): Promise<void> {
  await getStorage().save(COLLECTIONS.nex_hq_agent_health_checks, c);
}
