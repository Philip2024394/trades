import { describe, it, expect, beforeEach } from "vitest";
import {
  RULE_1_CAPABILITY_SELF_KNOWLEDGE,
  RULE_2_EVIDENCE_REQUIRED_FOR_PROMOTION,
  NEX_CAPABILITY_RULE_VERSION,
  assertRule1,
  assertRule2Registration,
  assertRule2Promotion,
  auditRuleCompliance,
  describeRules,
} from "./capability-rule";
import {
  registerCapability,
  promoteCapability,
  seedCoreCapabilities,
  _resetCapabilityRegistryForTests,
} from "./capability-registry";

describe("NEX Capability Rules · founder-frozen doctrine", () => {
  it("declares Rule 1 verbatim from founder mandate", () => {
    expect(RULE_1_CAPABILITY_SELF_KNOWLEDGE.id).toBe("RULE-1");
    expect(RULE_1_CAPABILITY_SELF_KNOWLEDGE.statement).toContain("NEX must know what NEX can do");
    expect(RULE_1_CAPABILITY_SELF_KNOWLEDGE.statement).toContain("what NEX cannot do");
    expect(RULE_1_CAPABILITY_SELF_KNOWLEDGE.statement).toContain("which agents can do it");
    expect(RULE_1_CAPABILITY_SELF_KNOWLEDGE.statement).toContain("what evidence proves it");
    expect(RULE_1_CAPABILITY_SELF_KNOWLEDGE.statement).toContain("what dependencies constrain it");
    expect(RULE_1_CAPABILITY_SELF_KNOWLEDGE.statement).toContain("how recently that capability was verified");
    expect(RULE_1_CAPABILITY_SELF_KNOWLEDGE.frozen).toBe(true);
    expect(RULE_1_CAPABILITY_SELF_KNOWLEDGE.required_answers.length).toBe(7);
  });

  it("declares Rule 2 verbatim from founder mandate", () => {
    expect(RULE_2_EVIDENCE_REQUIRED_FOR_PROMOTION.id).toBe("RULE-2");
    expect(RULE_2_EVIDENCE_REQUIRED_FOR_PROMOTION.statement).toContain("NEX may discover and propose capability evolution");
    expect(RULE_2_EVIDENCE_REQUIRED_FOR_PROMOTION.statement).toContain("only verified evidence can promote a capability");
    expect(RULE_2_EVIDENCE_REQUIRED_FOR_PROMOTION.frozen).toBe(true);
    expect(RULE_2_EVIDENCE_REQUIRED_FOR_PROMOTION.transitions.length).toBeGreaterThanOrEqual(6);
  });

  it("canonical version", () => {
    expect(NEX_CAPABILITY_RULE_VERSION).toBe("nex-capability-rule.v1.2026-09-19");
  });

  it("describeRules exposes both rules for agent consumption", () => {
    const r = describeRules();
    expect(r.rule_1.id).toBe("RULE-1");
    expect(r.rule_2.id).toBe("RULE-2");
    expect(r.version).toBe(NEX_CAPABILITY_RULE_VERSION);
  });
});

describe("Rule 1 · assertRule1 catches missing self-knowledge", () => {
  const baseValid = {
    name: "test", description: "desc",
    status: "VERIFIED" as const,
    owner_agent: null, supporting_agents: [],
    implementation_paths: ["src/x.ts"],
    evidence_refs: [{ kind: "source_file" as const, path: "src/x.ts", hash: null, observed_at_iso: new Date().toISOString(), note: "n" }],
    dependencies: [],
    last_verified_iso: new Date().toISOString(),
  };

  it("passes a fully-answered record", () => {
    const v = assertRule1(baseValid);
    expect(v.length).toBe(0);
  });

  it("catches missing name (Q1)", () => {
    const v = assertRule1({ ...baseValid, name: "" });
    expect(v.some((s) => s.includes("Q1: missing name"))).toBe(true);
  });

  it("catches missing description (Q1)", () => {
    const v = assertRule1({ ...baseValid, description: "" });
    expect(v.some((s) => s.includes("Q1: missing description"))).toBe(true);
  });

  it("requires supporting_agents to be an array (Q3)", () => {
    const v = assertRule1({ ...baseValid, supporting_agents: null as never });
    expect(v.some((s) => s.includes("Q3"))).toBe(true);
  });

  it("requires implementation_paths to be an array (Q4)", () => {
    const v = assertRule1({ ...baseValid, implementation_paths: null as never });
    expect(v.some((s) => s.includes("Q4"))).toBe(true);
  });

  it("requires evidence_refs to be an array (Q5)", () => {
    const v = assertRule1({ ...baseValid, evidence_refs: null as never });
    expect(v.some((s) => s.includes("Q5"))).toBe(true);
  });

  it("requires dependencies to be an array (Q6)", () => {
    const v = assertRule1({ ...baseValid, dependencies: null as never });
    expect(v.some((s) => s.includes("Q6"))).toBe(true);
  });
});

