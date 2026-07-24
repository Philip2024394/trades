// Answer router — classifier + reply builder.

import { describe, it, expect } from "vitest";
import { classifyBIQuestion, answerBIQuestion } from "./answer";
import type { BusinessHealth, DomainMetrics, Evidence } from "./types";

const ev: Evidence = { source: "test", tables: ["t"], computed_at: "2026-07-23T00:00:00Z" };

function snapshot(overrides: Partial<BusinessHealth> = {}): BusinessHealth {
  const domains: DomainMetrics[] = [
    {
      domain: "invoices", label: "Invoices", sub_score: 65, weight: 2,
      metrics: [
        { key: "revenue_gbp",     label: "Booked revenue", value: 4280, prior: 3600, unit: "gbp", direction: "higher_is_better", evidence: ev },
        { key: "outstanding_gbp", label: "Outstanding",    value: 1200,               unit: "gbp", direction: "lower_is_better",  evidence: ev },
        { key: "overdue_gbp",     label: "Past expiry",    value: 400,                unit: "gbp", direction: "lower_is_better",  evidence: ev }
      ],
      observations: []
    },
    {
      domain: "quotations", label: "Quotations", sub_score: 55, weight: 1.8,
      metrics: [
        { key: "conversion_pct", label: "Quote conversion", value: 42, prior: 55, unit: "pct", direction: "higher_is_better", evidence: ev }
      ],
      observations: []
    },
    {
      domain: "leads", label: "Leads", sub_score: 40, weight: 2,
      metrics: [
        { key: "leads_in",      label: "Leads received", value: 12, unit: "count", direction: "higher_is_better", evidence: ev },
        { key: "response_rate", label: "Reply rate",     value: 65, unit: "pct",   direction: "higher_is_better", evidence: ev }
      ],
      observations: [{
        key: "leads_top_trade", domain: "leads", severity: "info",
        headline: "8 of your enquiries this period came in under \"kitchens\".",
        evidence: ev
      }]
    }
  ];
  return {
    score: 55, band: "steady",
    headline: "Business Health: 55%. Steady.",
    domains,
    observations: [
      { key: "quote_conversion_dropped", domain: "quotations", severity: "warning", headline: "Quote conversion has fallen from 55% to 42% this period.", evidence: ev },
      { key: "leads_top_trade", domain: "leads", severity: "info", headline: "8 of your enquiries this period came in under \"kitchens\".", evidence: ev }
    ],
    computed_at: "2026-07-23T00:00:00Z",
    errors: [],
    ...overrides
  };
}

describe("classifyBIQuestion", () => {
  it("routes 'how's business?' to overall_health", () => {
    expect(classifyBIQuestion("how's business?").kind).toBe("overall_health");
    expect(classifyBIQuestion("Business health please").kind).toBe("overall_health");
  });

  it("routes revenue questions", () => {
    expect(classifyBIQuestion("how much did I make this month?").kind).toBe("revenue");
    expect(classifyBIQuestion("what's my revenue this period").kind).toBe("revenue");
    expect(classifyBIQuestion("turnover so far").kind).toBe("revenue");
  });

  it("routes 'who owes me' to outstanding", () => {
    expect(classifyBIQuestion("who owes me money?").kind).toBe("outstanding");
    expect(classifyBIQuestion("what's outstanding").kind).toBe("outstanding");
  });

  it("routes conversion questions", () => {
    expect(classifyBIQuestion("what's my quote conversion?").kind).toBe("conversion");
    expect(classifyBIQuestion("win rate?").kind).toBe("conversion");
  });

  it("routes recommendations", () => {
    expect(classifyBIQuestion("what should I improve this week?").kind).toBe("recommendations");
  });

  it("routes 'which trade earns me the most'", () => {
    expect(classifyBIQuestion("which trade earns me the most?").kind).toBe("best_trade");
  });

  it("returns 'none' for irrelevant text", () => {
    expect(classifyBIQuestion("what's the weather like").kind).toBe("none");
    expect(classifyBIQuestion("").kind).toBe("none");
  });
});

describe("answerBIQuestion", () => {
  it("overall_health includes headline + weakest area", () => {
    const s = snapshot();
    const reply = answerBIQuestion({ kind: "overall_health" }, s);
    expect(reply).toContain("Business Health: 55%");
    expect(reply).toContain("Weakest area: Leads (40%)");
  });

  it("revenue reports value + trend", () => {
    const reply = answerBIQuestion({ kind: "revenue", period: "this_period" }, snapshot());
    expect(reply).toContain("£4,280");
    expect(reply).toContain("up 19%");   // (4280-3600)/3600 ≈ 18.9 → rounds to 19
  });

  it("revenue with period=prior reports both periods", () => {
    const reply = answerBIQuestion({ kind: "revenue", period: "prior" }, snapshot());
    expect(reply).toContain("£3,600");
    expect(reply).toContain("£4,280");
  });

  it("profit stays silent about numbers when no cost data exists", () => {
    const reply = answerBIQuestion({ kind: "profit" }, snapshot());
    expect(reply).toContain("can't calculate profit");
    expect(reply).not.toMatch(/£\d/);
  });

  it("outstanding reports outstanding + overdue", () => {
    const reply = answerBIQuestion({ kind: "outstanding" }, snapshot());
    expect(reply).toContain("£1,200");
    expect(reply).toContain("£400");
  });

  it("conversion reports value + prior", () => {
    const reply = answerBIQuestion({ kind: "conversion" }, snapshot());
    expect(reply).toContain("42%");
    expect(reply).toContain("55%");
  });

  it("best_trade uses the leads_top_trade observation", () => {
    const reply = answerBIQuestion({ kind: "best_trade" }, snapshot());
    expect(reply).toContain("kitchens");
  });

  it("recommendations pulls warnings + alerts", () => {
    const reply = answerBIQuestion({ kind: "recommendations" }, snapshot());
    expect(reply).toContain("Quote conversion has fallen");
  });

  it("none produces empty reply", () => {
    expect(answerBIQuestion({ kind: "none" }, snapshot())).toBe("");
  });
});
