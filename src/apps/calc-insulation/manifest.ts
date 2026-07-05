// calc-insulation — App-store manifest.
//
// Wraps src/lib/calculators/insulation.ts (4 UK Part L 2025 scenarios:
// loft, wall cavity, solid floor, pitched roof). Insulation is a
// specialist trade — carpenter is included because between-rafter /
// between-joist installs sit in their patch. Plasterer NOT included
// (they get an insulation add-on inside calc-plastering for timber
// studwork rooms only).

import { Snowflake } from "lucide-react";

export const CALC_INSULATION_APP_MANIFEST = {
  slug: "calc-insulation",
  name: "Insulation Calculator",
  category: "calculator" as const,
  version: "1.0.0",
  description:
    "Estimate insulation for 4 UK Part L 2025 scenarios: loft rolls · cavity wall boards · solid floor PIR · pitched roof. Cross-lay guidance for lofts, cavity-width awareness for wall boards, DPM prompt for floors.",
  icon: Snowflake,

  tradeAllowlist: [
    "insulation-installer",
    "energy-efficiency-installer",
    "general-builder",
    "roofer",
    "carpenter"
  ] as const,

  autoInstallOnService: [
    "loft-insulation",
    "cavity-wall-insulation",
    "floor-insulation",
    "roof-insulation",
    "thermal-upgrade",
    "part-l-upgrade",
    "energy-efficiency",
    "eco4",
    "loft-top-up"
  ] as const,

  supportedSizes: ["landscape", "square", "portrait"] as const,
  compact: true,
  requiresProductFeed: false
} as const;

export type CalcInsulationAppSize =
  (typeof CALC_INSULATION_APP_MANIFEST)["supportedSizes"][number];
