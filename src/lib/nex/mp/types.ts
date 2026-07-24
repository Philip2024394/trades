// Nex Marketplace Intelligence — contracts.
//
// MP is a SEARCH + REASONING layer over the platform's existing
// product catalogues (hammerex_xrated_products, hammerex_canteen_products,
// app_products_merchant_offers). It ranks listings by price + stock +
// lead time + merchant trust. It never invents products or prices.
//
// Honest constraints:
//   • No external supplier feed. All results come from platform-hosted
//     listings.
//   • No live-checkout / payments / trade credit. Ranked results, no
//     transaction — merchant handles the buy off-platform.
//   • No equipment hire directory, no manufacturer partner registry,
//     no finance/insurance referrals. Surface honestly in `unavailable`.

import type { Evidence } from "../pi/types";
export type { Evidence };

/** A single unified product/offer row across the three source tables. */
export type ProductListing = {
  key:              string;                    // stable dedupe key
  source:           "xrated_products" | "canteen_products" | "merchant_offers";
  source_id:        string;
  name:             string;
  description:      string | null;
  price_pence:      number | null;             // null when the source didn't publish a price
  rrp_pence:        number | null;
  unit:             string | null;             // "each" | "pack" | "m2" | "board" | …
  category:         string | null;
  merchant_slug:    string | null;
  merchant_name:    string | null;
  merchant_city:    string | null;
  stock_status:     "in_stock" | "low_stock" | "out_of_stock" | "unknown";
  lead_time_days:   number | null;
  distance_km:      number | null;             // when origin supplied
  cover_url:        string | null;
  evidence:         Evidence;
};

// ─── Basket / normalised buying request ─────────────────────────

export type ProductRequest = {
  raw:              string;                    // the original ask
  keyword:          string;                    // normalised search term
  qty:              number | null;             // parsed qty or null
  unit:             string | null;             // "block" | "board" | "m2" | …
  hint_area_m2?:    number;                    // when translated from an area
  parsed_confidence: "high" | "medium" | "low";
  parse_reason:     string;
};

// ─── Ranking ─────────────────────────────────────────────────────

export type RankedListing = {
  listing:         ProductListing;
  score:           number;                     // 0–100
  score_breakdown: {
    price:         number | null;              // lower is better
    stock:         number | null;              // in_stock > low_stock > oos
    lead_time:     number | null;              // shorter is better
    distance:      number | null;              // closer is better
    trust:         number | null;              // supplier trust profile
  };
  reason:          string;                     // why it ranked here
};

export type SearchResult = {
  request:         ProductRequest;
  results:         RankedListing[];
  warnings:        string[];
  unavailable:     string[];
  evidence:        Evidence;
};

// ─── Procurement advice ─────────────────────────────────────────

export type ProcurementSaving = {
  material_label:  string;
  current_cost_pence: number;
  alternative:     ProductListing;
  saving_pence:    number;
  reason:          string;
  evidence:        Evidence;
};

export type ProcurementAdvice = {
  project_id:      string;
  savings:         ProcurementSaving[];
  total_saving_pence: number;
  warnings:        string[];
  evidence:        Evidence;
};

export function evidenceFor(source: string, tables: string[] = []): Evidence {
  return {
    source,
    tables,
    computed_at: new Date().toISOString()
  };
}

export const UNAVAILABLE_TODAY = [
  "External supplier catalogues (Jewson, Travis, Wickes, etc.) — no live-price feed wired.",
  "Equipment hire directory (scaffolding / diggers / mixers) — no hire-catalogue table.",
  "Manufacturer partner registry — no manufacturer table.",
  "Finance + insurance referrals — no referral-partner table.",
  "One-click purchasing / trade-credit / deposits — no payments-integration wired.",
  "Delivery tracking — no logistics API.",
  "Auto-purchasing on merchant's behalf — approval workflow (surface + rank, don't buy)."
];
