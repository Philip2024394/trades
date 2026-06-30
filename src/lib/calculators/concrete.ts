// Concrete calculator — 5 UK scenarios.
// Mixes: 1:2:4 general, 1:1.5:3 structural, 1:3:6 mass.
// 2.4 t/m³, ~108 × 20 kg bags per m³.

import type { CalculatorOutput, CalculatorLabour, CalculatorProductRef } from "./types";

export type ConcreteScenario =
  | "patio_slab"
  | "path"
  | "fence_post_bases"
  | "shed_base"
  | "driveway";

export type ConcreteInputs =
  | { scenario: "patio_slab"; length_m: number; width_m: number; depth_mm: number; mix: Mix; waste_10pct: boolean }
  | { scenario: "path"; length_m: number; width_m: number; depth_mm: number; mix: Mix; waste_10pct: boolean }
  | { scenario: "fence_post_bases"; count: number; hole_diameter_mm: number; hole_depth_mm: number; waste_10pct: boolean }
  | { scenario: "shed_base"; length_m: number; width_m: number; depth_mm: number; mix: Mix; waste_10pct: boolean }
  | { scenario: "driveway"; length_m: number; width_m: number; depth_mm: number; mix: Mix; waste_10pct: boolean };

type Mix = "general" | "structural" | "mass";
const MIX_RATIO: Record<Mix, { c: number; s: number; b: number; label: string }> = {
  general: { c: 1, s: 2, b: 4, label: "1:2:4 (general)" },
  structural: { c: 1, s: 1.5, b: 3, label: "1:1.5:3 (structural)" },
  mass: { c: 1, s: 3, b: 6, label: "1:3:6 (mass)" }
};
const DENSITY = 2.4;

function readNum(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  return fallback;
}

export function computeConcrete(inputs: ConcreteInputs, product: CalculatorProductRef): CalculatorOutput {
  let volume_m3 = 0;
  let area_m2 = 0;
  let title = "";
  let mix: Mix = "general";
  let waste = false;

  switch (inputs.scenario) {
    case "patio_slab":
    case "path":
    case "shed_base":
    case "driveway": {
      area_m2 = inputs.length_m * inputs.width_m;
      volume_m3 = area_m2 * (inputs.depth_mm / 1000);
      mix = inputs.mix;
      waste = inputs.waste_10pct;
      title = { patio_slab: "Patio slab", path: "Concrete path", shed_base: "Shed base", driveway: "Concrete driveway" }[inputs.scenario];
      break;
    }
    case "fence_post_bases": {
      const radius = inputs.hole_diameter_mm / 2 / 1000;
      const per_hole = Math.PI * radius * radius * (inputs.hole_depth_mm / 1000);
      volume_m3 = per_hole * inputs.count;
      area_m2 = 0;
      mix = "general";
      waste = inputs.waste_10pct;
      title = `${inputs.count} fence-post bases (${inputs.hole_diameter_mm} × ${inputs.hole_depth_mm} mm)`;
      break;
    }
  }

  if (waste) volume_m3 *= 1.1;
  const total_kg = volume_m3 * DENSITY * 1000;
  const ratio = MIX_RATIO[mix];
  const parts = ratio.c + ratio.s + ratio.b;
  const cement_kg = (total_kg * ratio.c) / parts;
  const sand_kg = (total_kg * ratio.s) / parts;
  const ballast_kg = (total_kg * ratio.b) / parts;
  const kg_per_bag = readNum(product.calculator_config?.kg_per_bag, 20);
  const premix_bags = Math.max(1, Math.ceil(total_kg / kg_per_bag));

  const warnings: string[] = [];
  if (inputs.scenario !== "fence_post_bases" && (inputs as { depth_mm?: number }).depth_mm && (inputs as { depth_mm: number }).depth_mm < 75 && mix !== "mass") {
    warnings.push("Slabs under 75 mm crack — consider deeper pour or mass mix.");
  }
  if (volume_m3 > 1) {
    warnings.push("Pour ≥ 1 m³ — usually cheaper to order ready-mix from a concrete supplier than bag-mix on site.");
  }

  return {
    lines: [
      { label: "Pour volume", value: `${volume_m3.toFixed(3)} m³`, detail: title + (waste ? " · +10% waste" : ""), tone: "primary" },
      { label: "Mix", value: ratio.label, tone: "muted" },
      { label: `Pre-mix bags (${kg_per_bag} kg)`, value: `${premix_bags} bags`, tone: "muted", cart: { product_id: product.id, qty: premix_bags, cart_label: `${product.name} × ${premix_bags}`, price_pence: product.price_pence, cover_url: product.cover_url } },
      { label: "OR mix-your-own", value: `${Math.ceil(cement_kg / 25)} × 25 kg cement`, detail: `+ ${(sand_kg / 1000).toFixed(2)} t sharp sand · ${(ballast_kg / 1000).toFixed(2)} t ballast`, tone: "muted" }
    ],
    warnings,
    materials_total_pence: premix_bags * product.price_pence,
    ...(area_m2 > 0 && labourLineFor(area_m2, product) && { labour: labourLineFor(area_m2, product)! })
  };
}

function labourLineFor(m2: number, product: CalculatorProductRef): CalculatorLabour | null {
  if (!product.service_trade_type || typeof product.service_rate_pence !== "number" || product.service_rate_unit !== "m2") return null;
  return { trade_label: product.service_trade_type.replace("_", " "), rate_pence: product.service_rate_pence, rate_unit: "m2", quantity: Math.round(m2 * 10) / 10, total_pence: Math.round(m2 * product.service_rate_pence) };
}

export function concreteComplementarySubcategories(scenario: ConcreteScenario): string[] {
  if (scenario === "driveway" || scenario === "shed_base") return ["rebar", "concrete_mesh", "formwork", "sub_base"];
  if (scenario === "fence_post_bases") return ["postcrete"];
  return ["formwork"];
}

export const CONCRETE_DEFAULT_INPUTS_BY_SCENARIO: { [K in ConcreteScenario]: Extract<ConcreteInputs, { scenario: K }> } = {
  patio_slab: { scenario: "patio_slab", length_m: 4, width_m: 3, depth_mm: 100, mix: "general", waste_10pct: true },
  path: { scenario: "path", length_m: 8, width_m: 1, depth_mm: 100, mix: "general", waste_10pct: true },
  fence_post_bases: { scenario: "fence_post_bases", count: 8, hole_diameter_mm: 300, hole_depth_mm: 600, waste_10pct: true },
  shed_base: { scenario: "shed_base", length_m: 3, width_m: 2.5, depth_mm: 100, mix: "general", waste_10pct: true },
  driveway: { scenario: "driveway", length_m: 8, width_m: 3, depth_mm: 150, mix: "structural", waste_10pct: true }
};
export const CONCRETE_DEFAULT_SCENARIO: ConcreteScenario = "patio_slab";
export const CONCRETE_DEFAULT_INPUTS: ConcreteInputs = CONCRETE_DEFAULT_INPUTS_BY_SCENARIO.patio_slab;
export const CONCRETE_SCENARIO_LABEL: Record<ConcreteScenario, string> = {
  patio_slab: "Patio slab",
  path: "Concrete path",
  fence_post_bases: "Fence-post bases",
  shed_base: "Shed base",
  driveway: "Driveway"
};
