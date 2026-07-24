// Answer router — classifier + reply formatters.

import { describe, it, expect } from "vitest";
import { answerFinancial, classifyFinancialQuestion } from "./answer";
import type { FinancialSnapshot } from "./types";

const ev = { source: "t", tables: [], computed_at: "x" };

function snap(overrides: Partial<FinancialSnapshot> = {}): FinancialSnapshot {
  return {
    computed_at: "2026-07-23T00:00:00Z",
    merchant_slug: "phil-plumbing",
    currency: "GBP",
    health: { score: 78, band: "healthy", headline: "Financial Health: 78%. Healthy.", signals: { cash_flow: { score: 90, note: "solid" }, profit: { score: 70, note: "" }, payment_speed: { score: 80, note: "" }, growth: { score: 60, note: "" }, stability: { score: null, note: "thin" } } },
    revenue:  { window_days: 90, total_pence: 900_000, by_customer: [{ key: "c1", label: "Mrs Smith", amount_pence: 400_000, count: 2 }], by_project: [], by_kind: [{ key: "labour", label: "Labour", amount_pence: 500_000, count: 6 }], evidence: ev },
    expenses: { window_days: 90, total_pence: 500_000, categories: [{ key: "materials", label: "Materials", spend_pence: 300_000, cost_count: 8 }], untracked_note: "Not yet tracked: vehicles, fuel, insurance, subscriptions, training.", evidence: ev },
    vat:      { window_days: 90, vat_rate_pct: 20, vat_payable_pence: 180_000, vat_reclaimable_est_pence: 50_000, vat_net_pence: 130_000, disclaimer: "Nex is not a tax adviser.", evidence: ev },
    cashflow_ref:  { outstanding_now_pence: 200_000, overdue_now_pence: 50_000, pipeline_weighted_pence: 300_000, next_30d_net_pence: 400_000, next_60d_net_pence: 200_000, next_90d_net_pence: 100_000 },
    profit_ref:    { quoted_pence: 900_000, planned_profit_pence: 180_000, weighted_margin_pct: 20, target_margin_pct: 20, low_margin_jobs_count: 0 },
    suppliers_ref: { total_spend_pence: 300_000, supplier_count: 3 },
    errors: [],
    ...overrides
  };
}

describe("classifyFinancialQuestion", () => {
  it("routes overview questions", () => {
    expect(classifyFinancialQuestion("how are my finances?").kind).toBe("overview");
    expect(classifyFinancialQuestion("financial overview").kind).toBe("overview");
  });
  it("routes financial_health", () => {
    expect(classifyFinancialQuestion("how healthy are my finances").kind).toBe("financial_health");
  });
  it("routes VAT / tax when merchant asks about THEIR position", () => {
    expect(classifyFinancialQuestion("what's my VAT position?").kind).toBe("vat");
    expect(classifyFinancialQuestion("my tax summary").kind).toBe("vat");
    expect(classifyFinancialQuestion("how much VAT do I owe?").kind).toBe("vat");
  });
  it("general 'VAT' questions do NOT route to FI (knowledge fallback owns them)", () => {
    expect(classifyFinancialQuestion("what's the VAT threshold").kind).toBe("none");
    expect(classifyFinancialQuestion("does this include VAT?").kind).toBe("none");
  });
  it("routes expenses", () => {
    expect(classifyFinancialQuestion("where am I spending too much").kind).toBe("expenses");
    expect(classifyFinancialQuestion("cost breakdown").kind).toBe("expenses");
  });
  it("routes revenue and best_customer", () => {
    expect(classifyFinancialQuestion("revenue by customer").kind).toBe("revenue");
    expect(classifyFinancialQuestion("who's my best customer?").kind).toBe("best_customer");
  });
  it("afford with explicit price", () => {
    const q = classifyFinancialQuestion("can I afford £8,000?");
    expect(q.kind).toBe("afford");
    if (q.kind === "afford") expect(q.pence).toBe(800_000);
  });
  it("afford with k / thousand modifier", () => {
    const q = classifyFinancialQuestion("can I afford 20k?");
    expect(q.kind).toBe("afford");
    if (q.kind === "afford") expect(q.pence).toBe(2_000_000);
  });
  it("afford with keyword fallback (new van)", () => {
    const q = classifyFinancialQuestion("can I afford a new van?");
    expect(q.kind).toBe("afford");
    if (q.kind === "afford") {
      expect(q.pence).toBeGreaterThan(0);
      expect(q.label.toLowerCase()).toContain("van");
    }
  });
  it("afford with no price and no keyword returns pence=null", () => {
    const q = classifyFinancialQuestion("can I afford it?");
    expect(q.kind).toBe("afford");
    if (q.kind === "afford") expect(q.pence).toBeNull();
  });
  it("none for unrelated text", () => {
    expect(classifyFinancialQuestion("hello there").kind).toBe("none");
  });
});

