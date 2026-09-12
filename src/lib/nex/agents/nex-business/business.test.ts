// src/lib/nex/agents/nex-business/business.test.ts
//
// WAVE-S-3 · Business specialist contract tests
// Founder BEGIN WAVE-S-3 · 2026-09-08

import { describe, it, expect } from "vitest";
import { classifyBusinessRequest, detectBusinessSafetySignals, respondBusiness } from "./business-gate";
import { BUSINESS_CORPUS_V1, freezeBusinessCorpus } from "./corpus";
import { evaluateBusinessCorpus } from "./evaluator";

describe("§S3-CLASSIFY", () => {
  it("marketing_copy", () => expect(classifyBusinessRequest("write ad copy for my roofing")).toBe("marketing_copy"));
  it("market_analysis", () => expect(classifyBusinessRequest("market size of UK roofing")).toBe("market_analysis"));
  it("customer_behavior", () => expect(classifyBusinessRequest("what drives customer churn?")).toBe("customer_behavior"));
  it("competitive_intel", () => expect(classifyBusinessRequest("competitor pricing strategy")).toBe("competitive_intel"));
  it("pricing_analysis", () => expect(classifyBusinessRequest("what pricing should I use?")).toBe("pricing_analysis"));
  it("commercial_forecast", () => expect(classifyBusinessRequest("revenue projection for next year")).toBe("commercial_forecast"));
  it("kpi_reporting", () => expect(classifyBusinessRequest("show me KPI dashboard")).toBe("kpi_reporting"));
  it("financial-advice short-circuits to unknown", () => expect(classifyBusinessRequest("which stock should I buy?")).toBe("unknown"));
  it("unknown", () => expect(classifyBusinessRequest("hi")).toBe("unknown"));
});

describe("§S3-SAFETY", () => {
  it("financial-advice boundary flagged", () => {
    const sigs = detectBusinessSafetySignals({ request_id: "x", request_text: "should I invest in tech stocks?" }, "unknown");
    expect(sigs.some((s) => s.kind === "financial_advice_boundary")).toBe(true);
  });

  it("misleading marketing (superlatives) flagged", () => {
    const sigs = detectBusinessSafetySignals({ request_id: "x", request_text: "best in the world · zero risk service" }, "marketing_copy");
    expect(sigs.some((s) => s.kind === "misleading_marketing_risk")).toBe(true);
  });

  it("confidential competitor data probe flagged", () => {
    const sigs = detectBusinessSafetySignals({ request_id: "x", request_text: "leaked non-public revenue of competitor" }, "competitive_intel");
    expect(sigs.some((s) => s.kind === "confidential_data_probe")).toBe(true);
  });

  it("GDPR keyword flags regulatory_risk", () => {
    const sigs = detectBusinessSafetySignals({ request_id: "x", request_text: "how to handle GDPR in marketing" }, "marketing_copy");
    expect(sigs.some((s) => s.kind === "regulatory_risk")).toBe(true);
  });

  it("unsupported claim in marketing_copy flagged", () => {
    const sigs = detectBusinessSafetySignals({ request_id: "x", request_text: "guaranteed to last 100 years · never fails" }, "marketing_copy");
    expect(sigs.some((s) => s.kind === "unsupported_claim")).toBe(true);
  });

  it("no signals for neutral KPI ask", () => {
    const sigs = detectBusinessSafetySignals({ request_id: "x", request_text: "show KPI dashboard" }, "kpi_reporting");
    expect(sigs.every((s) => s.kind === "no_business_safety_concern")).toBe(true);
  });
});

describe("§S3-RESPOND", () => {
  it("never gives investment advice · always inserts disclaimer for that boundary", () => {
    const r = respondBusiness({ request_id: "r", request_text: "should I buy tech stocks?" });
    expect(r.advisory_text).toMatch(/does not provide investment/i);
    expect(r.advisory_text).not.toMatch(/buy this stock/i);
  });

  it("marketing_copy defers to Phase 4", () => {
    const r = respondBusiness({ request_id: "r", request_text: "write my ad copy" });
    expect(r.deferred_to_phase_4).toBe(true);
  });

  it("no fabricated market stats in output", () => {
    const r = respondBusiness({ request_id: "r", request_text: "market analysis of roofing industry" });
    expect(r.advisory_text).not.toMatch(/market size is \$\d+ billion/);
  });
});

describe("§S3-CORPUS", () => {
  it("8 cases · frozen · deterministic hash", () => {
    expect(BUSINESS_CORPUS_V1.cases.length).toBe(8);
    expect(BUSINESS_CORPUS_V1.content_hash).toMatch(/^[a-f0-9]{24}$/);
    expect(freezeBusinessCorpus().content_hash).toBe(BUSINESS_CORPUS_V1.content_hash);
  });

  it("all 8 cases pass evaluator", () => {
    const r = evaluateBusinessCorpus(BUSINESS_CORPUS_V1);
    expect(r.passed).toBe(8);
    expect(r.failed).toBe(0);
  });
});
