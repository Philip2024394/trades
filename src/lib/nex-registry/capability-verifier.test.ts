import { describe, it, expect, beforeEach } from "vitest";
import { seedCoreCapabilities, registerCapability, _resetCapabilityRegistryForTests } from "./capability-registry";
import { verifyClaim, verifyBatch, NEX_CAPABILITY_VERIFIER_VERSION } from "./capability-verifier";
import type { CapabilityRecord } from "./capability-types";

describe("capability-verifier · founder scenario", () => {
  beforeEach(() => {
    _resetCapabilityRegistryForTests();
    seedCoreCapabilities();
  });

  it("canonical version", () => {
    expect(NEX_CAPABILITY_VERIFIER_VERSION).toBe("nex-capability-verifier.v1.2026-09-19");
  });

  it("Twin can VERIFY a seeded PROMOTED capability with real file evidence", () => {
    // project-scaffolder is a real file in the repo
    const result = verifyClaim({ by_name: { category: "code", name: "project-scaffolder" } });
    expect(result.outcome).toBe("VERIFIED");
    if (result.outcome === "VERIFIED") {
      expect(result.evidence.length).toBeGreaterThan(0);
    }
  });

  it("Twin gets CAPABILITY_UNKNOWN for a non-existent claim", () => {
    const r = verifyClaim({ by_name: { category: "code", name: "does-not-exist-anywhere" } });
    expect(r.outcome).toBe("CAPABILITY_UNKNOWN");
  });

  it("Twin gets INSUFFICIENT_EVIDENCE when a capability's evidence path is missing", () => {
    _resetCapabilityRegistryForTests();
    // Register a VERIFIED capability whose evidence points nowhere real
    registerCapability({
      name: "phantom", category: "code",
      description: "claims to exist but evidence is fake",
      status: "VERIFIED",
      owner_agent: null, supporting_agents: [], implementation_paths: [],
      dependencies: [], inputs: [], outputs: [],
      compatible_frameworks: [],
      device_support: { desktop: true, tablet: true, mobile: true, pwa: false },
      verification_method: "test_suite",
      evidence_refs: [{ kind: "test_file", path: "src/does/not/exist.test.ts", hash: null, observed_at_iso: new Date().toISOString(), note: "fake" }],
      failure_patterns: [],
      quality_tier: "EXPERIMENTAL",
      license_constraints: [],
      version: "0.1",
      last_verified_iso: new Date().toISOString(),
      proposed_by: "test",
      promoted_at_iso: null,
      supersedes: null,
    });
    const r = verifyClaim({ by_name: { category: "code", name: "phantom" } });
    expect(r.outcome).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("Twin REFUTES a REJECTED capability", () => {
    // Register a rejected capability directly (skip anti-manufacturing gate by using structural default)
    _resetCapabilityRegistryForTests();
    registerCapability({
      name: "abandoned", category: "code",
      description: "was tried and failed",
      status: "REJECTED",
      owner_agent: null, supporting_agents: [], implementation_paths: [],
      dependencies: [], inputs: [], outputs: [],
      compatible_frameworks: [],
      device_support: { desktop: true, tablet: true, mobile: true, pwa: false },
      verification_method: "not_verified",
      evidence_refs: [],
      failure_patterns: ["failed verification 3x"],
      quality_tier: "DO_NOT_USE",
      license_constraints: [],
      version: "0",
      last_verified_iso: null,
      proposed_by: "ui-research",
      promoted_at_iso: null,
      supersedes: null,
    });
    const r = verifyClaim({ by_name: { category: "code", name: "abandoned" } });
    expect(r.outcome).toBe("REFUTED");
  });

  it("Twin returns INSUFFICIENT_EVIDENCE for a PROPOSED (unverified) capability", () => {
    _resetCapabilityRegistryForTests();
    registerCapability({
      name: "hypothetical", category: "visual",
      description: "hypothesised · not yet tested",
      status: "PROPOSED",
      owner_agent: null, supporting_agents: [], implementation_paths: [],
      dependencies: [], inputs: [], outputs: [],
      compatible_frameworks: [],
      device_support: { desktop: true, tablet: true, mobile: true, pwa: false },
      verification_method: "not_verified",
      evidence_refs: [],
      failure_patterns: [],
      quality_tier: "EXPERIMENTAL",
      license_constraints: [],
      version: "0.1",
      last_verified_iso: null,
      proposed_by: "ui-research",
      promoted_at_iso: null,
      supersedes: null,
    });
    const r = verifyClaim({ by_name: { category: "visual", name: "hypothetical" } });
    expect(r.outcome).toBe("INSUFFICIENT_EVIDENCE");
  });
});

describe("capability-verifier · batch (Twin's audit pass)", () => {
  beforeEach(() => {
    _resetCapabilityRegistryForTests();
    seedCoreCapabilities();
  });

  it("verifies a batch of real seeded capabilities", () => {
    const claims = [
      { by_name: { category: "code" as const, name: "project-scaffolder" } },
      { by_name: { category: "code" as const, name: "twin-nex" } },
      { by_name: { category: "code" as const, name: "referee" } },
      { by_name: { category: "ui" as const, name: "ui-Button" } },
    ];
    const result = verifyBatch({ claims });
    expect(result.total).toBe(4);
    expect(result.verified).toBeGreaterThanOrEqual(3);
    expect(result.zero_llm).toBe(true);
    expect(result.ledger).toBe("B");
  });

  it("catches mixed cases · verified · unknown · refuted in one batch", () => {
    _resetCapabilityRegistryForTests();
    seedCoreCapabilities();
    // Add a REJECTED capability for the mix
    registerCapability({
      name: "rejected-example", category: "brain",
      description: "tried and failed",
      status: "REJECTED",
      owner_agent: null, supporting_agents: [], implementation_paths: [],
      dependencies: [], inputs: [], outputs: [],
      compatible_frameworks: [],
      device_support: { desktop: true, tablet: true, mobile: true, pwa: false },
      verification_method: "not_verified",
      evidence_refs: [],
      failure_patterns: ["failed"],
      quality_tier: "DO_NOT_USE",
      license_constraints: [],
      version: "0",
      last_verified_iso: null,
      proposed_by: "twin-nex",
      promoted_at_iso: null,
      supersedes: null,
    });
    const claims = [
      { by_name: { category: "code" as const, name: "project-scaffolder" } },        // VERIFIED
      { by_name: { category: "code" as const, name: "does-not-exist" } },            // UNKNOWN
      { by_name: { category: "brain" as const, name: "rejected-example" } },         // REFUTED
    ];
    const result = verifyBatch({ claims });
    expect(result.verified).toBe(1);
    expect(result.unknown).toBe(1);
    expect(result.refuted).toBe(1);
  });
});
