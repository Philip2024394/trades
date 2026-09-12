// src/lib/nex/agents/nex-business/types.ts
//
// WAVE-S-3 · Business specialist · Phase 3 (deterministic · observer-only)
// Founder BEGIN WAVE-S-3 · 2026-09-08
//
// Domain: marketing · market intelligence · customer behavior ·
// commercial analysis. Failure modes: unsupported claim · misread
// market · financial advice boundary · competitive-intelligence line.

export type BusinessRequestKind =
  | "marketing_copy"
  | "market_analysis"
  | "customer_behavior"
  | "competitive_intel"
  | "pricing_analysis"
  | "commercial_forecast"
  | "kpi_reporting"
  | "unknown";

export type BusinessSafetySignal =
  | { kind: "financial_advice_boundary"; description: string }        // route to disclaimer · never give investment advice
  | { kind: "regulatory_risk"; regime: string; description: string }  // FCA · SEC · CMA · GDPR
  | { kind: "unsupported_claim"; description: string }                // e.g. "guaranteed ROI"
  | { kind: "confidential_data_probe"; description: string }          // asking for private competitor data
  | { kind: "misleading_marketing_risk"; description: string }        // ad-standards / superlatives
  | { kind: "no_business_safety_concern" };

export type BusinessRequest = {
  request_id: string;
  request_text: string;
  business_context?: string;      // e.g. "trades platform"
  jurisdiction?: string;          // "UK" · "US" · "ID"
};

export type BusinessResponse = {
  request_id: string;
  detected_kind: BusinessRequestKind;
  safety_signals: readonly BusinessSafetySignal[];
  advisory_text: string;
  requires_human_review: boolean;
  deferred_to_phase_4: boolean;
};

export type BusinessRubricCheck =
  | { check: "kind_classification_matches_expected"; ok: boolean; detail?: string }
  | { check: "safety_signals_present_when_expected"; ok: boolean; detail?: string }
  | { check: "no_financial_advice_no_guaranteed_returns"; ok: boolean; detail?: string }
  | { check: "no_fabricated_market_stats"; ok: boolean; detail?: string }
  | { check: "human_review_triggered_when_appropriate"; ok: boolean; detail?: string }
  | { check: "advisory_text_non_empty_and_bounded"; ok: boolean; detail?: string };

export type BusinessCorpusCase = {
  case_id: string;
  request: BusinessRequest;
  expected: {
    detected_kind: BusinessRequestKind;
    should_require_human_review: boolean;
    expected_safety_kinds: readonly BusinessSafetySignal["kind"][];
    should_defer_to_phase_4: boolean;
  };
  tags?: readonly string[];
};

export type BusinessCorpus = {
  version: string;
  authored_by: string;
  authored_at_iso: string;
  cases: readonly BusinessCorpusCase[];
  content_hash: string;
};

export type BusinessEvaluation = {
  case_id: string;
  passed: boolean;
  checks: readonly BusinessRubricCheck[];
  actual: BusinessResponse;
};
