// calc-mortar — App-store manifest.
//
// Wraps src/lib/calculators/mortar.ts (3 UK scenarios · 3 mix ratios).
// Companion to calc-bricks — the bricks calc points at this one for
// the cement + sand breakdown.
//
// EXCLUDED: plasterer (works with plaster / render / board, not
// brickwork mortar) · painter · decorator · carpenter · tiler.

import { Container } from "lucide-react";

export const CALC_MORTAR_APP_MANIFEST = {
  slug: "calc-mortar",
  name: "Mortar Calculator",
  category: "calculator" as const,
  version: "1.0.0",
  description:
    "Estimate mortar volume, pre-mix bag count, and cement + sand breakdown for 3 UK scenarios: new brickwork · new blockwork · repointing. Three UK mix ratios (1:4 general · 1:1:6 lime · 1:3 structural).",
  icon: Container,

  tradeAllowlist: [
    "bricklayer",
    "stonemason",
    "general-builder",
    "groundworker"
  ] as const,

  autoInstallOnService: [
    "brickwork",
    "bricklaying",
    "blockwork",
    "repointing",
    "pointing-repair",
    "mortar-repair",
    "brick-repair",
    "cavity-wall",
    "garden-wall",
    "boundary-wall"
  ] as const,

  supportedSizes: ["landscape", "square", "portrait"] as const,
  compact: true,
  requiresProductFeed: false
} as const;

export type CalcMortarAppSize =
  (typeof CALC_MORTAR_APP_MANIFEST)["supportedSizes"][number];
