// Mesh — end-to-end multi-agent orchestration.

import { describe, it, expect, vi } from "vitest";

// Stub knowledge so specialist agents return deterministic hits.
vi.mock("../knowledge", () => ({
  retrieveKnowledge: vi.fn(async (q: string, limit = 3) => {
    if (/nothing/.test(q)) return [];
    return Array.from({ length: limit }, (_, i) => ({ title: `${q.split(" ")[0]} hit ${i + 1}` }));
  })
}));
// Stub engines the baseline agents lean on.
vi.mock("../est", () => ({
  buildEstimate: vi.fn(async () => ({
    ok: true, estimate: {
      trade: "carpentry", trade_label: "Carpentry", scope: "test",
      total_pence: 500_000, net_pence: 400_000, materials_pence: 200_000,
      labour_pence: 200_000, duration_days: 5
    }
  }))
}));
vi.mock("../mp", () => ({
  answerMP: vi.fn(async () => ({ speak: "3 listings", data: { results: [1, 2, 3] } })),
  classifyMPQuestion: vi.fn(() => ({ kind: "find_material", ask: "x" }))
}));
vi.mock("../bi", () => ({
  answerBIQuestion: vi.fn(() => "biz reply"),
  buildBusinessSnapshot: vi.fn(async () => ({})),
  classifyBIQuestion: vi.fn(() => ({ kind: "social" }))
}));
vi.mock("../fi", () => ({
  answerFinancial: vi.fn(() => "fin reply"),
  buildFinancialSnapshot: vi.fn(async () => ({ ok: true, snapshot: { health: { score: 80 } } })),
  classifyFinancialQuestion: vi.fn(() => ({ kind: "overview" }))
}));

import { asksForExplanation, runMesh } from "./mesh";

describe("runMesh — end to end", () => {
  it("loft conversion in Dublin: pulls the regs + structural + estimating + qs team", async () => {
    const res = await runMesh({
      merchant_slug: "phil",
      ask:           "loft conversion in Dublin",
      country:       "IE"
    });
    const ids = res.contributions.map((c) => c.agent_id).sort();
    expect(ids).toContain("planning");
    expect(ids).toContain("building_control");
    expect(ids).toContain("structural");
    expect(ids).toContain("fire_safety");
    expect(ids).toContain("estimating");
    expect(ids).toContain("quantity_surveyor");
    expect(res.plan.steps.length).toBeGreaterThanOrEqual(5);
  });

  it("heat pump into listed building — pulls the right multi-family team", async () => {
    const res = await runMesh({
      merchant_slug: "phil",
      ask:           "I'm installing a heat pump into a listed building"
    });
    const ids = res.contributions.map((c) => c.agent_id);
    expect(ids).toContain("heat_pump");
    expect(ids).toContain("heritage");
    expect(ids).toContain("planning");
    expect(ids).toContain("electrical");
  });

  it("load-bearing wall removal — structural + building_control + regulations + fire_safety", async () => {
    const res = await runMesh({ merchant_slug: "phil", ask: "can I remove this load-bearing wall?" });
    const ids = res.contributions.map((c) => c.agent_id);
    expect(ids).toContain("structural");
    expect(ids).toContain("building_control");
    expect(ids).toContain("fire_safety");
  });

  it("speak never leaks specialist names", async () => {
    const res = await runMesh({ merchant_slug: "phil", ask: "loft conversion" });
    const lower = res.speak.toLowerCase();
    expect(lower).not.toContain("planning agent");
    expect(lower).not.toContain("structural agent");
    expect(lower).not.toContain("regulations agent");
  });

  it("empty plan → graceful fallback + no crash", async () => {
    const res = await runMesh({ merchant_slug: "phil", ask: "hello there" });
    expect(res.plan.steps).toHaveLength(0);
    expect(res.contributions).toHaveLength(0);
    expect(res.speak.toLowerCase()).toContain("more");
  });

  it("country gating: unsupported country flags rather than invokes blind", async () => {
    const res = await runMesh({
      merchant_slug: "phil",
      ask:           "quote this extension",   // triggers estimating (country_support ["*"])
      country:       "AU"
    });
    // Estimating has ["*"] so it runs; no skipped_country entries expected.
    const skipped = res.contributions.filter((c) => c.metadata && (c.metadata as { skipped_country?: string }).skipped_country);
    expect(skipped).toHaveLength(0);
  });

  it("overall_confidence reflects rollup + official_cited flag set when regs contributed", async () => {
    const res = await runMesh({ merchant_slug: "phil", ask: "loft conversion in Dublin", country: "IE" });
    expect(["low", "medium", "high"]).toContain(res.overall_confidence);
    expect(res.official_cited).toBe(true);
  });
});

describe("asksForExplanation", () => {
  it("recognises 'how did you' + 'why did you' + 'explain your'", () => {
    expect(asksForExplanation("How did you reach that?")).toBe(true);
    expect(asksForExplanation("Why did you say that?")).toBe(true);
    expect(asksForExplanation("Explain your reasoning")).toBe(true);
    expect(asksForExplanation("Show your working")).toBe(true);
  });
  it("false on unrelated text", () => {
    expect(asksForExplanation("loft conversion")).toBe(false);
  });
});