describe("answerFinancial", () => {
  it("overview shows health headline + revenue + outstanding + VAT + disclaimer", () => {
    const out = answerFinancial({ kind: "overview" }, snap(), null);
    expect(out).toContain("78%");
    expect(out).toContain("£9,000");    // revenue
    expect(out).toContain("£2,000");    // outstanding
    expect(out).toContain("Nex is not a tax adviser");
  });

  it("revenue lists top customers + kind breakdown", () => {
    const out = answerFinancial({ kind: "revenue" }, snap(), null);
    expect(out).toContain("Mrs Smith");
    expect(out).toContain("£4,000");
    expect(out).toContain("Labour");
  });

  it("expenses shows categories + untracked note", () => {
    const out = answerFinancial({ kind: "expenses" }, snap(), null);
    expect(out).toContain("Materials");
    expect(out).toContain("Not yet tracked");
  });

  it("expenses with zero total shows no-expenses message + untracked", () => {
    const empty = snap({ expenses: { window_days: 90, total_pence: 0, categories: [], untracked_note: "Not yet tracked: vehicles.", evidence: ev } });
    const out = answerFinancial({ kind: "expenses" }, empty, null);
    expect(out).toContain("No expenses recorded");
    expect(out).toContain("Not yet tracked");
  });

  it("vat reports payable + reclaimable + net + disclaimer", () => {
    const out = answerFinancial({ kind: "vat" }, snap(), null);
    expect(out).toContain("£1,800");   // payable
    expect(out).toContain("£500");     // reclaimable
    expect(out).toContain("£1,300");   // net
    expect(out.toLowerCase()).toContain("not a tax adviser");
  });

  it("financial_health shows every signal + note", () => {
    const out = answerFinancial({ kind: "financial_health" }, snap(), null);
    expect(out).toContain("78%");
    expect(out).toContain("Cash flow");
    expect(out).toContain("Profit");
    expect(out).toContain("Payment speed");
    expect(out).toContain("Stability");
  });

  it("best_customer picks the top-revenue contact", () => {
    const out = answerFinancial({ kind: "best_customer" }, snap(), null);
    expect(out).toContain("Mrs Smith");
    expect(out).toContain("£4,000");
  });

  it("afford with unknown price asks for a number", () => {
    const out = answerFinancial({ kind: "afford", label: "it", pence: null }, snap(), null);
    expect(out).toContain("Tell me the price");
  });

  it("afford runs through checkAffordability using snapshot cashflow_ref", () => {
    // Horizon = 400K + 200K + 100K = 700K + 300K pipeline = 1M.
    // Purchase £5000 = 500,000. Buffer 30% = 300K. Remaining 500K ≥ 300K → yes.
    const out = answerFinancial({ kind: "afford", label: "£5000 tool", pence: 500_000 }, snap(), null);
    expect(out).toContain("Yes");
    expect(out).toContain("£5,000");
    expect(out).toContain("£10,000");   // horizon
  });
});
