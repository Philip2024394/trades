// src/lib/nex/agents/nex-finance/types.ts
//
// K7 · Finance specialist · Phase 3 (deterministic · observer-only)
// Founder-authorised 2026-09-20 as part of NEX MASTER AUTONOMOUS build.
//
// Domain: invoicing · tax · payroll · accounting · budgeting · forecasting ·
// audit · compliance · general finance questions. Safety modes: unlicensed
// financial-advice boundary · regulated-tax-advice boundary · personal-info
// privacy · jurisdiction-specific claim boundary.
//
// This specialist NEVER provides regulated financial advice. It surfaces
// safety signals and defers to qualified advisors / official sources.

export type FinanceRequestKind =
  | "invoice"
  | "tax"
  | "payroll"
  | "expense"
  | "accounting"
  | "budget"
  | "forecast"
  | "audit"
  | "compliance"
  | "investment_query"
  | "unknown";

export type FinanceSafetySignal =
  | { kind: "regulated_financial_advice_boundary"; description: string }
  | { kind: "regulated_tax_advice_boundary"; description: string }
  | { kind: "personal_financial_info_privacy"; description: string }
  | { kind: "jurisdiction_specific"; description: string; regime_hint?: string }
  | { kind: "investment_advice_boundary"; description: string }
  | { kind: "no_finance_safety_concern" };

export type FinanceRequest = {
  request_id: string;
  request_text: string;
  jurisdiction?: string;
  business_type?: string;
};

export type FinanceResponse = {
  request_id: string;
  detected_kind: FinanceRequestKind;
  safety_signals: readonly FinanceSafetySignal[];
  advisory_text: string;
  requires_professional_advisor: boolean;
};
