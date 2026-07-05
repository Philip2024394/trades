// calc-render — logic re-exports.

export {
  computeRender,
  renderComplementarySubcategories,
  RENDER_DEFAULT_INPUTS,
  RENDER_DEFAULT_INPUTS_BY_SCENARIO,
  RENDER_DEFAULT_SCENARIO,
  RENDER_SCENARIO_LABEL
} from "@/lib/calculators/render";
export type { RenderInputs, RenderScenario } from "@/lib/calculators/render";
export type {
  CalculatorOutput,
  CalculatorOutputLine,
  CalculatorProductRef
} from "@/lib/calculators/types";

import type { CalculatorProductRef } from "@/lib/calculators/types";

/** UK trade-price fallback — sand:cement bag reference. When user
 *  picks K Rend / silicone the fallback swaps to the K Rend product. */
export const FALLBACK_RENDER_SAND_CEMENT_PRODUCT: CalculatorProductRef = {
  id: "fallback-render-sand-cement-25kg",
  name: "Sand:cement render 25 kg (reference)",
  price_pence: 900,
  cover_url: null,
  calculator_config: {
    kg_per_bag: 25
  },
  service_trade_type: "plasterer",
  service_rate_pence: 4000,
  service_rate_unit: "m2"
};

export const FALLBACK_RENDER_K_REND_PRODUCT: CalculatorProductRef = {
  id: "fallback-render-k-rend-25kg",
  name: "K Rend silicone thin-coat 25 kg (reference)",
  price_pence: 3200,
  cover_url: null,
  calculator_config: {
    kg_per_bag: 25
  },
  service_trade_type: "rendering-specialist",
  service_rate_pence: 6500,
  service_rate_unit: "m2"
};

export function fallbackProductForSystem(
  system: "sand_cement" | "k_rend_silicone"
): CalculatorProductRef {
  return system === "k_rend_silicone"
    ? FALLBACK_RENDER_K_REND_PRODUCT
    : FALLBACK_RENDER_SAND_CEMENT_PRODUCT;
}
