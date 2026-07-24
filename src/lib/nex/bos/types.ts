// Nex Business Operating System — Phase 25 contracts.
//
// BOS is the composition layer that turns Nex from an intelligence
// platform into an operating system. It reads FI + PM + SC + NET + BI
// data (no writes, no persistence) and produces:
//
//   1. RiskSignal[]     — predictive project risks (schedule / cost /
//                          cash / workforce / material)
//   2. GrowthOpportunity[] — pattern-detected upsell/campaign chances
//   3. IndustrySignal[]  — market-level shifts (regional demand, price
//                          movement) — evidence-only, never fabricated
//   4. DecisionSuggestion — "can I afford X? if yes, when?" answer
//   5. ActionSuggestion[] — approval-gated draft actions
//   6. MorningReport      — the daily one-block narrative
//
// Every field carries an Evidence chain. Never persists. Never sends.

import type { Evidence } from "../pi/types";
export type { Evidence };

// ─── Risk signals (predictive project intelligence) ─────────────

export type RiskCategory =
  | "schedule"
  | "cost"
  | "cash"
  | "workforce"
  | "material"
  | "profit";

export type RiskSeverity = "critical" | "warning" | "notice";

export type RiskSignal = {
  category:            RiskCategory;
  severity:            RiskSeverity;
  project_id?:         string;
  project_title?:      string;
  /** Rough probability the risk manifests. Derived from measured
   *  signals — never guessed. Nullable when we can't compute it
   *  honestly. */
  probability_pct:     number | null;
  /** The gap in money terms (over-budget by, cash short by, etc.).
   *  Zero when the risk is qualitative. */
  impact_pence:        number;
  /** Human-readable one-line summary. */
  headline:            string;
  /** Why we flagged it — every signal must justify itself. */
  reason:              string;
  /** The single next step the merchant should consider. Actionable,
   *  never vague. */
  suggested_action:    string;
  evidence:            Evidence;
};

// ─── Growth opportunities ───────────────────────────────────────

export type GrowthOpportunityKind =
  | "package"           // "you completed N X projects — package it"
  | "campaign"          // "3 similar bathroom searches in your area"
  | "referral"          // "customer X gave you 5★ — ask for a referral"
  | "follow_up"         // "quote sent 21 days ago — chase"
  | "expansion";        // "adjacent trade you don't offer yet"

export type GrowthOpportunity = {
  kind:              GrowthOpportunityKind;
  headline:          string;
  reason:            string;
  suggested_action:  string;
  /** Estimated revenue upside if pursued. Nullable when we can't
   *  size it honestly. */
  upside_pence:      number | null;
  evidence:          Evidence;
};

// ─── Industry signals ───────────────────────────────────────────

export type IndustrySignalKind =
  | "demand_shift"
  | "price_movement"
  | "competition_change"
  | "regulation_change"
  | "trend";

export type IndustrySignal = {
  kind:          IndustrySignalKind;
  headline:      string;
  /** Percentage change vs prior window. Nullable when only direction
   *  is known. */
  change_pct:    number | null;
  /** The observation window that produced this signal. */
  window_days:   number;
  reason:        string;
  evidence:      Evidence;
};

// ─── Decision engine ────────────────────────────────────────────

export type DecisionInput = {
  purchase_label:    string;
  purchase_pence:    number;
  /** How urgent is this? Affects whether "wait 45 days" is offered. */
  urgency:           "now" | "soon" | "flexible";
};

export type DecisionSuggestion = {
  input:                DecisionInput;
  verdict:              "yes" | "wait" | "no" | "unknown";
  wait_days:            number | null;
  reason:               string;
  /** Cash horizon at check time. */
  cash_horizon_pence:   number;
  /** Optional footnote to help the merchant decide. */
  footnote:             string;
  evidence:             Evidence;
};

// ─── Action suggestions (approval-gated) ────────────────────────

export type ActionKind =
  | "send_reminder"
  | "draft_quote"
  | "draft_invoice"
  | "follow_up_customer"
  | "update_project_status"
  | "generate_report"
  | "recommend_supplier";

export type ActionSuggestion = {
  kind:                ActionKind;
  target_label:        string;                // "Smith kitchen invoice £8,400"
  /** Draft content Nex prepared. Merchant must approve before send. */
  draft:               string;
  requires_approval:   true;                  // always true — belt+braces
  reason:              string;
  evidence:            Evidence;
};

// ─── The Morning Intelligence Report ────────────────────────────

export type MorningReport = {
  computed_at:      string;
  merchant_slug:    string;
  merchant_name:    string;
  greeting:         string;
  /** One-line overall status: "3 warnings, 1 growth opportunity, 1
   *  decision to make". */
  overall_headline: string;
  risks:            RiskSignal[];
  growth:           GrowthOpportunity[];
  industry:         IndustrySignal[];
  decisions:        DecisionSuggestion[];
  actions:          ActionSuggestion[];
  /** Fields we couldn't compute honestly this run. Surfaced not hidden. */
  unavailable:      string[];
  errors:           Array<{ module: string; error: string }>;
};

export function evidenceFor(source: string, tables: string[] = []): Evidence {
  return {
    source,
    tables,
    computed_at: new Date().toISOString()
  };
}
