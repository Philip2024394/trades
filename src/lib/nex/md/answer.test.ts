// MD answer router — classifier + reply formatters.

import { describe, it, expect } from "vitest";
import { answerMD, classifyMDQuestion } from "./answer";
import type { MDBriefing } from "./types";

const ev = { source: "t", tables: [], computed_at: "x" };

function briefing(overrides: Partial<MDBriefing> = {}): MDBriefing {
  const base: MDBriefing = {
    computed_at: "2026-07-23T00:00:00Z",
    merchant_slug: "phil-plumbing",
    health: { score: 82, band: "healthy", headline: "Business Health: 82%. Healthy.", contributions: [] },
    cashflow: {
      currency: "GBP", computed_at: "x",
      buckets: [
        { end_date: "d1", inflow_pence: 300_000, outflow_pence: 0, net_pence: 300_000 },
        { end_date: "d2", inflow_pence: 150_000, outflow_pence: 0, net_pence: 150_000 },
        { end_date: "d3", inflow_pence: 100_000, outflow_pence: 0, net_pence: 100_000 }
      ],
      horizon_pence: 550_000, outstanding_now_pence: 250_000, overdue_now_pence: 80_000,
      pipeline_weighted_pence: 400_000, warnings: [], evidence: ev
    },
    profit: {
      computed_at: "x", jobs: [
        { quote_id: "q1", title: "Kitchen refit", estimated_total_pence: 600_000, materials_pence: 200_000, labour_pence: 200_000, overhead_pence: 0, profit_pence_planned: 100_000, paid_pence: 0, status: "accepted", margin_pct_planned: 16.7, evidence: ev }
      ],
      totals: { quoted_pence: 600_000, planned_profit_pence: 100_000, weighted_margin_pct: 16.7 },
      low_margin_jobs: [
        { quote_id: "q1", title: "Kitchen refit", estimated_total_pence: 600_000, materials_pence: 200_000, labour_pence: 200_000, overhead_pence: 0, profit_pence_planned: 100_000, paid_pence: 0, status: "accepted", margin_pct_planned: 16.7, evidence: ev }
      ],
      target_margin_pct: 20,
      warnings: ["Realised-cost tracking not yet wired — profit numbers are PLANNED."],
      evidence: ev
    },
    workforce: { computed_at: "x", active_projects_count: 3, hours_last_30d: 60, team_size_current: 3, utilisation_note: "3 active projects, 60 hours logged, 4 bookings.", bookings_next_14d: 4, warnings: [], evidence: ev },
    suppliers: { computed_at: "x", window_days: 90, suppliers: [{ supplier_key: "Jewson", spend_pence: 150_000, cost_count: 5, latest_cost_at: "2026-07-01" }], total_spend_pence: 150_000, evidence: ev },
    forecast:  { computed_at: "x", next_30d_revenue_pence: 800_000, next_60d_revenue_pence: 1_500_000, monthly_avg_pence: 700_000, best_day_of_week: "Tuesday", seasonality_notes: ["Best day of the week for profile views: Tuesday."], evidence: ev },
    priorities: [
      { key: "md_cashflow:overdue", source: "md_cashflow", severity: "warning", headline: "£800 overdue.", detail: "Chase today.", evidence: ev },
      { key: "info_ok",             source: "bi",          severity: "info",    headline: "Views up 22%.", evidence: ev }
    ],
    recommendations: [
      { key: "rec1", action: "Chase overdue payments today", reason: "£800 overdue on the ledger.", urgency: "today", source: "md_cashflow", evidence: ev }
    ],
    errors: []
  };
  return { ...base, ...overrides };
}

describe("classifyMDQuestion", () => {
  it("overview", () => expect(classifyMDQuestion("how's my business?").kind).toBe("overview"));
  it("worries", () => expect(classifyMDQuestion("what worries you?").kind).toBe("worries"));
  it("do_first", () => {
    expect(classifyMDQuestion("what should I do first?").kind).toBe("do_first");
    expect(classifyMDQuestion("what's next?").kind).toBe("do_first");
  });
  it("losing_money", () => expect(classifyMDQuestion("where am I losing money?").kind).toBe("losing_money"));
  it("opportunity", () => expect(classifyMDQuestion("what's my biggest opportunity?").kind).toBe("opportunity"));
  it("cash_flow", () => expect(classifyMDQuestion("how's cash flow?").kind).toBe("cash_flow"));
  it("forecast", () => expect(classifyMDQuestion("forecast for next month").kind).toBe("forecast"));
  it("workforce", () => expect(classifyMDQuestion("what's my workforce capacity?").kind).toBe("workforce"));
  it("suppliers", () => expect(classifyMDQuestion("show my suppliers").kind).toBe("suppliers"));
  it("profit", () => expect(classifyMDQuestion("what's my profit margin?").kind).toBe("profit"));
  it("none", () => expect(classifyMDQuestion("hello there").kind).toBe("none"));
});

describe("answerMD", () => {
  it("overview shows health + outstanding + pipeline + margin", () => {
    const out = answerMD({ kind: "overview" }, briefing());
    expect(out).toContain("82%");
    expect(out).toContain("£2,500");   // outstanding
    expect(out).toContain("£4,000");   // pipeline
    expect(out).toContain("16.7%");    // margin
  });

  it("worries shows only warnings/alerts, not info", () => {
    const out = answerMD({ kind: "worries" }, briefing());
    expect(out).toContain("£800 overdue.");
    expect(out).not.toContain("Views up");
  });

  it("do_first shows top recommendation with reason", () => {
    const out = answerMD({ kind: "do_first" }, briefing());
    expect(out).toContain("Chase overdue payments today");
    expect(out).toContain("because:");
  });

  it("losing_money surfaces low-margin jobs + overdue", () => {
    const out = answerMD({ kind: "losing_money" }, briefing());
    expect(out).toContain("Kitchen refit");
    expect(out).toContain("16.7%");
    expect(out).toContain("£800");
  });

  it("opportunity mentions pipeline + next-30 forecast", () => {
    const out = answerMD({ kind: "opportunity" }, briefing());
    expect(out).toContain("£4,000");
    expect(out).toContain("£8,000");
  });

  it("cash_flow lists 30/60/90 buckets + honest expense caveat", () => {
    const out = answerMD({ kind: "cash_flow" }, briefing());
    expect(out).toContain("30 days");
    expect(out).toContain("60 days");
    expect(out).toContain("90 days");
    expect(out.toLowerCase()).toContain("money-in only");
  });

  it("forecast reports the next-30 estimate + best day", () => {
    const out = answerMD({ kind: "forecast" }, briefing());
    expect(out).toContain("£8,000");
    expect(out).toContain("Tuesday");
  });

  it("workforce reports counts", () => {
    const out = answerMD({ kind: "workforce" }, briefing());
    expect(out).toContain("3");   // active projects
    expect(out).toContain("60");  // hours
  });

  it("suppliers ranks by spend", () => {
    const out = answerMD({ kind: "suppliers" }, briefing());
    expect(out).toContain("Jewson");
    expect(out).toContain("£1,500");
  });

  it("profit surfaces planned + honest caveat", () => {
    const out = answerMD({ kind: "profit" }, briefing());
    expect(out).toContain("16.7%");
    expect(out).toContain("target 20%");
    expect(out.toLowerCase()).toContain("planned");
  });

  it("empty briefing gracefully reports 'nothing to worry about'", () => {
    const b = briefing({ priorities: [] });
    expect(answerMD({ kind: "worries" }, b)).toContain("Nothing worrying");
  });
});
