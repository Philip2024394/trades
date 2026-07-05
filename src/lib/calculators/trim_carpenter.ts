// Trim Carpenter calculator — 7 UK carpenter services with per-unit
// pricing. The carpenter sets their rates; only services with rate > 0
// appear on the customer-facing quote.
//
// This is a pure labour-rate calculator — no material lookups. The
// carpenter's price is the finished-service price.

import type { CalculatorOutput, CalculatorProductRef } from "./types";

export type TrimService =
  | "skirting"
  | "door_frame_single"
  | "door_frame_double"
  | "architrave_single"
  | "architrave_double"
  | "window_board"
  | "loft_ladder";

export const TRIM_SERVICE_ORDER: readonly TrimService[] = [
  "skirting",
  "door_frame_single",
  "door_frame_double",
  "architrave_single",
  "architrave_double",
  "window_board",
  "loft_ladder"
];

export const TRIM_SERVICE_LABEL: Record<TrimService, string> = {
  skirting: "Skirting installation",
  door_frame_single: "Door frame — single door",
  door_frame_double: "Door frame — double door",
  architrave_single: "Architrave — single door",
  architrave_double: "Architrave — double door",
  window_board: "Window boards",
  loft_ladder: "Loft ladder installation"
};

/** Short-form unit label ("per m", "per door", "per install"). */
export const TRIM_SERVICE_UNIT_LABEL: Record<TrimService, string> = {
  skirting: "per metre",
  door_frame_single: "per single door",
  door_frame_double: "per double door",
  architrave_single: "per single door",
  architrave_double: "per double door",
  window_board: "per metre",
  loft_ladder: "per install"
};

/** Quantity noun ("metres", "doors", "installs"). Used in the result
 *  line to describe what the qty means. */
export const TRIM_SERVICE_QTY_NOUN: Record<TrimService, string> = {
  skirting: "metres",
  door_frame_single: "doors",
  door_frame_double: "double doors",
  architrave_single: "doors",
  architrave_double: "double doors",
  window_board: "metres",
  loft_ladder: "installs"
};

/** Whether the input takes fractional (metres) or integer (count). */
export const TRIM_SERVICE_IS_INTEGER: Record<TrimService, boolean> = {
  skirting: false,
  door_frame_single: true,
  door_frame_double: true,
  architrave_single: true,
  architrave_double: true,
  window_board: false,
  loft_ladder: true
};

export type TrimRates = Record<TrimService, number>; // pence per unit
export type TrimQuantities = Record<TrimService, number>;

/** UK trade-rate defaults in pence. Carpenters can override any of
 *  them via the "My rates" tab. */
export const DEFAULT_TRIM_RATES: TrimRates = {
  skirting: 2500, // £25 / m
  door_frame_single: 15000, // £150 / door
  door_frame_double: 25000, // £250 / double
  architrave_single: 6000, // £60 / door
  architrave_double: 10000, // £100 / double
  window_board: 3500, // £35 / m
  loft_ladder: 25000 // £250 / install
};

export const ZERO_TRIM_QUANTITIES: TrimQuantities = {
  skirting: 0,
  door_frame_single: 0,
  door_frame_double: 0,
  architrave_single: 0,
  architrave_double: 0,
  window_board: 0,
  loft_ladder: 0
};

export type TrimCarpenterInputs = {
  rates: TrimRates;
  quantities: TrimQuantities;
};

/** Returns only services the carpenter has priced (rate > 0). */
export function enabledTrimServices(rates: TrimRates): TrimService[] {
  return TRIM_SERVICE_ORDER.filter((s) => rates[s] > 0);
}

export function computeTrimCarpenter(
  inputs: TrimCarpenterInputs,
  _product?: CalculatorProductRef
): CalculatorOutput {
  void _product;
  const lines: CalculatorOutput["lines"] = [];
  let total = 0;

  for (const service of TRIM_SERVICE_ORDER) {
    const rate = inputs.rates[service];
    const qty = inputs.quantities[service];
    // Skip hidden services (no rate) AND zero-quantity services.
    if (rate <= 0) continue;
    if (qty <= 0) continue;
    const pence = Math.round(qty * rate);
    total += pence;
    const isInt = TRIM_SERVICE_IS_INTEGER[service];
    const qtyStr = isInt ? String(qty) : qty.toFixed(1);
    lines.push({
      label: TRIM_SERVICE_LABEL[service],
      value: `£${(pence / 100).toFixed(0)}`,
      detail: `${qtyStr} ${TRIM_SERVICE_QTY_NOUN[service]} × £${(rate / 100).toFixed(2)} ${TRIM_SERVICE_UNIT_LABEL[service]}`,
      tone: "muted"
    });
  }

  // Grand total headline
  if (lines.length > 0) {
    lines.unshift({
      label: "Total quote",
      value: `£${(total / 100).toFixed(0)}`,
      detail: `${lines.length} service line${lines.length === 1 ? "" : "s"} · finished-service price`,
      tone: "primary"
    });
  }

  return {
    lines,
    materials_total_pence: total,
    warnings:
      total === 0
        ? [
            "Enter quantities on the Get a quote tab, or add prices in My rates first."
          ]
        : []
  };
}

export const TRIM_CARPENTER_DEFAULT_INPUTS: TrimCarpenterInputs = {
  rates: DEFAULT_TRIM_RATES,
  quantities: ZERO_TRIM_QUANTITIES
};
