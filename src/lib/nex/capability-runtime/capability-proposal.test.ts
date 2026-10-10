// src/lib/nex/capability-runtime/capability-proposal.test.ts
//
// Stage 11 acceptance · inert capability proposal contract.
// The most important tests here are the REFUSAL tests — every reason a
// proposal can fail audit MUST be exercised.
// The second-most-important test is the NO-OPERATIONAL-EFFECT test:
// proposals cannot make anything operational.

import { describe, it, expect } from "vitest";
import { KNOWN_CAPABILITIES } from "./contract";
import {
  auditProposal,
  blockingVerdicts,
  isPromotable,
  PROTECTED_PATH_PREFIXES,
  EXISTING_IMPLEMENTING_MODULES,
  type CapabilityProposal,
} from "./capability-proposal";

const iso = "2026-09-23T10:00:00.000Z";

function makeProposal(overrides: Partial<CapabilityProposal> = {}): CapabilityProposal {
  return {
    proposal_id: "prop-001",
    proposed_by: "nex1",
    authored_at: iso,
    rationale: "extend NEX with a new deterministic capability that composes existing seams",
    proposed_definition: {
      proposed_name: "compose_agent_health_dashboard",
      description: "Compose per-agent health cards from AgentProfile + LoggedFact",
      implementing_module: "src/lib/nex/capability-runtime/build-lane/agent-health-dashboard.ts",
      scope_keys: ["programme_id"],
      example_grant_scope: { programme_id: "scaffolding" },
      domain: "coordination",
    },
    required_execution_level: "E2_TESTED_MUTATION",
    reversibility: "reversible",
    build_lane_evidence: {
      test_files: [
        "src/lib/nex/capability-runtime/build-lane/agent-health-dashboard.test.ts",
      ],
      typecheck_status: "passing",
      regression_status: "green",
      stage_attributable_regressions: 0,
    },
    status: "drafted",
    ...overrides,
  };
}

describe("auditProposal · acceptable path", () => {
  it("returns [acceptable] when the proposal is clean", () => {
    const verdicts = auditProposal(makeProposal(), { now: iso });
    expect(verdicts.length).toBe(1);
    expect(verdicts[0].verdict).toBe("acceptable");
    expect(verdicts[0].proposal_id).toBe("prop-001");
    expect(verdicts[0].reason).toContain("no automatic refusal");
    expect(verdicts[0].recorded_at).toBe(iso);
  });

  it("acceptable verdict still references Founder governance gate (never claims final authority)", () => {
    const verdicts = auditProposal(makeProposal(), { now: iso });
    expect(verdicts[0].reason).toMatch(/Founder|governance/i);
  });
});

