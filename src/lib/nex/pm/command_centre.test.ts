// Command centre composer — engines mocked, section assembly verified.

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from() {
      const b = {
        select: () => b, eq: () => b, in: () => b, neq: () => b,
        gte: () => b, lte: () => b, order: () => b, limit: () => b,
        not: () => b, contains: () => b, ilike: () => b, lt: () => b,
        maybeSingle: async () => ({ data: { id: "listing-1" } })
      };
      return b;
    }
  }
}));

vi.mock("../md", () => ({
  buildMDBriefing: vi.fn(async () => ({
    ok: true, briefing: {
      computed_at: "x", merchant_slug: "phil",
      health: { score: 82, band: "healthy", headline: "Business Health: 82%. Healthy.", contributions: [] },
      priorities: [
        { key: "p1", source: "md_cashflow", severity: "warning", headline: "£800 overdue.", evidence: e() },
        { key: "p2", source: "bi",          severity: "info",    headline: "Views up 22%.", evidence: e() }
      ],
      recommendations: [
        { key: "r1", action: "Chase overdue today", reason: "£800 owed >30 days", urgency: "today", source: "md_cashflow", evidence: e() }
      ],
      cashflow:  { currency: "GBP", computed_at: "x", buckets: [], horizon_pence: 0, outstanding_now_pence: 0, overdue_now_pence: 0, pipeline_weighted_pence: 0, warnings: [], evidence: e() },
      profit:    { computed_at: "x", jobs: [], totals: { quoted_pence: 0, planned_profit_pence: 0, weighted_margin_pct: 0 }, low_margin_jobs: [], target_margin_pct: 20, warnings: [], evidence: e() },
      workforce: { computed_at: "x", active_projects_count: 0, hours_last_30d: 0, team_size_current: 0, utilisation_note: "", bookings_next_14d: 0, warnings: [], evidence: e() },
      suppliers: { computed_at: "x", window_days: 90, suppliers: [], total_spend_pence: 0, evidence: e() },
      forecast:  { computed_at: "x", next_30d_revenue_pence: null, next_60d_revenue_pence: null, monthly_avg_pence: null, best_day_of_week: null, seasonality_notes: [], evidence: e() },
      errors: []
    }
  }))
}));

vi.mock("../bi", () => ({
  buildBusinessSnapshot: vi.fn(async () => ({ score: 78, band: "healthy", headline: "", computed_at: "x", errors: [], domains: [], observations: [] }))
}));

vi.mock("../fi", () => ({
  buildFinancialSnapshot: vi.fn(async () => ({
    ok: true, snapshot: {
      cashflow_ref: { outstanding_now_pence: 100_000, overdue_now_pence: 80_000, pipeline_weighted_pence: 0, next_30d_net_pence: -50_000, next_60d_net_pence: 0, next_90d_net_pence: 0 },
      profit_ref:   { quoted_pence: 100_000, planned_profit_pence: 15_000, weighted_margin_pct: 15, target_margin_pct: 20, low_margin_jobs_count: 2 }
    }
  }))
}));

vi.mock("../sc", () => ({
  buildSCSnapshot: vi.fn(async () => ({
    ok: true, snapshot: {
      shopping_list: { window_days: 14, jobs_count: 3, total_pence: 40_000, lines: [
        { key: "k1", sku: null, label: "Plasterboard 2400×1200", unit: "board", qty_needed: 12, est_cost_pence: 20_000, jobs: [], evidence: e() },
        { key: "k2", sku: null, label: "Finish plaster 25kg",     unit: "bag",   qty_needed: 6,  est_cost_pence: 10_000, jobs: [], evidence: e() }
      ], warnings: [], evidence: e() },
      waste:        { window_days: 90, projects: [], total_variance_pence: 0, average_variance_pct: null, warnings: [], evidence: e() },
      suppliers:    { window_days: 180, suppliers: [], warnings: [], evidence: e() },
      unavailable:  [], errors: []
    }
  }))
}));

vi.mock("../cx", () => ({
  findCustomersToContact: vi.fn(async () => [
    { contactId: "c1", displayName: "Mrs Smith", lifecycleStage: "active", lastActivityAt: null, note: "Quiet 75 days." }
  ])
}));

vi.mock("./overview", () => ({
  buildProjectsOverview: vi.fn(async () => ({
    computed_at: "x", merchant_slug: "phil",
    projects: [
      { project: { project_id: "p1", title: "Smith kitchen", status: "in-progress", started_at: null, completed_at: null, scheduled_end: null, progress_percent: null }, health_score: 45, band: "attention", observation_summary: "£800 overdue.", top_observations: [], evidence: e() }
    ],
    warnings: [], errors: []
  }))
}));

vi.mock("./delays", () => ({
  detectDelayedProjects: vi.fn(async () => [
    { project_id: "p1", title: "Smith kitchen", scheduled_end: "2026-08-15", forecast_end: "2026-09-01", days_behind: 17, reason: "slow progress", evidence: e() }
  ])
}));

function e() { return { source: "t", tables: [], computed_at: "x" }; }

import { buildCommandCentre, commandCentreToText } from "./command_centre";

describe("buildCommandCentre", () => {
  it("composes every section when data present", async () => {
    const res = await buildCommandCentre({ merchantSlug: "phil" });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error();
    const b = res.briefing;
    const headings = b.sections.map((s) => s.heading);
    expect(headings).toContain("Business priorities");
    expect(headings).toContain("Projects needing attention");
    expect(headings).toContain("Running behind");
    expect(headings).toContain("Money");
    expect(headings).toContain("Materials needed (next 14 days)");
    expect(headings).toContain("Customers to check in with");
    expect(headings).toContain("Do first");
  });

  it("headline uses MD health when present", async () => {
    const res = await buildCommandCentre({ merchantSlug: "phil" });
    if (!res.ok) throw new Error();
    expect(res.briefing.overall_headline).toContain("82%");
  });

  it("lists unavailable dimensions honestly", async () => {
    const res = await buildCommandCentre({ merchantSlug: "phil" });
    if (!res.ok) throw new Error();
    expect(res.briefing.unavailable.join(" ")).toContain("Weather");
    expect(res.briefing.unavailable.join(" ")).toContain("Safety");
  });

  it("commandCentreToText renders headline + sections in order", async () => {
    const res = await buildCommandCentre({ merchantSlug: "phil" });
    if (!res.ok) throw new Error();
    const txt = commandCentreToText(res.briefing);
    expect(txt).toContain("Business Health: 82%");
    expect(txt.indexOf("Business priorities:")).toBeLessThan(txt.indexOf("Do first:"));
  });
});
