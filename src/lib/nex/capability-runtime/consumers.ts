// src/lib/nex/capability-runtime/consumers.ts
//
// NEX Capability Runtime · Stage 3 · AOF agent-role consumer specs
// Founder-authorised build-lane addition · 2026-09-23.
//
// Declarative catalogue of the 12 AOF agent roles and which capabilities
// each role requires. This is READ-ONLY metadata for introspection —
// it does NOT grant anything. Actual grants remain in
// `nex.aof_agent_capability` and are queried through requireCapability().
//
// Sources of truth for the mapping:
//   · src/lib/nex/aof/agents/source-intelligence-agent.ts
//   · src/lib/nex/aof/agents/discovery-agent.ts
//   · src/lib/nex/aof/agents/website-walk-agent.ts
//   · src/lib/nex/aof/agents/evidence-audit-agent.ts
//   · src/lib/nex/aof/agents/recovery-agent.ts
//   · src/lib/nex/aof/agents/live-streaming-agent.ts
//   · src/lib/nex/aof/agents/connections-agent.ts
//   · src/lib/nex/aof/agents/orbiting-agent.ts
//   · src/lib/nex/aof/governors/rate-governor.ts
//   · src/lib/nex/aof/governors/failover.ts
//   · src/lib/nex/harvest/country-scheduler.ts
//   · src/lib/nex/aof/adapters/registry.ts

import type { CapabilityConsumer, CapabilityName } from "./contract";
import type { AgentRole } from "../aof/types";

/**
 * A role-level consumer spec.
 *
 * `consumer_id` here is the AgentRole name (e.g. "orbiting") because this
 * catalogue describes the TYPE-LEVEL requirements of a role. Actual
 * runtime consumers are agent rows in `nex.aof_agent` (agent_id).
 * The wrapper's enforce() takes agent_id at call time; this catalogue is
 * a read view for HQ / introspection.
 */
export interface AgentRoleConsumerSpec extends CapabilityConsumer {
  readonly agent_role: AgentRole;
  readonly reason: string;
}

export const AGENT_CONSUMERS: readonly AgentRoleConsumerSpec[] = [
  {
    consumer_id: "source_intelligence",
    consumer_kind: "aof_agent",
    agent_role: "source_intelligence",
    requires: ["source_probe", "failover_source", "manage_cooldown"],
    reason:
      "Selects a source per territory · applies cooldown on failure · picks failover when primary cooled",
  },
  {
    consumer_id: "rate_governor",
    consumer_kind: "aof_agent",
    agent_role: "rate_governor",
    requires: ["manage_cooldown"],
    reason:
      "Applies backoff + host concurrency + source cooldown decisions (never bypasses)",
  },
  {
    consumer_id: "country_scheduler",
    consumer_kind: "aof_agent",
    agent_role: "country_scheduler",
    requires: ["schedule_country"],
    reason:
      "Selects next country for probe · Asia-last hard-lock enforced at scheduler",
  },
  {
    consumer_id: "api_adapter_registry",
    consumer_kind: "aof_agent",
    agent_role: "api_adapter_registry",
    requires: ["connect_adapter"],
    reason:
      "Instantiates Founder-signed discovery adapters · falls back to NULL_* until allowlist present",
  },
  {
    consumer_id: "heartbeat_recovery",
    consumer_kind: "aof_agent",
    agent_role: "heartbeat_recovery",
    requires: ["emit_heartbeat", "recover_worker"],
    reason:
      "Emits liveness heartbeats · reaps stale worker leases · restores jobs to queued state",
  },
  {
    consumer_id: "discovery",
    consumer_kind: "aof_agent",
    agent_role: "discovery",
    requires: ["source_probe", "publish_evidence"],
    reason:
      "Executes a probe on the selected source · inserts business_candidate rows · enqueues website walks",
  },
  {
    consumer_id: "website_walk",
    consumer_kind: "aof_agent",
    agent_role: "website_walk",
    requires: ["website_walk", "publish_evidence"],
    reason:
      "Drains website_walk queue · fetches permitted pages · extracts emails · records evidence",
  },
  {
    consumer_id: "evidence_audit",
    consumer_kind: "aof_agent",
    agent_role: "evidence_audit",
    requires: ["audit_evidence"],
    reason:
      "Runs R1-R6 integrity checks on discovery_business_evidence · soft-fail (orbiting decides)",
  },
  {
    consumer_id: "orbiting",
    consumer_kind: "aof_agent",
    agent_role: "orbiting",
    requires: [
      "orbit_territories",
      "schedule_country",
      "failover_source",
      "recover_worker",
    ],
    reason:
      "Top-level orchestrator · startCycle → reap → iterate territories (Asia-last) → source → gate → discover → walk → audit → snapshot → endCycle",
  },
  {
    consumer_id: "live_streaming",
    consumer_kind: "aof_agent",
    agent_role: "live_streaming",
    requires: ["stream_events", "emit_heartbeat"],
    reason:
      "Publishes operational snapshot events into aof_agent_event for HQ Operations Centre",
  },
  {
    consumer_id: "connections",
    consumer_kind: "aof_agent",
    agent_role: "connections",
    requires: ["connect_adapter"],
    reason:
      "Enumerates connection surfaces · runs gate checks (PageFetcher activation · source cooldown · allowlist)",
  },
  {
    consumer_id: "gate_adapter",
    consumer_kind: "aof_agent",
    agent_role: "gate_adapter",
    requires: ["connect_adapter"],
    reason:
      "Adapter for founder-controlled activation gates (NEX_PAGE_FETCHER_ACTIVATION · NEX_DISCOVERY_CRON_ACTIVATION)",
  },
];

const AGENT_CONSUMERS_BY_ID = new Map<string, AgentRoleConsumerSpec>(
  AGENT_CONSUMERS.map((c) => [c.consumer_id, c] as const),
);

export function getAgentConsumer(consumer_id: string): AgentRoleConsumerSpec | null {
  return AGENT_CONSUMERS_BY_ID.get(consumer_id) ?? null;
}

/**
 * Reverse lookup: which agent roles require this capability?
 */
export function consumersOfCapability(cap: CapabilityName): readonly AgentRoleConsumerSpec[] {
  return AGENT_CONSUMERS.filter((c) => c.requires.includes(cap));
}

// ─── Doctrine locks (Stage 3) ─────────────────────────────────────────

export const _AGENT_CONSUMERS_ARE_DECLARATIVE_ONLY =
  "consumer_specs_do_not_grant_capabilities_they_describe_role_requirements";

export const _RUNTIME_ENFORCEMENT_STAYS_IN_AOF_CAPABILITY_TS =
  "enforce_requires_agent_id_not_role_and_flows_through_the_real_requireCapability";
