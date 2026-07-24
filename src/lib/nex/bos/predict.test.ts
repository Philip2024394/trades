// Predictive risk scoring — signal → risk mapping.

import { describe, it, expect } from "vitest";
import { predictRisks } from "./predict";
import type { FinancialSnapshot } from "../fi/types";
import type { ProjectsOverview, ProjectHealthRow } from "../pm/types";

const ev = { source: "t", tables: [], computed_at: "x" };

const row = (project_id: string, title: string, headline: string): ProjectHealthRow => ({
  project: { project_id, title, status: "in_progress", started_at: null, completed_at: null, scheduled_end: null, progress_percent: null },
  health_score: 50, band: "attention",
  observation_summary: headline,
  top_observations: [{ severity: "warning", headline }],
  evidence: ev
});

const overview = (rows: ProjectHealthRow[]): ProjectsOverview => ({
  computed_at: "x", merchant_slug: "phil", projects: rows, warnings: [], errors: []
});

const finance = (overrides: Partial<FinancialSnapshot["cashflow_ref"] & FinancialSnapshot["profit_ref"]>): FinancialSnapshot => ({
  computed_at: "x", merchant_slug: "phil", currency: "GBP",
  health: { score: 60, band: "steady", headline: "h", signals: { cash_flow: { score: null, note: "" }, profit: { score: null, note: "" }, payment_speed: { score: null, note: "" }, growth: { score: null, note: "" }, stability: { score: null, note: "" } } },
  revenue: { window_days: 90, total_pence: 0, by_customer: [], by_project: [], by_kind: [], evidence: ev },
  expenses: { window_days: 90, total_pence: 0, categories: [], untracked_note: "", evidence: ev },
  vat: { window_days: 90, vat_rate_pct: 20, vat_payable_pence: 0, vat_reclaimable_est_pence: 0, vat_net_pence: 0, disclaimer: "d", evidence: ev },
  cashflow_ref: {
    outstanding_now_pence: 0, overdue_now_pence: 0, pipeline_weighted_pence: 0,
    next_30d_net_pence: 0, next_60d_net_pence: 0, next_90d_net_pence: 0,
    ...overrides
  },
  profit_ref: {
    quoted_pence: 0, planned_profit_pence: 0, weighted_margin_pct: 20, target_margin_pct: 25,
    low_margin_jobs_count: 0,
    ...overrides
  },
  suppliers_ref: { total_spend_pence: 0, supplier_count: 0 },
  errors: []
});

describe("predictRisks", () => {
  it("empty input → no risks", () => {
    expect(predictRisks({})).toEqual([]);
  });

  it("schedule: 5 days behind → warning", () => {
    const risks = predictRisks({ projects_overview: overview([row("p1", "Smith kitchen", "5 days behind schedule")]) });
    const s = risks.find((r) => r.category === "schedule")!;
    expect(s.severity).toBe("warning");
    expect(s.headline).toContain("Smith kitchen");
    expect(s.probability_pct).toBeGreaterThan(50);
  });

  it("schedule: 8 days behind → critical", () => {
    const risks = predictRisks({ projects_overview: overview([row("p1", "Big loft", "8 days behind schedule")]) });
    expect(risks.find((r) => r.category === "schedule")!.severity).toBe("critical");
  });

  it("schedule: <3 days behind → no risk", () => {
    const risks = predictRisks({ projects_overview: overview([row("p1", "Small job", "1 day behind schedule")]) });
    expect(risks.filter((r) => r.category === "schedule")).toHaveLength(0);
  });

  it("profit: low_margin_jobs_count >= 3 → warning", () => {
    const risks = predictRisks({ finance: finance({ low_margin_jobs_count: 4 }) });
    const p = risks.find((r) => r.category === "profit")!;
    expect(p.severity).toBe("warning");
  });

  it("cash: overdue > 30d net → critical", () => {
    const risks = predictRisks({ finance: finance({ overdue_now_pence: 500_000, next_30d_net_pence: 200_000 }) });
    const c = risks.find((r) => r.category === "cash")!;
    expect(c.severity).toBe("critical");
    expect(c.impact_pence).toBe(500_000);
  });

  it("material: supply_warnings surface as material risks", () => {
    const risks = predictRisks({ supply_warnings: ["Kingspan delivery 3 days late for Smith kitchen"] });
    const m = risks.find((r) => r.category === "material")!;
    expect(m.headline).toContain("Kingspan");
  });

  it("workforce: 2+ behind projects → workforce risk", () => {
    const risks = predictRisks({
      projects_overview: overview([
        row("p1", "A", "4 days behind schedule"),
        row("p2", "B", "6 days behind schedule")
      ])
    });
    expect(risks.some((r) => r.category === "workforce")).toBe(true);
  });

  it("sorts critical before warning before notice", () => {
    const risks = predictRisks({
      projects_overview: overview([
        row("p1", "A", "3 days behind schedule"),   // notice
        row("p2", "B", "8 days behind schedule")    // critical
      ])
    });
    expect(risks[0]!.severity).toBe("critical");
  });
});
