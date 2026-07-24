// Adapters — phase-native events → memory writes.

import { describe, it, expect } from "vitest";
import {
  fromFinancialSnapshot,
  fromPaymentObserved,
  fromProjectCompletion,
  fromQuoteIssued
} from "./adapters";
import type { FinancialSnapshot } from "../fi/types";

const ev = { source: "t", tables: [], computed_at: "x" };

describe("fromProjectCompletion", () => {
  const base = {
    merchant_slug: "phil", project_id: "p1", completed_at: "2026-07-23T10:00:00Z"
  };

  it("emits one row per non-null metric with source_engine=pi", () => {
    const out = fromProjectCompletion({
      ...base,
      duration_days: 12, labour_hours: 88, materials_pence: 250_000,
      snags_count: 2, review_score: 5
    });
    expect(out).toHaveLength(5);
    expect(out.every((r) => r.source_engine === "pi")).toBe(true);
    expect(out.every((r) => r.merchant_slug === "phil" && r.project_id === "p1")).toBe(true);
    expect(out.map((r) => r.subject)).toEqual([
      "duration.days", "labour.hours", "materials.total_pence",
      "snags.count", "review.score"
    ]);
  });

  it("skips null metrics", () => {
    const out = fromProjectCompletion({
      ...base,
      duration_days: 12, labour_hours: null, materials_pence: null,
      snags_count: null, review_score: null
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.subject).toBe("duration.days");
  });

  it("uses observed_at from completed_at + project_participants visibility", () => {
    const out = fromProjectCompletion({
      ...base,
      duration_days: 12, labour_hours: null, materials_pence: null,
      snags_count: null, review_score: null
    });
    expect(out[0]!.observed_at).toBe("2026-07-23T10:00:00Z");
    expect(out[0]!.visible_to).toBe("project_participants");
  });
});

describe("fromQuoteIssued", () => {
  const q = {
    merchant_slug: "phil", trade: "kitchen", scope: "12 sqm refit",
    total_pence: 500_000, net_pence: 400_000,
    labour_pence: 200_000, materials_pence: 200_000, duration_days: 8,
    issued_at: "2026-07-23T10:00:00Z"
  };

  it("emits pricing.<trade>.total_pence at company scope", () => {
    const out = fromQuoteIssued(q);
    const pricing = out.find((r) => r.subject === "pricing.kitchen.total_pence")!;
    expect(pricing.layer).toBe("company");
    if (pricing.layer === "company") expect(pricing.merchant_slug).toBe("phil");
    expect(pricing.source_engine).toBe("est");
    const v = pricing.value_json as Record<string, unknown>;
    expect(v.total_pence).toBe(500_000);
    expect(v.scope).toBe("12 sqm refit");
  });

  it("also emits project-scoped quoted.total_pence when project_id present", () => {
    const out = fromQuoteIssued({ ...q, project_id: "p1" });
    const projRow = out.find((r) => r.layer === "project");
    expect(projRow).toBeDefined();
    expect(projRow!.subject).toBe("quoted.total_pence");
  });

  it("omits project row when project_id not given", () => {
    const out = fromQuoteIssued(q);
    expect(out.some((r) => r.layer === "project")).toBe(false);
  });
});

describe("fromPaymentObserved", () => {
  it("keys the subject on customer id for retrieval", () => {
    const out = fromPaymentObserved({
      merchant_slug: "phil", customer_id: "cust-abc",
      invoice_pence: 8_400_00, days_from_invoice_to_pay: 32,
      observed_at: "2026-07-23T10:00:00Z"
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.subject).toBe("customer.cust-abc.payment_days");
    const v = out[0]!.value_json as Record<string, unknown>;
    expect(v.days).toBe(32);
  });
});

describe("fromFinancialSnapshot", () => {
  const snap: FinancialSnapshot = {
    computed_at: "x", merchant_slug: "phil", currency: "GBP",
    health: { score: 72, band: "steady", headline: "h", signals: { cash_flow: { score: null, note: "" }, profit: { score: null, note: "" }, payment_speed: { score: null, note: "" }, growth: { score: null, note: "" }, stability: { score: null, note: "" } } },
    revenue: { window_days: 90, total_pence: 0, by_customer: [], by_project: [], by_kind: [], evidence: ev },
    expenses: { window_days: 90, total_pence: 0, categories: [], untracked_note: "", evidence: ev },
    vat: { window_days: 90, vat_rate_pct: 20, vat_payable_pence: 0, vat_reclaimable_est_pence: 0, vat_net_pence: 0, disclaimer: "d", evidence: ev },
    cashflow_ref: { outstanding_now_pence: 0, overdue_now_pence: 500_000, pipeline_weighted_pence: 0, next_30d_net_pence: 1_500_000, next_60d_net_pence: 2_500_000, next_90d_net_pence: 3_500_000 },
    profit_ref: { quoted_pence: 0, planned_profit_pence: 0, weighted_margin_pct: 22, target_margin_pct: 25, low_margin_jobs_count: 2 },
    suppliers_ref: { total_spend_pence: 0, supplier_count: 0 },
    errors: []
  };

  it("emits 6 financial signals with source_engine=fi", () => {
    const out = fromFinancialSnapshot({
      merchant_slug: "phil", snapshot: snap, observed_at: "2026-07-23T00:00:00Z"
    });
    expect(out).toHaveLength(6);
    expect(out.every((r) => r.source_engine === "fi")).toBe(true);
    const health = out.find((r) => r.subject === "financial.health.score")!;
    expect(health.value_json).toBe(72);
    const overdue = out.find((r) => r.subject === "financial.cash.overdue_pence")!;
    expect(overdue.value_json).toBe(500_000);
  });
});
