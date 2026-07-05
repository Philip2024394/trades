// calc-paving — App-store manifest.
//
// Wraps src/lib/calculators/paving.ts. Paver / landscaper trade.

import { Grid3x3 } from "lucide-react";

export const CALC_PAVING_APP_MANIFEST = {
  slug: "calc-paving",
  name: "Paving Calculator",
  category: "calculator" as const,
  version: "1.0.0",
  description:
    "Estimate slabs, MOT Type 1 sub-base, sharp sand + jointing for 3 UK layouts: patio · driveway · garden path. Sub-base depth auto-adjusts (100 mm patio / 150 mm driveway / 75 mm path).",
  icon: Grid3x3,

  tradeAllowlist: [
    "paver",
    "landscape-gardener",
    "garden-builder",
    "driveway-installer",
    "general-builder"
  ] as const,

  autoInstallOnService: [
    "paving",
    "patio-installation",
    "driveway-paving",
    "block-paving",
    "flagstone-paving",
    "porcelain-paving",
    "garden-path",
    "path-laying",
    "resin-driveway"
  ] as const,

  supportedSizes: ["landscape", "square", "portrait"] as const,
  compact: true,
  requiresProductFeed: false
} as const;

export type CalcPavingAppSize =
  (typeof CALC_PAVING_APP_MANIFEST)["supportedSizes"][number];
