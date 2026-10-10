// src/lib/nex/capability-runtime/agent-topology.ts
//
// NEX Agent Topology Contract · Stage 7 · Parent/child relationships
// Founder-authorised build-lane addition · 2026-09-23.
//
// HONESTY MARKER — READ CAREFULLY:
//
//   `nex.aof_agent` has NO parent_agent_id / child_agent_id column.
//
// Parent/child relationships between AOF agents therefore CANNOT be
// proven by authoritative DB state. They are IMPLICIT IN CODE:
//   · orbiting-agent invokes country_scheduler, source_intelligence,
//     discovery, website_walk, evidence_audit, live_streaming
//   · source_intelligence consults rate_governor + api_adapter_registry
//   · heartbeat_recovery provides recovery for other agents' workers
//
// Stage 7 declares this topology as CODE-DERIVED metadata. Every link
// carries an `evidence` field that names WHERE the relationship comes
// from. Consumers reading this module MUST NOT treat topology links as
// runtime state — they are declarative descriptions of what the orbiting
// code path does at runtime.
//
// Contrast with task-level parent/child: `nex.harvest_job.parent_job_id`
// IS DB-authoritative and is handled in `task-lifecycle.ts`.
//
// HARD RULES:
//   _AGENT_TOPOLOGY_IS_CODE_DERIVED_NOT_DB_PROVEN
//   _AGENT_TOPOLOGY_LINKS_MUST_CARRY_EVIDENCE
//   _AGENT_TOPOLOGY_IS_DECLARATIVE_ONLY — no writes, no runtime dispatch

import type { AgentRole } from "../aof/types";

// ═══════════════════════════════════════════════════════════════════════
// LINK KIND + EVIDENCE
// ═══════════════════════════════════════════════════════════════════════

/**
 * The role-relationship kind.
 * · orchestrates — parent controls the lifecycle of the child cycle
 * · invokes — parent calls the child in-flow during its own execution
 * · provides_recovery_for — child recovers state owned by parent's workers
 * · consults — parent reads decisions from child before proceeding
 */
export type AgentLinkKind =
  | "orchestrates"
  | "invokes"
  | "provides_recovery_for"
  | "consults";

/**
 * The evidence marker names WHERE the relationship comes from.
 * Explicit label so consumers can reject topology as DB-proof.
 */
export type AgentTopologyEvidence =
  | "code_derived_from_orbiting_agent"
  | "code_derived_from_agent_consumers"
  | "code_derived_from_recovery_agent"
  | "code_derived_from_connections_agent";

export interface AgentTopologyLink {
  readonly parent_role: AgentRole;
  readonly child_role: AgentRole;
  readonly kind: AgentLinkKind;
  readonly reason: string;
  readonly evidence: AgentTopologyEvidence;
}

// ═══════════════════════════════════════════════════════════════════════
// STATIC TOPOLOGY · code-derived from the orbiting-agent flow
// ═══════════════════════════════════════════════════════════════════════

/**
 * Parent/child topology as it exists in the NEX orbiting-agent
 * dispatch flow today. Every link is a factual description of a
 * function call OR a consumer-spec requirement (from Stage 3).
 * Not one link is invented.
 */
