// Decision engine — verdict + wait-days math.

import { describe, it, expect } from "vitest";
import { makeDecision } from "./decision";
import type { FinancialSnapshot } from "../fi/types";

const ev = { source: "t", tables: [], computed_at: "x" };

const fi = (next30: number, next90: number): FinancialSnapshot => ({
  computed_at: "x", merchant_slug: "phil", currency: "GBP",
  health: { score: 60, band: "steady", headline: "h", signals: { cash_flow: { score: null, note: "" }, profit: { score: null, note: "" }, payment_speed: { score: null, note: "" }, growth: { score: null, note: "" }, stability: { score: null, note: "" } } },
  revenue: { window_days: 90, total_pence: 0, by_customer: [], by_project: [], by_kind: [], evidence: ev },
  expenses: { window_days: 90, total_pence: 0, categories: [], untracked_note: "", evidence: ev },
  vat: { window_days: 90, vat_rate_pct: 20, vat_payable_pence: 0, vat_reclaimable_est_pence: 0, vat_net_pence: 0, disclaimer: "d", evidence: ev },
  cashflow_ref: {
    outstanding_now_pence: 0, overdue_now_pence: 0, pipeline_weighted_pence: 0,
    next_30d_net_pence: next30, next_60d_net_pence: (next30 + next90) / 2, next_90d_net_pence: next90
  },
  profit_ref: { quoted_pence: 0, planned_profit_pence: 0, weighted_margin_pct: 20, target_margin_pct: 25, low_margin_jobs_count: 0 },
  suppliers_ref: { total_spend_pence: 0, supplier_count: 0 },
  errors: []
});

describe("makeDecision", () => {
  const purchase = { purchase_label: "a van", purchase_pence: 25_000_00, urgency: "flexible" as const };

  it("no finance → unknown verdict + null wait", () => {
    const r = makeDecision({ input: purchase, finance: null });
    expect(r.verdict).toBe("unknown");
    expect(r.wait_days).toBeNull();
  });

  it("30-day net covers purchase + buffer → YES + wait 0", () => {
    const r = makeDecision({ input: purchase, finance: fi(30_000_00, 45_000_00) });
    expect(r.verdict).toBe("yes");
    expect(r.wait_days).toBe(0);
  });

  it("30 doesn't cover, 90 does → WAIT + some wait_days", () => {
    const r = makeDecision({ input: purchase, finance: fi(10_000_00, 40_000_00) });
    expect(r.verdict).toBe("wait");
    expect(r.wait_days).toBeGreaterThan(0);
    expect(r.wait_days).toBeLessThanOrEqual(90);
  });

  it("even 90-day doesn't cover → NO", () => {
    const r = makeDecision({ input: purchase, finance: fi(5_000_00, 15_000_00) });
    expect(r.verdict).toBe("no");
    expect(r.wait_days).toBeNull();
  });

  it("urgency 'now' + wait verdict → footnote suggests financing", () => {
    const r = makeDecision({
      input: { ...purchase, urgency: "now" },
      finance: fi(10_000_00, 40_000_00)
    });
    expect(r.verdict).toBe("wait");
    expect(r.footnote.toLowerCase()).toContain("financing");
  });
});
