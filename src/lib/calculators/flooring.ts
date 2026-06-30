// Flooring calculator — 5 UK scenarios.
//
// Waste % by layout (UK trade standard):
//   straight/rectangular    +10%
//   L-shape / alcoves       +15%
//   diagonal / herringbone  +20%
//
// Stairs: each tread covered separately (≈ tread depth × stair width).
// Multi-room: customer can add multiple zones (each its own L×W) and
// we sum the m² + apply one combined waste %.

import type {
  CalculatorOutput,
  CalculatorLabour,
  CalculatorProductRef
} from "./types";

export type FlooringScenario =
  | "rectangular"
  | "l_shape"
  | "stairs"
  | "hallway"
  | "multi_room";

export type FlooringInputs =
  | {
      scenario: "rectangular";
      length_m: number;
      width_m: number;
      layout: "straight" | "diagonal" | "herringbone";
    }
  | {
      scenario: "l_shape";
      part_a_length_m: number;
      part_a_width_m: number;
      part_b_length_m: number;
      part_b_width_m: number;
    }
  | {
      scenario: "stairs";
      treads: number;
      tread_depth_m: number;
      stair_width_m: number;
      include_risers: boolean;
    }
  | {
      scenario: "hallway";
      length_m: number;
      width_m: number;
    }
  | {
      scenario: "multi_room";
      zones: Array<{ name: string; length_m: number; width_m: number }>;
      layout: "straight" | "diagonal" | "herringbone";
    };

const WASTE_BY_LAYOUT: Record<"straight" | "diagonal" | "herringbone", number> = {
  straight: 0.10,
  diagonal: 0.15,
  herringbone: 0.20
};

function readNum(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  return fallback;
}

export function computeFlooring(
  inputs: FlooringInputs,
  product: CalculatorProductRef
): CalculatorOutput {
  const m2_per_box = readNum(product.calculator_config?.m2_per_box, 1.62);

  let room_m2 = 0;
  let perimeter_m = 0;
  let extraLines: CalculatorOutput["lines"] = [];
  let waste_pct = WASTE_BY_LAYOUT.straight;
  let title = "";

  switch (inputs.scenario) {
    case "rectangular": {
      room_m2 = Math.max(0, inputs.length_m) * Math.max(0, inputs.width_m);
      perimeter_m = 2 * (inputs.length_m + inputs.width_m);
      waste_pct = WASTE_BY_LAYOUT[inputs.layout];
      title = `Rectangular room — ${inputs.layout} lay`;
      extraLines = [
        { label: "Room area", value: `${room_m2.toFixed(2)} m²`, detail: `${inputs.length_m} × ${inputs.width_m} m`, tone: "muted" }
      ];
      break;
    }
    case "l_shape": {
      const a = Math.max(0, inputs.part_a_length_m) * Math.max(0, inputs.part_a_width_m);
      const b = Math.max(0, inputs.part_b_length_m) * Math.max(0, inputs.part_b_width_m);
      room_m2 = a + b;
      perimeter_m = 2 * (inputs.part_a_length_m + inputs.part_a_width_m + inputs.part_b_length_m + inputs.part_b_width_m);
      waste_pct = WASTE_BY_LAYOUT.straight + 0.05;
      title = "L-shaped room";
      extraLines = [
        { label: "Section A", value: `${a.toFixed(2)} m²`, detail: `${inputs.part_a_length_m} × ${inputs.part_a_width_m} m`, tone: "muted" },
        { label: "Section B", value: `${b.toFixed(2)} m²`, detail: `${inputs.part_b_length_m} × ${inputs.part_b_width_m} m`, tone: "muted" }
      ];
      break;
    }
    case "stairs": {
      room_m2 = inputs.treads * Math.max(0, inputs.tread_depth_m) * Math.max(0, inputs.stair_width_m);
      if (inputs.include_risers) {
        // Add riser strips (~0.18 m tall per riser × stair width)
        room_m2 += inputs.treads * 0.18 * inputs.stair_width_m;
      }
      waste_pct = 0.15;
      title = `${inputs.treads}-tread staircase${inputs.include_risers ? " + risers" : ""}`;
      extraLines = [
        { label: "Stair surface", value: `${room_m2.toFixed(2)} m²`, detail: `${inputs.treads} treads × ${inputs.tread_depth_m} m × ${inputs.stair_width_m} m wide`, tone: "muted" }
      ];
      break;
    }
    case "hallway": {
      room_m2 = Math.max(0, inputs.length_m) * Math.max(0, inputs.width_m);
      perimeter_m = 2 * (inputs.length_m + inputs.width_m);
      waste_pct = 0.12; // narrow rooms need slightly more for end cuts
      title = "Hallway";
      extraLines = [
        { label: "Hallway", value: `${room_m2.toFixed(2)} m²`, detail: `${inputs.length_m} × ${inputs.width_m} m`, tone: "muted" }
      ];
      break;
    }
    case "multi_room": {
      const zones = inputs.zones.filter((z) => z.length_m > 0 && z.width_m > 0);
      room_m2 = zones.reduce((acc, z) => acc + z.length_m * z.width_m, 0);
      waste_pct = WASTE_BY_LAYOUT[inputs.layout];
      title = `${zones.length} room${zones.length === 1 ? "" : "s"} — combined order`;
      extraLines = zones.map((z) => ({
        label: z.name || "Room",
        value: `${(z.length_m * z.width_m).toFixed(2)} m²`,
        detail: `${z.length_m} × ${z.width_m} m`,
        tone: "muted" as const
      }));
      break;
    }
  }

  const total_m2 = room_m2 * (1 + waste_pct);
  const boxes = Math.max(1, Math.ceil(total_m2 / m2_per_box));

  const lines: CalculatorOutput["lines"] = [
    ...extraLines,
    {
      label: `Flooring needed (+${(waste_pct * 100).toFixed(0)}% waste)`,
      value: `${total_m2.toFixed(2)} m²`,
      detail: title,
      tone: "primary"
    },
    {
      label: "Boxes to order",
      value: `${boxes} box${boxes === 1 ? "" : "es"}`,
      detail: `${m2_per_box} m² per box`,
      tone: "muted",
      cart: {
        product_id: product.id,
        qty: boxes,
        cart_label: `${product.name} × ${boxes}`,
        price_pence: product.price_pence,
        cover_url: product.cover_url
      }
    },
    {
      label: "Underlay needed (separate product)",
      value: `${room_m2.toFixed(2)} m²`,
      tone: "muted"
    },
    ...(perimeter_m > 0
      ? [
          {
            label: "Beading for expansion gaps",
            value: `${perimeter_m.toFixed(1)} m`,
            tone: "muted" as const
          }
        ]
      : [])
  ];

  return {
    lines,
    materials_total_pence: boxes * product.price_pence,
    ...(labourLineFor(room_m2, product) && { labour: labourLineFor(room_m2, product)! })
  };
}

