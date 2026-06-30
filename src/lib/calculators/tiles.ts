// Tile calculator — 5 UK scenarios.
// Adhesive ~1.5 kg/m², grout ~ joint_mm × 0.15 kg/m². Waste 10/15%.

import type { CalculatorOutput, CalculatorLabour, CalculatorProductRef } from "./types";

export type TilesScenario =
  | "bathroom_floor"
  | "shower_walls"
  | "splashback"
  | "whole_bathroom"
  | "outdoor_patio";

export type TilesInputs =
  | { scenario: "bathroom_floor"; length_m: number; width_m: number; tile_w_mm: number; tile_h_mm: number; joint_mm: number }
  | { scenario: "shower_walls"; height_m: number; wall_a_m: number; wall_b_m: number; tile_w_mm: number; tile_h_mm: number; joint_mm: number; diagonal: boolean }
  | { scenario: "splashback"; length_m: number; height_m: number; tile_w_mm: number; tile_h_mm: number; joint_mm: number }
  | { scenario: "whole_bathroom"; floor_length_m: number; floor_width_m: number; wall_height_m: number; bath_surround: boolean; tile_w_mm: number; tile_h_mm: number; joint_mm: number }
  | { scenario: "outdoor_patio"; length_m: number; width_m: number; tile_w_mm: number; tile_h_mm: number; joint_mm: number; diagonal: boolean };

function readNum(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  return fallback;
}

export function computeTiles(inputs: TilesInputs, product: CalculatorProductRef): CalculatorOutput {
  let area = 0;
  let waste = 0.10;
  let title = "";
  const tileM2 = (Math.max(1, inputs.tile_w_mm) / 1000) * (Math.max(1, inputs.tile_h_mm) / 1000);

  switch (inputs.scenario) {
    case "bathroom_floor": {
      area = inputs.length_m * inputs.width_m;
      waste = 0.12;
      title = "Bathroom floor";
      break;
    }
    case "shower_walls": {
      area = (inputs.wall_a_m + inputs.wall_b_m) * inputs.height_m;
      waste = inputs.diagonal ? 0.15 : 0.10;
      title = `Shower walls — two sides (${inputs.diagonal ? "diagonal" : "straight"})`;
      break;
    }
    case "splashback": {
      area = inputs.length_m * inputs.height_m;
      waste = 0.15; // small areas have proportionally more cuts
      title = "Kitchen splashback";
      break;
    }
    case "whole_bathroom": {
      const floor = inputs.floor_length_m * inputs.floor_width_m;
      const walls = 2 * (inputs.floor_length_m + inputs.floor_width_m) * inputs.wall_height_m;
      const surround = inputs.bath_surround ? 1.7 * 2 + 0.6 * 2 : 0; // ~5 m² bath surround
      area = floor + walls + surround;
      waste = 0.15;
      title = "Whole bathroom — floor + walls" + (inputs.bath_surround ? " + bath surround" : "");
      break;
    }
    case "outdoor_patio": {
      area = inputs.length_m * inputs.width_m;
      waste = inputs.diagonal ? 0.15 : 0.10;
      title = `Outdoor patio (${inputs.diagonal ? "diagonal" : "straight"})`;
      break;
    }
  }

  const total_m2 = area * (1 + waste);
  const tiles = Math.max(1, Math.ceil(total_m2 / tileM2));
  const tiles_per_box = readNum(product.calculator_config?.tiles_per_box, 6);
  const boxes = Math.max(1, Math.ceil(tiles / tiles_per_box));
  const adhesive_kg = total_m2 * 1.5;
  const adhesive_bags = Math.max(1, Math.ceil(adhesive_kg / 20));
  const grout_kg = total_m2 * Math.max(0.3, inputs.joint_mm * 0.15);
  const grout_bags = Math.max(1, Math.ceil(grout_kg / 5));

  return {
    lines: [
      { label: "Tiling area", value: `${area.toFixed(2)} m²`, detail: title, tone: "muted" },
      { label: `Tiles needed (+${(waste * 100).toFixed(0)}% waste)`, value: `${tiles} tiles`, detail: `${inputs.tile_w_mm}×${inputs.tile_h_mm} mm`, tone: "primary" },
      { label: "Boxes to order", value: `${boxes} box${boxes === 1 ? "" : "es"}`, detail: `${tiles_per_box} per box`, tone: "muted", cart: { product_id: product.id, qty: boxes, cart_label: `${product.name} × ${boxes}`, price_pence: product.price_pence, cover_url: product.cover_url } },
      { label: "Adhesive (separate)", value: `${adhesive_kg.toFixed(1)} kg`, detail: `${adhesive_bags} × 20 kg bags`, tone: "muted" },
      { label: "Grout (separate)", value: `${grout_kg.toFixed(1)} kg`, detail: `${grout_bags} × 5 kg bags`, tone: "muted" }
    ],
    materials_total_pence: boxes * product.price_pence,
    ...(labourLineFor(area, product) && { labour: labourLineFor(area, product)! })
  };
}

function labourLineFor(m2: number, product: CalculatorProductRef): CalculatorLabour | null {
  if (!product.service_trade_type || typeof product.service_rate_pence !== "number" || product.service_rate_unit !== "m2") return null;
  return { trade_label: product.service_trade_type.replace("_", " "), rate_pence: product.service_rate_pence, rate_unit: "m2", quantity: Math.round(m2 * 10) / 10, total_pence: Math.round(m2 * product.service_rate_pence) };
}

export function tilesComplementarySubcategories(scenario: TilesScenario): string[] {
  const universal = ["tile_adhesive", "grout", "tile_spacer"];
  if (scenario === "shower_walls" || scenario === "whole_bathroom") return [...universal, "tile_sealant", "tile_trim"];
  if (scenario === "outdoor_patio") return [...universal, "tile_sealant", "sub_base"];
  return [...universal, "tile_trim"];
}

export const TILES_DEFAULT_INPUTS_BY_SCENARIO: { [K in TilesScenario]: Extract<TilesInputs, { scenario: K }> } = {
  bathroom_floor: { scenario: "bathroom_floor", length_m: 2.5, width_m: 2, tile_w_mm: 600, tile_h_mm: 300, joint_mm: 3 },
  shower_walls: { scenario: "shower_walls", height_m: 2.2, wall_a_m: 0.9, wall_b_m: 0.9, tile_w_mm: 300, tile_h_mm: 600, joint_mm: 2, diagonal: false },
  splashback: { scenario: "splashback", length_m: 3, height_m: 0.6, tile_w_mm: 150, tile_h_mm: 75, joint_mm: 2 },
  whole_bathroom: { scenario: "whole_bathroom", floor_length_m: 2.5, floor_width_m: 2, wall_height_m: 2.2, bath_surround: true, tile_w_mm: 300, tile_h_mm: 300, joint_mm: 3 },
  outdoor_patio: { scenario: "outdoor_patio", length_m: 5, width_m: 4, tile_w_mm: 600, tile_h_mm: 600, joint_mm: 5, diagonal: false }
};
export const TILES_DEFAULT_SCENARIO: TilesScenario = "bathroom_floor";
export const TILES_DEFAULT_INPUTS: TilesInputs = TILES_DEFAULT_INPUTS_BY_SCENARIO.bathroom_floor;
export const TILES_SCENARIO_LABEL: Record<TilesScenario, string> = {
  bathroom_floor: "Bathroom floor",
  shower_walls: "Shower walls",
  splashback: "Kitchen splashback",
  whole_bathroom: "Whole bathroom",
  outdoor_patio: "Outdoor patio"
};
