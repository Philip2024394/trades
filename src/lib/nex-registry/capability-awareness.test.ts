import { describe, it, expect, beforeEach } from "vitest";
import {
  whatCanNexDo,
  whatCanNexNotDo,
  whatCanAgentDo,
  whatEvidenceSupports,
  whatDependsOn,
  whatDoesItDependOn,
  whatIsMissingFor,
  howToBuild,
  canSatisfyIntent,
  awarenessSnapshot,
  NEX_CAPABILITY_AWARENESS_VERSION,
} from "./capability-awareness";
import { seedCoreCapabilities, registerCapability, getCapabilityByName, _resetCapabilityRegistryForTests } from "./capability-registry";
import { seedCoreAgents, _resetAgentRegistryForTests } from "./agent-registry";

describe("capability-awareness · founder mandate", () => {
  beforeEach(() => {
    _resetCapabilityRegistryForTests();
    _resetAgentRegistryForTests();
    seedCoreCapabilities();
    seedCoreAgents();
  });

  it("canonical version", () => {
    expect(NEX_CAPABILITY_AWARENESS_VERSION).toBe("nex-capability-awareness.v1.2026-09-19");
  });

  it("whatCanNexDo returns trustable capabilities only", () => {
    const r = whatCanNexDo();
    expect(r.answer.length).toBeGreaterThan(0);
    for (const c of r.answer) expect(["VERIFIED", "PROMOTED"]).toContain(c.status);
    expect(r.evidence_count).toBeGreaterThan(0);
    expect(r.zero_llm).toBe(true);
    expect(r.ledger).toBe("B");
  });

  it("whatCanNexDo filters by category", () => {
    const r = whatCanNexDo({ category: "code" });
    for (const c of r.answer) expect(c.category).toBe("code");
  });

  it("whatCanAgentDo returns capabilities the agent owns/supports · empty for unknown agent", () => {
    const withAgent = whatCanAgentDo("programmer");
    expect(withAgent.answer.length).toBeGreaterThan(0);
    for (const c of withAgent.answer) {
      expect([c.owner_agent, ...c.supporting_agents]).toContain("programmer");
    }
    const unknown = whatCanAgentDo("ghost-agent-does-not-exist");
    expect(unknown.answer.length).toBe(0);
  });

  it("whatCanNexNotDo surfaces REJECTED/DEPRECATED/PROPOSED", () => {
    // Add a REJECTED capability to prove it appears
    registerCapability({
      name: "abandoned", category: "brain", description: "failed exp",
      status: "REJECTED",
      owner_agent: null, supporting_agents: [], implementation_paths: [],
      dependencies: [], inputs: [], outputs: [],
      compatible_frameworks: [], device_support: { desktop: true, tablet: true, mobile: true, pwa: false },
      verification_method: "not_verified",
      evidence_refs: [],
      failure_patterns: ["failed 3 times"],
      quality_tier: "DO_NOT_USE",
      license_constraints: [],
      version: "0",
      last_verified_iso: null,
      proposed_by: "ui-research",
      promoted_at_iso: null,
      supersedes: null,
    });
    const r = whatCanNexNotDo();
    const names = r.answer.map((x) => x.capability_name);
    expect(names).toContain("abandoned");
  });
});

describe("capability-awareness · evidence and dependencies", () => {
  beforeEach(() => {
    _resetCapabilityRegistryForTests();
    seedCoreCapabilities();
  });

  it("whatEvidenceSupports returns VERIFIED for a real seeded capability", () => {
    const r = whatEvidenceSupports({ by_name: { category: "code", name: "project-scaffolder" } });
    expect(r.answer.outcome).toBe("VERIFIED");
    if (r.answer.outcome === "VERIFIED") {
      expect(r.evidence_count).toBeGreaterThan(0);
    }
  });

  it("whatEvidenceSupports returns CAPABILITY_UNKNOWN for a non-existent claim (anti-fabrication)", () => {
    const r = whatEvidenceSupports({ by_name: { category: "code", name: "invented-nothing" } });
    expect(r.answer.outcome).toBe("CAPABILITY_UNKNOWN");
    expect(r.evidence_count).toBe(0);
  });

  it("whatDependsOn returns empty for a leaf/orphan capability", () => {
    const scaffolder = getCapabilityByName("code", "project-scaffolder")!;
    const r = whatDependsOn(scaffolder.capability_id);
    expect(r.answer.length).toBe(0);
  });

  it("whatDoesItDependOn returns declared dependencies", () => {
    const scaffolder = getCapabilityByName("code", "project-scaffolder")!;
    const r = whatDoesItDependOn(scaffolder.capability_id);
    // seeded scaffolder has no dependencies · so 0 · but function returns coherently
    expect(r.answer.length).toBe(0);
    expect(r.zero_llm).toBe(true);
  });
});

