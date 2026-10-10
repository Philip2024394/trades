import { describe, it, expect, beforeEach } from "vitest";
import {
  seedCoreCapabilities,
  registerCapability,
  promoteCapability,
  deprecateCapability,
  getCapability,
  getCapabilityByName,
  listCapabilities,
  countCapabilities,
  summarizeCapabilities,
  _resetCapabilityRegistryForTests,
} from "./capability-registry";
import { computeCapabilityId, isAutoSelectableStatus, isTrustable, NEX_CAPABILITY_VERSION } from "./capability-types";

describe("capability-types · helpers", () => {
  it("computeCapabilityId is deterministic 20-char", () => {
    const a = computeCapabilityId({ category: "code", name: "project-scaffolder" });
    const b = computeCapabilityId({ category: "code", name: "project-scaffolder" });
    expect(a).toBe(b);
    expect(a.length).toBe(20);
  });
  it("status trust helpers", () => {
    expect(isAutoSelectableStatus("PROMOTED")).toBe(true);
    expect(isAutoSelectableStatus("VERIFIED")).toBe(false);
    expect(isTrustable("PROMOTED")).toBe(true);
    expect(isTrustable("VERIFIED")).toBe(true);
    expect(isTrustable("PROPOSED")).toBe(false);
    expect(isTrustable("REJECTED")).toBe(false);
  });
  it("version constant is canonical", () => {
    expect(NEX_CAPABILITY_VERSION).toBe("nex-capability.v1.2026-09-19");
  });
});

