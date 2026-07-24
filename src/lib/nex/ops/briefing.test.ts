// Morning briefing composer — engines mocked, composed speak asserted.

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from(table: string) {
      const b = {
        select: (_cols?: string, _opts?: unknown) => b,
        eq:     () => b,
        not:    () => b,
        gte:    () => b,
        lte:    () => b,
        head:   () => b,
        async maybeSingle() {
          if (table === "hammerex_trade_off_listings") return { data: { id: "L1", display_name: "Phil Plumbing" } };
          return { data: null };
        },
        then:   (resolve: (v: { data: unknown; count?: number }) => void) => {
          if (table === "app_job_diary_jobs") return Promise.resolve().then(() => resolve({ data: [], count: 3 }));
          return Promise.resolve().then(() => resolve({ data: [] }));
        }
      };
      return b;
    }
  }
}));

vi.mock("./overnight_payments", () => ({
  findOvernightPayments: vi.fn(async () => [
    { cost_id: "c1", project_title: "Smith kitchen", amount_pence: 120000, paid_at: "2026-07-23T02:00:00Z", method: "bank", evidence: { source: "t", tables: [], computed_at: "x" } }
  ])
}));

vi.mock("./diary_gaps", () => ({
  findDiaryGaps: vi.fn(async () => [
    { start_date: "2026-07-30", end_date: "2026-07-31", days: 2, reason: "no jobs", evidence: { source: "t", tables: [], computed_at: "x" } }
  ])
}));

vi.mock("./warranty_window", () => ({
  findWarrantiesExpiring: vi.fn(async () => [
    { title: "Boiler service", next_due_at: "2026-07-30T00:00:00Z", days_until: 7, evidence: { source: "t", tables: [], computed_at: "x" } }
  ])
}));

vi.mock("../ab", () => ({
  buildApprovalQueue: vi.fn(async () => ({
    autonomy: { merchant_slug: "phil", mode: "manual", trusted_categories: [], source: "engine_default" },
    actions: [
      { key: "a", category: "customer_message",  severity: "warning", headline: "", reason: "", preview_of_effect: "", reversible: true, source: "cx", evidence: { source: "t", tables: [], computed_at: "x" }, status: "awaiting_approval" },
      { key: "b", category: "social_post",       severity: "notice",  headline: "", reason: "", preview_of_effect: "", reversible: true, source: "bi", evidence: { source: "t", tables: [], computed_at: "x" }, status: "awaiting_approval" },
      { key: "c", category: "invoice_reminder",  severity: "warning", headline: "", reason: "", preview_of_effect: "", reversible: true, source: "fi", evidence: { source: "t", tables: [], computed_at: "x" }, status: "awaiting_approval" }
    ],
    auto_approvable: [],
    computed_at: "x", merchant_slug: "phil", errors: []
  }))
}));

vi.mock("../fi", () => ({
  buildFinancialSnapshot: vi.fn(async () => ({
    ok: true, snapshot: {
      health: { score: 78 },
      cashflow_ref: { overdue_now_pence: 250_000, next_30d_net_pence: 400_000, next_60d_net_pence: 200_000, next_90d_net_pence: 100_000, outstanding_now_pence: 500_000, pipeline_weighted_pence: 300_000 },
      profit_ref:   { quoted_pence: 0, planned_profit_pence: 0, weighted_margin_pct: 0, target_margin_pct: 20, low_margin_jobs_count: 0 },
      suppliers_ref:{ total_spend_pence: 0, supplier_count: 0 },
      revenue: {}, expenses: {}, vat: {}
    }
  }))
}));

import { buildMorningBriefing } from "./briefing";

describe("buildMorningBriefing", () => {
  it("builds when the merchant exists in the mocked listing", async () => {
    const res = await buildMorningBriefing({ merchantSlug: "phil" });
    expect(res.ok).toBe(true);
  });

  it("composes speak with greeting + jobs count + overnight payment + gap + warranty + overdue + drafts + time saved", async () => {
    const res = await buildMorningBriefing({ merchantSlug: "phil" });
    if (!res.ok) throw new Error();
    const s = res.briefing.speak;
    expect(s).toContain("Good morning Phil");
    expect(s).toContain("3 jobs today");
    expect(s).toContain("One customer paid overnight");
    expect(s).toContain("£1,200");
    expect(s).toContain("2-day gap in your diary starting 2026-07-30");
    expect(s).toContain("Boiler service warranty expires in 7 days");
    expect(s).toContain("£2,500");             // overdue
    expect(s).toContain("prepared 3 draft");
    expect(s).toContain("Estimated time saved");
    expect(s).toContain("Would you like me to show today's plan?");
  });

  it("populates suggestions from the briefing state", async () => {
    const res = await buildMorningBriefing({ merchantSlug: "phil" });
    if (!res.ok) throw new Error();
    expect(res.briefing.suggestions).toContain("Show me what needs my approval");
    expect(res.briefing.suggestions).toContain("Chase overdue invoices");
    expect(res.briefing.suggestions).toContain("Fill that diary gap");
    expect(res.briefing.suggestions).toContain("Send a maintenance reminder");
  });
});
