// Catalog — registry audit + agent shape checks for the 30 specialists.

import { describe, it, expect, vi } from "vitest";

vi.mock("../knowledge", () => ({
  retrieveKnowledge: vi.fn(async (q: string, limit = 3) => {
    if (/nothing/.test(q)) return [];
    return Array.from({ length: limit }, (_, i) => ({ title: `${q} entry ${i + 1}` }));
  })
}));

import { SPECIALIST_AGENTS, SPECIALIST_SPECS, buildSpecialistAgent } from "./catalog";
import { REQUIRED_PERMISSIONS, auditRegistry } from "./permissions";
import { AGENTS, _auditFindings, agentsByCategory } from "./registry";

describe("catalog shape", () => {
  it("registers ≥30 specialists", () => {
    expect(SPECIALIST_AGENTS.length).toBeGreaterThanOrEqual(30);
    expect(SPECIALIST_SPECS.length).toBe(SPECIALIST_AGENTS.length);
  });

  it("every specialist has a REQUIRED_PERMISSIONS row", () => {
    for (const a of SPECIALIST_AGENTS) {
      expect(REQUIRED_PERMISSIONS[a.id]).toBeDefined();
    }
  });

  it("every specialist declares country_support + expertise_keywords + category", () => {
    for (const a of SPECIALIST_AGENTS) {
      expect(a.country_support.length).toBeGreaterThan(0);
      expect(a.expertise_keywords.length).toBeGreaterThan(0);
      expect(["regulations", "trades", "commercial", "business", "property", "ai"]).toContain(a.category);
    }
  });

  it("full registry passes permission audit (baseline 10 + 30 specialists)", () => {
    const findings = auditRegistry(AGENTS);
    expect(findings).toEqual([]);
    expect(_auditFindings()).toEqual([]);
  });

  it("agentsByCategory buckets every agent", () => {
    const grouped = agentsByCategory();
    const total = Object.values(grouped).reduce((s, arr) => s + arr.length, 0);
    expect(total).toBe(AGENTS.length);
    expect(grouped.regulations.length).toBeGreaterThan(0);
    expect(grouped.trades.length).toBeGreaterThan(0);
    expect(grouped.commercial.length).toBeGreaterThan(0);
    expect(grouped.business.length).toBeGreaterThan(0);
    expect(grouped.ai.length).toBeGreaterThan(0);
  });

  it("regulations family flags official=true (planning, building_control, fire_safety, structural, heritage, accessibility)", () => {
    const official = SPECIALIST_SPECS.filter((s) => s.category === "regulations");
    for (const s of official) expect(s.official).toBe(true);
  });
});

describe("default knowledge-backed invoker", () => {
  it("returns 3 hits when knowledge is present, medium confidence", async () => {
    const timber = SPECIALIST_AGENTS.find((a) => a.id === "timber")!;
    const r = await timber.invoke({ merchant_slug: "phil", focus_ask: "roof rafter c24 sizing", prior: [] });
    expect(r.confidence).toBe("medium");
    expect(r.speak).toContain("Timber Agent");
    expect(r.evidence.tables).toContain("hammerex_knowledge_entries");
  });

  it("returns low confidence + friendly fallback when knowledge base is empty", async () => {
    const heritage = SPECIALIST_AGENTS.find((a) => a.id === "heritage")!;
    const r = await heritage.invoke({ merchant_slug: "phil", focus_ask: "nothing on file", prior: [] });
    expect(r.confidence).toBe("low");
    expect(r.speak.toLowerCase()).toContain("nothing on file");
  });

  it("official specialists carry is_official=true", async () => {
    const structural = SPECIALIST_AGENTS.find((a) => a.id === "structural")!;
    const r = await structural.invoke({ merchant_slug: "phil", focus_ask: "load bearing wall removal", prior: [] });
    expect(r.is_official).toBe(true);
  });

  it("non-regulation specialists carry is_official=false", async () => {
    const timber = SPECIALIST_AGENTS.find((a) => a.id === "timber")!;
    const r = await timber.invoke({ merchant_slug: "phil", focus_ask: "cls timber", prior: [] });
    expect(r.is_official).toBe(false);
  });
});

describe("buildSpecialistAgent", () => {
  it("wires defaults when no custom invoke supplied", () => {
    const spec = {
      id: "translation" as const, name: "T", role: "R",
      speciality: "translation" as const, category: "ai" as const,
      permissions: ["read_knowledge" as const], tools: [],
      country_support: ["*" as const], expertise_keywords: ["kw"]
    };
    const a = buildSpecialistAgent(spec);
    expect(a.version).toBe("2026-07");
    expect(typeof a.invoke).toBe("function");
  });
});
