// calc-bricks — logic re-exports.

export {
  computeBricks,
  bricksComplementarySubcategories,
  BRICKS_DEFAULT_INPUTS,
  BRICKS_DEFAULT_INPUTS_BY_SCENARIO,
  BRICKS_DEFAULT_SCENARIO,
  BRICKS_SCENARIO_LABEL
} from "@/lib/calculators/bricks";
export type {
  BricksInputs,
  BricksScenario
} from "@/lib/calculators/bricks";
export type {
  CalculatorOutput,
  CalculatorOutputLine,
  CalculatorProductRef
} from "@/lib/calculators/types";

import type { CalculatorProductRef } from "@/lib/calculators/types";

/** UK trade-price fallback — a mid-range facing brick reference pack
 *  (500 bricks per pack, ~£350 per pack). Used when the merchant
 *  hasn't hooked up their own product feed. */
export const FALLBACK_BRICKS_PRODUCT: CalculatorProductRef = {
  id: "fallback-facing-brick-pack500",
  name: "Trade-grade facing brick (500-pack reference)",
  price_pence: 35000,
  cover_url: null,
  calculator_config: {
    units_per_pack: 500,
    unit_label: "brick"
  },
  service_trade_type: "bricklayer",
  service_rate_pence: 8500,
  service_rate_unit: "m2"
};
