// calc-paving — logic re-exports.

export {
  computePaving,
  pavingComplementarySubcategories,
  PAVING_DEFAULT_INPUTS,
  PAVING_DEFAULT_INPUTS_BY_SCENARIO,
  PAVING_DEFAULT_SCENARIO,
  PAVING_SCENARIO_LABEL
} from "@/lib/calculators/paving";
export type { PavingInputs, PavingScenario } from "@/lib/calculators/paving";
export type {
  CalculatorOutput,
  CalculatorOutputLine,
  CalculatorProductRef
} from "@/lib/calculators/types";

import type { CalculatorProductRef } from "@/lib/calculators/types";

/** UK trade-price fallback — a 600×600 concrete patio slab. */
export const FALLBACK_PAVING_PRODUCT: CalculatorProductRef = {
  id: "fallback-paving-slab-600",
  name: "Concrete paving slab 600 × 600 mm (reference)",
  price_pence: 900,
  cover_url: null,
  calculator_config: {
    slab_w_mm: 600,
    slab_h_mm: 600
  },
  service_trade_type: "paver",
  service_rate_pence: 4500,
  service_rate_unit: "m2"
};
