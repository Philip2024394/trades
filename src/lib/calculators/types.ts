// Calculator framework — shared types for every Material Calculator.
//
// Each calculator (paint, flooring, tiles, gravel, concrete, ...) lives
// as a pure-function math module (no React) consumed by a matching
// React component. Modules return a CalculatorOutput which the shared
// output panel renders + the share/cart buttons consume.
//
// Decoupling math from UI lets us unit-test the formulas and render
// estimates server-side for the shared-estimate read-only page.

import type { CalculatorType } from "@/lib/merchantCategories";

export type { CalculatorType };

/** Per-calc input shape — each calculator declares its own narrowed
 *  Inputs type and re-exports it. Stored on the share-estimate row so
 *  the read-only page can re-render the original inputs. */
export type CalculatorInputs = Record<string, string | number | boolean>;

/** A single line in the calculator's output card. Drives both the
 *  visual display ("You need 12 L of paint = 2 × 5L + 1 × 2.5L") and
 *  optionally an Add-to-Cart line when product_id + qty are set. */
export type CalculatorOutputLine = {
  /** Display label shown in the output panel. */
  label: string;
  /** Display value — pre-formatted string ("12 L", "3 boxes", "1.4 tonnes"). */
  value: string;
  /** Optional secondary text under the value (e.g. "2 × 5L + 1 × 2.5L"). */
  detail?: string;
  /** Optional accent — "primary" = headline, "warning" = yellow notice. */
  tone?: "primary" | "muted" | "warning";
  /** When set, "Add all to cart" includes this line as a cart entry. */
  cart?: {
    /** Product UUID — when omitted, line is informational only (e.g.
     *  underlay needed but we don't know which product on file). */
    product_id?: string;
    /** Quantity in product units (tins, boxes, bags, tonnes — whatever
     *  the merchant's product pricing is per). */
    qty: number;
    /** Display name + unit in the cart ("Dulux Vinyl Matt 5L"). */
    cart_label: string;
    /** Per-unit price in pence (snapshotted at render time so the
     *  add-to-cart price matches what the customer sees). */
    price_pence: number;
    /** Per-unit cover photo if available. */
    cover_url?: string | null;
  };
};

/** Optional installer-labour summary. Computed when the merchant of a
 *  service product has set service_rate_pence + service_rate_unit and
 *  the calculator can derive a quantity in that unit. */
export type CalculatorLabour = {
  trade_label: string;
  rate_pence: number;
  rate_unit: string;
  quantity: number;
  /** Pre-formatted total ("£432"). */
  total_pence: number;
};

export type CalculatorOutput = {
  lines: CalculatorOutputLine[];
  /** Inline warnings (e.g. "Fresh plaster? Mist coat first"). */
  warnings?: string[];
  /** Sub-total of cart lines in pence (excludes informational lines). */
  materials_total_pence: number;
  /** Optional installer labour breakdown when set. */
  labour?: CalculatorLabour;
};

/** Snapshot of a product's relevant fields for the calculator. We pass
 *  only what's needed to keep the calculator independent of the full
 *  HammerexXratedProduct shape (and serialisable for the share-estimate
 *  read-only page). */
export type CalculatorProductRef = {
  id: string;
  name: string;
  price_pence: number;
  cover_url: string | null;
  /** Per-product calculator config — coverage per unit, pack size,
   *  density, etc. Schema varies by CalculatorType; each calc reads its
   *  own expected keys with sensible UK defaults when fields are NULL. */
  calculator_config?: Record<string, unknown> | null;
  /** For service products — populated by the parent component when
   *  rendering an install-labour line. */
  service_trade_type?: string | null;
  service_rate_pence?: number | null;
  service_rate_unit?: string | null;
};
