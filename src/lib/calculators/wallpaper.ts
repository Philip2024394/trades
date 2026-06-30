// Wallpaper calculator — 3 UK scenarios (feature wall / whole room / stairwell).
// 10.05m × 0.52m std roll = 5.2 m² raw, 4.5 m² usable with pattern.

import type { CalculatorOutput, CalculatorProductRef } from "./types";

export type WallpaperScenario = "feature_wall" | "whole_room" | "stairwell";

export type WallpaperInputs =
  | { scenario: "feature_wall"; wall_length_m: number; wall_height_m: number; pattern: "plain_or_small" | "large_repeat" }
  | { scenario: "whole_room"; length_m: number; width_m: number; height_m: number; doors: number; windows: number; pattern: "plain_or_small" | "large_repeat" }
  | { scenario: "stairwell"; tallest_wall_height_m: number; stair_run_m: number; pattern: "plain_or_small" | "large_repeat" };

const USABLE_M2: Record<"plain_or_small" | "large_repeat", number> = { plain_or_small: 4.5, large_repeat: 3.5 };
const DOOR_M2 = 1.7;
const WINDOW_M2 = 1.4;

export function computeWallpaper(inputs: WallpaperInputs, product: CalculatorProductRef): CalculatorOutput {
  let area = 0;
  let title = "";
  switch (inputs.scenario) {
    case "feature_wall": {
      area = inputs.wall_length_m * inputs.wall_height_m;
      title = "Single feature wall";
      break;
    }
    case "whole_room": {
      const gross = 2 * (inputs.length_m + inputs.width_m) * inputs.height_m;
      const subtract = inputs.doors * DOOR_M2 + inputs.windows * WINDOW_M2;
      area = Math.max(0, gross - subtract);
      title = "Whole room";
      break;
    }
    case "stairwell": {
      // Stairwell walls roughly trapezoidal — average height × stair run × 2 walls
      const avg_height = inputs.tallest_wall_height_m / 2 + 1; // approx
      area = avg_height * inputs.stair_run_m * 2;
      title = "Stairwell (averaged trapezoid)";
      break;
    }
  }

  const per_roll = USABLE_M2[inputs.pattern];
  const rolls = Math.max(1, Math.ceil(area / per_roll));
  const paste_packets = Math.max(1, Math.ceil(rolls / 5));

  return {
    lines: [
      { label: "Wall area", value: `${area.toFixed(1)} m²`, detail: title, tone: "muted" },
      { label: "Rolls needed", value: `${rolls} roll${rolls === 1 ? "" : "s"}`, detail: `${per_roll} m² usable per roll (${inputs.pattern.replace("_", " ")})`, tone: "primary", cart: { product_id: product.id, qty: rolls, cart_label: `${product.name} × ${rolls}`, price_pence: product.price_pence, cover_url: product.cover_url } },
      { label: "Paste packets", value: `${paste_packets} packet${paste_packets === 1 ? "" : "s"}`, detail: "1 packet hangs ~5 rolls", tone: "muted" }
    ],
    warnings: inputs.scenario === "stairwell" ? ["Stairwell walls are tricky — measure tallest height + stair run; estimate may need a pro recheck."] : [],
    materials_total_pence: rolls * product.price_pence
  };
}

export function wallpaperComplementarySubcategories(_scenario: WallpaperScenario): string[] {
  void _scenario;
  return ["wallpaper_paste", "wallpaper_smoother", "sandpaper", "filler", "scraper"];
}

export const WALLPAPER_DEFAULT_INPUTS_BY_SCENARIO: { [K in WallpaperScenario]: Extract<WallpaperInputs, { scenario: K }> } = {
  feature_wall: { scenario: "feature_wall", wall_length_m: 4, wall_height_m: 2.4, pattern: "plain_or_small" },
  whole_room: { scenario: "whole_room", length_m: 4, width_m: 3, height_m: 2.4, doors: 1, windows: 1, pattern: "plain_or_small" },
  stairwell: { scenario: "stairwell", tallest_wall_height_m: 5, stair_run_m: 4, pattern: "plain_or_small" }
};
export const WALLPAPER_DEFAULT_SCENARIO: WallpaperScenario = "feature_wall";
export const WALLPAPER_DEFAULT_INPUTS: WallpaperInputs = WALLPAPER_DEFAULT_INPUTS_BY_SCENARIO.feature_wall;
export const WALLPAPER_SCENARIO_LABEL: Record<WallpaperScenario, string> = {
  feature_wall: "Feature wall",
  whole_room: "Whole room",
  stairwell: "Stairwell"
};
