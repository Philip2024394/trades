// Decking calculator — 3 UK scenarios (simple rect / L-shape / multi-level).
// 144 mm boards + 5 mm gap, joists at 400 mm centres, 10 screws/m of board.

import type { CalculatorOutput, CalculatorLabour, CalculatorProductRef } from "./types";

export type DeckingScenario = "simple" | "l_shape" | "multi_level";

export type DeckingInputs =
  | { scenario: "simple"; length_m: number; width_m: number; board_width_mm: number; waste_10pct: boolean }
  | { scenario: "l_shape"; a_length_m: number; a_width_m: number; b_length_m: number; b_width_m: number; board_width_mm: number; waste_10pct: boolean }
  | { scenario: "multi_level"; upper_length_m: number; upper_width_m: number; lower_length_m: number; lower_width_m: number; step_count: number; step_width_m: number; board_width_mm: number; waste_10pct: boolean };

function readNum(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  return fallback;
}

export function computeDecking(inputs: DeckingInputs, product: CalculatorProductRef): CalculatorOutput {
  const board_length_m = readNum(product.calculator_config?.board_length_m, 3.6);
  const board_w_m = (Math.max(50, inputs.board_width_mm) + 5) / 1000;

  let deck_m2 = 0;
  let extra_boards = 0;
  let title = "";
  const extra: CalculatorOutput["lines"] = [];

  switch (inputs.scenario) {
    case "simple": {
      deck_m2 = inputs.length_m * inputs.width_m;
      title = `${inputs.length_m} × ${inputs.width_m} m simple deck`;
      break;
    }
    case "l_shape": {
      const a = inputs.a_length_m * inputs.a_width_m;
      const b = inputs.b_length_m * inputs.b_width_m;
      deck_m2 = a + b;
      title = "L-shape deck (sections A + B)";
      extra.push({ label: "Section A", value: `${a.toFixed(2)} m²`, tone: "muted" });
      extra.push({ label: "Section B", value: `${b.toFixed(2)} m²`, tone: "muted" });
      break;
    }
    case "multi_level": {
      const upper = inputs.upper_length_m * inputs.upper_width_m;
      const lower = inputs.lower_length_m * inputs.lower_width_m;
      const steps_m = inputs.step_count * 0.28 * inputs.step_width_m;
      deck_m2 = upper + lower + steps_m;
      title = `Multi-level deck — ${inputs.step_count} step${inputs.step_count === 1 ? "" : "s"}`;
      extra.push({ label: "Upper deck", value: `${upper.toFixed(2)} m²`, tone: "muted" });
      extra.push({ label: "Lower deck", value: `${lower.toFixed(2)} m²`, tone: "muted" });
      extra.push({ label: "Steps", value: `${steps_m.toFixed(2)} m²`, tone: "muted" });
      extra_boards = inputs.step_count * 2; // bullnose/riser overage
      break;
    }
  }

  const boards_per_m_width = (inputs.scenario === "simple" ? inputs.width_m : 0) / board_w_m;
  const lengthwise = inputs.scenario === "simple" ? Math.max(1, Math.ceil(inputs.length_m / board_length_m)) : 1;
  const raw_boards = inputs.scenario === "simple"
    ? Math.ceil(boards_per_m_width) * lengthwise
    : Math.ceil(deck_m2 / (board_length_m * board_w_m));
  const boards = Math.max(1, Math.ceil((raw_boards + extra_boards) * (inputs.waste_10pct ? 1.1 : 1)));
  const joist_length_m = inputs.scenario === "simple" ? inputs.length_m : Math.max(inputs.scenario === "l_shape" ? inputs.a_length_m + inputs.b_length_m : inputs.upper_length_m + inputs.lower_length_m, 1);
  const joists = Math.max(2, Math.ceil(joist_length_m / 0.4) + 1);
  const screws = boards * 10;

  return {
    lines: [
      { label: "Deck area", value: `${deck_m2.toFixed(2)} m²`, detail: title, tone: "muted" },
      ...extra,
      { label: `Boards needed${inputs.waste_10pct ? " (+10% waste)" : ""}`, value: `${boards} boards`, detail: `${inputs.board_width_mm} mm wide × ${board_length_m} m`, tone: "primary", cart: { product_id: product.id, qty: boards, cart_label: `${product.name} × ${boards}`, price_pence: product.price_pence, cover_url: product.cover_url } },
      { label: "Joists (47×100) @ 400 mm centres", value: `${joists} joists`, tone: "muted" },
      { label: "Decking screws", value: `~${screws} screws`, detail: "4 per board per joist crossing", tone: "muted" }
    ],
    materials_total_pence: boards * product.price_pence,
    ...(labourLineFor(deck_m2, product) && { labour: labourLineFor(deck_m2, product)! })
  };
}

function labourLineFor(m2: number, product: CalculatorProductRef): CalculatorLabour | null {
  if (!product.service_trade_type || typeof product.service_rate_pence !== "number" || product.service_rate_unit !== "m2") return null;
  return { trade_label: product.service_trade_type.replace("_", " "), rate_pence: product.service_rate_pence, rate_unit: "m2", quantity: Math.round(m2 * 10) / 10, total_pence: Math.round(m2 * product.service_rate_pence) };
}

export function deckingComplementarySubcategories(scenario: DeckingScenario): string[] {
  if (scenario === "multi_level") return ["deck_screw", "joist_hanger", "post_anchor", "deck_oil"];
  return ["deck_screw", "joist_hanger", "deck_oil"];
}

export const DECKING_DEFAULT_INPUTS_BY_SCENARIO: { [K in DeckingScenario]: Extract<DeckingInputs, { scenario: K }> } = {
  simple: { scenario: "simple", length_m: 4, width_m: 3, board_width_mm: 144, waste_10pct: true },
  l_shape: { scenario: "l_shape", a_length_m: 4, a_width_m: 3, b_length_m: 2, b_width_m: 1.5, board_width_mm: 144, waste_10pct: true },
  multi_level: { scenario: "multi_level", upper_length_m: 3, upper_width_m: 3, lower_length_m: 4, lower_width_m: 3, step_count: 3, step_width_m: 1.2, board_width_mm: 144, waste_10pct: true }
};
export const DECKING_DEFAULT_SCENARIO: DeckingScenario = "simple";
export const DECKING_DEFAULT_INPUTS: DeckingInputs = DECKING_DEFAULT_INPUTS_BY_SCENARIO.simple;
export const DECKING_SCENARIO_LABEL: Record<DeckingScenario, string> = {
  simple: "Simple rectangle",
  l_shape: "L-shape deck",
  multi_level: "Multi-level + steps"
};
