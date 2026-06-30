// Skirting / coving / architrave calculator — 3 UK scenarios.
// Stock lengths 2.4 / 3 / 4.2 m. Subtract doorways. +10% mitre waste.

import type { CalculatorOutput, CalculatorProductRef } from "./types";

export type SkirtingScenario = "single_room" | "multi_room" | "coving";

export type SkirtingInputs =
  | { scenario: "single_room"; room_length_m: number; room_width_m: number; doorways: number; doorway_width_m: number; stock_length_m: 2.4 | 3 | 4.2 }
  | { scenario: "multi_room"; rooms: Array<{ name: string; length_m: number; width_m: number; doorways: number }>; doorway_width_m: number; stock_length_m: 2.4 | 3 | 4.2 }
  | { scenario: "coving"; room_length_m: number; room_width_m: number; stock_length_m: 2.4 | 3 | 4.2 };

export function computeSkirting(inputs: SkirtingInputs, product: CalculatorProductRef): CalculatorOutput {
  let needed_m = 0;
  let title = "";
  const extra: CalculatorOutput["lines"] = [];

  switch (inputs.scenario) {
    case "single_room": {
      const perim = 2 * (inputs.room_length_m + inputs.room_width_m);
      const subtract = inputs.doorways * inputs.doorway_width_m;
      needed_m = Math.max(0, perim - subtract);
      title = `${inputs.room_length_m} × ${inputs.room_width_m} m room, ${inputs.doorways} doorway${inputs.doorways === 1 ? "" : "s"}`;
      break;
    }
    case "multi_room": {
      title = `${inputs.rooms.length} rooms — combined`;
      for (const r of inputs.rooms) {
        const perim = 2 * (r.length_m + r.width_m);
        const sub = r.doorways * inputs.doorway_width_m;
        const room_m = Math.max(0, perim - sub);
        needed_m += room_m;
        extra.push({ label: r.name || "Room", value: `${room_m.toFixed(1)} m`, detail: `${r.length_m} × ${r.width_m} m − ${r.doorways} doorway${r.doorways === 1 ? "" : "s"}`, tone: "muted" });
      }
      break;
    }
    case "coving": {
      needed_m = 2 * (inputs.room_length_m + inputs.room_width_m); // coving has no doorway breaks
      title = `Coving — ${inputs.room_length_m} × ${inputs.room_width_m} m room`;
      break;
    }
  }

  const with_waste = needed_m * (inputs.scenario === "coving" ? 1.15 : 1.1);
  const lengths = Math.max(1, Math.ceil(with_waste / inputs.stock_length_m));

  return {
    lines: [
      { label: "Length needed", value: `${needed_m.toFixed(2)} m`, detail: title, tone: "muted" },
      ...extra,
      { label: `Stock lengths (${inputs.stock_length_m} m) +${inputs.scenario === "coving" ? 15 : 10}% waste`, value: `${lengths} length${lengths === 1 ? "" : "s"}`, tone: "primary", cart: { product_id: product.id, qty: lengths, cart_label: `${product.name} × ${lengths}`, price_pence: product.price_pence, cover_url: product.cover_url } }
    ],
    materials_total_pence: lengths * product.price_pence
  };
}

export function skirtingComplementarySubcategories(scenario: SkirtingScenario): string[] {
  if (scenario === "coving") return ["panel_adhesive", "filler"];
  return ["panel_adhesive", "sandpaper", "filler"];
}

export const SKIRTING_DEFAULT_INPUTS_BY_SCENARIO: { [K in SkirtingScenario]: Extract<SkirtingInputs, { scenario: K }> } = {
  single_room: { scenario: "single_room", room_length_m: 4, room_width_m: 3, doorways: 1, doorway_width_m: 0.762, stock_length_m: 3 },
  multi_room: { scenario: "multi_room", rooms: [{ name: "Lounge", length_m: 4, width_m: 5, doorways: 2 }, { name: "Hall", length_m: 3, width_m: 1.2, doorways: 1 }], doorway_width_m: 0.762, stock_length_m: 3 },
  coving: { scenario: "coving", room_length_m: 4, room_width_m: 3, stock_length_m: 3 }
};
export const SKIRTING_DEFAULT_SCENARIO: SkirtingScenario = "single_room";
export const SKIRTING_DEFAULT_INPUTS: SkirtingInputs = SKIRTING_DEFAULT_INPUTS_BY_SCENARIO.single_room;
export const SKIRTING_SCENARIO_LABEL: Record<SkirtingScenario, string> = {
  single_room: "Single room",
  multi_room: "Multi-room",
  coving: "Coving"
};
