// Morning report composer — end-to-end shape + formatting.

import { describe, it, expect } from "vitest";
import { buildMorningReport, formatMorningReport } from "./advisor";
import type { FinancialSnapshot } from "../fi/types";
import type { ProjectsOverview } from "../pm/types";

const ev = { source: "t", tables: [], computed_at: "x" };

const fi = (): FinancialSnapshot => ({
  computed_at: "x", merchant_slug: "phil", currency: "GBP",
  health: { score: 60, band: "steady", headline: "h", signals: { cash_flow: { score: null, note: "" }, profit: { score: null, note: "" }, payment_speed: { score: null, note: "" }, growth: { score: null, note: "" }, stability: { score: null, note: "" } } },
  revenue: { window_days: 90, total_pence: 0, by_customer: [], by_project: [], by_kind: [], evidence: ev },
  expenses: { window_days: 90, total_pence: 0, categories: [], untracked_note: "", evidence: ev },
  vat: { window_days: 90, vat_rate_pct: 20, vat_payable_pence: 0, vat_reclaimable_est_pence: 0, vat_net_pence: 0, disclaimer: "d", evidence: ev },
  cashflow_ref: { outstanding_now_pence: 0, overdue_now_pence: 800_000, pipeline_weighted_pence: 0, next_30d_net_pence: 1_000_000, next_60d_net_pence: 1_500_000, next_90d_net_pence: 2_000_000 },
  profit_ref: { quoted_pence: 0, planned_profit_pence: 0, weighted_margin_pct: 18, target_margin_pct: 25, low_margin_jobs_count: 3 },
  suppliers_ref: { total_spend_pence: 0, supplier_count: 0 },
  errors: []
});

const overview = (): ProjectsOverview => ({
  computed_at: "x", merchant_slug: "phil",
  projects: [{
    project: { project_id: "p1", title: "Smith kitchen", status: "in_progress", started_at: null, completed_at: null, scheduled_end: null, progress_percent: null },
    health_score: 45, band: "attention",
    observation_summary: "6 days behind schedule",
    top_observations: [{ severity: "warning", headline: "6 days behind schedule" }],
    evidence: ev
  }],
  warnings: [], errors: []
});

describe("buildMorningReport", () => {
  it("greets by name + composes overall headline from populated inputs", () => {
    const r = buildMorningReport({
      merchant_slug: "phil", merchant_name: "Phil",
      predict:  { projects_overview: overview(), finance: fi() },
      growth:   { completed_projects: [{ trade_label: "Kitchen", count: 18 }] },
      industry: { observations: [{ kind: "demand_shift", headline: "Roofing up 24%", change_pct: 24, window_days: 30, source_table: "net", reason: "r" }] },
      actions:  { overdue_invoices: [{ invoice_id: "i1", customer_label: "S", amount_pence: 800_000, days_overdue: 32 }] }
    });
    expect(r.greeting).toContain("Phil");
    expect(r.risks.length).toBeGreaterThan(0);
    expect(r.growth.length).toBeGreaterThan(0);
    expect(r.industry.length).toBeGreaterThan(0);
    expect(r.actions.length).toBeGreaterThan(0);
    expect(r.overall_headline).toMatch(/warning|opportunity/i);
  });

  it("no inputs → 'Nothing urgent' + full unavailable list", () => {
    const r = buildMorningReport({ merchant_slug: "phil", merchant_name: "Phil" });
    expect(r.overall_headline.toLowerCase()).toContain("nothing urgent");
    expect(r.unavailable.length).toBe(4);
  });

  it("formatter renders greeting + risks + growth + actions", () => {
    const r = buildMorningReport({
      merchant_slug: "phil", merchant_name: "Phil",
      predict:  { projects_overview: overview(), finance: fi() },
      growth:   { completed_projects: [{ trade_label: "Kitchen", count: 18 }] },
      actions:  { overdue_invoices: [{ invoice_id: "i1", customer_label: "Sam Smith", amount_pence: 800_000, days_overdue: 32 }] }
    });
    const out = formatMorningReport(r);
    expect(out).toContain("Phil");
    expect(out).toContain("Risks:");
    expect(out).toContain("Growth opportunities:");
    expect(out).toContain("your approval needed");
    // No em dashes anywhere in the merchant-facing text.
    expect(out).not.toContain("—");
  });
});