export const AGENT_TOPOLOGY: readonly AgentTopologyLink[] = [
  // Orbiting is the top-level orchestrator per orbiting-agent.ts:
  //   startCycle → reap → iterate territories → source → gate → discover → walk → audit → snapshot → endCycle
  {
    parent_role: "orbiting",
    child_role: "country_scheduler",
    kind: "invokes",
    reason: "orbiting-agent calls country_scheduler to select next territory (Asia-last enforced)",
    evidence: "code_derived_from_orbiting_agent",
  },
  {
    parent_role: "orbiting",
    child_role: "source_intelligence",
    kind: "invokes",
    reason: "orbiting-agent asks source_intelligence to pick a source per territory",
    evidence: "code_derived_from_orbiting_agent",
  },
  {
    parent_role: "orbiting",
    child_role: "connections",
    kind: "invokes",
    reason: "orbiting-agent runs gate/connection checks before dispatch",
    evidence: "code_derived_from_orbiting_agent",
  },
  {
    parent_role: "orbiting",
    child_role: "discovery",
    kind: "invokes",
    reason: "orbiting-agent dispatches discovery to probe the selected source",
    evidence: "code_derived_from_orbiting_agent",
  },
  {
    parent_role: "orbiting",
    child_role: "website_walk",
    kind: "invokes",
    reason: "orbiting-agent drains the website_walk queue after discovery",
    evidence: "code_derived_from_orbiting_agent",
  },
  {
    parent_role: "orbiting",
    child_role: "evidence_audit",
    kind: "invokes",
    reason: "orbiting-agent runs evidence_audit R1-R6 checks after walk",
    evidence: "code_derived_from_orbiting_agent",
  },
  {
    parent_role: "orbiting",
    child_role: "live_streaming",
    kind: "invokes",
    reason: "orbiting-agent emits per-cycle operational snapshot via live_streaming",
    evidence: "code_derived_from_orbiting_agent",
  },
  {
    parent_role: "orbiting",
    child_role: "heartbeat_recovery",
    kind: "orchestrates",
    reason: "orbiting-agent runs the reaper at the start of every cycle",
    evidence: "code_derived_from_orbiting_agent",
  },

  // Source intelligence delegates to governors + registry (from AGENT_CONSUMERS in Stage 3)
  {
    parent_role: "source_intelligence",
    child_role: "rate_governor",
    kind: "consults",
    reason: "source_intelligence checks rate_governor.decideCanProceed before each probe",
    evidence: "code_derived_from_agent_consumers",
  },
  {
    parent_role: "source_intelligence",
    child_role: "api_adapter_registry",
    kind: "invokes",
    reason: "source_intelligence resolves the concrete adapter through the AdapterRegistry",
    evidence: "code_derived_from_agent_consumers",
  },

  // Connections agent uses gate_adapter for activation checks
  {
    parent_role: "connections",
    child_role: "gate_adapter",
    kind: "invokes",
    reason: "connections-agent verifies NEX_PAGE_FETCHER_ACTIVATION / cron gates via gate_adapter",
    evidence: "code_derived_from_connections_agent",
  },

  // Heartbeat recovery restores workers owned by the discovery + website_walk lanes
  {
    parent_role: "heartbeat_recovery",
    child_role: "website_walk",
    kind: "provides_recovery_for",
    reason: "recovery-agent reaper reclaims expired website_walk worker leases",
    evidence: "code_derived_from_recovery_agent",
  },
  {
    parent_role: "heartbeat_recovery",
    child_role: "discovery",
    kind: "provides_recovery_for",
    reason: "recovery-agent reaper reclaims expired discovery worker leases",
    evidence: "code_derived_from_recovery_agent",
  },
];

// ═══════════════════════════════════════════════════════════════════════
// LOOKUPS
// ═══════════════════════════════════════════════════════════════════════

export function childrenOf(parent: AgentRole): readonly AgentTopologyLink[] {
  return AGENT_TOPOLOGY.filter((l) => l.parent_role === parent);
}

export function parentsOf(child: AgentRole): readonly AgentTopologyLink[] {
  return AGENT_TOPOLOGY.filter((l) => l.child_role === child);
}

export function linksBetween(parent: AgentRole, child: AgentRole): readonly AgentTopologyLink[] {
  return AGENT_TOPOLOGY.filter((l) => l.parent_role === parent && l.child_role === child);
}

/**
 * Convenience: returns true if the topology contains any link between
 * these two roles (regardless of kind). Useful for HQ visualisation.
 */
export function hasRelationship(parent: AgentRole, child: AgentRole): boolean {
  return AGENT_TOPOLOGY.some((l) => l.parent_role === parent && l.child_role === child);
}

// ═══════════════════════════════════════════════════════════════════════
// DOCTRINE LOCKS (Stage 7)
// ═══════════════════════════════════════════════════════════════════════

export const _AGENT_TOPOLOGY_IS_CODE_DERIVED_NOT_DB_PROVEN =
  "aof_agent_table_has_no_parent_id_column_topology_reflects_orbiting_agent_dispatch_flow_only";

export const _AGENT_TOPOLOGY_LINKS_MUST_CARRY_EVIDENCE =
  "every_AgentTopologyLink_declares_evidence_naming_source_of_the_relationship";

export const _AGENT_TOPOLOGY_IS_DECLARATIVE_ONLY =
  "no_dispatch_no_spawn_no_write_helpers_topology_is_metadata_for_introspection";
