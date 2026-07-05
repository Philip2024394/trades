// calc-concrete — logic re-exports.

export {
  computeConcrete,
  concreteComplementarySubcategories,
  CONCRETE_DEFAULT_INPUTS,
  CONCRETE_DEFAULT_INPUTS_BY_SCENARIO,
  CONCRETE_DEFAULT_SCENARIO,
  CONCRETE_SCENARIO_LABEL
} from "@/lib/calculators/concrete";
export type {
  ConcreteInputs,
  ConcreteScenario
} from "@/lib/calculators/concrete";
export type {
  CalculatorOutput,
  CalculatorOutputLine,
  CalculatorProductRef
} from "@/lib/calculators/types";

import type { CalculatorProductRef } from "@/lib/calculators/types";

/** UK trade-price fallback — a 20 kg pre-mixed concrete bag reference
 *  (~£6 per bag). Used when the merchant hasn't hooked up their own
 *  product feed. Real bulk-buy discounts and ready-mix truck pricing
 *  would kick in for slabs > 3 m³. */
export const FALLBACK_CONCRETE_PRODUCT: CalculatorProductRef = {
  id: "fallback-concrete-20kg",
  name: "Trade-grade 20 kg pre-mixed concrete (reference)",
  price_pence: 600,
  cover_url: null,
  calculator_config: {
    pack_kg: 20,
    price_per_bag_pence: 600
  },
  service_trade_type: "groundworker",
  service_rate_pence: 4500,
  service_rate_unit: "m3"
};
