// src/lib/nex/capability-runtime/agent-profile.ts
//
// NEX Agent Profile Composition · Stage 10 · Read-only view over 5 existing seams
// Founder-authorised build-lane addition · 2026-09-23.
//
// AgentProfile is a PURE COMPOSITION of authoritative state that already
// exists elsewhere:
//
//   Identity + lifecycle    → Stage 7  AgentLifecycleSnapshot (from nex.aof_agent)
//   Required capabilities   → Stage 3  AGENT_CONSUMERS (role-level declarative catalogue)
//   Granted capabilities    → Stage 2  aof_agent_capability grants
//   Topology (parents/kids) → Stage 7  AGENT_TOPOLOGY (code-derived + evidence)
//   Execution authority     → Stage 9  ENFORCEMENT_GATES (per-capability gates)
//
// This module DOES NOT introduce a new registry, a new table, or a new
// source of truth. Every field is a projection of existing state.
//
// The GENUINE SEAM Stage 10 adds is capability_coverage:
//   "Does this specific agent instance actually have every capability
//    that its role declaratively requires?"
// That question is otherwise not easy to compute · profiles surface it.
//
// HARD RULES:
//   _AGENT_PROFILE_IS_A_COMPOSITION_NOT_A_REGISTRY
//   _AGENT_PROFILE_INTRODUCES_NO_NEW_SOURCE_OF_TRUTH
//   _AGENT_PROFILE_IS_PURE_NO_READS_NO_WRITES

import type { CapabilityName } from "./contract";
import type { AgentLifecycleSnapshot } from "./agent-lifecycle";
import { getAgentConsumer, type AgentRoleConsumerSpec } from "./consumers";
import { childrenOf, parentsOf, type AgentTopologyLink } from "./agent-topology";
import { gatesForCapability, type EnforcementGate } from "./execution-level";
import type { AofCapabilityGrant } from "../aof/types";

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

/**
 * Capability coverage check: comparing what a role requires (Stage 3
 * declarative spec) against what an agent instance has been granted
 * (Stage 2 authoritative DB state).
 */
export interface CapabilityCoverage {
  readonly required: readonly CapabilityName[];
  readonly granted: readonly CapabilityName[];
  readonly missing: readonly CapabilityName[];
  readonly satisfied: boolean;
}

/**
 * Composed profile for one AOF agent instance.
 *
 * Read-only. Every field is a projection of an existing seam. No caller
 * should treat this as authoritative on its own — it is a snapshot
 * assembled at `composed_at` time from other authoritative reads.
 */
export interface AgentProfile {
  /** Identity + lifecycle · from Stage 7 snapshot */
  readonly identity: AgentLifecycleSnapshot;

  /** Role-level declarative consumer spec · from Stage 3 (null if role unknown to consumers catalogue) */
  readonly role_spec: AgentRoleConsumerSpec | null;

  /** Actual DB grants for this agent · from Stage 2 (aof_agent_capability rows) */
  readonly grants: readonly AofCapabilityGrant[];

  /** The genuine Stage 10 seam: required-vs-granted coverage */
  readonly capability_coverage: CapabilityCoverage;

  /** Roles that INVOKE this agent's role · from Stage 7 topology (code-derived) */
  readonly invoked_by: readonly AgentTopologyLink[];

  /** Roles this agent's role INVOKES · from Stage 7 topology (code-derived) */
  readonly invokes: readonly AgentTopologyLink[];

  /** Enforcement gates guarding each granted capability · from Stage 9 catalogue */
  readonly gates_by_capability: Readonly<Record<string, readonly EnforcementGate[]>>;

  /** When this composition was assembled (ISO 8601) */
  readonly composed_at: string;

  /** Contract version · bumped on structural change */
  readonly composition_version: "1.0.0";
}

// ═══════════════════════════════════════════════════════════════════════
// COMPOSITION
// ═══════════════════════════════════════════════════════════════════════

export interface BuildAgentProfileInput {
  readonly snapshot: AgentLifecycleSnapshot;
  readonly grants: readonly AofCapabilityGrant[];
  readonly composed_at?: string;
}

/**
 * Compose an AgentProfile from a Stage 7 snapshot + Stage 2 grants.
 * Pure function · no I/O · no writes · no cache.
 */
export function buildAgentProfile(input: BuildAgentProfileInput): AgentProfile {
  const role_spec = getAgentConsumer(input.snapshot.agent_role);
  const required: readonly CapabilityName[] = role_spec?.requires ?? [];
  const grantedNames: readonly CapabilityName[] = input.grants.map((g) => g.capability);
  const grantedSet = new Set<string>(grantedNames);
  const missing = required.filter((c) => !grantedSet.has(c));

  const gates_by_capability: Record<string, readonly EnforcementGate[]> = {};
  for (const cap of grantedNames) {
    gates_by_capability[cap] = gatesForCapability(cap);
  }

  return {
    identity: input.snapshot,
    role_spec,
    grants: input.grants,
    capability_coverage: {
      required,
      granted: grantedNames,
      missing,
      satisfied: missing.length === 0 && required.length > 0,
    },
    invoked_by: parentsOf(input.snapshot.agent_role),
    invokes: childrenOf(input.snapshot.agent_role),
    gates_by_capability,
    composed_at: input.composed_at ?? new Date().toISOString(),
    composition_version: "1.0.0",
  };
}

// ═══════════════════════════════════════════════════════════════════════
// DOCTRINE LOCKS (Stage 10)
// ═══════════════════════════════════════════════════════════════════════

export const _AGENT_PROFILE_IS_A_COMPOSITION_NOT_A_REGISTRY =
  "profile_projects_existing_seams_into_one_view_never_creates_new_state_or_new_table";

export const _AGENT_PROFILE_INTRODUCES_NO_NEW_SOURCE_OF_TRUTH =
  "every_field_maps_to_a_Stage_2_3_7_or_9_authoritative_source_no_originals_here";

export const _AGENT_PROFILE_IS_PURE_NO_READS_NO_WRITES =
  "buildAgentProfile_is_a_pure_function_over_inputs_no_DB_calls_no_side_effects";
