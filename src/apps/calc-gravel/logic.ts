// calc-gravel — logic re-exports.

export {
  computeGravel,
  gravelComplementarySubcategories,
  GRAVEL_DEFAULT_INPUTS,
  GRAVEL_DEFAULT_INPUTS_BY_SCENARIO,
  GRAVEL_DEFAULT_SCENARIO,
  GRAVEL_SCENARIO_LABEL
} from "@/lib/calculators/gravel";
export type {
  GravelInputs,
  GravelScenario
} from "@/lib/calculators/gravel";
export type {
  CalculatorOutput,
  CalculatorOutputLine,
  CalculatorProductRef
} from "@/lib/calculators/types";

import type { CalculatorProductRef } from "@/lib/calculators/types";

/** UK trade-price fallback — a 25 kg gravel bag (~£4.50 reference)
 *  with a bulk-bag threshold at 0.85 tonnes (~£65 reference). */
export const FALLBACK_GRAVEL_PRODUCT: CalculatorProductRef = {
  id: "fallback-gravel-25kg",
  name: "20 mm decorative gravel (25 kg reference)",
  price_pence: 450,
  cover_url: null,
  calculator_config: {
    kg_per_bag: 25,
    tonnes_per_bag: 0.85,
    price_per_25kg_pence: 450,
    price_per_bulk_bag_pence: 6500
  },
  service_trade_type: "landscape-gardener",
  service_rate_pence: 4000,
  service_rate_unit: "m3"
};
