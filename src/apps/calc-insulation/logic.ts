// calc-insulation — logic re-exports + FALLBACK products.
//
// The underlying calc reads `product.calculator_config.m2_per_pack`
// to size packs — so we ship 4 fallback products, one per scenario
// (mineral wool roll for loft, cavity-board for wall, PIR sheet for
// floor + roof).

export {
  computeInsulation,
  insulationComplementarySubcategories,
  INSULATION_DEFAULT_INPUTS,
  INSULATION_DEFAULT_INPUTS_BY_SCENARIO,
  INSULATION_DEFAULT_SCENARIO,
  INSULATION_SCENARIO_LABEL
} from "@/lib/calculators/insulation";
export type {
  InsulationInputs,
  InsulationScenario
} from "@/lib/calculators/insulation";
export type {
  CalculatorOutput,
  CalculatorOutputLine,
  CalculatorProductRef
} from "@/lib/calculators/types";

import type { CalculatorProductRef } from "@/lib/calculators/types";
import type { InsulationScenario } from "@/lib/calculators/insulation";

/** UK trade-price fallbacks — one per scenario so material selection
 *  changes packs + price. All roughly-current UK builders-merchant
 *  reference prices. */
export const FALLBACK_INSULATION_PRODUCT_BY_SCENARIO: Record<
  InsulationScenario,
  CalculatorProductRef
> = {
  loft: {
    id: "fallback-insulation-loft-mineral-wool",
    name: "Mineral wool loft roll 200 mm × 8.64 m² (reference)",
    price_pence: 3200,
    cover_url: null,
    calculator_config: { m2_per_pack: 8.64 },
    service_trade_type: "insulation_installer",
    service_rate_pence: 900,
    service_rate_unit: "m2"
  },
  wall_cavity: {
    id: "fallback-insulation-cavity-pir",
    name: "PIR cavity board 100 mm × 2.88 m² (reference)",
    price_pence: 4200,
    cover_url: null,
    calculator_config: { m2_per_pack: 2.88 },
    service_trade_type: "insulation_installer",
    service_rate_pence: 1200,
    service_rate_unit: "m2"
  },
  solid_floor: {
    id: "fallback-insulation-floor-pir",
    name: "PIR floor board 100 mm × 2.88 m² (reference)",
    price_pence: 4400,
    cover_url: null,
    calculator_config: { m2_per_pack: 2.88 },
    service_trade_type: "insulation_installer",
    service_rate_pence: 2800,
    service_rate_unit: "m2"
  },
  pitched_roof: {
    id: "fallback-insulation-roof-pir",
    name: "PIR rafter board 100 mm × 2.88 m² (reference)",
    price_pence: 4400,
    cover_url: null,
    calculator_config: { m2_per_pack: 2.88 },
    service_trade_type: "insulation_installer",
    service_rate_pence: 3500,
    service_rate_unit: "m2"
  }
};
