// Gravel / aggregates calculator — 5 UK scenarios.
// Densities: gravel 1.6 t/m³, pebbles 1.8, cobbles 1.9, sands 1.5-1.7.
// Depth presets per scenario (UK landscaper conventions).

import type { CalculatorOutput, CalculatorProductRef } from "./types";

export type GravelScenario =
  | "driveway"
  | "garden_path"
  | "decorative_border"
  | "french_drain"
  | "custom_l_shape";

export type GravelInputs =
  | { scenario: "driveway"; length_m: number; width_m: number; depth_mm: number; stone_type: StoneType; waste_10pct: boolean }
  | { scenario: "garden_path"; length_m: number; width_m: number; depth_mm: number; stone_type: StoneType; waste_10pct: boolean }
  | { scenario: "decorative_border"; length_m: number; width_m: number; depth_mm: number; stone_type: StoneType; waste_10pct: boolean }
  | { scenario: "french_drain"; length_m: number; trench_width_m: number; trench_depth_m: number; waste_10pct: boolean }
  | { scenario: "custom_l_shape"; part_a_length_m: number; part_a_width_m: number; part_b_length_m: number; part_b_width_m: number; depth_mm: number; stone_type: StoneType; waste_10pct: boolean };

type StoneType = "gravel" | "pebbles" | "cobbles" | "sharp_sand" | "building_sand" | "ballast";
const DENSITY: Record<StoneType, number> = { gravel: 1.6, pebbles: 1.8, cobbles: 1.9, sharp_sand: 1.6, building_sand: 1.5, ballast: 1.7 };

function readNum(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  return fallback;
}

export function computeGravel(inputs: GravelInputs, product: CalculatorProductRef): CalculatorOutput {
  let area_m2 = 0;
  let volume_m3 = 0;
  let stone: StoneType = "gravel";
  let title = "";
  let waste = false;

  switch (inputs.scenario) {
    case "driveway":
    case "garden_path":
    case "decorative_border": {
      area_m2 = inputs.length_m * inputs.width_m;
      volume_m3 = area_m2 * (inputs.depth_mm / 1000);
      stone = inputs.stone_type;
      waste = inputs.waste_10pct;
      title = { driveway: "Driveway", garden_path: "Garden path", decorative_border: "Decorative border" }[inputs.scenario];
      break;
    }
    case "french_drain": {
      area_m2 = inputs.length_m * inputs.trench_width_m;
      volume_m3 = area_m2 * inputs.trench_depth_m;
      stone = "gravel";
      waste = inputs.waste_10pct;
      title = `French drain — ${inputs.length_m} m trench`;
      break;
    }
    case "custom_l_shape": {
      const a = inputs.part_a_length_m * inputs.part_a_width_m;
      const b = inputs.part_b_length_m * inputs.part_b_width_m;
      area_m2 = a + b;
      volume_m3 = area_m2 * (inputs.depth_mm / 1000);
      stone = inputs.stone_type;
      waste = inputs.waste_10pct;
      title = "L-shaped area";
      break;
    }
  }

  let tonnes = volume_m3 * DENSITY[stone];
  if (waste) tonnes *= 1.1;
  const kg_per_bag = readNum(product.calculator_config?.kg_per_bag, 25);
  const tonnes_per_bulk = readNum(product.calculator_config?.tonnes_per_bag, 0.85);
  const small_bags = Math.max(1, Math.ceil((tonnes * 1000) / kg_per_bag));
  const bulk_bags = Math.max(1, Math.ceil(tonnes / tonnes_per_bulk));

  return {
    lines: [
      { label: "Coverage area", value: `${area_m2.toFixed(2)} m²`, detail: title, tone: "muted" },
      { label: `Volume needed${waste ? " (+10% waste)" : ""}`, value: `${tonnes.toFixed(2)} t`, detail: `${stone.replace("_", " ")} @ ${DENSITY[stone]} t/m³`, tone: "primary" },
      { label: `Small bags (${kg_per_bag} kg)`, value: `${small_bags} bags`, tone: "muted", cart: { product_id: product.id, qty: small_bags, cart_label: `${product.name} × ${small_bags}`, price_pence: product.price_pence, cover_url: product.cover_url } },
      { label: `Bulk bags (${tonnes_per_bulk} t each)`, value: `${bulk_bags} bag${bulk_bags === 1 ? "" : "s"}`, tone: "muted" }
    ],
    materials_total_pence: small_bags * product.price_pence
  };
}

export function gravelComplementarySubcategories(scenario: GravelScenario): string[] {
  if (scenario === "decorative_border" || scenario === "garden_path") return ["weed_membrane", "lawn_edging", "ground_pegs" as never];
  if (scenario === "driveway") return ["weed_membrane", "sub_base"];
  if (scenario === "french_drain") return ["weed_membrane"];
  return ["weed_membrane"];
}

export const GRAVEL_DEFAULT_INPUTS_BY_SCENARIO: { [K in GravelScenario]: Extract<GravelInputs, { scenario: K }> } = {
  driveway: { scenario: "driveway", length_m: 8, width_m: 3, depth_mm: 50, stone_type: "gravel", waste_10pct: true },
  garden_path: { scenario: "garden_path", length_m: 6, width_m: 1, depth_mm: 40, stone_type: "gravel", waste_10pct: true },
  decorative_border: { scenario: "decorative_border", length_m: 10, width_m: 0.5, depth_mm: 25, stone_type: "pebbles", waste_10pct: true },
  french_drain: { scenario: "french_drain", length_m: 8, trench_width_m: 0.3, trench_depth_m: 0.4, waste_10pct: true },
  custom_l_shape: { scenario: "custom_l_shape", part_a_length_m: 4, part_a_width_m: 3, part_b_length_m: 2, part_b_width_m: 1, depth_mm: 50, stone_type: "gravel", waste_10pct: true }
};
export const GRAVEL_DEFAULT_SCENARIO: GravelScenario = "driveway";
export const GRAVEL_DEFAULT_INPUTS: GravelInputs = GRAVEL_DEFAULT_INPUTS_BY_SCENARIO.driveway;
export const GRAVEL_SCENARIO_LABEL: Record<GravelScenario, string> = {
  driveway: "Driveway",
  garden_path: "Garden path",
  decorative_border: "Decorative border",
  french_drain: "French drain",
  custom_l_shape: "L-shaped area"
};
