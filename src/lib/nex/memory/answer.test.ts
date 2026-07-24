// Answer router — classifier + dispatch (reader mocked).

import { describe, it, expect, vi } from "vitest";

vi.mock("./reader", () => ({
  retrieveMemory: vi.fn(async (input: { subject_like?: string; subject?: string }) => {
    const ev = { source: "t", tables: [], computed_at: "x" };
    if (input.subject === "financial.cash.next_30d_pence") {
      return {
        rows: [
          { id: "1", layer: "company", subject: "financial.cash.next_30d_pence",
            predicate: "=", value_json: 1_500_000, unit: "pence",
            observed_at: "2026-07-22T00:00:00Z", window_start: null, window_end: null,
            sample_size: 1, confidence: "medium", is_official: false, is_verified: false,
            visible_to: "owner_only", source_engine: "fi", evidence_tables: [],
            computed_at: "x", decays_at: null, correction_of: null, created_at: "x",
            merchant_slug: "phil" }
        ],
        resolved: 1, superseded: 0, evidence: ev
      };
    }
    if (input.subject_like === "pricing.kitchen.") {
      return {
        rows: [
          { id: "k1", layer: "company", subject: "pricing.kitchen.total_pence",
            predicate: "=", value_json: { total_pence: 500_000, duration_days: 8, scope: "12 sqm refit" },
            unit: "pence", observed_at: "2026-07-20T10:00:00Z",
            window_start: null, window_end: null, sample_size: 1,
            confidence: "medium", is_official: false, is_verified: false,
            visible_to: "owner_only", source_engine: "est", evidence_tables: [],
            computed_at: "x", decays_at: null, correction_of: null, created_at: "x",
            merchant_slug: "phil" }
        ],
        resolved: 1, superseded: 0, evidence: ev
      };
    }
    if (input.subject_like === "customer.") {
      return {
        rows: [
          { id: "c1", layer: "company", subject: "customer.cust-a.payment_days",
            predicate: "=", value_json: { days: 45 }, unit: "days",
            observed_at: "2026-07-15T00:00:00Z", window_start: null, window_end: null,
            sample_size: 1, confidence: "medium", is_official: false, is_verified: false,
            visible_to: "owner_only", source_engine: "cx", evidence_tables: [],
            computed_at: "x", decays_at: null, correction_of: null, created_at: "x",
            merchant_slug: "phil" },
          { id: "c2", layer: "company", subject: "customer.cust-b.payment_days",
            predicate: "=", value_json: { days: 12 }, unit: "days",
            observed_at: "2026-07-16T00:00:00Z", window_start: null, window_end: null,
            sample_size: 1, confidence: "medium", is_official: false, is_verified: false,
            visible_to: "owner_only", source_engine: "cx", evidence_tables: [],
            computed_at: "x", decays_at: null, correction_of: null, created_at: "x",
            merchant_slug: "phil" }
        ],
        resolved: 2, superseded: 0, evidence: ev
      };
    }
    return { rows: [], resolved: 0, superseded: 0, evidence: ev };
  })
}));

import { answerMemory, classifyMemoryQuestion } from "./answer";

describe("classifyMemoryQuestion", () => {
  it("pricing recall with trade capture", () => {
    const q = classifyMemoryQuestion("how did I price a kitchen last time?");
    expect(q.kind).toBe("recall_pricing");
    if (q.kind === "recall_pricing") expect(q.trade).toBe("kitchen");
  });

  it("pricing recall without trade", () => {
    const q = classifyMemoryQuestion("what's my usual price?");
    expect(q.kind).toBe("recall_pricing");
    if (q.kind === "recall_pricing") expect(q.trade).toBeNull();
  });

  it("similar jobs", () => {
    expect(classifyMemoryQuestion("what have we done like this before?").kind).toBe("recall_similar_jobs");
    expect(classifyMemoryQuestion("anything like this before?").kind).toBe("recall_similar_jobs");
  });

  it("slow payers", () => {
    expect(classifyMemoryQuestion("which customers pay late?").kind).toBe("recall_slow_payers");
    expect(classifyMemoryQuestion("who's a slow payer?").kind).toBe("recall_slow_payers");
  });

  it("cash history", () => {
    expect(classifyMemoryQuestion("how's cash been?").kind).toBe("recall_cash_history");
    expect(classifyMemoryQuestion("cash trend?").kind).toBe("recall_cash_history");
  });

  it("unrelated → none", () => {
    expect(classifyMemoryQuestion("hello there").kind).toBe("none");
  });
});

describe("answerMemory", () => {
  const base = { merchant_slug: "phil" };

  it("recall_pricing surfaces total + duration + scope", async () => {
    const r = await answerMemory({
      question: { kind: "recall_pricing", trade: "kitchen", scope_hint: "test" },
      ...base
    });
    expect(r.speak).toContain("kitchen");
    expect(r.speak).toContain("£5,000");
    expect(r.speak).toContain("8 days");
    expect(r.speak).toContain("12 sqm refit");
    expect(r.rows).toHaveLength(1);
  });

  it("recall_slow_payers sorts by days descending", async () => {
    const r = await answerMemory({
      question: { kind: "recall_slow_payers" }, ...base
    });
    // cust-a (45d) should come before cust-b (12d).
    const idx_a = r.speak.indexOf("cust-a");
    const idx_b = r.speak.indexOf("cust-b");
    expect(idx_a).toBeLessThan(idx_b);
    expect(r.speak).toContain("45 days");
  });

  it("recall_cash_history formats as £/day", async () => {
    const r = await answerMemory({
      question: { kind: "recall_cash_history" }, ...base
    });
    expect(r.speak).toContain("£15,000");
    expect(r.speak).toContain("30-day net");
  });

  it("none → empty speak", async () => {
    const r = await answerMemory({ question: { kind: "none" }, ...base });
    expect(r.speak).toBe("");
  });
});
