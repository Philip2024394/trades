// calc-mortar — logic re-exports.

export {
  computeMortar,
  mortarComplementarySubcategories,
  MORTAR_DEFAULT_INPUTS,
  MORTAR_DEFAULT_INPUTS_BY_SCENARIO,
  MORTAR_DEFAULT_SCENARIO,
  MORTAR_SCENARIO_LABEL
} from "@/lib/calculators/mortar";
export type {
  MortarInputs,
  MortarScenario
} from "@/lib/calculators/mortar";
export type {
  CalculatorOutput,
  CalculatorOutputLine,
  CalculatorProductRef
} from "@/lib/calculators/types";

import type { CalculatorProductRef } from "@/lib/calculators/types";

/** UK trade-price fallback — a 25 kg pre-mix mortar bag reference
 *  (~£5.50 per bag). Used when the merchant hasn't hooked up their
 *  own product feed. */
export const FALLBACK_MORTAR_PRODUCT: CalculatorProductRef = {
  id: "fallback-mortar-25kg",
  name: "Trade-grade 25 kg pre-mix mortar (reference)",
  price_pence: 550,
  cover_url: null,
  calculator_config: {
    kg_per_bag: 25,
    price_per_bag_pence: 550
  },
  service_trade_type: "bricklayer",
  service_rate_pence: 8500,
  service_rate_unit: "m2"
};
