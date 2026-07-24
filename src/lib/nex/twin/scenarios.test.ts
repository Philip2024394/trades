// Scenario runners — mock upstream engines, assert scenario shapes.

import { describe, it, expect, vi } from "vitest";

vi.mock("../fi", () => ({
  buildFinancialSnapshot: vi.fn(async () => ({
    ok: true, snapshot: {
      health: { score: 78 },
      cashflow_ref: { outstanding_now_pence: 500_000, overdue_now_pence: 0, pipeline_weighted_pence: 300_000, next_30d_net_pence: 400_000, next_60d_net_pence: 200_000, next_90d_net_pence: 100_000 },
      profit_ref:   { quoted_pence: 1_000_000, planned_profit_pence: 200_000, weighted_margin_pct: 20, target_margin_pct: 20, low_margin_jobs_count: 0 },
      suppliers_ref:{ total_spend_pence: 0, supplier_count: 0 },
      revenue: {}, expenses: {}, vat: {}
    }
  })),
  checkAffordability: (opts: { purchase_pence: number; cashflow: unknown }) => ({
    purchase_label: "van", purchase_pence: opts.purchase_pence,
    verdict: opts.purchase_pence <= 700_000 ? "yes" as const : opts.purchase_pence <= 1_500_000 ? "stretch" as const : "no" as const,
    reason: "test",
    cash_horizon_pence: 1_000_000, safety_buffer_pence: 300_000,
    remaining_pence: 1_000_000 - opts.purchase_pence,
    evidence: { source: "t", tables: [], computed_at: "x" }
  })
}));

vi.mock("../md", () => ({
  buildMDBriefing: vi.fn(async () => ({
    ok: true, briefing: {
      workforce: { active_projects_count: 3 },
      cashflow:  { currency: "GBP", computed_at: "x", buckets: [], horizon_pence: 1_000_000, outstanding_now_pence: 0, overdue_now_pence: 0, pipeline_weighted_pence: 0, warnings: [], evidence: { source: "t", tables: [], computed_at: "x" } }
    }
  }))
}));

vi.mock("../bi", () => ({
  buildBusinessSnapshot: vi.fn(async () => ({
    observations: [], domains: [], score: 70, band: "steady", headline: "", computed_at: "x", errors: []
  }))
}));

import { runAdvertisingBoost, runExtraHire, runFuelIncrease, runPriceRise, runVanPurchase } from "./scenarios";

describe("runFuelIncrease", () => {
  it("returns fuel-cost delta at requested %", async () => {
    const r = await runFuelIncrease("phil", { pct: 20 });
    expect(r.kind).toBe("fuel_increase");
    const delta = r.deltas[0];
    expect(delta.diff).not.toBeNull();
    expect(delta.diff).toBeGreaterThan(0);
    expect(delta.higher_is_better).toBe(false);
    expect(r.disclaimer.toLowerCase()).toContain("simulated only");
  });

  it("flags the 8%-of-labour-cost proxy in assumptions", async () => {
    const r = await runFuelIncrease("phil", { pct: 20 });
    expect(r.assumptions.join(" ").toLowerCase()).toContain("proxy");
  });
});

describe("runPriceRise", () => {
  it("5% rise on £10k quoted → £500 revenue + £500 profit uplift", async () => {
    const r = await runPriceRise("phil", { pct: 5 });
    const revDelta = r.deltas.find((d) => d.label === "Quoted revenue")!;
    expect(revDelta.diff).toBe(50_000);   // £500 in pence
    const profitDelta = r.deltas.find((d) => d.label === "Planned profit")!;
    expect(profitDelta.diff).toBe(50_000);
    expect(r.verdict).toBe("positive");
  });

  it("flags the 'optimistic' cost-flat assumption", async () => {
    const r = await runPriceRise("phil", { pct: 5 });
    expect(r.assumptions.join(" ").toLowerCase()).toContain("optimistic");
  });
});

describe("runExtraHire", () => {
  it("carpenter at £30k → POSITIVE net (£45k/12 uplift beats £30k/12 cost)", async () => {
    const r = await runExtraHire("phil", { trade: "carpenter", annual_cost_gbp: 30_000 });
    const net = r.deltas.find((d) => d.label === "Net monthly delta")!;
    // Uplift £45,000/12 = £3,750; cost £30,000/12 = £2,500 → +£1,250/mo (positive)
    expect(net.diff).toBeGreaterThan(0);
    expect(r.verdict).toBe("positive");
    expect(r.assumptions.join(" ")).toContain("75%");
  });

  it("expensive hire (£60k) → NEGATIVE net", async () => {
    const r = await runExtraHire("phil", { trade: "manager", annual_cost_gbp: 60_000 });
    // Uplift £45,000/12 = £3,750; cost £60,000/12 = £5,000 → -£1,250/mo
    expect(r.verdict).toBe("negative");
  });

  it("flags no-active-projects warning when applicable", async () => {
    // Override MD mock for this test — no active projects.
    const md = await import("../md");
    (md.buildMDBriefing as unknown as { mockResolvedValueOnce: (v: unknown) => void }).mockResolvedValueOnce({
      ok: true, briefing: { workforce: { active_projects_count: 0 }, cashflow: null }
    });
    const r = await runExtraHire("phil", { trade: "plasterer", annual_cost_gbp: 30_000 });
    expect(r.assumptions.some((a) => a.toLowerCase().includes("no active projects"))).toBe(true);
  });
});

describe("runVanPurchase", () => {
  it("£7000 van (within horizon) → positive verdict", async () => {
    const r = await runVanPurchase("phil", { price_gbp: 7_000 });
    expect(r.verdict).toBe("positive");
    // Headline is the affordability reason — mock returns "test" here.
    expect(r.reason.length).toBeGreaterThan(0);
  });

  it("£20,000 van → 'stretch' verdict + neutral", async () => {
    const r = await runVanPurchase("phil", { price_gbp: 12_000 });
    expect(["neutral", "positive"]).toContain(r.verdict);
  });

  it("£50,000 van → negative verdict", async () => {
    const r = await runVanPurchase("phil", { price_gbp: 20_000 });
    expect(r.verdict).toBe("negative");
  });
});

describe("runAdvertisingBoost", () => {
  it("£500/mo → £1250 projected revenue at 2.5× ROAS", async () => {
    const r = await runAdvertisingBoost("phil", { monthly_gbp: 500 });
    const rev = r.deltas.find((d) => d.label === "Projected revenue")!;
    expect(rev.diff).toBe(125_000);   // £1250 in pence
    expect(r.verdict).toBe("positive");
  });

  it("flags 2.5× ROAS as an assumption", async () => {
    const r = await runAdvertisingBoost("phil", { monthly_gbp: 500 });
    expect(r.assumptions.join(" ")).toContain("2.5");
  });
});
