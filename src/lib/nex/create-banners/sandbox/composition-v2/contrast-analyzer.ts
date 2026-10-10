// src/lib/nex/create-banners/sandbox/composition-v2/contrast-analyzer.ts
//
// NEX Composition Engineering Wave · contrast planner
// ===================================================
// Given a region of the source image, decide the least-intrusive text
// treatment that guarantees legibility.

import type { BrandTokens, ContrastPlan, NegativeSpaceMap, Region } from "./types";
import { regionLuminance } from "./negative-space-analyzer";

export function planContrast(input: {
  readonly region: Region;
  readonly negative_space: NegativeSpaceMap;
  readonly tokens: BrandTokens;
  /** true when the region is inside a busy area · needs stronger treatment */
  readonly region_is_busy: boolean;
}): ContrastPlan {
  const { region, negative_space, tokens, region_is_busy } = input;
  const lum = regionLuminance(negative_space, region);

  // Base text colour · light regions get dark text, dark regions get light text
  const text_color =
    lum > 0.55 ? tokens.text_on_light : tokens.text_on_dark;

  // In quiet regions, use only text · no backing
  if (!region_is_busy) {
    return {
      text_color,
      stroke_color: null,
      stroke_width_px: 0,
      shadow: "drop-shadow(0 1px 2px rgba(0,0,0,0.35))",
      backing: { kind: "none" },
    };
  }

  // Busy region · use a subtle gradient backing that follows the vertical
  // position (top-band → dark-fade-to-transparent · bottom-band →
  // transparent-fade-to-dark). Text stays white in this branch.
  const centre_y = region.y + region.h / 2;
  const rel_y = centre_y / negative_space.source_height;
  const is_top_half = rel_y < 0.5;
  return {
    text_color: tokens.text_on_dark,
    stroke_color: null,
    stroke_width_px: 0,
    shadow: "drop-shadow(0 1px 2px rgba(0,0,0,0.55))",
    backing: {
      kind: "gradient",
      stops: is_top_half
        ? [
            { offset: 0, color: "rgba(0,0,0,0.75)" },
            { offset: 1, color: "rgba(0,0,0,0)" },
          ]
        : [
            { offset: 0, color: "rgba(0,0,0,0)" },
            { offset: 1, color: "rgba(0,0,0,0.85)" },
          ],
    },
  };
}
