// calc-plasterboard — logic re-exports.

export {
  computePlasterboard,
  plasterboardComplementarySubcategories,
  PLASTERBOARD_DEFAULT_INPUTS,
  PLASTERBOARD_DEFAULT_INPUTS_BY_SCENARIO,
  PLASTERBOARD_DEFAULT_SCENARIO,
  PLASTERBOARD_SCENARIO_LABEL
} from "@/lib/calculators/plasterboard";
export type {
  PlasterboardInputs,
  PlasterboardScenario
} from "@/lib/calculators/plasterboard";
export type {
  CalculatorOutput,
  CalculatorOutputLine,
  CalculatorProductRef
} from "@/lib/calculators/types";

import type { CalculatorProductRef } from "@/lib/calculators/types";

/** UK trade-price fallback — a standard 12.5 mm 1200×2400 sheet
 *  reference (~£9 per sheet). Used when the merchant hasn't hooked
 *  up their own product feed. */
export const FALLBACK_PLASTERBOARD_PRODUCT: CalculatorProductRef = {
  id: "fallback-plasterboard-1200x2400",
  name: "Trade-grade 12.5 mm plasterboard 1200×2400 (reference)",
  price_pence: 900,
  cover_url: null,
  calculator_config: {
    m2_per_sheet: 2.88,
    price_per_sheet_pence: 900
  },
  service_trade_type: "plasterer",
  service_rate_pence: 2500,
  service_rate_unit: "m2"
};