describe("Rule 2 · assertRule2Registration and assertRule2Promotion", () => {
  it("blocks VERIFIED registration with zero evidence", () => {
    const v = assertRule2Registration({ status: "VERIFIED", evidence_refs: [], last_verified_iso: null, proposed_by: null });
    expect(v.length).toBeGreaterThan(0);
    expect(v.some((s) => s.includes("evidence_ref"))).toBe(true);
    expect(v.some((s) => s.includes("last_verified_iso"))).toBe(true);
  });

  it("blocks PROMOTED registration with zero evidence", () => {
    const v = assertRule2Registration({ status: "PROMOTED", evidence_refs: [], last_verified_iso: null, proposed_by: null });
    expect(v.length).toBeGreaterThan(0);
  });

  it("blocks PROPOSED registration without proposed_by", () => {
    const v = assertRule2Registration({ status: "PROPOSED", evidence_refs: [], last_verified_iso: null, proposed_by: null });
    expect(v.some((s) => s.includes("proposed_by"))).toBe(true);
  });

  it("blocks promotion transition with zero new evidence", () => {
    const v = assertRule2Promotion({ new_status: "VERIFIED", new_evidence: [] });
    expect(v.length).toBeGreaterThan(0);
  });

  it("allows promotion transition when new evidence supplied", () => {
    const v = assertRule2Promotion({
      new_status: "PROMOTED",
      new_evidence: [{ kind: "test_file", path: "src/x.test.ts", hash: null, observed_at_iso: new Date().toISOString(), note: "tests" }],
    });
    expect(v.length).toBe(0);
  });
});

describe("auditRuleCompliance · scan the entire seeded registry", () => {
  beforeEach(() => {
    _resetCapabilityRegistryForTests();
    seedCoreCapabilities();
  });

  it("reports zero violations across all seeded capabilities", () => {
    const audit = auditRuleCompliance();
    if (!audit.all_compliant) {
      // eslint-disable-next-line no-console
      console.log("Rule violations:", JSON.stringify({
        rule1: audit.rule1_violations.slice(0, 5),
        rule2: audit.rule2_violations.slice(0, 5),
      }, null, 2));
    }
    expect(audit.rule1_violations.length).toBe(0);
    expect(audit.rule2_violations.length).toBe(0);
    expect(audit.all_compliant).toBe(true);
  });

  it("audit result declares zero_llm=true and ledger=B", () => {
    const audit = auditRuleCompliance();
    expect(audit.zero_llm).toBe(true);
    expect(audit.ledger).toBe("B");
    expect(audit.total_capabilities).toBeGreaterThanOrEqual(50);
  });
});

describe("registerCapability throws on Rule 1 + Rule 2 violations (write-time enforcement)", () => {
  beforeEach(() => _resetCapabilityRegistryForTests());

  it("throws on Rule 1 violation (empty name)", () => {
    expect(() => registerCapability({
      name: "", category: "code", description: "d",
      status: "PROPOSED",
      owner_agent: null, supporting_agents: [], implementation_paths: [],
      dependencies: [], inputs: [], outputs: [],
      compatible_frameworks: [], device_support: { desktop: true, tablet: false, mobile: false, pwa: false },
      verification_method: "not_verified",
      evidence_refs: [],
      failure_patterns: [], quality_tier: "EXPERIMENTAL", license_constraints: [],
      version: "0", last_verified_iso: null, proposed_by: "test", promoted_at_iso: null, supersedes: null,
    })).toThrow(/Rule 1/);
  });

  it("throws on Rule 2 violation (VERIFIED without evidence)", () => {
    expect(() => registerCapability({
      name: "manufactured", category: "code", description: "would sneak past",
      status: "VERIFIED",
      owner_agent: null, supporting_agents: [], implementation_paths: [],
      dependencies: [], inputs: [], outputs: [],
      compatible_frameworks: [], device_support: { desktop: true, tablet: false, mobile: false, pwa: false },
      verification_method: "not_verified",
      evidence_refs: [],
      failure_patterns: [], quality_tier: "CORE", license_constraints: [],
      version: "0", last_verified_iso: null, proposed_by: null, promoted_at_iso: null, supersedes: null,
    })).toThrow(/Rule 2/);
  });

  it("throws on Rule 2 promotion without new evidence", () => {
    const proposal = registerCapability({
      name: "candidate", category: "code", description: "proposal",
      status: "PROPOSED",
      owner_agent: null, supporting_agents: [], implementation_paths: [],
      dependencies: [], inputs: [], outputs: [],
      compatible_frameworks: [], device_support: { desktop: true, tablet: false, mobile: false, pwa: false },
      verification_method: "not_verified",
      evidence_refs: [],
      failure_patterns: [], quality_tier: "EXPERIMENTAL", license_constraints: [],
      version: "0.1", last_verified_iso: null, proposed_by: "ui-research", promoted_at_iso: null, supersedes: null,
    });
    expect(() => promoteCapability({ capability_id: proposal.capability_id, new_status: "VERIFIED", new_evidence: [] })).toThrow(/Rule 2/);
  });
});
