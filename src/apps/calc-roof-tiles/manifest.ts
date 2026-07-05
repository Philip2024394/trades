// calc-roof-tiles — App-store manifest.
//
// Roofing calc — 3 job scopes (retile / reslate / full strip + re-roof).
// Underlying math from src/lib/calculators/roof_tiles.ts. Scope filter
// controls which output lines (battens vs no-battens) appear.

import { Home } from "lucide-react";

export const CALC_ROOF_TILES_APP_MANIFEST = {
  slug: "calc-roof-tiles",
  name: "Roof Tiles & Slate Calculator",
  category: "calculator" as const,
  version: "1.0.0",
  description:
    "Estimate tiles or slates, membrane, battens + ridge/hip cap for 3 UK job scopes: retile with new membrane · reslate with new membrane · full strip and re-roof (new battens + membrane + tile or slate). Pitch factor 1.04-1.41.",
  icon: Home,

  tradeAllowlist: [
    "roofer",
    "slater",
    "tiler-roofer",
    "general-builder"
  ] as const,

  autoInstallOnService: [
    "roofing",
    "roof-installation",
    "retile",
    "reslate",
    "re-roof",
    "tile-roof",
    "slate-roof",
    "roof-membrane",
    "roof-underlay",
    "roof-battens",
    "ridge-tile",
    "hip-tile"
  ] as const,

  supportedSizes: ["landscape", "square", "portrait"] as const,
  compact: true,
  requiresProductFeed: false
} as const;

export type CalcRoofTilesAppSize =
  (typeof CALC_ROOF_TILES_APP_MANIFEST)["supportedSizes"][number];
