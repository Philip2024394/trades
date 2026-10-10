import { describe, it, expect, beforeEach } from "vitest";
import {
  getRequires,
  getRequiredBy,
  analyseDependencies,
  findByTag,
  findByCompositionLevel,
  findMissing,
  proposeCompositionPath,
  detectCycles,
  summarizeGraph,
  NEX_CAPABILITY_GRAPH_VERSION,
} from "./capability-graph";
import {
  seedCoreCapabilities,
  registerCapability,
  _resetCapabilityRegistryForTests,
  getCapabilityByName,
} from "./capability-registry";

describe("capability-graph · version", () => {
  it("canonical version", () => {
    expect(NEX_CAPABILITY_GRAPH_VERSION).toBe("nex-capability-graph.v1.2026-09-19");
  });
});

describe("capability-graph · edge queries on seeded registry", () => {
  beforeEach(() => {
    _resetCapabilityRegistryForTests();
    seedCoreCapabilities();
  });

  it("summarizeGraph reports coherent node + edge counts", () => {
    const s = summarizeGraph();
    expect(s.total_nodes).toBeGreaterThanOrEqual(50);
    expect(s.total_edges).toBeGreaterThanOrEqual(0);
    expect(s.zero_llm).toBe(true);
    expect(s.ledger).toBe("B");
  });

  it("seed has no dependency cycles", () => {
    expect(detectCycles().length).toBe(0);
  });

  it("getRequires returns empty for a leaf capability", () => {
    const scaffolder = getCapabilityByName("code", "project-scaffolder")!;
    expect(getRequires(scaffolder.capability_id).length).toBe(0);
  });

  it("getRequiredBy returns empty for orphan (nothing depends on it yet)", () => {
    const scaffolder = getCapabilityByName("code", "project-scaffolder")!;
    // In seed, dependencies are minimal; scaffolder is not depended on by any other seed entry
    expect(getRequiredBy(scaffolder.capability_id).length).toBe(0);
  });
});

describe("capability-graph · dependency semantics", () => {
  beforeEach(() => _resetCapabilityRegistryForTests());

  it("analyseDependencies distinguishes present · missing · untrustable", () => {
    // Base capabilities
    const base1 = registerCapability({
      name: "base-A", category: "code", description: "base A",
      status: "PROMOTED",
      owner_agent: null, supporting_agents: [], implementation_paths: [],
      dependencies: [], inputs: [], outputs: [],
      compatible_frameworks: [], device_support: { desktop: true, tablet: true, mobile: true, pwa: true },
      verification_method: "user_authorized",
      evidence_refs: [{ kind: "user_confirmation", path: "n/a", hash: null, observed_at_iso: new Date().toISOString(), note: "ok" }],
      failure_patterns: [], quality_tier: "CORE", license_constraints: [],
      version: "1", last_verified_iso: new Date().toISOString(), proposed_by: "test", promoted_at_iso: null, supersedes: null,
    });
    const base2 = registerCapability({
      name: "base-B", category: "code", description: "base B",
      status: "PROPOSED",   // deliberately untrustable
      owner_agent: null, supporting_agents: [], implementation_paths: [],
      dependencies: [], inputs: [], outputs: [],
      compatible_frameworks: [], device_support: { desktop: true, tablet: true, mobile: true, pwa: true },
      verification_method: "not_verified",
      evidence_refs: [],
      failure_patterns: [], quality_tier: "EXPERIMENTAL", license_constraints: [],
      version: "0.1", last_verified_iso: null, proposed_by: "test", promoted_at_iso: null, supersedes: null,
    });
    // Composite that depends on both PLUS a missing id
    const composite = registerCapability({
      name: "composite-X", category: "code", description: "composite",
      status: "PROMOTED",
      owner_agent: null, supporting_agents: [], implementation_paths: [],
      dependencies: [base1.capability_id, base2.capability_id, "id-that-does-not-exist-00"],
      inputs: [], outputs: [],
      compatible_frameworks: [], device_support: { desktop: true, tablet: true, mobile: true, pwa: true },
      verification_method: "user_authorized",
      evidence_refs: [{ kind: "user_confirmation", path: "n/a", hash: null, observed_at_iso: new Date().toISOString(), note: "ok" }],
      failure_patterns: [], quality_tier: "CORE", license_constraints: [],
      version: "1", last_verified_iso: new Date().toISOString(), proposed_by: "test", promoted_at_iso: null, supersedes: null,
    });
    const dep = analyseDependencies(composite.capability_id)!;
    expect(dep.present).toContain(base1.capability_id);
    expect(dep.untrustable).toContain(base2.capability_id);
    expect(dep.missing).toContain("id-that-does-not-exist-00");
  });
});

