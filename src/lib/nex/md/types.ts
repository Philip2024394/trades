// Nex Managing Director — composition-layer contracts.
//
// Where BI (Phase 5) reports merchant KPIs, PI (Phase 6) is per-project,
// Est (Phase 7) is per-job, and CX (Phase 8) is per-customer — MD is
// the LAYER ABOVE them all. It composes the four engines' outputs +
// adds the missing dimensions Phase 5 deliberately deferred:
//   • Cash flow forecast (30/60/90 days)
//   • Realised profit (from Est → Quote → Payments)
//   • Workforce utilisation
//   • Supplier ranking
//   • Seasonality forecast
//
// Every projected number carries an evidence chain. Nothing invented.

import type { Evidence } from "../pi/types";
export type { Evidence };

// ─── Cash flow ───────────────────────────────────────────────────

export type CashflowBucket = {
  /** ISO date the bucket ends on (inclusive). */
  end_date:   string;
  /** Best-guess money-in over the window from KNOWN sources (accepted
   *  quotes with sent_at, sitebook_costs coming due, invoice pipeline). */
  inflow_pence:  number;
  /** Money-out we can see (supplier invoices with due_at, planned costs
   *  merchant recorded). Today mostly zero until an expenses source
   *  lands — surfaces honestly. */
  outflow_pence: number;
  /** Net over the window. */
  net_pence:     number;
};

export type CashflowSnapshot = {
  currency:       "GBP";
  computed_at:    string;
  buckets:        CashflowBucket[];               // 30d, 60d, 90d
  /** Sum over the horizon. */
  horizon_pence:  number;
  /** Known outstanding money owed to us right now. */
  outstanding_now_pence: number;
  /** Known overdue money right now. */
  overdue_now_pence:     number;
  /** Pipeline: sent quotes not yet accepted/rejected × probability. */
  pipeline_weighted_pence: number;
  warnings:       string[];
  evidence:       Evidence;
};

// ─── Profit ──────────────────────────────────────────────────────

export type JobProfit = {
  quote_id:            string;
  title:               string;
  estimated_total_pence: number;    // what the merchant quoted
  materials_pence:     number;
  labour_pence:        number;
  overhead_pence:      number;
  profit_pence_planned: number;     // planned profit from the estimate
  paid_pence:          number;      // realised money-in so far
  status:              string;
  margin_pct_planned:  number;
  evidence:            Evidence;
};

export type ProfitSnapshot = {
  computed_at:  string;
  jobs:         JobProfit[];
  totals: {
    quoted_pence:    number;
    planned_profit_pence: number;
    weighted_margin_pct:  number;
  };
  low_margin_jobs: JobProfit[];    // jobs below merchant target
  target_margin_pct: number;
  warnings:      string[];
  evidence:      Evidence;
};

// ─── Workforce ───────────────────────────────────────────────────

export type WorkforceSnapshot = {
  computed_at:   string;
  active_projects_count: number;
  hours_last_30d: number;
  team_size_current: number;          // trades on ACTIVE projects
  utilisation_note:  string;          // human-readable ("2 trades, 6 open jobs — likely tight")
  bookings_next_14d: number;          // scheduled entries or jobs
  warnings:      string[];
  evidence:      Evidence;
};

// ─── Suppliers ───────────────────────────────────────────────────

export type SupplierRow = {
  supplier_key: string;               // trade_name where cost.kind='supplier' | 'materials'
  spend_pence:  number;
  cost_count:   number;
  latest_cost_at: string | null;
};

export type SupplierSnapshot = {
  computed_at: string;
  window_days: number;
  suppliers:   SupplierRow[];         // sorted spend desc
  total_spend_pence: number;
  evidence:    Evidence;
};

// ─── Forecast ────────────────────────────────────────────────────

export type ForecastSnapshot = {
  computed_at:    string;
  /** Best guess for next 30 days revenue based on accepted-quote
   *  velocity + last-month baseline. Null when data is too thin. */
  next_30d_revenue_pence:   number | null;
  /** Same, for the following 30 days. */
  next_60d_revenue_pence:   number | null;
  /** Historical monthly averages from the last 6 months (may be short). */
  monthly_avg_pence:        number | null;
  /** Best day-of-week for enquiries (from daily metrics). */
  best_day_of_week:         string | null;
  /** Any strong seasonality flags we can honestly report. */
  seasonality_notes:        string[];
  evidence:                 Evidence;
};

// ─── Priorities + Recommendations ────────────────────────────────

export type PriorityItem = {
  key:      string;
  source:   "bi" | "pi" | "cx" | "md_cashflow" | "md_profit" | "md_workforce" | "md_suppliers";
  severity: "alert" | "warning" | "notice" | "info";
  headline: string;
  detail?:  string;
  action?:  { label: string; href: string };
  evidence: Evidence;
};

export type Recommendation = {
  key:      string;
  action:   string;                   // what to do
  reason:   string;                   // why (evidence-linked)
  urgency:  "today" | "this_week" | "this_month";
  source:   PriorityItem["source"];
  evidence: Evidence;
};

// ─── The MD briefing ─────────────────────────────────────────────

export type MDHealth = {
  score:    number;                   // 0–100
  band:     "excellent" | "healthy" | "steady" | "attention" | "critical";
  headline: string;
  contributions: Array<{ engine: string; score: number | null; weight: number }>;
};

export type MDBriefing = {
  computed_at:      string;
  merchant_slug:    string;
  health:           MDHealth;
  cashflow:         CashflowSnapshot;
  profit:           ProfitSnapshot;
  workforce:        WorkforceSnapshot;
  suppliers:        SupplierSnapshot;
  forecast:         ForecastSnapshot;
  priorities:       PriorityItem[];       // top-N sorted by severity
  recommendations:  Recommendation[];     // actionable "do X because Y"
  errors:           Array<{ module: string; error: string }>;
};

export function evidenceFor(source: string, tables: string[] = []): Evidence {
  return {
    source,
    tables,
    computed_at: new Date().toISOString()
  };
}
