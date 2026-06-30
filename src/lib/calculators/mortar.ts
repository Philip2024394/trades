// Mortar calculator — 3 UK scenarios (new brickwork, new blockwork,
// repointing). Mixes 1:4 / 1:1:6 / 1:3. 0.022 m³/m² bricks, 0.012 blocks.

import type { CalculatorOutput, CalculatorProductRef } from "./types";

export type MortarScenario = "brickwork" | "blockwork" | "repointing";

export type MortarInputs =
  | { scenario: "brickwork"; wall_area_m2: number; mix: Mix; waste_10pct: boolean }
  | { scenario: "blockwork"; wall_area_m2: number; mix: Mix; waste_10pct: boolean }
  | { scenario: "repointing"; wall_area_m2: number; joint_thickness_mm: number; mix: Mix; waste_10pct: boolean };

type Mix = "general_1_4" | "lime_1_1_6" | "structural_1_3";

const MIX_RATIO: Record<Mix, { c: number; l: number; s: number; label: string }> = {
  general_1_4: { c: 1, l: 0, s: 4, label: "1:4 cement:sand (general)" },
  lime_1_1_6: { c: 1, l: 1, s: 6, label: "1:1:6 cement:lime:sand (M4)" },
  structural_1_3: { c: 1, l: 0, s: 3, label: "1:3 (structural / engineering)" }
};

function readNum(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  return fallback;
}

export function computeMortar(inputs: MortarInputs, product: CalculatorProductRef): CalculatorOutput {
  let volume_m3 = 0;
  let title = "";
  switch (inputs.scenario) {
    case "brickwork": {
      volume_m3 = inputs.wall_area_m2 * 0.022;
      title = "New brickwork";
      break;
    }
    case "blockwork": {
      volume_m3 = inputs.wall_area_m2 * 0.012;
      title = "New blockwork";
      break;
    }
    case "repointing": {
      // ~30 m of joint per m² wall, joint depth ~15 mm typical raking
      const joint_volume_per_m2 = 30 * 0.015 * (inputs.joint_thickness_mm / 1000);
      volume_m3 = inputs.wall_area_m2 * joint_volume_per_m2 * 8; // 8× factor: trade rule
      title = `Repointing (${inputs.joint_thickness_mm} mm joints)`;
      break;
    }
  }
  if (inputs.waste_10pct) volume_m3 *= 1.1;

  const mix = MIX_RATIO[inputs.mix];
  const parts = mix.c + mix.l + mix.s;
  const cement_m3 = (volume_m3 * mix.c) / parts;
  const sand_m3 = (volume_m3 * mix.s) / parts;
  const cement_bags_25kg = Math.max(1, Math.ceil(cement_m3 / 0.017));
  const sand_tonnes = sand_m3 * 1.5;

  const kg_per_bag = readNum(product.calculator_config?.kg_per_bag, 25);
  const premix_bags = Math.max(1, Math.ceil((volume_m3 * 1500) / kg_per_bag));

  return {
    lines: [
      { label: "Surface", value: `${inputs.wall_area_m2.toFixed(1)} m²`, detail: title, tone: "muted" },
      { label: `Mortar volume${inputs.waste_10pct ? " (+10% waste)" : ""}`, value: `${volume_m3.toFixed(3)} m³`, detail: mix.label, tone: "primary" },
      { label: `Pre-mix bags (${kg_per_bag} kg)`, value: `${premix_bags} bags`, tone: "muted", cart: { product_id: product.id, qty: premix_bags, cart_label: `${product.name} × ${premix_bags}`, price_pence: product.price_pence, cover_url: product.cover_url } },
      { label: "OR mix-your-own", value: `${cement_bags_25kg} × 25 kg cement`, detail: `+ ${sand_tonnes.toFixed(2)} t building sand`, tone: "muted" }
    ],
    materials_total_pence: premix_bags * product.price_pence
  };
}

export function mortarComplementarySubcategories(scenario: MortarScenario): string[] {
  if (scenario === "repointing") return ["scraper", "sandpaper", "drop_sheet"];
  return ["lime", "plasticiser", "wall_tie", "dpc"];
}

export const MORTAR_DEFAULT_INPUTS_BY_SCENARIO: { [K in MortarScenario]: Extract<MortarInputs, { scenario: K }> } = {
  brickwork: { scenario: "brickwork", wall_area_m2: 10, mix: "general_1_4", waste_10pct: true },
  blockwork: { scenario: "blockwork", wall_area_m2: 15, mix: "general_1_4", waste_10pct: true },
  repointing: { scenario: "repointing", wall_area_m2: 8, joint_thickness_mm: 10, mix: "lime_1_1_6", waste_10pct: true }
};
export const MORTAR_DEFAULT_SCENARIO: MortarScenario = "brickwork";
export const MORTAR_DEFAULT_INPUTS: MortarInputs = MORTAR_DEFAULT_INPUTS_BY_SCENARIO.brickwork;
export const MORTAR_SCENARIO_LABEL: Record<MortarScenario, string> = {
  brickwork: "New brickwork",
  blockwork: "New blockwork",
  repointing: "Repointing"
};