function labourLineFor(m2: number, product: CalculatorProductRef): CalculatorLabour | null {
  if (!product.service_trade_type || typeof product.service_rate_pence !== "number" || product.service_rate_unit !== "m2") return null;
  return {
    trade_label: product.service_trade_type.replace("_", " "),
    rate_pence: product.service_rate_pence,
    rate_unit: "m2",
    quantity: Math.round(m2 * 10) / 10,
    total_pence: Math.round(m2 * product.service_rate_pence)
  };
}

export function flooringComplementarySubcategories(scenario: FlooringScenario): string[] {
  const universal = ["underlay", "beading", "threshold_bar", "floor_adhesive"];
  if (scenario === "stairs") return [...universal, "drywall_screw"]; // for stair-nose fixings
  return universal;
}

export const FLOORING_DEFAULT_INPUTS_BY_SCENARIO: { [K in FlooringScenario]: Extract<FlooringInputs, { scenario: K }> } = {
  rectangular: { scenario: "rectangular", length_m: 4, width_m: 3, layout: "straight" },
  l_shape: { scenario: "l_shape", part_a_length_m: 4, part_a_width_m: 3, part_b_length_m: 2, part_b_width_m: 1.5 },
  stairs: { scenario: "stairs", treads: 13, tread_depth_m: 0.28, stair_width_m: 0.9, include_risers: true },
  hallway: { scenario: "hallway", length_m: 5, width_m: 1.2 },
  multi_room: {
    scenario: "multi_room",
    zones: [
      { name: "Lounge", length_m: 5, width_m: 4 },
      { name: "Hallway", length_m: 4, width_m: 1.2 }
    ],
    layout: "straight"
  }
};

export const FLOORING_DEFAULT_SCENARIO: FlooringScenario = "rectangular";
export const FLOORING_DEFAULT_INPUTS: FlooringInputs = FLOORING_DEFAULT_INPUTS_BY_SCENARIO.rectangular;

export const FLOORING_SCENARIO_LABEL: Record<FlooringScenario, string> = {
  rectangular: "Rectangular room",
  l_shape: "L-shaped room",
  stairs: "Stairs",
  hallway: "Hallway",
  multi_room: "Multi-room order"
};
