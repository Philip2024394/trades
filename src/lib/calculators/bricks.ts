// Bricks / Blocks calculator — 3 UK scenarios (garden wall, cavity
// wall, boundary/retaining). 60 bricks/m² single skin (standard
// 215×102.5×65 + 10 mm joint). 10 blocks/m² (440×100×215).

import type { CalculatorOutput, CalculatorLabour, CalculatorProductRef } from "./types";

export type BricksScenario = "garden_wall" | "cavity_wall" | "boundary_wall";

export type BricksInputs =
  | { scenario: "garden_wall"; length_m: number; height_m: number; unit: "brick" | "block" | "aircrete"; waste_10pct: boolean }
  | { scenario: "cavity_wall"; length_m: number; height_m: number; unit: "brick" | "block" | "aircrete"; waste_10pct: boolean }
  | { scenario: "boundary_wall"; length_m: number; height_m: number; unit: "brick" | "block" | "aircrete"; skins: 1 | 2; piers_count: number; waste_10pct: boolean };

const UNITS_PER_M2: Record<"brick" | "block" | "aircrete", number> = { brick: 60, block: 10, aircrete: 10 };
const UNIT_LABEL: Record<"brick" | "block" | "aircrete", string> = { brick: "bricks", block: "concrete blocks", aircrete: "aircrete blocks" };
const MORTAR_M3: Record<"brick" | "block" | "aircrete", number> = { brick: 0.022, block: 0.012, aircrete: 0.012 };

function readNum(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  return fallback;
}

export function computeBricks(inputs: BricksInputs, product: CalculatorProductRef): CalculatorOutput {
  const wall_m2 = inputs.length_m * inputs.height_m;
  const per_m2 = UNITS_PER_M2[inputs.unit];
  let skins = 1;
  let pier_units = 0;
  let title = "";

  switch (inputs.scenario) {
    case "garden_wall": skins = 1; title = "Single-skin garden wall"; break;
    case "cavity_wall": skins = 2; title = "Cavity wall (two skins)"; break;
    case "boundary_wall": {
      skins = inputs.skins;
      // Piers: 1 unit width × wall_height every pier
      pier_units = inputs.piers_count * inputs.height_m * (inputs.unit === "brick" ? 8 : 3);
      title = `Boundary wall — ${skins === 2 ? "double" : "single"} skin + ${inputs.piers_count} piers`;
      break;
    }
  }

  const total = wall_m2 * per_m2 * skins + pier_units;
  const units = Math.max(1, Math.ceil(total * (inputs.waste_10pct ? 1.1 : 1)));
  const mortar_m3 = wall_m2 * skins * MORTAR_M3[inputs.unit];
  const units_per_pack = readNum(product.calculator_config?.units_per_pack, inputs.unit === "brick" ? 500 : 60);
  const packs = Math.max(1, Math.ceil(units / units_per_pack));

  return {
    lines: [
      { label: "Wall area", value: `${wall_m2.toFixed(1)} m²`, detail: title, tone: "muted" },
      { label: `${UNIT_LABEL[inputs.unit]} needed${inputs.waste_10pct ? " (+10% waste)" : ""}`, value: `${units} units`, detail: `${per_m2}/m² × ${(wall_m2 * skins).toFixed(1)} m² face${pier_units ? ` + ${pier_units} for piers` : ""}`, tone: "primary" },
      { label: "Packs to order", value: `${packs} pack${packs === 1 ? "" : "s"}`, detail: `${units_per_pack} per pack`, tone: "muted", cart: { product_id: product.id, qty: packs, cart_label: `${product.name} × ${packs}`, price_pence: product.price_pence, cover_url: product.cover_url } },
      { label: "Mortar needed (separate)", value: `${mortar_m3.toFixed(3)} m³`, detail: "Use the Mortar calculator for cement + sand breakdown", tone: "muted" }
    ],
    materials_total_pence: packs * product.price_pence,
    ...(labourLineFor(wall_m2 * skins, product) && { labour: labourLineFor(wall_m2 * skins, product)! })
  };
}

function labourLineFor(m2: number, product: CalculatorProductRef): CalculatorLabour | null {
  if (!product.service_trade_type || typeof product.service_rate_pence !== "number" || product.service_rate_unit !== "m2") return null;
  return { trade_label: product.service_trade_type.replace("_", " "), rate_pence: product.service_rate_pence, rate_unit: "m2", quantity: Math.round(m2 * 10) / 10, total_pence: Math.round(m2 * product.service_rate_pence) };
}

export function bricksComplementarySubcategories(scenario: BricksScenario): string[] {
  if (scenario === "cavity_wall") return ["wall_tie", "lintel", "dpc", "insulation_tape"];
  if (scenario === "boundary_wall") return ["wall_tie", "dpc", "concrete_mesh"];
  return ["dpc"];
}

export const BRICKS_DEFAULT_INPUTS_BY_SCENARIO: { [K in BricksScenario]: Extract<BricksInputs, { scenario: K }> } = {
  garden_wall: { scenario: "garden_wall", length_m: 6, height_m: 1.2, unit: "brick", waste_10pct: true },
  cavity_wall: { scenario: "cavity_wall", length_m: 5, height_m: 2.4, unit: "brick", waste_10pct: true },
  boundary_wall: { scenario: "boundary_wall", length_m: 10, height_m: 1.8, unit: "brick", skins: 1, piers_count: 3, waste_10pct: true }
};
export const BRICKS_DEFAULT_SCENARIO: BricksScenario = "garden_wall";
export const BRICKS_DEFAULT_INPUTS: BricksInputs = BRICKS_DEFAULT_INPUTS_BY_SCENARIO.garden_wall;
export const BRICKS_SCENARIO_LABEL: Record<BricksScenario, string> = {
  garden_wall: "Garden wall (single)",
  cavity_wall: "Cavity wall (double)",
  boundary_wall: "Boundary + piers"
};