describe("capability-registry · seed", () => {
  beforeEach(() => {
    _resetCapabilityRegistryForTests();
    seedCoreCapabilities();
  });

  it("seeds ≥50 capabilities across 6+ categories", () => {
    expect(countCapabilities()).toBeGreaterThanOrEqual(50);
    const s = summarizeCapabilities();
    expect(s.by_category.code).toBeGreaterThanOrEqual(20);
    expect(s.by_category.ui).toBeGreaterThanOrEqual(25);
    expect(s.by_category.visual).toBeGreaterThanOrEqual(4);
    expect(s.by_category.layout).toBeGreaterThanOrEqual(7);
    expect(s.by_category.runtime).toBeGreaterThanOrEqual(2);
    expect(s.by_category.governance).toBeGreaterThanOrEqual(3);
    expect(s.by_category.brain).toBeGreaterThanOrEqual(4);
    expect(s.by_category.evolution).toBeGreaterThanOrEqual(1);
  });

  it("all seeded capabilities have zero_llm=true and ledger=B", () => {
    for (const c of listCapabilities()) {
      expect(c.zero_llm).toBe(true);
      expect(c.ledger).toBe("B");
    }
  });

  it("every seeded capability is VERIFIED or PROMOTED (never PROPOSED at seed)", () => {
    for (const c of listCapabilities()) {
      expect(["VERIFIED", "PROMOTED"]).toContain(c.status);
    }
  });

  it("all seeded PROMOTED/VERIFIED capabilities have evidence_refs", () => {
    for (const c of listCapabilities()) {
      expect(c.evidence_refs.length).toBeGreaterThan(0);
      expect(c.last_verified_iso).toBeTruthy();
    }
  });

  it("query auto_selectable_only returns only PROMOTED", () => {
    const rows = listCapabilities({ auto_selectable_only: true });
    for (const r of rows) expect(r.status).toBe("PROMOTED");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("query by category returns coherent set", () => {
    const codeCaps = listCapabilities({ category: "code" });
    for (const c of codeCaps) expect(c.category).toBe("code");
  });

  it("getCapabilityByName resolves a known seeded capability", () => {
    const cap = getCapabilityByName("code", "project-scaffolder");
    expect(cap).toBeTruthy();
    expect(cap!.status).toBe("PROMOTED");
    expect(cap!.owner_agent).toBe("programmer");
  });

  it("summary declares zero_llm=true and ledger=B", () => {
    const s = summarizeCapabilities();
    expect(s.zero_llm).toBe(true);
    expect(s.ledger).toBe("B");
    expect(s.auto_selectable_count).toBeGreaterThan(0);
    expect(s.trustable_count).toBeGreaterThanOrEqual(s.auto_selectable_count);
  });
});

describe("capability-registry · anti-manufacturing invariants", () => {
  beforeEach(() => _resetCapabilityRegistryForTests());

  it("refuses to register PROMOTED capability with zero evidence", () => {
    expect(() => registerCapability({
      name: "fake-promoted", category: "code", description: "attempt",
      status: "PROMOTED",
      owner_agent: null, supporting_agents: [], implementation_paths: [],
      dependencies: [], inputs: [], outputs: [],
      compatible_frameworks: [], device_support: { desktop: true, tablet: true, mobile: true, pwa: false },
      verification_method: "not_verified",
      evidence_refs: [],
      failure_patterns: [], quality_tier: "CORE", license_constraints: [],
      version: "1", last_verified_iso: null, proposed_by: null, promoted_at_iso: null, supersedes: null,
    })).toThrow(/evidence_ref/);
  });

  it("refuses to register VERIFIED capability with zero evidence", () => {
    expect(() => registerCapability({
      name: "fake-verified", category: "code", description: "attempt",
      status: "VERIFIED",
      owner_agent: null, supporting_agents: [], implementation_paths: [],
      dependencies: [], inputs: [], outputs: [],
      compatible_frameworks: [], device_support: { desktop: true, tablet: true, mobile: true, pwa: false },
      verification_method: "not_verified",
      evidence_refs: [],
      failure_patterns: [], quality_tier: "CORE", license_constraints: [],
      version: "1", last_verified_iso: null, proposed_by: null, promoted_at_iso: null, supersedes: null,
    })).toThrow(/evidence_ref/);
  });

  it("refuses to register PROPOSED capability without proposed_by", () => {
    expect(() => registerCapability({
      name: "orphan-proposal", category: "code", description: "attempt",
      status: "PROPOSED",
      owner_agent: null, supporting_agents: [], implementation_paths: [],
      dependencies: [], inputs: [], outputs: [],
      compatible_frameworks: [], device_support: { desktop: true, tablet: true, mobile: true, pwa: false },
      verification_method: "not_verified",
      evidence_refs: [],
      failure_patterns: [], quality_tier: "EXPERIMENTAL", license_constraints: [],
      version: "1", last_verified_iso: null, proposed_by: null, promoted_at_iso: null, supersedes: null,
    })).toThrow(/proposed_by/);
  });

  it("allows PROPOSED capability with proposed_by declared and zero evidence", () => {
    const rec = registerCapability({
      name: "honest-proposal", category: "code", description: "hypothesised",
      status: "PROPOSED",
      owner_agent: null, supporting_agents: [], implementation_paths: [],
      dependencies: [], inputs: [], outputs: [],
      compatible_frameworks: [], device_support: { desktop: true, tablet: true, mobile: true, pwa: false },
      verification_method: "not_verified",
      evidence_refs: [],
      failure_patterns: [], quality_tier: "EXPERIMENTAL", license_constraints: [],
      version: "0.1", last_verified_iso: null, proposed_by: "ui-research", promoted_at_iso: null, supersedes: null,
    });
    expect(rec.status).toBe("PROPOSED");
  });

  it("promoteCapability refuses promotion without new evidence", () => {
    const rec = registerCapability({
      name: "candidate", category: "code", description: "proposal",
      status: "PROPOSED",
      owner_agent: null, supporting_agents: [], implementation_paths: [],
      dependencies: [], inputs: [], outputs: [],
      compatible_frameworks: [], device_support: { desktop: true, tablet: true, mobile: true, pwa: false },
      verification_method: "not_verified",
      evidence_refs: [],
      failure_patterns: [], quality_tier: "EXPERIMENTAL", license_constraints: [],
      version: "0.1", last_verified_iso: null, proposed_by: "ui-research", promoted_at_iso: null, supersedes: null,
    });
    expect(() => promoteCapability({ capability_id: rec.capability_id, new_status: "VERIFIED", new_evidence: [] })).toThrow(/evidence/);
  });

  it("promoteCapability accepts promotion when new evidence is provided", () => {
    const rec = registerCapability({
      name: "candidate2", category: "code", description: "proposal",
      status: "PROPOSED",
      owner_agent: null, supporting_agents: [], implementation_paths: [],
      dependencies: [], inputs: [], outputs: [],
      compatible_frameworks: [], device_support: { desktop: true, tablet: true, mobile: true, pwa: false },
      verification_method: "not_verified",
      evidence_refs: [],
      failure_patterns: [], quality_tier: "EXPERIMENTAL", license_constraints: [],
      version: "0.1", last_verified_iso: null, proposed_by: "ui-research", promoted_at_iso: null, supersedes: null,
    });
    const promoted = promoteCapability({
      capability_id: rec.capability_id,
      new_status: "VERIFIED",
      new_evidence: [{ kind: "test_file", path: "src/lib/x.test.ts", hash: null, observed_at_iso: new Date().toISOString(), note: "tests pass" }],
    });
    expect(promoted.status).toBe("VERIFIED");
    expect(promoted.evidence_refs.length).toBeGreaterThan(0);
    expect(promoted.last_verified_iso).toBeTruthy();
  });

  it("deprecateCapability marks as DEPRECATED or SUPERSEDED and preserves record", () => {
    _resetCapabilityRegistryForTests();
    seedCoreCapabilities();
    const cap = listCapabilities()[0];
    const deprecated = deprecateCapability({ capability_id: cap.capability_id, reason: "test" });
    expect(["DEPRECATED", "SUPERSEDED"]).toContain(deprecated.status);
    expect(getCapability(cap.capability_id)!.status).toBe(deprecated.status);
  });
});
