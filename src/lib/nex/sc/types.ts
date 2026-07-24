// Nex Supply Chain Intelligence — contracts.
//
// SC is a PLANNING + REASONING layer on top of what exists today.
// The spec asks for many capabilities that need data sources not
// present in the codebase (live stock levels, live supplier prices,
// barcode scanning, delivery-tracking API, hire equipment). Rather
// than fabricate, SC ships:
//   • Shopping list from UPCOMING JOBS — genuinely buildable today
//   • Supplier profile w/ reliability from paid-on-time history
//   • Waste = estimated vs actual per project
//   • Alternatives from the knowledge engine
//   • Delivery-date suggestions from median lead-time
//
// Missing sources are surfaced honestly as `null` / "no source yet".
// Voice: NOT wired (memory rule: no voice in purchasing path).
// Auto-execution: NOT wired (spec rule: merchant approval remains
// the default; SC ships recommendations only).

import type { Evidence } from "../pi/types";
export type { Evidence };

// ─── Shopping list ───────────────────────────────────────────────

export type ShoppingLine = {
  /** Sha of (sku ?? label lowercased) — stable dedupe key. */
  key:              string;
  sku:              string | null;
  label:            string;                 // "Plasterboard 2400×1200"
  unit:             string | null;          // "board" | "bag" | "m" | …
  qty_needed:       number;                 // aggregate across all upcoming jobs
  est_cost_pence:   number;                 // aggregate cost from quote items
  /** Which upcoming jobs contributed to this line. */
  jobs:             Array<{
    job_id:         string;
    title:          string;
    scheduled_start_date: string | null;
    qty:            number;
  }>;
  evidence:         Evidence;
};

export type ShoppingList = {
  window_days:      number;
  jobs_count:       number;
  lines:            ShoppingLine[];
  total_pence:      number;
  warnings:         string[];
  evidence:         Evidence;
};

// ─── Waste variance ──────────────────────────────────────────────

export type WasteRow = {
  project_id:            string;
  project_title:         string;
  estimated_materials_pence: number;      // from quote_items (kind=material)
  actual_materials_pence:    number;      // from sitebook_costs (kind=materials, paid)
  variance_pence:            number;      // actual - estimated
  variance_pct:              number | null;
  evidence:                  Evidence;
};

export type WasteSummary = {
  window_days:               number;
  projects:                  WasteRow[];     // sorted worst variance first
  total_variance_pence:      number;
  average_variance_pct:      number | null;
  warnings:                  string[];
  evidence:                  Evidence;
};

// ─── Supplier profile ────────────────────────────────────────────

export type SupplierProfile = {
  supplier_key:              string;         // trade_name from cost rows
  spend_pence:               number;
  cost_count:                number;
  latest_cost_at:            string | null;
  /** Pct of costs settled with paid_pence >= agreed_pence within due
   *  date (or without a due date). Null when history is thin. */
  paid_on_time_pct:          number | null;
  /** Optional last-known unit price for a specific kind, if surfaced
   *  by a matching label. Empty when nothing labelled matches. */
  latest_prices:             Array<{ label: string; unit_price_pence: number; when: string }>;
  evidence:                  Evidence;
};

export type SupplierProfiles = {
  window_days:               number;
  suppliers:                 SupplierProfile[];   // sorted spend desc
  warnings:                  string[];
  evidence:                  Evidence;
};

// ─── Alternatives ────────────────────────────────────────────────

export type AlternativeItem = {
  label:         string;
  reason:        string;                 // why suitable
  source_url?:   string | null;
  evidence:      Evidence;
};

export type AlternativesAnswer = {
  query:         string;
  alternatives:  AlternativeItem[];
  note:          string;                 // honest note when nothing found
  evidence:      Evidence;
};

// ─── Delivery planning ───────────────────────────────────────────

export type DeliverySuggestion = {
  supplier_key:     string;
  material_hint:    string;
  lead_time_days:   number;
  lead_time_source: "history_median" | "engine_default";
  target_delivery:  string;             // ISO date
  suggested_order_by: string;           // ISO date
  reason:           string;
  evidence:         Evidence;
};

// ─── The Supply Chain snapshot ───────────────────────────────────

export type SupplyChainSnapshot = {
  computed_at:      string;
  merchant_slug:    string;
  shopping_list:    ShoppingList;
  waste:            WasteSummary;
  suppliers:        SupplierProfiles;
  /** Missing-source disclosure — merchants see what SC CANNOT do yet
   *  so they never trust a silent zero. */
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
