// src/lib/nex/capability-runtime/agent-lifecycle.ts
//
// NEX Agent Lifecycle Contract · Stage 7 · Typed view over AofAgent
// Founder-authorised build-lane addition · 2026-09-23.
//
// WRAPS the authoritative AOF agent registry:
//   · nex.aof_agent table (agent_id · agent_role · status · founder_signed · timestamps)
//   · src/lib/nex/aof/agent-registry.ts (registerAgent · signAgent · setAgentStatus)
//   · src/lib/nex/aof/types.ts (AofAgent · AgentStatus · AgentRole)
//
// This module adds:
//   1. `AgentLifecycleSnapshot` — read-only view of one AofAgent row
//   2. `fromAofAgent()` adapter — lossless conversion
//   3. `ALLOWED_TRANSITIONS` — mirrors setAgentStatus enforcement in agent-registry.ts
//   4. `canTransition()` — pure predicate over the transition table
//
// HARD RULES:
//   _AGENT_LIFECYCLE_IS_READ_ONLY — no register/sign/setStatus helpers here
//   _AGENT_LIFECYCLE_TRANSITIONS_MIRROR_AOF — the table matches agent-registry.ts
//   _AGENT_LIFECYCLE_DOES_NOT_INVENT_STATE — every field maps to a real AofAgent field

import type { AgentRole, AgentStatus, AofAgent } from "../aof/types";

// ═══════════════════════════════════════════════════════════════════════
// STATUS + TRANSITIONS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Lifecycle status alias for AOF's typed union.
 * Kept in lockstep with `AgentStatus` in `src/lib/nex/aof/types.ts`.
 */
export type AgentLifecycleStatus = AgentStatus;

export const KNOWN_LIFECYCLE_STATUSES: readonly AgentLifecycleStatus[] = [
  "registered",
  "active",
  "paused",
  "stopped",
  "error",
] as const;

/**
 * Allowed status transitions.
 *
 * Sourced from `setAgentStatus()` enforcement in `src/lib/nex/aof/agent-registry.ts`:
 *   registered → active (only if founder_signed)
 *   registered → stopped
 *   registered → error
 *   active     → paused / stopped / error
 *   paused     → active / stopped / error
 *
 * `stopped` and `error` are terminal-with-manual-reactivation (not enumerated
 * as auto-transitions here — reactivation happens through a re-register + sign).
 */
interface Transition {
  readonly from: AgentLifecycleStatus;
  readonly to: AgentLifecycleStatus;
  readonly requires_founder_signed: boolean;
}

export const ALLOWED_TRANSITIONS: readonly Transition[] = [
  { from: "registered", to: "active",  requires_founder_signed: true },
  { from: "registered", to: "stopped", requires_founder_signed: false },
  { from: "registered", to: "error",   requires_founder_signed: false },
  { from: "active",     to: "paused",  requires_founder_signed: false },
  { from: "active",     to: "stopped", requires_founder_signed: false },
  { from: "active",     to: "error",   requires_founder_signed: false },
  { from: "paused",     to: "active",  requires_founder_signed: false },
  { from: "paused",     to: "stopped", requires_founder_signed: false },
  { from: "paused",     to: "error",   requires_founder_signed: false },
];

/**
 * Pure predicate: is a transition allowed given the current founder_signed flag?
 * Mirrors the check inside `setAgentStatus`. Does NOT perform the transition —
 * the AOF module remains the only writer.
 */
export function canTransition(input: {
  readonly from: AgentLifecycleStatus;
  readonly to: AgentLifecycleStatus;
  readonly founder_signed: boolean;
}): { readonly allowed: true } | { readonly allowed: false; readonly reason: string } {
  if (input.from === input.to) return { allowed: true };
  const t = ALLOWED_TRANSITIONS.find((x) => x.from === input.from && x.to === input.to);
  if (!t) return { allowed: false, reason: `no_transition_from_${input.from}_to_${input.to}` };
  if (t.requires_founder_signed && !input.founder_signed) {
    return { allowed: false, reason: "transition_requires_founder_signed_agent" };
  }
  return { allowed: true };
}

// ═══════════════════════════════════════════════════════════════════════
// SNAPSHOT
// ═══════════════════════════════════════════════════════════════════════

/**
 * Read-only snapshot of one `nex.aof_agent` row.
 * The `provenance_row_id` is included so callers can wrap this in a
 * Stage 5 `LoggedFact<AgentLifecycleSnapshot>` with correct provenance.
 */
export interface AgentLifecycleSnapshot {
  readonly agent_id: string;
  readonly agent_name: string;
  readonly agent_role: AgentRole;
  readonly description: string | null;
  readonly status: AgentLifecycleStatus;
  readonly founder_signed: boolean;
  readonly founder_signed_at: string | null;
  readonly founder_signed_by: string | null;
  readonly last_seen_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly metadata: Record<string, unknown>;
  readonly provenance_row_id: string;
  readonly provenance_store: "nex.aof_agent";
}

/**
 * Lossless adapter from an authoritative `AofAgent` row into the snapshot.
 * Adds `provenance_row_id` = agent_id + `provenance_store` = "nex.aof_agent".
 */
export function fromAofAgent(row: AofAgent): AgentLifecycleSnapshot {
  return {
    agent_id: row.agent_id,
    agent_name: row.agent_name,
    agent_role: row.agent_role,
    description: row.description,
    status: row.status,
    founder_signed: row.founder_signed,
    founder_signed_at: row.founder_signed_at,
    founder_signed_by: row.founder_signed_by,
    last_seen_at: row.last_seen_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    metadata: row.metadata,
    provenance_row_id: row.agent_id,
    provenance_store: "nex.aof_agent",
  };
}

// ═══════════════════════════════════════════════════════════════════════
// DOCTRINE LOCKS (Stage 7)
// ═══════════════════════════════════════════════════════════════════════

export const _AGENT_LIFECYCLE_IS_READ_ONLY =
  "no_register_sign_setStatus_helpers_exported_writes_stay_in_agent_registry_ts";

export const _AGENT_LIFECYCLE_TRANSITIONS_MIRROR_AOF =
  "ALLOWED_TRANSITIONS_matches_setAgentStatus_enforcement_in_agent_registry_ts";

export const _AGENT_LIFECYCLE_DOES_NOT_INVENT_STATE =
  "every_field_in_AgentLifecycleSnapshot_maps_to_a_real_AofAgent_column";
