// calc-paint — logic re-exports.
//
// Wraps the pure-function calculator from src/lib/calculators/paint.ts.
// No math lives here — this file exists so the app owns a stable API.

export {
  computePaint,
  paintComplementarySubcategories,
  PAINT_DEFAULT_INPUTS,
  PAINT_DEFAULT_INPUTS_BY_SCENARIO,
  PAINT_DEFAULT_SCENARIO,
  PAINT_SCENARIO_LABEL
} from "@/lib/calculators/paint";
export type {
  PaintInputs,
  PaintScenario
} from "@/lib/calculators/paint";
export type {
  CalculatorOutput,
  CalculatorOutputLine,
  CalculatorProductRef
} from "@/lib/calculators/types";

import type { CalculatorProductRef } from "@/lib/calculators/types";

/** UK trade-price fallback used when the merchant hasn't hooked up a
 *  product feed. Dulux Trade Vinyl Matt 5L reference price. Every
 *  price is pence. Updated 2026-07 from merchant benchmarks. */
export const FALLBACK_PAINT_PRODUCT: CalculatorProductRef = {
  id: "fallback-vinyl-matt-5l",
  name: "Trade-grade vinyl matt (5 L reference)",
  price_pence: 4900,
  cover_url: null,
  calculator_config: {
    coverage_m2_per_l: 12,
    pack_sizes_l: [10, 5, 2.5, 1]
  },
  service_trade_type: "painter",
  service_rate_pence: 2500,
  service_rate_unit: "hour"
};
