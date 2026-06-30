// Turf + topsoil calculator — 2 UK scenarios (simple lawn / full prep).
// 1m × 410mm rolls = 0.41 m² each. Topsoil 50 mm new lawn, 1.4 t/m³.

import type { CalculatorOutput, CalculatorProductRef } from "./types";

export type TurfScenario = "simple" | "full_prep";

export type TurfInputs =
  | { scenario: "simple"; lawn_length_m: number; lawn_width_m: number; waste_5pct: boolean }
  | { scenario: "full_prep"; lawn_length_m: number; lawn_width_m: number; topsoil_depth_mm: number; include_levelling_sand: boolean; waste_5pct: boolean };

export function computeTurf(inputs: TurfInputs, product: CalculatorProductRef): CalculatorOutput {
  const area = inputs.lawn_length_m * inputs.lawn_width_m;
  const m2_total = inputs.waste_5pct ? area * 1.05 : area;
  const rolls = Math.max(1, Math.ceil(m2_total / 0.41));
  const extra: CalculatorOutput["lines"] = [];

  if (inputs.scenario === "full_prep") {
    const topsoil_m3 = area * (inputs.topsoil_depth_mm / 1000);
    const topsoil_tonnes = topsoil_m3 * 1.4;
    extra.push({ label: `Topsoil @ ${inputs.topsoil_depth_mm} mm`, value: `${topsoil_m3.toFixed(2)} m³`, detail: `~${topsoil_tonnes.toFixed(1)} t (separate product)`, tone: "muted" });
    if (inputs.include_levelling_sand) {
      const sand_kg = area * 2;
      extra.push({ label: "Levelling sand", value: `${sand_kg.toFixed(0)} kg`, detail: "2 kg/m² brushed into seams", tone: "muted" });
    }
  }

  return {
    lines: [
      { label: "Lawn area", value: `${area.toFixed(1)} m²`, detail: `${inputs.lawn_length_m} × ${inputs.lawn_width_m} m${inputs.scenario === "full_prep" ? " (with prep)" : ""}`, tone: "muted" },
      { label: `Turf rolls (1m × 410mm)${inputs.waste_5pct ? " +5%" : ""}`, value: `${rolls} rolls`, tone: "primary", cart: { product_id: product.id, qty: rolls, cart_label: `${product.name} × ${rolls}`, price_pence: product.price_pence, cover_url: product.cover_url } },
      ...extra
    ],
    warnings: inputs.scenario === "full_prep" ? ["Rotovate to 100 mm depth, remove stones, level, spread topsoil, firm, then lay turf within 24 h of delivery."] : ["Lay turf within 24 hours of delivery and water daily for 2 weeks."],
    materials_total_pence: rolls * product.price_pence
  };
}

export function turfComplementarySubcategories(scenario: TurfScenario): string[] {
  if (scenario === "full_prep") return ["lawn_feed", "top_dressing", "weed_membrane", "sharp_sand"];
  return ["lawn_feed", "top_dressing"];
}

export const TURF_DEFAULT_INPUTS_BY_SCENARIO: { [K in TurfScenario]: Extract<TurfInputs, { scenario: K }> } = {
  simple: { scenario: "simple", lawn_length_m: 5, lawn_width_m: 4, waste_5pct: true },
  full_prep: { scenario: "full_prep", lawn_length_m: 5, lawn_width_m: 4, topsoil_depth_mm: 50, include_levelling_sand: true, waste_5pct: true }
};
export const TURF_DEFAULT_SCENARIO: TurfScenario = "simple";
export const TURF_DEFAULT_INPUTS: TurfInputs = TURF_DEFAULT_INPUTS_BY_SCENARIO.simple;
export const TURF_SCENARIO_LABEL: Record<TurfScenario, string> = {
  simple: "Simple lawn",
  full_prep: "Full prep + turf"
};