describe("auditProposal · refusal branches (§19 correct-refusal)", () => {
  it("refuses duplicate capability name", () => {
    const dup = makeProposal({
      proposed_definition: {
        ...makeProposal().proposed_definition,
        proposed_name: KNOWN_CAPABILITIES[0],
      },
    });
    const v = auditProposal(dup, { now: iso });
    expect(v.some((x) => x.verdict === "duplicates_existing_capability_name")).toBe(true);
  });

  it("refuses duplicate implementing_module", () => {
    const dup = makeProposal({
      proposed_definition: {
        ...makeProposal().proposed_definition,
        implementing_module: EXISTING_IMPLEMENTING_MODULES[0],
      },
    });
    const v = auditProposal(dup, { now: iso });
    expect(v.some((x) => x.verdict === "duplicates_existing_implementing_module")).toBe(true);
  });

  it("refuses protected-path modification for every protected prefix", () => {
    for (const prefix of PROTECTED_PATH_PREFIXES) {
      // Build a path that starts with the prefix but is not one of the
      // EXISTING_IMPLEMENTING_MODULES · so we hit protected_path_modification
      // rather than duplicates_existing_implementing_module.
      const modulePath = prefix.endsWith("/") || prefix.endsWith(".json")
        ? `${prefix}stage11-test-only-fake-path.ts`
        : `${prefix}-stage11-test-only-fake.mts`;
      const p = makeProposal({
        proposed_definition: {
          ...makeProposal().proposed_definition,
          implementing_module: modulePath,
        },
      });
      const v = auditProposal(p, { now: iso });
      expect(
        v.some((x) => x.verdict === "protected_path_modification"),
        `expected protected_path_modification for ${modulePath}`,
      ).toBe(true);
    }
  });

  it("refuses when no test files declared (insufficient_evidence)", () => {
    const p = makeProposal({
      build_lane_evidence: {
        test_files: [],
        typecheck_status: "passing",
        regression_status: "green",
        stage_attributable_regressions: 0,
      },
    });
    const v = auditProposal(p, { now: iso });
    expect(v.some((x) => x.verdict === "insufficient_evidence")).toBe(true);
  });

  it("refuses when typecheck is failing (failing_tests_or_typecheck)", () => {
    const p = makeProposal({
      build_lane_evidence: {
        test_files: ["some.test.ts"],
        typecheck_status: "failing",
        regression_status: "green",
        stage_attributable_regressions: 0,
      },
    });
    const v = auditProposal(p, { now: iso });
    expect(v.some((x) => x.verdict === "failing_tests_or_typecheck")).toBe(true);
  });

  it("refuses when regression_status is regressions_present", () => {
    const p = makeProposal({
      build_lane_evidence: {
        test_files: ["some.test.ts"],
        typecheck_status: "passing",
        regression_status: "regressions_present",
        stage_attributable_regressions: 0,
      },
    });
    const v = auditProposal(p, { now: iso });
    expect(v.some((x) => x.verdict === "failing_tests_or_typecheck")).toBe(true);
  });

  it("refuses when stage_attributable_regressions > 0", () => {
    const p = makeProposal({
      build_lane_evidence: {
        test_files: ["some.test.ts"],
        typecheck_status: "passing",
        regression_status: "green",
        stage_attributable_regressions: 1,
      },
    });
    const v = auditProposal(p, { now: iso });
    expect(v.some((x) => x.verdict === "failing_tests_or_typecheck")).toBe(true);
  });

  it("refuses when required_execution_level is E5 (irreversible)", () => {
    const p = makeProposal({ required_execution_level: "E5_DESTRUCTIVE_IRREVERSIBLE" });
    const v = auditProposal(p, { now: iso });
    expect(v.some((x) => x.verdict === "unbounded_execution_level_without_founder")).toBe(true);
  });

  it("refuses malformed non-object input", () => {
    for (const bad of [null, undefined, "string", 42, [], true]) {
      const v = auditProposal(bad, { now: iso });
      expect(v.length).toBe(1);
      expect(v[0].verdict).toBe("malformed_proposal");
    }
  });

  it("refuses proposal missing required fields", () => {
    const bad = { proposal_id: "", authored_at: iso };
    const v = auditProposal(bad as unknown, { now: iso });
    expect(v[0].verdict).toBe("malformed_proposal");
  });

  it("emits multiple refusal verdicts when multiple things are wrong", () => {
    // Pick an implementing_module that is BOTH duplicate (in EXISTING_IMPLEMENTING_MODULES)
    // AND under a protected path prefix — verifies both verdicts co-fire.
    const bad = makeProposal({
      proposed_definition: {
        ...makeProposal().proposed_definition,
        proposed_name: KNOWN_CAPABILITIES[0],                          // dup name
        implementing_module: "src/lib/nex/aof/lifecycle.ts",           // dup module AND protected path
      },
      required_execution_level: "E5_DESTRUCTIVE_IRREVERSIBLE",  // E5
      build_lane_evidence: {
        test_files: [],   // no evidence
        typecheck_status: "failing",
        regression_status: "regressions_present",
        stage_attributable_regressions: 3,
      },
    });
    const v = auditProposal(bad, { now: iso });
    const kinds = new Set(v.map((x) => x.verdict));
    expect(kinds.has("duplicates_existing_capability_name")).toBe(true);
    expect(kinds.has("duplicates_existing_implementing_module")).toBe(true);
    expect(kinds.has("protected_path_modification")).toBe(true);
    expect(kinds.has("insufficient_evidence")).toBe(true);
    expect(kinds.has("failing_tests_or_typecheck")).toBe(true);
    expect(kinds.has("unbounded_execution_level_without_founder")).toBe(true);
    expect(kinds.has("acceptable")).toBe(false);
  });
});

