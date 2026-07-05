// calc-bricks — App-store manifest.
//
// Wraps src/lib/calculators/bricks.ts (3 UK scenarios). Covers
// bricks · concrete blocks · aircrete blocks · garden walls · cavity
// walls · boundary walls with piers.
//
// EXCLUDED: plasterer (standing rule) · painter · decorator · carpenter
// (timber only) · tiler · electrician · plumber.

import { Boxes } from "lucide-react";

export const CALC_BRICKS_APP_MANIFEST = {
  slug: "calc-bricks",
  name: "Bricks & Blocks Calculator",
  category: "calculator" as const,
  version: "1.0.0",
  description:
    "Estimate brick / block count, packs, and mortar volume for 3 UK scenarios: garden wall (single skin) · cavity wall (double skin) · boundary wall with piers. Standard UK 60 bricks/m² · 10 blocks/m² conventions.",
  icon: Boxes,

  tradeAllowlist: [
    "bricklayer",
    "stonemason",
    "general-builder",
    "groundworker"
  ] as const,

  autoInstallOnService: [
    "brickwork",
    "bricklaying",
    "garden-wall",
    "boundary-wall",
    "cavity-wall",
    "retaining-wall",
    "wall-piers",
    "blockwork",
    "aircrete",
    "cavity-blocks",
    "brick-repair",
    "repointing"
  ] as const,

  supportedSizes: ["landscape", "square", "portrait"] as const,
  compact: true,
  requiresProductFeed: false
} as const;

export type CalcBricksAppSize =
  (typeof CALC_BRICKS_APP_MANIFEST)["supportedSizes"][number];
