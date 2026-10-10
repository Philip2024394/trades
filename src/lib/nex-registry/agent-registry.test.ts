import { describe, it, expect, beforeEach } from "vitest";
import {
  seedCoreAgents,
  registerAgent,
  getAgentByName,
  listAgents,
  countAgents,
  exportAgentManifest,
  NEX_AGENT_REGISTRY_VERSION,
  _resetAgentRegistryForTests,
} from "./agent-registry";

describe("agent-registry · seed", () => {
  beforeEach(() => {
    _resetAgentRegistryForTests();
    seedCoreAgents();
  });

  it("seeds ≥14 agents (7 runtime + 2 verification + 5 new specialists)", () => {
    expect(countAgents()).toBeGreaterThanOrEqual(14);
  });

  it("all 7 existing runtime agents are RUNNING", () => {
    const runtimeNames = ["master_ai", "programmer", "vision", "accommodation", "speaking", "business", "travel"];
    for (const name of runtimeNames) {
      const a = getAgentByName(name);
      expect(a).toBeTruthy();
      expect(a!.status).toBe("RUNNING");
      expect(a!.runtime_evidence.heartbeat_path).toContain(name);
      expect(a!.runtime_evidence.command_line_signature).toContain(name);
    }
  });

  it("the 5 new UI/creation specialists are PROPOSED (not RUNNING · not spawned yet)", () => {
    const proposedNames = ["creation", "design", "ui-layout", "ui-research", "ui-theme"];
    for (const name of proposedNames) {
      const a = getAgentByName(name);
      expect(a).toBeTruthy();
      expect(a!.status).toBe("PROPOSED");
    }
  });

  it("Twin + Referee are REGISTERED_INACTIVE with clear boundaries", () => {
    const twin = getAgentByName("twin-nex");
    const ref = getAgentByName("referee");
    expect(twin!.status).toBe("REGISTERED_INACTIVE");
    expect(ref!.status).toBe("REGISTERED_INACTIVE");
    expect(twin!.boundaries.length).toBeGreaterThan(0);
    expect(ref!.boundaries.length).toBeGreaterThan(0);
  });

  it("agents own capability categories that reflect their domain", () => {
    expect(getAgentByName("programmer")!.owned_capability_categories).toContain("code");
    expect(getAgentByName("ui-layout")!.owned_capability_categories).toContain("layout");
    expect(getAgentByName("design")!.owned_capability_categories.some((c) => c === "ui" || c === "visual")).toBe(true);
  });

  it("agent manifest declares zero_llm and ledger B", () => {
    const m = exportAgentManifest();
    expect(m.version).toBe(NEX_AGENT_REGISTRY_VERSION);
    expect(m.zero_llm).toBe(true);
    expect(m.ledger).toBe("B");
    expect(m.by_status.RUNNING).toBeGreaterThanOrEqual(7);
    expect(m.by_status.PROPOSED).toBeGreaterThanOrEqual(5);
  });
});

describe("agent-registry · anti-manufacturing invariants", () => {
  beforeEach(() => _resetAgentRegistryForTests());

  it("refuses to register RUNNING agent without heartbeat_path", () => {
    expect(() => registerAgent({
      name: "ghost", role: "test", description: "fake running",
      status: "RUNNING",
      owned_capability_categories: [],
      primary_domain: "test",
      boundaries: [], upstream_agents: [], downstream_agents: [],
      runtime_evidence: { heartbeat_path: null, last_heartbeat_iso: null, runtime_spawner: "task", command_line_signature: "cmd" },
      proposed_by: "test",
    })).toThrow(/RUNNING/);
  });

  it("refuses to register RUNNING agent without runtime_spawner", () => {
    expect(() => registerAgent({
      name: "ghost2", role: "test", description: "fake running",
      status: "RUNNING",
      owned_capability_categories: [],
      primary_domain: "test",
      boundaries: [], upstream_agents: [], downstream_agents: [],
      runtime_evidence: { heartbeat_path: "some/path", last_heartbeat_iso: null, runtime_spawner: null, command_line_signature: "cmd" },
      proposed_by: "test",
    })).toThrow(/RUNNING/);
  });

  it("allows PROPOSED agent without runtime evidence (§correct·new agents haven't spawned yet)", () => {
    const a = registerAgent({
      name: "future-agent", role: "hypothetical", description: "not spawned yet",
      status: "PROPOSED",
      owned_capability_categories: ["ui"],
      primary_domain: "test",
      boundaries: [], upstream_agents: [], downstream_agents: [],
      runtime_evidence: { heartbeat_path: null, last_heartbeat_iso: null, runtime_spawner: null, command_line_signature: null },
      proposed_by: "nex-native",
    });
    expect(a.status).toBe("PROPOSED");
  });
});

describe("agent-registry · queries", () => {
  beforeEach(() => {
    _resetAgentRegistryForTests();
    seedCoreAgents();
  });

  it("listAgents filter by status", () => {
    const running = listAgents({ status: "RUNNING" });
    for (const a of running) expect(a.status).toBe("RUNNING");
    const proposed = listAgents({ status: "PROPOSED" });
    for (const a of proposed) expect(a.status).toBe("PROPOSED");
  });

  it("listAgents filter by owns_category", () => {
    const rows = listAgents({ owns_category: "code" });
    for (const a of rows) expect(a.owned_capability_categories).toContain("code");
    expect(rows.length).toBeGreaterThan(0);
  });
});
