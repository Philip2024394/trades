// Nex Financial Intelligence — contracts.
//
// FI is a COMPOSITION LAYER over the existing engines:
//   • BI (Phase 5)  ships the invoices/quotes adapters + booked revenue
//   • PI (Phase 6)  ships per-project costs
//   • Est (Phase 7) ships the cost decomposition (materials / labour /
//                   overhead / profit / VAT) + merchant defaults
//   • CX (Phase 8)  ships per-customer + cross-customer payments owed
//   • MD (Phase 9)  ships cash flow + realised profit + suppliers +
//                   forecast + priorities + recommendations
//
// This module adds what none of them cover:
//   • Revenue rollups (per-customer / per-trade / per-project type)
//   • Expense categorisation (from cost.kind + explicit unknowns)
//   • VAT summary (payable vs reclaimable, with tax-advice disclaimer)
//   • Affordability check ("can I afford X?" with a decision + reason)
//   • Dedicated Financial Health score
//
// Every projected number carries an evidence chain. Where a category
// has no source yet (vehicles, insurance, subscriptions), the field
// stays null and is surfaced as "not tracked yet" — never fabricated.

import type { Evidence } from "../pi/types";
export type { Evidence };

// ─── Revenue ─────────────────────────────────────────────────────

export type RevenueRow = {
  key:          string;
  label:        string;
  amount_pence: number;
  count:        number;
};

export type RevenueBreakdown = {
  window_days:  number;
  total_pence:  number;
  by_customer:  RevenueRow[];        // top N contacts by booked revenue
  by_project:   RevenueRow[];        // top N by revenue on their quotes
  by_kind:      RevenueRow[];        // cost.kind (labour / materials / …) share of booked
  evidence:     Evidence;
};

// ─── Expenses ────────────────────────────────────────────────────

export type ExpenseCategoryRow = {
  key:          string;              // "materials" | "labour" | "supplier" | …
  label:        string;
  spend_pence:  number;
  cost_count:   number;
};

export type ExpenseBreakdown = {
  window_days:      number;
  total_pence:      number;
  categories:       ExpenseCategoryRow[];
  /** Categories the spec lists we can't source yet (vehicles /
   *  insurance / fuel / subscriptions / training). Surfaced honestly
   *  so the merchant knows what's NOT included. */
  untracked_note:   string;
  evidence:         Evidence;
};

// ─── VAT summary ─────────────────────────────────────────────────

export type VATSummary = {
  window_days:            number;
  vat_rate_pct:           number;
  /** Output VAT — from accepted quotes' vat_pence sum. */
  vat_payable_pence:      number;
  /** Input VAT — cost-side reclaimable (estimated at same rate on
   *  materials/supplier cost lines). Only rough — merchant's accountant
   *  is authoritative. */
  vat_reclaimable_est_pence: number;
  vat_net_pence:          number;
  disclaimer:             string;   // "Never claim to replace professional tax advice"
  evidence:               Evidence;
};

// ─── Affordability ───────────────────────────────────────────────

export type AffordabilityAnswer = {
  purchase_label:      string;
  purchase_pence:      number;
  /** Verdict: yes / stretch / no. Every verdict carries a reason. */
  verdict:             "yes" | "stretch" | "no" | "unknown";
  reason:              string;
  /** Cash-flow horizon (30-day net) at time of check. */
  cash_horizon_pence:  number;
  safety_buffer_pence: number;
  /** How much of the 90-day net remains after the purchase. */
  remaining_pence:     number;
  evidence:            Evidence;
};

// ─── Financial health ────────────────────────────────────────────

export type FinancialHealth = {
  score:    number;                  // 0–100
  band:     "excellent" | "healthy" | "steady" | "attention" | "critical";
  headline: string;
  signals: {
    cash_flow:    { score: number | null; note: string };
    profit:       { score: number | null; note: string };
    payment_speed: { score: number | null; note: string };
    growth:       { score: number | null; note: string };
    stability:    { score: number | null; note: string };
  };
};

// ─── The finance snapshot ────────────────────────────────────────

export type FinancialSnapshot = {
  computed_at:     string;
  merchant_slug:   string;
  currency:        "GBP";
  health:          FinancialHealth;
  revenue:         RevenueBreakdown;
  expenses:        ExpenseBreakdown;
  vat:             VATSummary;
  /** Fields sourced straight from the MD briefing — kept as sub-refs
   *  so callers see the full picture without extra queries. */
  cashflow_ref:    {
    outstanding_now_pence: number;
    overdue_now_pence:     number;
    pipeline_weighted_pence: number;
    next_30d_net_pence:    number;
    next_60d_net_pence:    number;
    next_90d_net_pence:    number;
  };
  profit_ref:      {
    quoted_pence:            number;
    planned_profit_pence:    number;
    weighted_margin_pct:     number;
    target_margin_pct:       number;
    low_margin_jobs_count:   number;
  };
  suppliers_ref:   {
    total_spend_pence: number;
    supplier_count:    number;
  };
  errors:          Array<{ module: string; error: string }>;
};

export function evidenceFor(source: string, tables: string[] = []): Evidence {
  return {
    source,
    tables,
    computed_at: new Date().toISOString()
  };
}
