// src/lib/nex/agents/nex-finance/finance-gate.ts
//
// K7 · Deterministic finance classifier + safety signals.
// Founder-authorised 2026-09-20 as part of NEX MASTER AUTONOMOUS build.
//
// STRICT DISCIPLINE: NEX never provides regulated financial advice. Investment,
// insurance, tax-optimisation, and regulated advice queries always surface a
// professional-advisor boundary signal.

import type { FinanceRequest, FinanceRequestKind, FinanceSafetySignal } from "./types";

const INVESTMENT_ADVICE_KEYWORDS = /\b(?:should i (?:buy|sell|invest)|recommend .* stock|which stocks|is .* a good investment|portfolio allocation|financial adviser|investment strategy|when to (?:buy|sell))\b/i;
const REGULATED_TAX_ADVICE_KEYWORDS = /\b(?:tax optimi[sz]ation|reduce my tax bill|(?:avoid|minimise|minimize) (?:paying )?taxes?|tax loophole|offshore (?:tax|structure)|tax haven|specific tax return advice)\b/i;
const PERSONAL_FINANCIAL_INFO_KEYWORDS = /\b(?:my bank account|my salary|my income|my credit score|my savings|my mortgage|my pension|my crypto wallet)\b/i;

export function classifyFinanceRequest(text: string): FinanceRequestKind {
  const t = (text ?? "").toLowerCase();
  if (!t) return "unknown";
  // Investment advice check runs first (safety-critical)
  if (INVESTMENT_ADVICE_KEYWORDS.test(t)) return "investment_query";
  // Compliance / audit (specific vocabulary)
  if (/\b(?:audit|compliance|regulatory (?:filing|requirement)|sox|gaap|ifrs)\b/i.test(t)) {
    if (/\baudit\b/i.test(t)) return "audit";
    return "compliance";
  }
  // Tax (broad)
  if (/\b(?:tax|vat|value added tax|corporation tax|paye|payroll tax|sales tax|self assessment|hmrc|irs)\b/i.test(t)) return "tax";
  // Payroll
  if (/\b(?:payroll|salary|wages|paye|superannuation|401k|national insurance)\b/i.test(t)) return "payroll";
  // Invoice
  if (/\b(?:invoice|invoicing|billing|receivable|payable|remittance)\b/i.test(t)) return "invoice";
  // Expense
  if (/\b(?:expense|expenditure|reimburse|receipt|petty cash)\b/i.test(t)) return "expense";
  // Budget / forecast
  if (/\b(?:budget|budgeting|forecast|projection|cash ?flow|p&l|profit and loss|balance sheet)\b/i.test(t)) {
    if (/\bforecast|projection\b/i.test(t)) return "forecast";
    return "budget";
  }
  // Accounting (general)
  if (/\b(?:accounting|bookkeeping|ledger|reconciliation|accrual|depreciation|amortisation|amortization)\b/i.test(t)) return "accounting";
  return "unknown";
}

export function detectFinanceSafetySignals(req: FinanceRequest, kind: FinanceRequestKind): FinanceSafetySignal[] {
  const out: FinanceSafetySignal[] = [];
  const text = (req.request_text ?? "").toLowerCase();
  const jur = req.jurisdiction;

  if (kind === "investment_query" || INVESTMENT_ADVICE_KEYWORDS.test(text)) {
    out.push({
      kind: "investment_advice_boundary",
      description: "regulated investment advice · NEX is not a licensed adviser · defer to an FCA/SEC-authorised financial adviser or the relevant local regulator",
    });
  }

  if (kind === "tax" || REGULATED_TAX_ADVICE_KEYWORDS.test(text)) {
    out.push({
      kind: "regulated_tax_advice_boundary",
      description: "tax advice is jurisdiction-specific and regulated · NEX may explain general concepts but never give personalised tax advice · consult HMRC/IRS/local revenue authority or a chartered accountant",
      regime_hint: taxRegimeHint(text, jur),
    });
  }

  if (kind === "payroll") {
    out.push({
      kind: "jurisdiction_specific",
      description: "payroll rules vary by jurisdiction · confirm with local payroll authority",
      regime_hint: taxRegimeHint(text, jur),
    });
  }

  if (kind === "compliance" || kind === "audit") {
    out.push({
      kind: "regulated_financial_advice_boundary",
      description: "compliance/audit is regulated · defer to a qualified auditor / compliance officer · NEX may summarise principles but not sign off",
    });
  }

  if (PERSONAL_FINANCIAL_INFO_KEYWORDS.test(text)) {
    out.push({
      kind: "personal_financial_info_privacy",
      description: "message references personal financial details · NEX does not store personal financial data unless explicitly authorised by governance",
    });
  }

  if (out.length === 0) out.push({ kind: "no_finance_safety_concern" });
  return out;
}

function taxRegimeHint(text: string, jurisdiction?: string): string {
  const jur = (jurisdiction ?? "").toLowerCase();
  const t = text.toLowerCase();
  if (jur.startsWith("uk") || /\b(uk|britain|united kingdom|england|scotland|wales|hmrc|paye)\b/.test(t)) return "UK · HMRC · check gov.uk";
  if (jur.startsWith("us") || /\b(us|usa|united states|america|irs)\b/.test(t)) return "US · IRS · check irs.gov";
  if (jur.startsWith("id") || /\bindonesia\b/.test(t)) return "ID · DGT (Direktorat Jenderal Pajak) · check pajak.go.id";
  if (jur.startsWith("au") || /\baustralia\b/.test(t)) return "AU · ATO · check ato.gov.au";
  if (jur.startsWith("eu") || /\b(eu|europe)\b/.test(t)) return "EU · member-state tax authority applies";
  return "consult the tax authority for the applicable jurisdiction";
}
