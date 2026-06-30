// Paving calculator — 3 UK scenarios (patio / driveway / garden path).
// Sub-base 100mm patio / 150mm driveway. 50mm sand bed. 25 kg jointing
// compound per 10 m². MOT Type 1 = 2.0 t/m³, sharp sand 1.6.

import type { CalculatorOutput, CalculatorLabour, CalculatorProductRef } from "./types";

export type PavingScenario = "patio" | "driveway" | "garden_path";

export type PavingInputs =
  | { scenario: "patio"; length_m: number; width_m: number; slab_w_mm: number; slab_h_mm: number; waste_10pct: boolean }
  | { scenario: "driveway"; length_m: number; width_m: number; slab_w_mm: number; slab_h_mm: number; waste_10pct: boolean }
  | { scenario: "garden_path"; length_m: number; width_m: number; slab_w_mm: number; slab_h_mm: number; curves: boolean; waste_10pct: boolean };

export function computePaving(inputs: PavingInputs, product: CalculatorProductRef): CalculatorOutput {
  const area = inputs.length_m * inputs.width_m;
  const slab_m2 = (inputs.slab_w_mm * inputs.slab_h_mm) / 1_000_000;
  let waste_pct = 0.10;
  let subbase_mm = 100;
  let title = "";

  switch (inputs.scenario) {
    case "patio": waste_pct = 0.10; subbase_mm = 100; title = "Patio"; break;
    case "driveway": waste_pct = 0.10; subbase_mm = 150; title = "Driveway"; break;
    case "garden_path": waste_pct = inputs.curves ? 0.20 : 0.12; subbase_mm = 75; title = `Garden path${inputs.curves ? " (curved)" : ""}`; break;
  }
  if (inputs.waste_10pct) waste_pct = Math.max(waste_pct, 0.10);

  const slabs = Math.max(1, Math.ceil((area * (1 + waste_pct)) / slab_m2));
  const subbase_tonnes = (area * subbase_mm / 1000) * 2.0;
  const sand_tonnes = (area * 0.05) * 1.6;
  const jointing_kg = (area / 10) * 25;

  return {
    lines: [
      { label: "Patio area", value: `${area.toFixed(1)} m²`, detail: title, tone: "muted" },
      { label: `Slabs needed (+${(waste_pct * 100).toFixed(0)}% waste)`, value: `${slabs} slabs`, detail: `${inputs.slab_w_mm} × ${inputs.slab_h_mm} mm = ${slab_m2.toFixed(2)} m² each`, tone: "primary", cart: { product_id: product.id, qty: slabs, cart_label: `${product.name} × ${slabs}`, price_pence: product.price_pence, cover_url: product.cover_url } },
      { label: `Sub-base — MOT Type 1 @ ${subbase_mm} mm`, value: `${subbase_tonnes.toFixed(2)} t`, tone: "muted" },
      { label: "Sand bed @ 50 mm", value: `${sand_tonnes.toFixed(2)} t sharp sand`, tone: "muted" },
      { label: "Jointing compound", value: `${jointing_kg.toFixed(0)} kg`, tone: "muted" }
    ],
    materials_total_pence: slabs * product.price_pence,
    ...(labourLineFor(area, product) && { labour: labourLineFor(area, product)! })
  };
}

function labourLineFor(m2: number, product: CalculatorProductRef): CalculatorLabour | null {
  if (!product.service_trade_type || typeof product.service_rate_pence !== "number" || product.service_rate_unit !== "m2") return null;
  return { trade_label: product.service_trade_type.replace("_", " "), rate_pence: product.service_rate_pence, rate_unit: "m2", quantity: Math.round(m2 * 10) / 10, total_pence: Math.round(m2 * product.service_rate_pence) };
}

export function pavingComplementarySubcategories(scenario: PavingScenario): string[] {
  if (scenario === "driveway") return ["pointing_mortar", "sub_base", "sharp_sand", "jointing_compound", "weed_membrane"];
  return ["pointing_mortar", "sub_base", "sharp_sand", "jointing_compound", "lawn_edging"];
}

export const PAVING_DEFAULT_INPUTS_BY_SCENARIO: { [K in PavingScenario]: Extract<PavingInputs, { scenario: K }> } = {
  patio: { scenario: "patio", length_m: 5, width_m: 3, slab_w_mm: 600, slab_h_mm: 600, waste_10pct: true },
  driveway: { scenario: "driveway", length_m: 8, width_m: 3, slab_w_mm: 200, slab_h_mm: 100, waste_10pct: true },
  garden_path: { scenario: "garden_path", length_m: 8, width_m: 0.9, slab_w_mm: 450, slab_h_mm: 450, curves: false, waste_10pct: true }
};
export const PAVING_DEFAULT_SCENARIO: PavingScenario = "patio";
export const PAVING_DEFAULT_INPUTS: PavingInputs = PAVING_DEFAULT_INPUTS_BY_SCENARIO.patio;
export const PAVING_SCENARIO_LABEL: Record<PavingScenario, string> = {
  patio: "Patio",
  driveway: "Driveway",
  garden_path: "Garden path"
};
