// Fencing calculator — 3 UK scenarios (straight run / L-corner / gated).
// 1.83 m panels, posts at 1.83 m centres, 600 mm post depth, 20 kg
// postcrete per post.

import type { CalculatorOutput, CalculatorLabour, CalculatorProductRef } from "./types";

export type FencingScenario = "straight" | "l_corner" | "gated";

export type FencingInputs =
  | { scenario: "straight"; run_length_m: number; panel_width_m: number; include_gravel_boards: boolean }
  | { scenario: "l_corner"; run_a_length_m: number; run_b_length_m: number; panel_width_m: number; include_gravel_boards: boolean }
  | { scenario: "gated"; run_length_m: number; panel_width_m: number; gate_width_m: number; gate_count: 1 | 2; include_gravel_boards: boolean };

export function computeFencing(inputs: FencingInputs, product: CalculatorProductRef): CalculatorOutput {
  const panel_w = Math.max(0.5, inputs.panel_width_m);
  let run = 0;
  let panels = 0;
  let posts = 0;
  let gate_extras: CalculatorOutput["lines"] = [];
  let title = "";

  switch (inputs.scenario) {
    case "straight": {
      run = inputs.run_length_m;
      panels = Math.max(1, Math.ceil(run / panel_w));
      posts = panels + 1;
      title = "Straight run";
      break;
    }
    case "l_corner": {
      run = inputs.run_a_length_m + inputs.run_b_length_m;
      const panels_a = Math.max(1, Math.ceil(inputs.run_a_length_m / panel_w));
      const panels_b = Math.max(1, Math.ceil(inputs.run_b_length_m / panel_w));
      panels = panels_a + panels_b;
      posts = panels + 2; // extra corner post
      title = `L-corner run — ${inputs.run_a_length_m} m + ${inputs.run_b_length_m} m`;
      break;
    }
    case "gated": {
      const gate_total = inputs.gate_width_m * inputs.gate_count;
      run = inputs.run_length_m;
      const panel_run = Math.max(0, run - gate_total);
      panels = Math.max(1, Math.ceil(panel_run / panel_w));
      posts = panels + 1 + inputs.gate_count * 2; // each gate needs 2 strong posts
      title = `Gated run — ${inputs.gate_count} × ${inputs.gate_width_m} m gate${inputs.gate_count === 1 ? "" : "s"}`;
      gate_extras = [
        { label: `Gate panel${inputs.gate_count === 1 ? "" : "s"}`, value: `${inputs.gate_count} × ${inputs.gate_width_m} m`, tone: "muted" },
        { label: "Gate hinges + latches", value: `${inputs.gate_count} kit${inputs.gate_count === 1 ? "" : "s"}`, detail: "Heavy-duty hinges + drop bolt", tone: "muted" }
      ];
      break;
    }
  }

  const postcrete_bags = posts;

  return {
    lines: [
      { label: "Fence run", value: `${run.toFixed(1)} m`, detail: title, tone: "muted" },
      { label: "Panels needed", value: `${panels} panel${panels === 1 ? "" : "s"}`, detail: `${panel_w} m wide each`, tone: "primary", cart: { product_id: product.id, qty: panels, cart_label: `${product.name} × ${panels}`, price_pence: product.price_pence, cover_url: product.cover_url } },
      { label: "Posts (100×100 × 2.4 m)", value: `${posts} posts`, detail: "600 mm in ground", tone: "muted" },
      { label: "Postcrete bags (20 kg)", value: `${postcrete_bags} bags`, tone: "muted" },
      ...(inputs.include_gravel_boards ? [{ label: "Gravel boards", value: `${panels} board${panels === 1 ? "" : "s"}`, tone: "muted" as const }] : []),
      ...gate_extras
    ],
    materials_total_pence: panels * product.price_pence,
    ...(labourLineFor(run, product) && { labour: labourLineFor(run, product)! })
  };
}

function labourLineFor(linear_m: number, product: CalculatorProductRef): CalculatorLabour | null {
  if (!product.service_trade_type || typeof product.service_rate_pence !== "number" || product.service_rate_unit !== "linear_m") return null;
  return { trade_label: product.service_trade_type.replace("_", " "), rate_pence: product.service_rate_pence, rate_unit: "linear_m", quantity: Math.round(linear_m * 10) / 10, total_pence: Math.round(linear_m * product.service_rate_pence) };
}

export function fencingComplementarySubcategories(scenario: FencingScenario): string[] {
  if (scenario === "gated") return ["postcrete", "post_cap", "gravel_board", "gate_hinge", "fence_paint"];
  return ["postcrete", "post_cap", "gravel_board", "fence_paint"];
}

export const FENCING_DEFAULT_INPUTS_BY_SCENARIO: { [K in FencingScenario]: Extract<FencingInputs, { scenario: K }> } = {
  straight: { scenario: "straight", run_length_m: 12, panel_width_m: 1.83, include_gravel_boards: true },
  l_corner: { scenario: "l_corner", run_a_length_m: 8, run_b_length_m: 6, panel_width_m: 1.83, include_gravel_boards: true },
  gated: { scenario: "gated", run_length_m: 15, panel_width_m: 1.83, gate_width_m: 0.9, gate_count: 1, include_gravel_boards: true }
};
export const FENCING_DEFAULT_SCENARIO: FencingScenario = "straight";
export const FENCING_DEFAULT_INPUTS: FencingInputs = FENCING_DEFAULT_INPUTS_BY_SCENARIO.straight;
export const FENCING_SCENARIO_LABEL: Record<FencingScenario, string> = {
  straight: "Straight run",
  l_corner: "L-corner",
  gated: "Run with gate"
};
