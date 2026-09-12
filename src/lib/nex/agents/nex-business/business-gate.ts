// src/lib/nex/agents/nex-business/business-gate.ts
//
// WAVE-S-3 · Deterministic business classifier + safety signals
// Founder BEGIN WAVE-S-3 · 2026-09-08

import type { BusinessRequest, BusinessRequestKind, BusinessResponse, BusinessSafetySignal } from "./types";

export function classifyBusinessRequest(text: string): BusinessRequestKind {
  const t = (text ?? "").toLowerCase();
  if (!t) return "unknown";
  // Financial-advice boundary short-circuits · specialized handler owns it
  if (/\b(investment advice|invest in|stock pick|which stock|financial advice|should i buy|guaranteed return|guaranteed roi)\b/.test(t)) return "unknown";
  if (/\b(competitor|competition|competitive intel|market share|rival)\b/.test(t)) return "competitive_intel";
  if (/\b(pricing|price point|discount strategy|price elasticity|markdown)\b/.test(t)) return "pricing_analysis";
  if (/\b(forecast|projection|revenue projection|commercial forecast|revenue model)\b/.test(t)) return "commercial_forecast";
  if (/\b(kpi|dashboard|metrics report|report card|reporting)\b/.test(t)) return "kpi_reporting";
  if (/\b(marketing|copy|slogan|tagline|headline|ad copy|campaign)\b/.test(t)) return "marketing_copy";
  if (/\b(market size|market analysis|industry trends|market intelligence|market segment)\b/.test(t)) return "market_analysis";
  if (/\b(customer|user behavior|churn|retention|persona|segment)\b/.test(t)) return "customer_behavior";
  return "unknown";
}

const CONFIDENTIAL_DATA_PATTERNS = /\b(insider|leaked|confidential|non.public|private financials|nda)\b/;
const MISLEADING_MARKETING_PATTERNS = /\b(best in the world|number one guaranteed|100% success|zero risk|never fails)\b/;
const REGULATORY_KEYWORDS = /\b(gdpr|ccpa|fca|sec|ftc|cma|antitrust|monopoly)\b/;

export function detectBusinessSafetySignals(req: BusinessRequest, kind: BusinessRequestKind): BusinessSafetySignal[] {
  const out: BusinessSafetySignal[] = [];
  const text = (req.request_text ?? "").toLowerCase();

  // Financial-advice boundary · always flag when the query implies investment
  if (/\b(investment advice|invest in|stock pick|which stock|financial advice|should i buy|guaranteed return|guaranteed roi)\b/.test(text)) {
    out.push({
      kind: "financial_advice_boundary",
      description: "request touches investment / financial advice · NEX Phase 3 does not provide investment advice · disclaimer required",
    });
  }

  if (MISLEADING_MARKETING_PATTERNS.test(text)) {
    out.push({
      kind: "misleading_marketing_risk",
      description: "claim uses superlatives that likely violate advertising standards (ASA/FTC) · rephrase without unsupported absolutes",
    });
  }

  if (kind === "competitive_intel" && CONFIDENTIAL_DATA_PATTERNS.test(text)) {
    out.push({
      kind: "confidential_data_probe",
      description: "competitive-intel request asks for confidential / non-public information · refuse and rephrase around public sources",
    });
  }

  if (REGULATORY_KEYWORDS.test(text)) {
    const match = text.match(REGULATORY_KEYWORDS);
    out.push({
      kind: "regulatory_risk",
      regime: match ? match[0].toUpperCase() : "UNKNOWN",
      description: `request touches regulatory regime · specialized legal + jurisdictional review required`,
    });
  }

  // Unsupported-claim heuristic · specific to marketing_copy / commercial_forecast
  if ((kind === "marketing_copy" || kind === "commercial_forecast") &&
      /\b(guaranteed|always|never fails|proven to|definitely will)\b/.test(text)) {
    out.push({
      kind: "unsupported_claim",
      description: "claim uses absolute language · marketing/forecast should carry evidence + caveats · avoid unsupported certainty",
    });
  }

  if (out.length === 0) out.push({ kind: "no_business_safety_concern" });
  return out;
}

export function respondBusiness(req: BusinessRequest): BusinessResponse {
  const kind = classifyBusinessRequest(req.request_text);
  const signals = detectBusinessSafetySignals(req, kind);
  const has_serious = signals.some((s) => s.kind !== "no_business_safety_concern");
  // Phase 3 defers real-time market data + LLM-generated copy + forecast modeling
  const deferred = kind === "marketing_copy" || kind === "market_analysis" || kind === "commercial_forecast" || kind === "customer_behavior";
  const requires_review = has_serious || kind === "unknown" || kind === "competitive_intel";

  const lines: string[] = [];
  lines.push(`Business request classified as: ${kind}.`);
  if (deferred) lines.push("Phase 3 specialist does not generate copy / real market data / forecast models · deferred to Phase 4 (LLM via gateway + real data sources).");
  for (const s of signals) {
    if (s.kind === "no_business_safety_concern") continue;
    if (s.kind === "financial_advice_boundary") lines.push(`⚠️ NEX does not provide investment or financial advice. Speak to a licensed advisor for individual guidance.`);
    else if (s.kind === "confidential_data_probe") lines.push(`Confidentiality flag · NEX will not source confidential / non-public information about competitors.`);
    else if (s.kind === "misleading_marketing_risk") lines.push(`Advertising-standards flag · claims using absolute superlatives may violate ad standards.`);
    else if (s.kind === "regulatory_risk") lines.push(`Regulatory flag · ${s.regime} · specialized review required.`);
    else if (s.kind === "unsupported_claim") lines.push(`Unsupported-claim flag · evidence + caveats required.`);
  }

  return {
    request_id: req.request_id,
    detected_kind: kind,
    safety_signals: signals,
    advisory_text: lines.join(" "),
    requires_human_review: requires_review,
    deferred_to_phase_4: deferred,
  };
}