describe("capability-graph · gap analysis", () => {
  beforeEach(() => {
    _resetCapabilityRegistryForTests();
    seedCoreCapabilities();
  });

  it("findMissing reports MISSING when a name does not exist (never fabricates)", () => {
    const gap = findMissing([
      { by_name: { category: "code", name: "project-scaffolder" } },       // real
      { by_name: { category: "code", name: "totally-invented-thing-xyz" } },// missing
    ]);
    expect(gap.satisfied.length).toBe(1);
    expect(gap.missing.length).toBe(1);
    expect(gap.missing[0]).toContain("totally-invented-thing-xyz");
    expect(gap.all_satisfied).toBe(false);
  });

  it("findMissing all_satisfied=true when every request maps to trustable", () => {
    const gap = findMissing([
      { by_name: { category: "code", name: "project-scaffolder" } },
      { by_name: { category: "code", name: "twin-nex" } },
    ]);
    expect(gap.all_satisfied).toBe(true);
    expect(gap.zero_llm).toBe(true);
    expect(gap.ledger).toBe("B");
  });
});

describe("capability-graph · composition path", () => {
  beforeEach(() => _resetCapabilityRegistryForTests());

  it("returns resolved · topologically-ordered path", () => {
    const a = registerCapability({
      name: "atom", category: "ui", description: "atom",
      status: "PROMOTED",
      owner_agent: null, supporting_agents: [], implementation_paths: [],
      dependencies: [], inputs: [], outputs: [],
      compatible_frameworks: [], device_support: { desktop: true, tablet: true, mobile: true, pwa: true },
      verification_method: "user_authorized",
      evidence_refs: [{ kind: "user_confirmation", path: "n/a", hash: null, observed_at_iso: new Date().toISOString(), note: "ok" }],
      failure_patterns: [], quality_tier: "CORE", license_constraints: [],
      version: "1", last_verified_iso: new Date().toISOString(), proposed_by: "test", promoted_at_iso: null, supersedes: null,
    });
    const composite = registerCapability({
      name: "composite", category: "ui", description: "composite",
      status: "PROMOTED",
      owner_agent: null, supporting_agents: [], implementation_paths: [],
      dependencies: [a.capability_id], inputs: [], outputs: [],
      compatible_frameworks: [], device_support: { desktop: true, tablet: true, mobile: true, pwa: true },
      verification_method: "user_authorized",
      evidence_refs: [{ kind: "user_confirmation", path: "n/a", hash: null, observed_at_iso: new Date().toISOString(), note: "ok" }],
      failure_patterns: [], quality_tier: "CORE", license_constraints: [],
      version: "1", last_verified_iso: new Date().toISOString(), proposed_by: "test", promoted_at_iso: null, supersedes: null,
    });
    const path = proposeCompositionPath({ capability_id: composite.capability_id });
    expect(path.outcome).toBe("resolved");
    if (path.outcome === "resolved") {
      expect(path.total_steps).toBe(2);
      // atom must be built before composite
      expect(path.steps[0].capability_name).toBe("atom");
      expect(path.steps[1].capability_name).toBe("composite");
    }
  });

  it("returns blocked with GapAnalysis when a dependency is missing", () => {
    const orphan = registerCapability({
      name: "orphan", category: "ui", description: "depends on nothing that exists",
      status: "PROMOTED",
      owner_agent: null, supporting_agents: [], implementation_paths: [],
      dependencies: ["ghost-id-not-in-registry"],
      inputs: [], outputs: [],
      compatible_frameworks: [], device_support: { desktop: true, tablet: true, mobile: true, pwa: true },
      verification_method: "user_authorized",
      evidence_refs: [{ kind: "user_confirmation", path: "n/a", hash: null, observed_at_iso: new Date().toISOString(), note: "ok" }],
      failure_patterns: [], quality_tier: "CORE", license_constraints: [],
      version: "1", last_verified_iso: new Date().toISOString(), proposed_by: "test", promoted_at_iso: null, supersedes: null,
    });
    const path = proposeCompositionPath({ capability_id: orphan.capability_id });
    expect(path.outcome).toBe("blocked");
    if (path.outcome === "blocked") {
      expect(path.gap.missing).toContain("ghost-id-not-in-registry");
    }
  });

  it("detects cycles when two capabilities depend on each other", () => {
    // Build two records with mutual dependencies · use raw registry insertion
    // by first registering one with a placeholder dep, then patching (we can't
    // easily patch, so we build a synthetic cycle scenario with three nodes)
    const c1 = registerCapability({
      name: "cyc1", category: "code", description: "cyc1",
      status: "PROMOTED",
      owner_agent: null, supporting_agents: [], implementation_paths: [],
      dependencies: [],  // will be updated by re-registering c2 first
      inputs: [], outputs: [],
      compatible_frameworks: [], device_support: { desktop: true, tablet: true, mobile: true, pwa: true },
      verification_method: "user_authorized",
      evidence_refs: [{ kind: "user_confirmation", path: "n/a", hash: null, observed_at_iso: new Date().toISOString(), note: "ok" }],
      failure_patterns: [], quality_tier: "CORE", license_constraints: [],
      version: "1", last_verified_iso: new Date().toISOString(), proposed_by: "test", promoted_at_iso: null, supersedes: null,
    });
    const c2 = registerCapability({
      name: "cyc2", category: "code", description: "cyc2",
      status: "PROMOTED",
      owner_agent: null, supporting_agents: [], implementation_paths: [],
      dependencies: [c1.capability_id],
      inputs: [], outputs: [],
      compatible_frameworks: [], device_support: { desktop: true, tablet: true, mobile: true, pwa: true },
      verification_method: "user_authorized",
      evidence_refs: [{ kind: "user_confirmation", path: "n/a", hash: null, observed_at_iso: new Date().toISOString(), note: "ok" }],
      failure_patterns: [], quality_tier: "CORE", license_constraints: [],
      version: "1", last_verified_iso: new Date().toISOString(), proposed_by: "test", promoted_at_iso: null, supersedes: null,
    });
    // Now re-register c1 with a dependency on c2 to close the cycle
    registerCapability({
      name: "cyc1", category: "code", description: "cyc1 with back-edge",
      status: "PROMOTED",
      owner_agent: null, supporting_agents: [], implementation_paths: [],
      dependencies: [c2.capability_id],
      inputs: [], outputs: [],
      compatible_frameworks: [], device_support: { desktop: true, tablet: true, mobile: true, pwa: true },
      verification_method: "user_authorized",
      evidence_refs: [{ kind: "user_confirmation", path: "n/a", hash: null, observed_at_iso: new Date().toISOString(), note: "ok" }],
      failure_patterns: [], quality_tier: "CORE", license_constraints: [],
      version: "2", last_verified_iso: new Date().toISOString(), proposed_by: "test", promoted_at_iso: null, supersedes: null,
    });
    const cycles = detectCycles();
    expect(cycles.length).toBeGreaterThan(0);
    const path = proposeCompositionPath({ capability_id: c1.capability_id });
    expect(path.outcome).toBe("cyclic");
  });
});

