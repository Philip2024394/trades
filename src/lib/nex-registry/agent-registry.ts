// src/lib/nex-registry/agent-registry.ts
//
// NEX Agent Registry (Ledger B · Zero LLM)
//
// The founder mandate calls for NEX to know WHICH AGENTS own which
// capabilities. This module registers:
//   · existing runtime agents (from the 7 already running on the machine)
//   · new specialist agents required for world-class UI/design/creation work
//
// An AgentRecord is a declarative schema. It describes:
//   · role · owned capabilities · supporting capabilities
//   · what evidence proves the agent works
//   · dependencies · boundaries
//
// AGENT ≠ PROCESS
//   Registering an agent here is NOT the same as spawning a runtime worker.
//   The existing 7 workers are spawned by NEX-Agent-Runtime-User scheduled
//   task. The NEW agents (creation · design · ui-layout · ui-research ·
//   ui-theme) are registered as SCHEMA · they have no runtime spawner yet.
//   Their status is PROPOSED until a runtime spawner is added AND their
//   heartbeat is observed AND their owned capabilities are verified.

import { createHash } from "node:crypto";
import type { CapabilityCategory } from "./capability-types";

export const NEX_AGENT_REGISTRY_VERSION = "nex-agent-registry.v1.2026-09-19";

// ── Agent status ──────────────────────────────────────────────────────
export type AgentStatus =
  | "RUNNING"          // Real process observed on machine · heartbeat fresh
  | "REGISTERED_INACTIVE"  // Registered as agent but no runtime spawner today
  | "PROPOSED"         // New agent role · needs runtime + verification
  | "DEPRECATED";      // Retained for audit · not selected

// ── Agent runtime evidence ────────────────────────────────────────────
export interface AgentRuntimeEvidence {
  readonly heartbeat_path: string | null;      // e.g. data/nex-agent-runtime/heartbeat-programmer.json
  readonly last_heartbeat_iso: string | null;
  readonly runtime_spawner: string | null;     // scheduled task name / script that starts it
  readonly command_line_signature: string | null;  // partial process command line for identification
}

// ── AgentRecord ───────────────────────────────────────────────────────
export interface AgentRecord {
  readonly agent_id: string;                    // deterministic hash
  readonly name: string;                        // stable identifier · matches process command
  readonly role: string;                        // human-readable role
  readonly description: string;
  readonly status: AgentStatus;
  readonly owned_capability_categories: readonly CapabilityCategory[];
  readonly primary_domain: string;              // e.g. "coding" · "design" · "verification"
  readonly boundaries: readonly string[];       // what this agent MUST NOT do
  readonly upstream_agents: readonly string[];  // agents this one is called by
  readonly downstream_agents: readonly string[];// agents this one calls
  readonly runtime_evidence: AgentRuntimeEvidence;
  readonly proposed_by: string;
  readonly registered_at_iso: string;
  readonly zero_llm: true;
  readonly ledger: "B";
}

// ── Storage ────────────────────────────────────────────────────────────
const AGENTS = new Map<string, AgentRecord>();

export function _resetAgentRegistryForTests(): void {
  AGENTS.clear();
}

// ── Registration ──────────────────────────────────────────────────────
function computeAgentId(name: string): string {
  return createHash("sha256").update(`agent::${name}`).digest("hex").slice(0, 20);
}

export function registerAgent(spec: Omit<AgentRecord, "agent_id" | "registered_at_iso" | "zero_llm" | "ledger">): AgentRecord {
  const agent_id = computeAgentId(spec.name);
  // Anti-manufacturing: RUNNING requires heartbeat_path + runtime_spawner
  if (spec.status === "RUNNING") {
    if (!spec.runtime_evidence.heartbeat_path || !spec.runtime_evidence.runtime_spawner) {
      throw new Error(`nex-agent-registry: RUNNING agent ${spec.name} must declare heartbeat_path AND runtime_spawner`);
    }
  }
  const rec: AgentRecord = {
    ...spec,
    agent_id,
    registered_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
  };
  AGENTS.set(agent_id, rec);
  return rec;
}

// ── Query ─────────────────────────────────────────────────────────────
export function getAgent(agent_id: string): AgentRecord | null {
  return AGENTS.get(agent_id) ?? null;
}

export function getAgentByName(name: string): AgentRecord | null {
  return AGENTS.get(computeAgentId(name)) ?? null;
}

export function listAgents(filter?: { status?: AgentStatus; owns_category?: CapabilityCategory }): readonly AgentRecord[] {
  const rows: AgentRecord[] = [];
  for (const a of AGENTS.values()) {
    if (filter?.status && a.status !== filter.status) continue;
    if (filter?.owns_category && !a.owned_capability_categories.includes(filter.owns_category)) continue;
    rows.push(a);
  }
  return Object.freeze(rows.sort((a, b) => a.name.localeCompare(b.name)));
}

