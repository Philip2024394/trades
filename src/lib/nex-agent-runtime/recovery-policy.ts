// WO-AGENT-RUNTIME-01 · per-agent bounded recovery policy.
//
// Founder-locked 2026-09-13: each agent has its own recovery-state
// policy. Escalates to founder rather than auto-retrying into
// architectural gaps.

import type { AgentIdentity } from "./types";

export type AgentRecoveryAction =
  | "NONE"
  | "REEMIT_HEARTBEAT"
  | "RESUME_FROM_CHECKPOINT"
  | "REPLAY_MISSION"
  | "ABANDON_AND_ESCALATE"
  | "ENTER_QUARANTINE";

export interface AgentFailure {
  readonly kind: "SIGNATURE_ERROR" | "TOOL_FAILURE" | "NETWORK_FAILURE" | "AUTHORITY_DENIED" | "TIMEOUT" | "MEMORY_CORRUPTION" | "UNKNOWN";
  readonly at: string;
  readonly mission_id: string | null;
  readonly reason: string;
}

export interface RecoveryPolicyState {
  readonly consecutive_failures: number;
  readonly total_failures_24h: number;
  readonly last_success_at: string | null;
}

export interface RecoveryDecisionInput {
  readonly identity: AgentIdentity;
  readonly failure: AgentFailure;
  readonly state: RecoveryPolicyState;
}

export interface RecoveryDecision {
  readonly action: AgentRecoveryAction;
  readonly reason: string;
  readonly retry_delay_ms: number;
}

/**
 * Deterministic recovery decision. Pure function. Never grants authority.
 * Never bypasses substrate protection.
 */
export function decideAgentRecovery(input: RecoveryDecisionInput): RecoveryDecision {
  const { failure, state } = input;

  // Authority denied is NEVER retried — it's a P-U signal.
  if (failure.kind === "AUTHORITY_DENIED") {
    return { action: "ABANDON_AND_ESCALATE", reason: "authority denied · P-U requires founder review", retry_delay_ms: 0 };
  }

  // Signature error indicates possible tampering or key rotation issue — escalate.
  if (failure.kind === "SIGNATURE_ERROR") {
    return { action: "ABANDON_AND_ESCALATE", reason: "signature error · possible tampering or key rotation · founder review required", retry_delay_ms: 0 };
  }

  // Memory corruption — quarantine (do not touch memory until founder inspects).
  if (failure.kind === "MEMORY_CORRUPTION") {
    return { action: "ENTER_QUARANTINE", reason: "memory corruption detected · quarantine until founder authorises repair", retry_delay_ms: 0 };
  }

  // Consecutive failure escalation
  if (state.consecutive_failures >= 5) {
    return { action: "ABANDON_AND_ESCALATE", reason: `${state.consecutive_failures} consecutive failures · abandon + escalate`, retry_delay_ms: 0 };
  }

  // 24h saturation escalation
  if (state.total_failures_24h >= 20) {
    return { action: "ABANDON_AND_ESCALATE", reason: `${state.total_failures_24h} failures in 24h · saturation · escalate`, retry_delay_ms: 0 };
  }

  // Otherwise, bounded retry with exponential backoff
  const attempt = state.consecutive_failures;
  const base = failure.kind === "NETWORK_FAILURE" || failure.kind === "TIMEOUT" ? 2000 : 1000;
  const retry_delay_ms = Math.min(base * Math.pow(2, attempt), 60_000);

  if (failure.kind === "TIMEOUT" || failure.kind === "NETWORK_FAILURE") {
    return { action: "REEMIT_HEARTBEAT", reason: `transient failure (${failure.kind}) · backoff ${retry_delay_ms}ms then re-emit`, retry_delay_ms };
  }

  if (failure.mission_id) {
    return { action: "RESUME_FROM_CHECKPOINT", reason: `mission ${failure.mission_id} · resume from persisted checkpoint`, retry_delay_ms };
  }

  return { action: "REPLAY_MISSION", reason: "no mission checkpoint · replay from start", retry_delay_ms };
}
