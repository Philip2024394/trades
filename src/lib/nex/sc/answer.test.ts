// SC answer router — classifier + reply formatters.

import { describe, it, expect, vi } from "vitest";

// Mock the alternatives fetcher so the answer router test is
// deterministic without a DB.
vi.mock("./alternatives", () => ({
  findAlternatives: vi.fn(async ({ query }: { query: string }) => ({
    query,
    alternatives: [
      { label: "Alt product A", reason: "Similar spec", source_url: null, evidence: { source: "t", tables: [], computed_at: "x" } }
    ],
    note: "1 alternative on file.",
    evidence: { source: "t", tables: [], computed_at: "x" }
  }))
}));

import { answerSC, classifySCQuestion } from "./answer";
import type { SupplyChainSnapshot } from "./types";

const ev = { source: "t", tables: [], computed_at: "x" };

function snap(overrides: Partial<SupplyChainSnapshot> = {}): SupplyChainSnapshot {
  return {
    computed_at:   "2026-07-23T00:00:00Z",
    merchant_slug: "phil-plumbing",
    shopping_list: {
      window_days: 14, jobs_count: 3, total_pence: 45_000,
      lines: [
        { key: "sku:PB2412", sku: "PB2412", label: "Plasterboard 2400×1200", unit: "board", qty_needed: 24, est_cost_pence: 20_400, jobs: [{ job_id: "j1", title: "Smith kitchen", scheduled_start_date: "2026-07-25", qty: 12 }, { job_id: "j2", title: "Jones bathroom", scheduled_start_date: "2026-07-28", qty: 12 }], evidence: ev },
        { key: "sku:BAG25", sku: "BAG25", label: "Finish plaster 25kg", unit: "bag", qty_needed: 12, est_cost_pence: 13_800, jobs: [{ job_id: "j1", title: "Smith kitchen", scheduled_start_date: "2026-07-25", qty: 6 }, { job_id: "j2", title: "Jones bathroom", scheduled_start_date: "2026-07-28", qty: 6 }], evidence: ev }
      ],
      warnings: [], evidence: ev
    },
    waste: {
      window_days: 90, total_variance_pence: 30_000, average_variance_pct: 15.5,
      projects: [
        { project_id: "p1", project_title: "Loft conversion", estimated_materials_pence: 100_000, actual_materials_pence: 120_000, variance_pence: 20_000, variance_pct: 20, evidence: ev },
        { project_id: "p2", project_title: "Kitchen refit",   estimated_materials_pence: 50_000,  actual_materials_pence: 60_000,  variance_pence: 10_000, variance_pct: 20, evidence: ev }
      ],
      warnings: [], evidence: ev
    },
    suppliers: {
      window_days: 180,
      suppliers: [
        { supplier_key: "Jewson", spend_pence: 120_000, cost_count: 8, latest_cost_at: "2026-07-01", paid_on_time_pct: 87.5, latest_prices: [], evidence: ev },
        { supplier_key: "Travis", spend_pence: 40_000,  cost_count: 3, latest_cost_at: "2026-06-15", paid_on_time_pct: null, latest_prices: [], evidence: ev }
      ],
      warnings: [], evidence: ev
    },
    unavailable: ["Live stock — no inventory table yet."],
    errors:      [],
    ...overrides
  };
}

describe("classifySCQuestion", () => {
  it("routes 'what materials do I need next week?'", () => {
    expect(classifySCQuestion("what materials do I need next week?").kind).toBe("shopping_list");
    expect(classifySCQuestion("materials for upcoming jobs").kind).toBe("shopping_list");
    expect(classifySCQuestion("what's on the shopping list").kind).toBe("shopping_list");
  });
  it("routes 'compare suppliers'", () => {
    expect(classifySCQuestion("compare suppliers").kind).toBe("compare_suppliers");
    expect(classifySCQuestion("who is my top supplier").kind).toBe("compare_suppliers");
  });
  it("routes 'where am I wasting materials?'", () => {
    expect(classifySCQuestion("where am I wasting materials?").kind).toBe("waste");
    expect(classifySCQuestion("show me my materials waste").kind).toBe("waste");
  });
  it("routes alternatives with product name", () => {
    const q = classifySCQuestion("alternatives for plasterboard");
    expect(q.kind).toBe("alternatives");
    if (q.kind === "alternatives") expect(q.query).toBe("plasterboard");
    const q2 = classifySCQuestion("find an alternative for PVA primer");
    expect(q2.kind).toBe("alternatives");
    // Classifier operates on lowercase — the extracted query is lower-cased too.
    if (q2.kind === "alternatives") expect(q2.query.toLowerCase()).toContain("pva");
  });
  it("returns 'none' for unrelated text", () => {
    expect(classifySCQuestion("hello there").kind).toBe("none");
  });
});

describe("answerSC", () => {
  it("shopping_list includes job count + line breakdown", async () => {
    const out = await answerSC({ kind: "shopping_list" }, snap());
    expect(out).toContain("3 jobs");
    expect(out).toContain("Plasterboard 2400×1200");
    expect(out).toContain("24 board");
    expect(out).toContain("across 2 jobs");
    expect(out).toContain("£450");   // total
  });

  it("shopping_list shows warnings when list is empty", async () => {
    const s = snap();
    s.shopping_list.lines = [];
    s.shopping_list.jobs_count = 0;
    s.shopping_list.warnings = ["No jobs scheduled in the next 14 days."];
    const out = await answerSC({ kind: "shopping_list" }, s);
    expect(out).toContain("No jobs scheduled");
  });

  it("compare_suppliers ranks by spend + shows reliability", async () => {
    const out = await answerSC({ kind: "compare_suppliers" }, snap());
    expect(out).toContain("Jewson");
    expect(out).toContain("£1,200");
    expect(out).toContain("87.5% paid on time");
    expect(out).toContain("Travis");
    expect(out).toContain("reliability not enough history");
  });

  it("waste ranks worst offenders + shows over-by amount", async () => {
    const out = await answerSC({ kind: "waste" }, snap());
    expect(out).toContain("Loft conversion");
    expect(out).toContain("over by £200");
    expect(out).toContain("Average variance: 15.5%");
  });

  it("waste with no projects returns friendly message", async () => {
    const s = snap();
    s.waste.projects = [];
    const out = await answerSC({ kind: "waste" }, s);
    expect(out).toContain("No projects");
  });

  it("alternatives uses the knowledge engine result", async () => {
    const out = await answerSC({ kind: "alternatives", query: "plasterboard" }, snap());
    expect(out).toContain("Alt product A");
    expect(out).toContain("Similar spec");
  });

  it("unavailable enumerates the missing sources honestly", async () => {
    const out = await answerSC({ kind: "unavailable" }, snap());
    expect(out).toContain("Live stock");
    expect(out).toContain("no source");
  });
});