export function countAgents(): number {
  return AGENTS.size;
}

// ── Seed · existing runtime agents + new specialist agents ────────────
export function seedCoreAgents(): void {
  _resetAgentRegistryForTests();

  // ═════════════════════════════════════════════════════════════════
  // EXISTING RUNTIME AGENTS · observed on machine · RUNNING
  // ═════════════════════════════════════════════════════════════════
  const RUNTIME_AGENTS: readonly {
    name: string; role: string; description: string; primary_domain: string;
    owns: readonly CapabilityCategory[]; upstream: readonly string[]; downstream: readonly string[];
  }[] = [
    { name: "master_ai", role: "supervisor", description: "Master AI Engineer · runs 5-min failure aggregation and 15-min claude-observer cycle", primary_domain: "meta_observation", owns: ["governance", "evolution"], upstream: [], downstream: ["programmer", "vision"] },
    { name: "programmer", role: "coding specialist", description: "Runtime coding agent · owns code-engine capabilities · runs vitest / repair loop", primary_domain: "coding", owns: ["code"], upstream: ["master_ai"], downstream: ["twin-nex", "referee"] },
    { name: "vision", role: "vision specialist", description: "Deterministic Phase-3 vision classifier · 7 request kinds · flags <85% for human review", primary_domain: "vision", owns: ["visual"], upstream: ["master_ai"], downstream: [] },
    { name: "accommodation", role: "domain specialist · accommodation", description: "Accommodation domain observer · Overpass harvester · Wikidata cache", primary_domain: "accommodation_data", owns: [], upstream: ["master_ai"], downstream: [] },
    { name: "speaking", role: "voice specialist", description: "Speaking agent · communication path", primary_domain: "communication", owns: [], upstream: ["master_ai"], downstream: [] },
    { name: "business", role: "domain specialist · business", description: "Business domain observer", primary_domain: "business_data", owns: [], upstream: ["master_ai"], downstream: [] },
    { name: "travel", role: "domain specialist · travel", description: "Travel domain observer · self-benchmark 8/8", primary_domain: "travel_data", owns: [], upstream: ["master_ai"], downstream: [] },
  ];
  for (const a of RUNTIME_AGENTS) {
    registerAgent({
      name: a.name,
      role: a.role,
      description: a.description,
      status: "RUNNING",
      owned_capability_categories: a.owns,
      primary_domain: a.primary_domain,
      boundaries: [],
      upstream_agents: a.upstream,
      downstream_agents: a.downstream,
      runtime_evidence: {
        heartbeat_path: `data/nex-agent-runtime/heartbeat-${a.name}.json`,
        last_heartbeat_iso: null,
        runtime_spawner: "NEX-Agent-Runtime-User scheduled task",
        command_line_signature: `scripts/nex-agent-runtime.mjs --agent=${a.name}`,
      },
      proposed_by: "nex-native",
    });
  }

  // ═════════════════════════════════════════════════════════════════
  // TWIN + REFEREE · verification agents · already in code · not
  // spawned as OS processes but structurally verified
  // ═════════════════════════════════════════════════════════════════
  registerAgent({
    name: "twin-nex",
    role: "independent verifier",
    description: "Independent verdict derivation · challenges primary on evidence · never modifies primary workspace",
    status: "REGISTERED_INACTIVE",
    owned_capability_categories: ["governance", "evolution"],
    primary_domain: "verification",
    boundaries: ["MUST NOT modify NEX1 workspace directly", "MUST NOT trust primary's verdict transitively"],
    upstream_agents: ["referee"],
    downstream_agents: [],
    runtime_evidence: {
      heartbeat_path: null,
      last_heartbeat_iso: null,
      runtime_spawner: null,
      command_line_signature: null,
    },
    proposed_by: "nex-native",
  });
  registerAgent({
    name: "referee",
    role: "evidence-based judge",
    description: "5 verdicts · never fabricates missing evidence · promotes only on real evidence match",
    status: "REGISTERED_INACTIVE",
    owned_capability_categories: ["governance"],
    primary_domain: "verification",
    boundaries: ["MUST NOT emit VERIFIED without matching evidence path", "MUST NOT collapse to primary verdict"],
    upstream_agents: [],
    downstream_agents: ["twin-nex"],
    runtime_evidence: {
      heartbeat_path: null,
      last_heartbeat_iso: null,
      runtime_spawner: null,
      command_line_signature: null,
    },
    proposed_by: "nex-native",
  });

  // ═════════════════════════════════════════════════════════════════
  // NEW SPECIALIST AGENTS (founder mandate this session)
  // status = PROPOSED · runtime not spawned yet · not auto-selectable
  // ═════════════════════════════════════════════════════════════════
  registerAgent({
    name: "creation",
    role: "creation orchestrator",
    description: "Turns user product intent into a concrete implementation plan · orchestrates image-gen · scaffolds project · attaches media as assets · verifies preview render",
    status: "PROPOSED",
    owned_capability_categories: ["visual"],
    primary_domain: "creation",
    boundaries: ["MUST NOT skip Modernity Quality Gate", "MUST NOT emit READY without preview evidence", "MUST NOT fabricate assets"],
    upstream_agents: [],
    downstream_agents: ["programmer", "design", "ui-layout", "ui-theme"],
    runtime_evidence: {
      heartbeat_path: null,
      last_heartbeat_iso: null,
      runtime_spawner: null,
      command_line_signature: null,
    },
    proposed_by: "nex-native",
  });
  registerAgent({
    name: "design",
    role: "design system specialist",
    description: "Enforces one design language across a project · selects fonts · icon families · animation · imagery · maintains NexHudTheme coherence",
    status: "PROPOSED",
    owned_capability_categories: ["visual", "ui"],
    primary_domain: "design_system",
    boundaries: ["MUST NOT mix icon families randomly", "MUST NOT introduce a competing design system"],
    upstream_agents: ["creation"],
    downstream_agents: ["ui-theme", "ui-layout"],
    runtime_evidence: {
      heartbeat_path: null,
      last_heartbeat_iso: null,
      runtime_spawner: null,
      command_line_signature: null,
    },
    proposed_by: "nex-native",
  });
  registerAgent({
    name: "ui-layout",
    role: "layout selection specialist",
    description: "Selects a NEX layout matching user intent · verifies responsive transformation across desktop/tablet/mobile · queries the layout registry",
    status: "PROPOSED",
    owned_capability_categories: ["layout", "ui"],
    primary_domain: "layout",
    boundaries: ["MUST NOT emit PASS_MODERN without 3-viewport screenshot evidence", "MUST NOT shrink desktop into mobile"],
    upstream_agents: ["creation", "design"],
    downstream_agents: ["programmer"],
    runtime_evidence: {
      heartbeat_path: null,
      last_heartbeat_iso: null,
      runtime_spawner: null,
      command_line_signature: null,
    },
    proposed_by: "nex-native",
  });
  registerAgent({
    name: "ui-research",
    role: "external UI discovery",
    description: "Discovers external UI candidates · records provenance · runs license + security checks · never auto-imports · surfaces to design/ui-layout for human-in-loop approval",
    status: "PROPOSED",
    owned_capability_categories: ["governance", "evolution"],
    primary_domain: "discovery",
    boundaries: ["MUST NOT clone external repos without founder authorization", "MUST NOT bypass license gate", "MUST NOT skip security review"],
    upstream_agents: [],
    downstream_agents: ["design", "ui-layout"],
    runtime_evidence: {
      heartbeat_path: null,
      last_heartbeat_iso: null,
      runtime_spawner: null,
      command_line_signature: null,
    },
    proposed_by: "nex-native",
  });
  registerAgent({
    name: "ui-theme",
    role: "theme + visual language specialist",
    description: "Adapts external components into NexHudTheme · applies design tokens · resolves compositional coherence · rejects mixed visual languages",
    status: "PROPOSED",
    owned_capability_categories: ["ui", "visual"],
    primary_domain: "theming",
    boundaries: ["MUST NOT ship components with mixed design languages", "MUST NOT default to AI-purple-glow"],
    upstream_agents: ["design"],
    downstream_agents: ["ui-layout"],
    runtime_evidence: {
      heartbeat_path: null,
      last_heartbeat_iso: null,
      runtime_spawner: null,
      command_line_signature: null,
    },
    proposed_by: "nex-native",
  });
}

// ── Manifest ──────────────────────────────────────────────────────────
export function exportAgentManifest(): { version: string; total: number; by_status: Record<AgentStatus, number>; generated_at_iso: string; zero_llm: true; ledger: "B" } {
  const by_status: Record<AgentStatus, number> = {
    RUNNING: 0, REGISTERED_INACTIVE: 0, PROPOSED: 0, DEPRECATED: 0,
  };
  for (const a of AGENTS.values()) by_status[a.status] += 1;
  return {
    version: NEX_AGENT_REGISTRY_VERSION,
    total: AGENTS.size,
    by_status,
    generated_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
  };
}