describe("capability-awareness · gap and build path", () => {
  beforeEach(() => {
    _resetCapabilityRegistryForTests();
    seedCoreCapabilities();
  });

  it("whatIsMissingFor reports honest MISSING · does not invent", () => {
    const r = whatIsMissingFor([
      { by_name: { category: "code", name: "project-scaffolder" } },      // real
      { by_name: { category: "visual", name: "midjourney-integration" } },// missing
    ]);
    expect(r.answer.satisfied.length).toBe(1);
    expect(r.answer.missing.length).toBe(1);
    expect(r.answer.all_satisfied).toBe(false);
  });

  it("howToBuild returns resolved for a real seeded capability", () => {
    const r = howToBuild({ by_name: { category: "code", name: "project-scaffolder" } });
    expect(r.answer.outcome).toBe("resolved");
  });

  it("howToBuild returns blocked when the goal itself is unknown", () => {
    const r = howToBuild({ by_name: { category: "code", name: "impossible-goal" } });
    expect(r.answer.outcome).toBe("blocked");
  });
});

describe("capability-awareness · canSatisfyIntent (semantic query · anti-fabrication)", () => {
  beforeEach(() => _resetCapabilityRegistryForTests());

  it("returns NOT_UNDERSTOOD when intent keywords are empty", () => {
    const r = canSatisfyIntent([]);
    expect(r.answer.outcome).toBe("NOT_UNDERSTOOD");
  });

  it("returns NOT_UNDERSTOOD when no capability has matching tags", () => {
    seedCoreCapabilities();
    const r = canSatisfyIntent(["fictional-token-xyz"]);
    expect(r.answer.outcome).toBe("NOT_UNDERSTOOD");
  });

  it("returns matched when semantic_tags overlap and capability is trustable", () => {
    registerCapability({
      name: "contact-form-atom", category: "ui", description: "form composite",
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
    const r = canSatisfyIntent(["contact"]);
    expect(r.answer.outcome).toBe("matched");
    if (r.answer.outcome === "matched") {
      expect(r.answer.candidates.length).toBe(1);
      expect(r.answer.matched_tags).toContain("contact");
    }
  });

  it("does NOT return PROPOSED candidates even if their tags match (Rule 2)", () => {
    registerCapability({
      name: "hypothetical-map", category: "ui", description: "map composite hypothesised",
      status: "PROPOSED",
      owner_agent: null, supporting_agents: [], implementation_paths: [],
      dependencies: [], inputs: [], outputs: [],
      compatible_frameworks: [], device_support: { desktop: true, tablet: true, mobile: true, pwa: true },
      verification_method: "not_verified",
      evidence_refs: [],
      failure_patterns: [], quality_tier: "EXPERIMENTAL", license_constraints: [],
      version: "0.1", last_verified_iso: null, proposed_by: "ui-research", promoted_at_iso: null, supersedes: null,
      composition_level: "composite",
      semantic_tags: ["map", "location"],
    });
    const r = canSatisfyIntent(["map"]);
    // canSatisfyIntent filters to trustable · so a PROPOSED-only match becomes empty · NOT_UNDERSTOOD
    expect(r.answer.outcome).toBe("NOT_UNDERSTOOD");
  });
});

describe("capability-awareness · snapshot", () => {
  beforeEach(() => {
    _resetCapabilityRegistryForTests();
    seedCoreCapabilities();
  });

  it("awarenessSnapshot returns coherent counts", () => {
    const s = awarenessSnapshot();
    expect(s.total_capabilities).toBeGreaterThanOrEqual(50);
    expect(s.trustable_count).toBeGreaterThan(0);
    expect(s.trustable_count).toBeLessThanOrEqual(s.total_capabilities);
    expect(s.zero_llm).toBe(true);
    expect(s.ledger).toBe("B");
  });
});
