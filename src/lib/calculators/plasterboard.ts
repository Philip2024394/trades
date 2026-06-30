// Plasterboard calculator — 3 UK scenarios (walls, ceilings, whole room).
// 2.88 m² per 1200×2400 sheet, 30 screws/board, scrim ~1.8 m/m², filler
// ~0.5 kg/m².

import type { CalculatorOutput, CalculatorLabour, CalculatorProductRef } from "./types";

export type PlasterboardScenario = "walls" | "ceilings" | "whole_room";

export type PlasterboardInputs =
  | { scenario: "walls"; wall_area_m2: number; board_size: "1200x2400" | "1200x1800"; waste_10pct: boolean }
  | { scenario: "ceilings"; ceiling_area_m2: number; board_size: "1200x2400" | "1200x1800"; moisture_resistant: boolean; waste_10pct: boolean }
  | { scenario: "whole_room"; length_m: number; width_m: number; height_m: number; board_size: "1200x2400" | "1200x1800"; include_ceiling: boolean; waste_10pct: boolean };

const BOARD_M2 = { "1200x2400": 2.88, "1200x1800": 2.16 };

export function computePlasterboard(inputs: PlasterboardInputs, product: CalculatorProductRef): CalculatorOutput {
  let area = 0;
  let title = "";
  let extra: CalculatorOutput["lines"] = [];

  switch (inputs.scenario) {
    case "walls": {
      area = inputs.wall_area_m2;
      title = "Walls";
      break;
    }
    case "ceilings": {
      area = inputs.ceiling_area_m2;
      title = `Ceilings${inputs.moisture_resistant ? " — moisture-resistant board" : ""}`;
      if (inputs.moisture_resistant) extra.push({ label: "Board type", value: "MR / green board", detail: "Bathrooms / kitchens", tone: "muted" });
      break;
    }
    case "whole_room": {
      const walls = 2 * (inputs.length_m + inputs.width_m) * inputs.height_m;
      const ceiling = inputs.include_ceiling ? inputs.length_m * inputs.width_m : 0;
      area = walls + ceiling;
      title = `Whole room — walls${inputs.include_ceiling ? " + ceiling" : ""}`;
      extra.push({ label: "Walls", value: `${walls.toFixed(1)} m²`, tone: "muted" });
      if (inputs.include_ceiling) extra.push({ label: "Ceiling", value: `${ceiling.toFixed(1)} m²`, tone: "muted" });
      break;
    }
  }

  const m2_total = inputs.waste_10pct ? area * 1.1 : area;
  const per_board = BOARD_M2[inputs.board_size];
  const boards = Math.max(1, Math.ceil(m2_total / per_board));
  const screws = boards * 30;
  const scrim_m = area * 1.8;
  const filler_kg = area * 0.5;

  return {
    lines: [
      { label: "Area to board", value: `${area.toFixed(1)} m²`, detail: title, tone: "muted" },
      ...extra,
      { label: `Sheets needed${inputs.waste_10pct ? " (+10% waste)" : ""}`, value: `${boards} sheets`, detail: `${inputs.board_size} = ${per_board} m² per sheet`, tone: "primary", cart: { product_id: product.id, qty: boards, cart_label: `${product.name} × ${boards}`, price_pence: product.price_pence, cover_url: product.cover_url } },
      { label: "Drywall screws", value: `~${screws} screws`, detail: "30 per board · ~300 mm spacing", tone: "muted" },
      { label: "Scrim tape", value: `${scrim_m.toFixed(1)} m`, tone: "muted" },
      { label: "Joint filler", value: `${filler_kg.toFixed(1)} kg`, tone: "muted" }
    ],
    materials_total_pence: boards * product.price_pence,
    ...(labourLineFor(area, product) && { labour: labourLineFor(area, product)! })
  };
}

function labourLineFor(m2: number, product: CalculatorProductRef): CalculatorLabour | null {
  if (!product.service_trade_type || typeof product.service_rate_pence !== "number" || product.service_rate_unit !== "m2") return null;
  return { trade_label: product.service_trade_type.replace("_", " "), rate_pence: product.service_rate_pence, rate_unit: "m2", quantity: Math.round(m2 * 10) / 10, total_pence: Math.round(m2 * product.service_rate_pence) };
}

export function plasterboardComplementarySubcategories(_scenario: PlasterboardScenario): string[] {
  void _scenario;
  return ["drywall_screw", "scrim_tape", "jointing_filler", "corner_bead"];
}

export const PLASTERBOARD_DEFAULT_INPUTS_BY_SCENARIO: { [K in PlasterboardScenario]: Extract<PlasterboardInputs, { scenario: K }> } = {
  walls: { scenario: "walls", wall_area_m2: 20, board_size: "1200x2400", waste_10pct: true },
  ceilings: { scenario: "ceilings", ceiling_area_m2: 15, board_size: "1200x2400", moisture_resistant: false, waste_10pct: true },
  whole_room: { scenario: "whole_room", length_m: 4, width_m: 3, height_m: 2.4, board_size: "1200x2400", include_ceiling: true, waste_10pct: true }
};
export const PLASTERBOARD_DEFAULT_SCENARIO: PlasterboardScenario = "walls";
export const PLASTERBOARD_DEFAULT_INPUTS: PlasterboardInputs = PLASTERBOARD_DEFAULT_INPUTS_BY_SCENARIO.walls;
export const PLASTERBOARD_SCENARIO_LABEL: Record<PlasterboardScenario, string> = {
  walls: "Walls only",
  ceilings: "Ceilings only",
  whole_room: "Whole room"
};