describe("isPromotable + blockingVerdicts", () => {
  it("isPromotable true when all verdicts acceptable", () => {
    const v = auditProposal(makeProposal(), { now: iso });
    expect(isPromotable(v)).toBe(true);
    expect(blockingVerdicts(v).length).toBe(0);
  });

  it("isPromotable false when any verdict is non-acceptable", () => {
    const p = makeProposal({ required_execution_level: "E5_DESTRUCTIVE_IRREVERSIBLE" });
    const v = auditProposal(p, { now: iso });
    expect(isPromotable(v)).toBe(false);
    expect(blockingVerdicts(v).length).toBeGreaterThan(0);
  });

  it("isPromotable false for empty verdict array (must audit first)", () => {
    expect(isPromotable([])).toBe(false);
  });
});

describe("Stage 11 · anti-operational-effect surface (the critical guardrail)", () => {
  it("module exports NO register/grant/promote/activate/execute/enable FUNCTIONS", async () => {
    const mod: Record<string, unknown> = await import("./capability-proposal");
    for (const key of Object.keys(mod)) {
      if (typeof mod[key] !== "function") continue;
      expect(key.toLowerCase()).not.toMatch(
        /^(register|grant|revoke|activate|deactivate|promote|execute|enable|disable|spawn|dispatch|write|persist|store|save|insert|update|delete|sign)/,
      );
    }
  });

  it("module source imports NO authoritative writer / registry / promoter", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(process.cwd(), "src/lib/nex/capability-runtime/capability-proposal.ts"),
      "utf8",
    );
    // Absolutely not · these would give proposals operational side effects
    expect(src).not.toMatch(/from ["'].*aof\/capability["']/);
    expect(src).not.toMatch(/from ["'].*aof\/agent-registry["']/);
    expect(src).not.toMatch(/from ["'].*aof\/lifecycle["']/);
    expect(src).not.toMatch(/from ["'].*aof\/adapters\/registry["']/);
    expect(src).not.toMatch(/from ["'].*harvest\/queue["']/);
    expect(src).not.toMatch(/from ["'].*harvest\/production-boot["']/);
    expect(src).not.toMatch(/from ["'].*nex1-builder/);
    expect(src).not.toMatch(/from ["'].*nex-security\//);
    // No SQL writes
    expect(src).not.toMatch(/\bINSERT\b|\bUPDATE\b|\bDELETE\b/);
  });

  it("audit is a pure function · same input → same verdicts", () => {
    const p = makeProposal();
    const v1 = auditProposal(p, { now: iso });
    const v2 = auditProposal(p, { now: iso });
    expect(JSON.stringify(v1)).toBe(JSON.stringify(v2));
  });

  it("PROTECTED_PATH_PREFIXES covers all proven zones", () => {
    // Presence checks · guard against silent removal
    const joined = PROTECTED_PATH_PREFIXES.join(",");
    expect(joined).toContain("src/lib/nex/aof/");
    expect(joined).toContain("src/lib/nex/harvest/");
    expect(joined).toContain("src/lib/nex/discovery-world/");
    expect(joined).toContain("scripts/nex-verified-discovery-engine");
    expect(joined).toContain("scripts/nex-worldwide-discovery-engine");
    expect(joined).toContain("db/migrations/");
    expect(joined).toContain("data/nex-page-fetcher-allowlist.json");
  });

  it("EXISTING_IMPLEMENTING_MODULES matches Stage 2 known capability count (12)", () => {
    expect(EXISTING_IMPLEMENTING_MODULES.length).toBe(12);
  });
});
