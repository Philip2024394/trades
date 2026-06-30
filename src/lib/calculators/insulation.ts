// Insulation calculator — 4 UK scenarios (loft roll, wall cavity,
// solid floor, pitched roof). Part L 2025 U-value targets.

import type { CalculatorOutput, CalculatorProductRef } from "./types";

export type InsulationScenario = "loft" | "wall_cavity" | "solid_floor" | "pitched_roof";

export type InsulationInputs =
  | { scenario: "loft"; loft_length_m: number; loft_width_m: number; cross_lay: boolean; waste_5pct: boolean }
  | { scenario: "wall_cavity"; wall_area_m2: number; cavity_mm: number; waste_5pct: boolean }
  | { scenario: "solid_floor"; floor_area_m2: number; depth_mm: number; waste_5pct: boolean }
  | { scenario: "pitched_roof"; roof_area_m2: number; rafter_centres_mm: number; waste_5pct: boolean };

function readNum(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  return fallback;
}

export function computeInsulation(inputs: InsulationInputs, product: CalculatorProductRef): CalculatorOutput {
  let area = 0;
  let title = "";
  const extra: CalculatorOutput["lines"] = [];

  switch (inputs.scenario) {
    case "loft": {
      area = inputs.loft_length_m * inputs.loft_width_m;
      // Cross-lay doubles the m² (first layer between joists, second across at 90°)
      if (inputs.cross_lay) area *= 2;
      title = `Loft${inputs.cross_lay ? " (cross-laid for full U=0.16)" : " (single layer)"}`;
      break;
    }
    case "wall_cavity": {
      area = inputs.wall_area_m2;
      title = `Wall cavity — ${inputs.cavity_mm} mm`;
      extra.push({ label: "Cavity width", value: `${inputs.cavity_mm} mm`, detail: "Use the right board thickness", tone: "muted" });
      break;
    }
    case "solid_floor": {
      area = inputs.floor_area_m2;
      title = `Solid floor — ${inputs.depth_mm} mm PIR`;
      break;
    }
    case "pitched_roof": {
      area = inputs.roof_area_m2;
      title = `Pitched roof — rafters @ ${inputs.rafter_centres_mm} mm`;
      break;
    }
  }

  const area_total = inputs.waste_5pct ? area * 1.05 : area;
  const m2_per_pack = readNum(product.calculator_config?.m2_per_pack, 8.64);
  const packs = Math.max(1, Math.ceil(area_total / m2_per_pack));

  return {
    lines: [
      { label: "Area to insulate", value: `${area.toFixed(1)} m²`, detail: title, tone: "muted" },
      ...extra,
      { label: `Coverage needed${inputs.waste_5pct ? " (+5% waste)" : ""}`, value: `${area_total.toFixed(1)} m²`, tone: "primary" },
      { label: "Packs to order", value: `${packs} pack${packs === 1 ? "" : "s"}`, detail: `${m2_per_pack} m² per pack`, tone: "muted", cart: { product_id: product.id, qty: packs, cart_label: `${product.name} × ${packs}`, price_pence: product.price_pence, cover_url: product.cover_url } }
    ],
    warnings: inputs.scenario === "loft" && !inputs.cross_lay ? ["Single-layer loft only hits ~0.20 U-value — cross-lay a second roll at 90° for Part L 0.16 target."] : [],
    materials_total_pence: packs * product.price_pence
  };
}

export function insulationComplementarySubcategories(scenario: InsulationScenario): string[] {
  if (scenario === "wall_cavity" || scenario === "pitched_roof") return ["vapour_barrier", "insulation_tape", "drywall_screw"];
  return ["vapour_barrier", "insulation_tape"];
}

export const INSULATION_DEFAULT_INPUTS_BY_SCENARIO: { [K in InsulationScenario]: Extract<InsulationInputs, { scenario: K }> } = {
  loft: { scenario: "loft", loft_length_m: 8, loft_width_m: 5, cross_lay: true, waste_5pct: true },
  wall_cavity: { scenario: "wall_cavity", wall_area_m2: 40, cavity_mm: 100, waste_5pct: true },
  solid_floor: { scenario: "solid_floor", floor_area_m2: 25, depth_mm: 100, waste_5pct: true },
  pitched_roof: { scenario: "pitched_roof", roof_area_m2: 30, rafter_centres_mm: 600, waste_5pct: true }
};
export const INSULATION_DEFAULT_SCENARIO: InsulationScenario = "loft";
export const INSULATION_DEFAULT_INPUTS: InsulationInputs = INSULATION_DEFAULT_INPUTS_BY_SCENARIO.loft;
export const INSULATION_SCENARIO_LABEL: Record<InsulationScenario, string> = {
  loft: "Loft roll",
  wall_cavity: "Wall cavity board",
  solid_floor: "Solid floor (PIR)",
  pitched_roof: "Pitched roof"
};
