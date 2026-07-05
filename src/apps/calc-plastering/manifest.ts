// calc-plastering — App-store manifest.
//
// Wraps src/lib/calculators/plastering.ts. The ultimate UK plastering
// calc: 10 external render finishes, 3 internal finish paths, gable
// triangles via 3-side measurement, 4-bead pricing engine, features
// (arches), insulation add-on, project details + attachments.
//
// NO tape-and-joint finish — that's a drywall-taper trade with its
// own app.

import { PaintBucket } from "lucide-react";

export const CALC_PLASTERING_APP_MANIFEST = {
  slug: "calc-plastering",
  name: "Plastering Calculator",
  category: "calculator" as const,
  version: "1.0.0",
  description:
    "The ultimate UK plastering estimator — external render (10 finishes: sand & cement · nap dash · pebble dash · stone dash · monocouche · silicone · acrylic · lime · roughcast · smooth float) and internal skim (solid + timber studwork). Rect + gable walls, opening subtractions, quoins, arches, insulation, and 4-bead pricing (windows · doors · external corners · internal edges — £/m or free).",
  icon: PaintBucket,

  tradeAllowlist: [
    "plasterer",
    "rendering-specialist",
    "general-builder"
  ] as const,

  autoInstallOnService: [
    "plastering",
    "skim",
    "skimming",
    "rendering",
    "render",
    "external-render",
    "monocouche",
    "silicone-render",
    "lime-render",
    "pebble-dash",
    "roughcast",
    "wet-dash",
    "stone-dash",
    "internal-plastering",
    "bonding-skim",
    "arch-plastering"
  ] as const,

  supportedSizes: ["landscape", "square", "portrait"] as const,
  compact: false,
  requiresProductFeed: false
} as const;

export type CalcPlasteringAppSize =
  (typeof CALC_PLASTERING_APP_MANIFEST)["supportedSizes"][number];
