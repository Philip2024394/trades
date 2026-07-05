// calc-turf — logic re-exports.

export {
  computeTurf,
  turfComplementarySubcategories,
  TURF_DEFAULT_INPUTS,
  TURF_DEFAULT_INPUTS_BY_SCENARIO,
  TURF_DEFAULT_SCENARIO,
  TURF_SCENARIO_LABEL
} from "@/lib/calculators/turf";
export type { TurfInputs, TurfScenario } from "@/lib/calculators/turf";
export type {
  CalculatorOutput,
  CalculatorOutputLine,
  CalculatorProductRef
} from "@/lib/calculators/types";

import type { CalculatorProductRef } from "@/lib/calculators/types";

/** UK trade-price fallback — standard 1 m × 410 mm turf roll (~£4). */
export const FALLBACK_TURF_PRODUCT: CalculatorProductRef = {
  id: "fallback-turf-standard-roll",
  name: "Turf roll 1 m × 410 mm (reference)",
  price_pence: 400,
  cover_url: null,
  calculator_config: null,
  service_trade_type: "landscape-gardener",
  service_rate_pence: 1500,
  service_rate_unit: "m2"
};
