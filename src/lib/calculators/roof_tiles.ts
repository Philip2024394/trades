// Roof tiles calculator — 2 UK scenarios (gable roof / hip roof).
// Pitch factor 1.04-1.41. Tiles/m² varies by type.

import type { CalculatorOutput, CalculatorLabour, CalculatorProductRef } from "./types";

export type RoofTilesScenario = "gable" | "hip";

export type RoofTilesInputs =
  | { scenario: "gable"; plan_area_m2: number; pitch_deg: 15 | 22.5 | 30 | 35 | 40 | 45; tile_type: TileType; ridge_length_m: number; waste_5pct: boolean }
  | { scenario: "hip"; plan_area_m2: number; pitch_deg: 15 | 22.5 | 30 | 35 | 40 | 45; tile_type: TileType; ridge_length_m: number; hip_length_m: number; waste_5pct: boolean };

type TileType = "concrete_interlocking" | "plain_clay" | "natural_slate";
const PITCH_FACTOR: Record<RoofTilesInputs["pitch_deg"], number> = { 15: 1.04, 22.5: 1.08, 30: 1.15, 35: 1.22, 40: 1.31, 45: 1.41 };
const TILES_PER_M2: Record<TileType, number> = { concrete_interlocking: 10, plain_clay: 60, natural_slate: 20 };

export function computeRoofTiles(inputs: RoofTilesInputs, product: CalculatorProductRef): CalculatorOutput {
  const slope_m2 = inputs.plan_area_m2 * PITCH_FACTOR[inputs.pitch_deg];
  let tile_factor = 1;
  let title = "";
  const extra: CalculatorOutput["lines"] = [];

  if (inputs.scenario === "hip") {
    // Hip roofs need ~7% more tiles for hip cuts + hip-tile run
    tile_factor = 1.07;
    title = "Hip roof";
    extra.push({ label: "Hip-tile run", value: `${inputs.hip_length_m.toFixed(1)} m`, tone: "muted" });
  } else {
    title = "Gable roof";
  }

  const tiles_raw = slope_m2 * TILES_PER_M2[inputs.tile_type] * tile_factor;
  const tiles = Math.max(1, Math.ceil(tiles_raw * (inputs.waste_5pct ? 1.05 : 1)));
  const battens_m = slope_m2 * 3;
  const felt_m2 = slope_m2 * 1.1;
  const ridge_tiles = Math.max(1, Math.ceil(inputs.ridge_length_m / 0.3)); // 300 mm gauge
  const hip_tiles = inputs.scenario === "hip" ? Math.max(1, Math.ceil(inputs.hip_length_m / 0.3)) : 0;
  const nails = tiles * 2;

  return {
    lines: [
      { label: "Roof slope area", value: `${slope_m2.toFixed(1)} m²`, detail: `${inputs.plan_area_m2} m² × ${PITCH_FACTOR[inputs.pitch_deg]} (${inputs.pitch_deg}° pitch) — ${title}`, tone: "muted" },
      ...extra,
      { label: `Tiles${inputs.waste_5pct ? " (+5% waste)" : ""}`, value: `${tiles} tiles`, tone: "primary", cart: { product_id: product.id, qty: tiles, cart_label: `${product.name} × ${tiles}`, price_pence: product.price_pence, cover_url: product.cover_url } },
      { label: "Ridge tiles", value: `${ridge_tiles} tiles`, detail: `${inputs.ridge_length_m.toFixed(1)} m run`, tone: "muted" },
      ...(hip_tiles > 0 ? [{ label: "Hip tiles", value: `${hip_tiles} tiles`, tone: "muted" as const }] : []),
      { label: "Battens (25×50 treated)", value: `${battens_m.toFixed(0)} m`, tone: "muted" },
      { label: "Underlay felt", value: `${felt_m2.toFixed(1)} m²`, tone: "muted" },
      { label: "Tile nails", value: `${nails} nails`, tone: "muted" }
    ],
    materials_total_pence: tiles * product.price_pence,
    ...(labourLineFor(inputs.plan_area_m2, product) && { labour: labourLineFor(inputs.plan_area_m2, product)! })
  };
}

function labourLineFor(m2: number, product: CalculatorProductRef): CalculatorLabour | null {
  if (!product.service_trade_type || typeof product.service_rate_pence !== "number" || product.service_rate_unit !== "m2") return null;
  return { trade_label: product.service_trade_type.replace("_", " "), rate_pence: product.service_rate_pence, rate_unit: "m2", quantity: Math.round(m2 * 10) / 10, total_pence: Math.round(m2 * product.service_rate_pence) };
}

export function roofTilesComplementarySubcategories(_scenario: RoofTilesScenario): string[] {
  void _scenario;
  return ["ridge_tile", "eaves_felt", "roofing_batten", "roofing_nail"];
}

export const ROOF_TILES_DEFAULT_INPUTS_BY_SCENARIO: { [K in RoofTilesScenario]: Extract<RoofTilesInputs, { scenario: K }> } = {
  gable: { scenario: "gable", plan_area_m2: 50, pitch_deg: 30, tile_type: "concrete_interlocking", ridge_length_m: 8, waste_5pct: true },
  hip: { scenario: "hip", plan_area_m2: 60, pitch_deg: 30, tile_type: "concrete_interlocking", ridge_length_m: 6, hip_length_m: 5, waste_5pct: true }
};
export const ROOF_TILES_DEFAULT_SCENARIO: RoofTilesScenario = "gable";
export const ROOF_TILES_DEFAULT_INPUTS: RoofTilesInputs = ROOF_TILES_DEFAULT_INPUTS_BY_SCENARIO.gable;
export const ROOF_TILES_SCENARIO_LABEL: Record<RoofTilesScenario, string> = {
  gable: "Gable roof",
  hip: "Hip roof"
};
