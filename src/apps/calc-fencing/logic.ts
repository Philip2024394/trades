// calc-fencing — logic re-exports.

export {
  computeFencing,
  fencingComplementarySubcategories,
  FENCING_DEFAULT_INPUTS,
  FENCING_DEFAULT_INPUTS_BY_SCENARIO,
  FENCING_DEFAULT_SCENARIO,
  FENCING_SCENARIO_LABEL
} from "@/lib/calculators/fencing";
export type {
  FencingInputs,
  FencingScenario
} from "@/lib/calculators/fencing";
export type {
  CalculatorOutput,
  CalculatorOutputLine,
  CalculatorProductRef
} from "@/lib/calculators/types";

import type { CalculatorProductRef } from "@/lib/calculators/types";

/** UK trade-price fallback — standard 1.83 m × 1.83 m closeboard
 *  panel (~£40 at builders' merchants). */
export const FALLBACK_FENCING_PRODUCT: CalculatorProductRef = {
  id: "fallback-fencing-closeboard-1830",
  name: "Closeboard fence panel 1.83 × 1.83 m (reference)",
  price_pence: 4000,
  cover_url: null,
  calculator_config: {
    panel_width_m: 1.83
  },
  service_trade_type: "fencer",
  service_rate_pence: 3500,
  service_rate_unit: "linear_m"
};
