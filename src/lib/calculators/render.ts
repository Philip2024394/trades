// Render calculator — 2 UK scenarios (external wall / chimney stack).
// Sand:cement ~12 kg/m² (16 mm). K Rend ~8 kg/m² (two coats).

import type { CalculatorOutput, CalculatorLabour, CalculatorProductRef } from "./types";

export type RenderScenario = "external_wall" | "chimney_stack";

export type RenderInputs =
  | { scenario: "external_wall"; wall_area_m2: number; system: "sand_cement" | "k_rend_silicone"; include_mesh: boolean; waste_10pct: boolean }
  | { scenario: "chimney_stack"; stack_perimeter_m: number; stack_height_m: number; system: "sand_cement" | "k_rend_silicone"; include_mesh: boolean; waste_10pct: boolean };

const KG_PER_M2: Record<"sand_cement" | "k_rend_silicone", number> = { sand_cement: 12, k_rend_silicone: 8 };

function readNum(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  return fallback;
}

export function computeRender(inputs: RenderInputs, product: CalculatorProductRef): CalculatorOutput {
  let area = 0;
  let title = "";
  const warnings: string[] = [];

  switch (inputs.scenario) {
    case "external_wall": {
      area = inputs.wall_area_m2;
      title = "External wall";
      break;
    }
    case "chimney_stack": {
      area = inputs.stack_perimeter_m * inputs.stack_height_m;
      title = `Chimney stack — ${inputs.stack_perimeter_m} m perimeter × ${inputs.stack_height_m} m`;
      warnings.push("Chimney work needs scaffold + lead/code-4 flashing — quote that separately.");
      break;
    }
  }

  const total_kg = area * KG_PER_M2[inputs.system] * (inputs.waste_10pct ? 1.1 : 1);
  const kg_per_bag = readNum(product.calculator_config?.kg_per_bag, 25);
  const bags = Math.max(1, Math.ceil(total_kg / kg_per_bag));
  const mesh_m2 = inputs.include_mesh ? area * 1.1 : 0;

  return {
    lines: [
      { label: "Area to render", value: `${area.toFixed(1)} m²`, detail: `${title} · ${inputs.system === "sand_cement" ? "sand:cement 1:5" : "K Rend / silicone"}`, tone: "muted" },
      { label: `Render needed${inputs.waste_10pct ? " (+10% waste)" : ""}`, value: `${total_kg.toFixed(0)} kg`, tone: "primary" },
      { label: `Bags to order (${kg_per_bag} kg)`, value: `${bags} bags`, tone: "muted", cart: { product_id: product.id, qty: bags, cart_label: `${product.name} × ${bags}`, price_pence: product.price_pence, cover_url: product.cover_url } },
      ...(inputs.include_mesh ? [{ label: "Reinforcement mesh", value: `${mesh_m2.toFixed(1)} m²`, detail: "+10% overlap", tone: "muted" as const }] : [])
    ],
    warnings,
    materials_total_pence: bags * product.price_pence,
    ...(labourLineFor(area, product) && { labour: labourLineFor(area, product)! })
  };
}

function labourLineFor(m2: number, product: CalculatorProductRef): CalculatorLabour | null {
  if (!product.service_trade_type || typeof product.service_rate_pence !== "number" || product.service_rate_unit !== "m2") return null;
  return { trade_label: product.service_trade_type.replace("_", " "), rate_pence: product.service_rate_pence, rate_unit: "m2", quantity: Math.round(m2 * 10) / 10, total_pence: Math.round(m2 * product.service_rate_pence) };
}

export function renderComplementarySubcategories(_scenario: RenderScenario): string[] {
  void _scenario;
  return ["render_mesh", "scrim_corner", "primer", "scraper"];
}

export const RENDER_DEFAULT_INPUTS_BY_SCENARIO: { [K in RenderScenario]: Extract<RenderInputs, { scenario: K }> } = {
  external_wall: { scenario: "external_wall", wall_area_m2: 25, system: "sand_cement", include_mesh: true, waste_10pct: true },
  chimney_stack: { scenario: "chimney_stack", stack_perimeter_m: 2.4, stack_height_m: 1.5, system: "sand_cement", include_mesh: true, waste_10pct: true }
};
export const RENDER_DEFAULT_SCENARIO: RenderScenario = "external_wall";
export const RENDER_DEFAULT_INPUTS: RenderInputs = RENDER_DEFAULT_INPUTS_BY_SCENARIO.external_wall;
export const RENDER_SCENARIO_LABEL: Record<RenderScenario, string> = {
  external_wall: "External wall",
  chimney_stack: "Chimney stack"
};
