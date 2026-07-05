// calc-tiles — logic re-exports.

export {
  computeTiles,
  tilesComplementarySubcategories,
  TILES_DEFAULT_INPUTS,
  TILES_DEFAULT_INPUTS_BY_SCENARIO,
  TILES_DEFAULT_SCENARIO,
  TILES_SCENARIO_LABEL
} from "@/lib/calculators/tiles";
export type {
  TilesInputs,
  TilesScenario
} from "@/lib/calculators/tiles";
export type {
  CalculatorOutput,
  CalculatorOutputLine,
  CalculatorProductRef
} from "@/lib/calculators/types";

import type { CalculatorProductRef } from "@/lib/calculators/types";

/** UK trade-price fallback — a mid-range 600×300 porcelain wall/floor
 *  tile (~£30/m² reference). Used when the merchant hasn't hooked up
 *  their own product feed. */
export const FALLBACK_TILES_PRODUCT: CalculatorProductRef = {
  id: "fallback-porcelain-600x300",
  name: "Trade-grade porcelain 600×300 (reference)",
  price_pence: 3000,
  cover_url: null,
  calculator_config: {
    price_per_m2_pence: 3000,
    pack_label: "m²"
  },
  service_trade_type: "tiler",
  service_rate_pence: 3500,
  service_rate_unit: "m2"
};
