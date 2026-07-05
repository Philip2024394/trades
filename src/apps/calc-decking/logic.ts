// calc-decking — logic re-exports.

export {
  computeDecking,
  deckingComplementarySubcategories,
  DECKING_DEFAULT_INPUTS,
  DECKING_DEFAULT_INPUTS_BY_SCENARIO,
  DECKING_DEFAULT_SCENARIO,
  DECKING_SCENARIO_LABEL
} from "@/lib/calculators/decking";
export type {
  DeckingInputs,
  DeckingScenario
} from "@/lib/calculators/decking";
export type {
  CalculatorOutput,
  CalculatorOutputLine,
  CalculatorProductRef
} from "@/lib/calculators/types";

import type { CalculatorProductRef } from "@/lib/calculators/types";

/** UK trade-price fallback — 144×28 mm × 3.6 m softwood decking
 *  board. Standard 3.6 m length used everywhere in the calc. */
export const FALLBACK_DECKING_PRODUCT: CalculatorProductRef = {
  id: "fallback-decking-144x28-3600",
  name: "Softwood decking board 144 × 28 mm × 3.6 m (reference)",
  price_pence: 1400,
  cover_url: null,
  calculator_config: {
    board_length_m: 3.6,
    board_width_mm: 144
  },
  service_trade_type: "carpenter",
  service_rate_pence: 3500,
  service_rate_unit: "m2"
};
