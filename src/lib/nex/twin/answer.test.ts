// Twin answer router — classifier + dispatch (scenarios mocked).

import { describe, it, expect, vi } from "vitest";

vi.mock("./simulate", () => ({
  runSimulation: vi.fn(async ({ scenario, parameters }: { scenario: string; parameters: Record<string, unknown> }) => ({
    computed_at: "x", merchant_slug: "phil", errors: [],
    results: [{
      kind: scenario, headline: `simulated ${scenario} with ${JSON.stringify(parameters)}`,
      parameters, assumptions: [], deltas: [],
      verdict: "positive" as const, reason: "", disclaimer: "no persist",
      evidence: { source: "t", tables: [], computed_at: "x" }
    }],
    speak: `SIMULATED ${scenario}`
  })),
  formatSimulation: () => ""
}));

import { answerTwin, classifyTwinQuestion } from "./answer";

describe("classifyTwinQuestion", () => {
  it("routes fuel_increase", () => {
    const q = classifyTwinQuestion("if fuel increases by 20%");
    expect(q.kind).toBe("simulate");
    if (q.kind === "simulate") { expect(q.scenario).toBe("fuel_increase"); expect(q.parameters.pct).toBe(20); }
  });

  it("routes price_rise", () => {
    const q = classifyTwinQuestion("if I raise my prices by 5%");
    expect(q.kind).toBe("simulate");
    if (q.kind === "simulate") { expect(q.scenario).toBe("price_rise"); expect(q.parameters.pct).toBe(5); }
  });

  it("routes extra_hire with trade capture", () => {
    const q = classifyTwinQuestion("if I hire another carpenter");
    expect(q.kind).toBe("simulate");
    if (q.kind === "simulate") { expect(q.scenario).toBe("extra_hire"); expect(q.parameters.trade).toBe("carpenter"); }
  });

  it("routes van_purchase with optional price", () => {
    const q1 = classifyTwinQuestion("can I buy a van");
    expect(q1.kind).toBe("simulate");
    if (q1.kind === "simulate") { expect(q1.scenario).toBe("van_purchase"); expect(q1.parameters.price_gbp).toBe(25_000); }
    const q2 = classifyTwinQuestion("if I buy a van for £12,000");
    if (q2.kind === "simulate") { expect(q2.parameters.price_gbp).toBe(12_000); }
  });

  it("routes advertising_boost", () => {
    const q = classifyTwinQuestion("if I spend £500 on ads");
    expect(q.kind).toBe("simulate");
    if (q.kind === "simulate") { expect(q.scenario).toBe("advertising_boost"); expect(q.parameters.monthly_gbp).toBe(500); }
  });

  it("routes list_scenarios", () => {
    expect(classifyTwinQuestion("list scenarios").kind).toBe("list_scenarios");
  });

  it("returns 'none' for unrelated text", () => {
    expect(classifyTwinQuestion("hello there").kind).toBe("none");
  });
});

describe("answerTwin", () => {
  it("simulate dispatches to runSimulation + returns its speak", async () => {
    const out = await answerTwin({
      question: { kind: "simulate", scenario: "price_rise", parameters: { pct: 5 } },
      merchantSlug: "phil"
    });
    expect(out).toContain("SIMULATED price_rise");
  });

  it("list_scenarios enumerates all 5 scenarios + reassures no-persistence", async () => {
    const out = await answerTwin({ question: { kind: "list_scenarios" }, merchantSlug: "phil" });
    expect(out).toContain("fuel increases");
    expect(out).toContain("raise my prices");
    expect(out).toContain("hire another");
    expect(out).toContain("buy a van");
    expect(out).toContain("on ads");
    expect(out.toLowerCase()).toContain("nothing changes");
  });

  it("none returns empty speak", async () => {
    const out = await answerTwin({ question: { kind: "none" }, merchantSlug: "phil" });
    expect(out).toBe("");
  });
});
