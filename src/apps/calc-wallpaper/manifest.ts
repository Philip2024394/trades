// calc-wallpaper — App-store manifest.
//
// Wraps src/lib/calculators/wallpaper.ts. Decorator's app —
// plasterer excluded (paint/paper is decorator patch not plaster).

import { Wallpaper } from "lucide-react";

export const CALC_WALLPAPER_APP_MANIFEST = {
  slug: "calc-wallpaper",
  name: "Wallpaper Calculator",
  category: "calculator" as const,
  version: "1.0.0",
  description:
    "Estimate wallpaper rolls + paste packets for 3 UK scenarios: feature wall · whole room (deducts doors + windows) · stairwell (trapezoidal averaging). Standard 10.05 × 0.52 m roll — 4.5 m² usable for plain / small pattern, 3.5 m² for large repeat.",
  icon: Wallpaper,

  tradeAllowlist: [
    "decorator",
    "painter-decorator",
    "wallpaper-installer",
    "general-builder"
  ] as const,

  autoInstallOnService: [
    "wallpaper",
    "wallpaper-installation",
    "wallpaper-hanging",
    "feature-wall",
    "decorating",
    "interior-design",
    "wall-mural"
  ] as const,

  supportedSizes: ["landscape", "square", "portrait"] as const,
  compact: true,
  requiresProductFeed: false
} as const;

export type CalcWallpaperAppSize =
  (typeof CALC_WALLPAPER_APP_MANIFEST)["supportedSizes"][number];
