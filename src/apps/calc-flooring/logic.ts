// calc-flooring — logic re-exports.

export {
  computeFlooring,
  flooringComplementarySubcategories,
  FLOORING_DEFAULT_INPUTS,
  FLOORING_DEFAULT_INPUTS_BY_SCENARIO,
  FLOORING_DEFAULT_SCENARIO,
  FLOORING_SCENARIO_LABEL
} from "@/lib/calculators/flooring";
export type {
  FlooringInputs,
  FlooringScenario
} from "@/lib/calculators/flooring";
export type {
  CalculatorOutput,
  CalculatorOutputLine,
  CalculatorProductRef
} from "@/lib/calculators/types";

import type { CalculatorProductRef } from "@/lib/calculators/types";

/** UK trade-price fallback — an 8mm laminate reference (1.62 m² per
 *  box, ~£24 per box). Used when the merchant hasn't hooked up their
 *  own product feed. All prices in pence. */
export const FALLBACK_FLOORING_PRODUCT: CalculatorProductRef = {
  id: "fallback-laminate-8mm",
  name: "Trade-grade 8mm laminate (reference)",
  price_pence: 2400,
  cover_url: null,
  calculator_config: {
    m2_per_box: 1.62,
    pack_label: "box"
  },
  service_trade_type: "floor-layer",
  service_rate_pence: 1800,
  service_rate_unit: "m2"
};
