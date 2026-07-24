// Runner — topological order + parallel execution + error isolation.

import { describe, it, expect, vi } from "vitest";

// Mock every downstream engine so the runner test is deterministic.
vi.mock("../bi", () => ({
  answerBIQuestion: () => "bi ok",
  buildBusinessSnapshot: async () => ({ score: 0, band: "steady", headline: "", computed_at: "x", errors: [], domains: [], observations: [] }),
  classifyBIQuestion: () => ({ kind: "social" })
}));
vi.mock("../fi", () => ({
  answerFinancial: () => "fi ok",
  buildFinancialSnapshot: async () => ({ ok: true, snapshot: { health: { score: 78 }, cashflow_ref: {}, profit_ref: {}, suppliers_ref: {}, revenue: {}, expenses: {}, vat: {} } }),
  classifyFinancialQuestion: () => ({ kind: "overview" })
}));
vi.mock("../mp", () => ({
  answerMP: async () => ({ speak: "mp ok", data: { results: [{}, {}, {}] } }),
  classifyMPQuestion: () => ({ kind: "find_material", ask: "" })
}));
vi.mock("../net", () => ({ answerNetwork: async () => "net ok" }));
vi.mock("../xp", () => ({
  answerXP: async () => ({ speak: "xp ok" }),
  classifyXPQuestion: () => ({ kind: "none" })
}));
vi.mock("../est", () => ({
  buildEstimate: async () => ({ ok: true, estimate: { trade: "plastering", trade_label: "Plastering", scope: "42 m² skim", total_pence: 100_000, net_pence: 80_000, duration_days: 1.1, materials_pence: 20_000, labour_pence: 60_000 } })
}));
vi.mock("../knowledge", () => ({
  retrieveKnowledge: async () => ([{ title: "Test entry" }, { title: "Another" }, { title: "Third" }])
}));

import { planForAsk } from "./planner";
import { runPlan } from "./runner";

describe("runPlan", () => {
  it("runs plan with parallel independent + sequential dependent steps", async () => {
    const plan = planForAsk("Nex, quote this extension");
    const res = await runPlan({ merchant_slug: "phil", plan });
    // All 4 agents contributed.
    const ids = new Set(res.contributions.map((c) => c.agent_id));
    expect(ids.has("estimating")).toBe(true);
    expect(ids.has("procurement")).toBe(true);
    expect(ids.has("finance")).toBe(true);
    expect(ids.has("customer")).toBe(true);
  });

  it("explanation surfaces every contributing agent name", async () => {
    const plan = planForAsk("Nex, quote this extension");
    const res = await runPlan({ merchant_slug: "phil", plan });
    expect(res.explanation).toContain("I checked:");
    expect(res.explanation).toContain("Estimating");
    expect(res.explanation).toContain("Procurement");
  });

  it("errors from one agent don't kill the plan", async () => {
    // Force one agent to fail by passing an empty plan step for an
    // unknown id.
    const brokenPlan = {
      ask: "test",
      reason: "test",
      steps: [
        { agent_id: "estimating" as const, focus_ask: "estimate 42m² plastering", depends_on: [] },
        // "not_a_real_agent" isn't in registry — should error but not throw
        { agent_id: "not_a_real_agent" as unknown as import("./types").AgentId, focus_ask: "", depends_on: [] }
      ]
    };
    const res = await runPlan({ merchant_slug: "phil", plan: brokenPlan });
    expect(res.errors.length).toBeGreaterThan(0);
    // Estimating still ran.
    expect(res.contributions.some((c) => c.agent_id === "estimating" && !c.error)).toBe(true);
  });

  it("empty plan → empty result", async () => {
    const plan = planForAsk("hello there");
    const res = await runPlan({ merchant_slug: "phil", plan });
    expect(res.contributions).toEqual([]);
    expect(res.speak).toBe("");
  });
});
