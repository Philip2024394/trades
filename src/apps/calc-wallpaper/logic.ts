// calc-wallpaper — logic re-exports.

export {
  computeWallpaper,
  wallpaperComplementarySubcategories,
  WALLPAPER_DEFAULT_INPUTS,
  WALLPAPER_DEFAULT_INPUTS_BY_SCENARIO,
  WALLPAPER_DEFAULT_SCENARIO,
  WALLPAPER_SCENARIO_LABEL
} from "@/lib/calculators/wallpaper";
export type {
  WallpaperInputs,
  WallpaperScenario
} from "@/lib/calculators/wallpaper";
export type {
  CalculatorOutput,
  CalculatorOutputLine,
  CalculatorProductRef
} from "@/lib/calculators/types";

import type { CalculatorProductRef } from "@/lib/calculators/types";

/** UK trade-price fallback — standard 10.05 × 0.52 m roll (mid-market
 *  Graham & Brown / John Lewis reference). */
export const FALLBACK_WALLPAPER_PRODUCT: CalculatorProductRef = {
  id: "fallback-wallpaper-standard-roll",
  name: "Wallpaper roll 10.05 × 0.52 m (reference)",
  price_pence: 2500,
  cover_url: null,
  calculator_config: null,
  service_trade_type: "decorator",
  service_rate_pence: 2000,
  service_rate_unit: "m2"
};
