// calc-tiles — App-store manifest.
//
// Wraps src/lib/calculators/tiles.ts (5 UK scenarios) covering wall +
// floor + splashback + outdoor tiling with adhesive + grout + spacer
// waste maths.
//
// Distinct from calc-flooring — tiles have their own adhesive / grout
// physics and are laid by tilers (not floor-layers).
//
// EXCLUDED: plasterer (does not tile) · floor-layer (uses calc-flooring
// for wood / laminate / vinyl / carpet — tile floors are a separate
// trade).

import { Grid3x3 } from "lucide-react";

export const CALC_TILES_APP_MANIFEST = {
  slug: "calc-tiles",
  name: "Tiles Calculator",
  category: "calculator" as const,
  version: "1.0.0",
  description:
    "Estimate tile count, adhesive kg, grout kg, spacers, and labour cost for 5 UK scenarios: bathroom floor / shower walls / kitchen splashback / whole bathroom / outdoor patio.",
  icon: Grid3x3,

  tradeAllowlist: [
    "tiler",
    "kitchen-fitter",
    "bathroom-fitter",
    "general-builder"
  ] as const,

  autoInstallOnService: [
    "tiling",
    "wall-tiling",
    "floor-tiling",
    "bathroom-tiling",
    "kitchen-tiling",
    "splashback",
    "wet-room",
    "shower-tiling",
    "outdoor-tiling",
    "patio-tiling",
    "porcelain-tiling",
    "ceramic-tiling",
    "mosaic-tiling"
  ] as const,

  supportedSizes: ["landscape", "square", "portrait"] as const,
  compact: true,
  requiresProductFeed: false
} as const;

export type CalcTilesAppSize =
  (typeof CALC_TILES_APP_MANIFEST)["supportedSizes"][number];