describe("capability-graph · semantic tag search", () => {
  beforeEach(() => _resetCapabilityRegistryForTests());

  it("findByTag returns empty when no tags match (never fabricates)", () => {
    const rows = findByTag(["completely-invented-tag"]);
    expect(rows.length).toBe(0);
  });

  it("findByTag returns capabilities whose semantic_tags include any input token", () => {
    registerCapability({
      name: "contact-form", category: "ui", description: "contact-form composite",
      status: "PROMOTED",
      owner_agent: null, supporting_agents: [], implementation_paths: [],
      dependencies: [], inputs: [], outputs: [],
      compatible_frameworks: [], device_support: { desktop: true, tablet: true, mobile: true, pwa: true },
      verification_method: "user_authorized",
      evidence_refs: [{ kind: "user_confirmation", path: "n/a", hash: null, observed_at_iso: new Date().toISOString(), note: "ok" }],
      failure_patterns: [], quality_tier: "CORE", license_constraints: [],
      version: "1", last_verified_iso: new Date().toISOString(), proposed_by: "test", promoted_at_iso: null, supersedes: null,
      composition_level: "composite",
      semantic_tags: ["contact", "form", "email"],
    });
    const rows = findByTag(["contact"]);
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe("contact-form");
  });

  it("findByCompositionLevel filters by hierarchy layer", () => {
    registerCapability({
      name: "some-atom", category: "ui", description: "atom",
      status: "PROMOTED",
      owner_agent: null, supporting_agents: [], implementation_paths: [],
      dependencies: [], inputs: [], outputs: [],
      compatible_frameworks: [], device_support: { desktop: true, tablet: true, mobile: true, pwa: true },
      verification_method: "user_authorized",
      evidence_refs: [{ kind: "user_confirmation", path: "n/a", hash: null, observed_at_iso: new Date().toISOString(), note: "ok" }],
      failure_patterns: [], quality_tier: "CORE", license_constraints: [],
      version: "1", last_verified_iso: new Date().toISOString(), proposed_by: "test", promoted_at_iso: null, supersedes: null,
      composition_level: "atom",
    });
    const rows = findByCompositionLevel("atom");
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe("some-atom");
  });
});
