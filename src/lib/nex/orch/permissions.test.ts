// Permission audit + runtime check.

import { describe, it, expect } from "vitest";
import { AGENTS, _auditFindings } from "./registry";
import { REQUIRED_PERMISSIONS, auditRegistry, canAgentPerform } from "./permissions";

describe("REQUIRED_PERMISSIONS", () => {
  it("declares one entry per registered agent", () => {
    for (const a of AGENTS) {
      expect(REQUIRED_PERMISSIONS[a.id]).toBeDefined();
    }
  });
});

describe("auditRegistry", () => {
  it("live registry has no missing/excess permission drift", () => {
    const findings = _auditFindings();
    expect(findings).toEqual([]);
  });

  it("flags missing_permission when an agent under-declares", () => {
    const findings = auditRegistry([{
      id: "estimating", name: "Est", role: "", speciality: "estimating",
      category: "commercial", country_support: ["*"], expertise_keywords: ["x"],
      // required has read_projects/read_products/read_knowledge — missing all
      permissions: [],
      version: "test", tools: [], invoke: async () => ({ agent_id: "estimating", headline: "", speak: "", confidence: "low", evidence: { source: "t", tables: [], computed_at: "x" } })
    }]);
    expect(findings.some((f) => f.problem === "missing_permission" && f.detail === "read_projects")).toBe(true);
  });

  it("flags excess_permission when an agent over-declares", () => {
    const findings = auditRegistry([{
      id: "regulations", name: "Reg", role: "", speciality: "regulations",
      category: "regulations", country_support: ["*"], expertise_keywords: ["x"],
      // required has read_regulations + read_knowledge — extra read_costs is excess
      permissions: ["read_regulations", "read_knowledge", "read_costs"],
      version: "test", tools: [], invoke: async () => ({ agent_id: "regulations", headline: "", speak: "", confidence: "low", evidence: { source: "t", tables: [], computed_at: "x" } })
    }]);
    expect(findings.some((f) => f.problem === "excess_permission" && f.detail === "read_costs")).toBe(true);
  });
});

describe("canAgentPerform", () => {
  it("true when permission listed", () => {
    const est = AGENTS.find((a) => a.id === "estimating")!;
    expect(canAgentPerform(est, "read_projects")).toBe(true);
  });
  it("false when not listed", () => {
    const est = AGENTS.find((a) => a.id === "estimating")!;
    expect(canAgentPerform(est, "read_customers")).toBe(false);
  });
});
