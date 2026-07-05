// calc-gravel — App-store manifest.
//
// Wraps src/lib/calculators/gravel.ts (5 UK scenarios) covering
// gravel · pebbles · cobbles · sharp sand · building sand · ballast
// across driveways · paths · borders · French drains · custom areas.
//
// EXCLUDED: plasterer (standing rule) · painter · decorator · carpenter
// · tiler · electrician · plumber.

import { Package } from "lucide-react";

export const CALC_GRAVEL_APP_MANIFEST = {
  slug: "calc-gravel",
  name: "Gravel & Aggregate Calculator",
  category: "calculator" as const,
  version: "1.0.0",
  description:
    "Estimate m³, tonnes, small bags, and bulk bags across 5 UK aggregate scenarios: driveway / garden path / decorative border / French drain / L-shaped area. 6 stone types with UK density per material.",
  icon: Package,

  tradeAllowlist: [
    "landscape-gardener",
    "groundworker",
    "aggregate-supplier",
    "driveway-specialist",
    "general-builder"
  ] as const,

  autoInstallOnService: [
    "gravel",
    "aggregate",
    "aggregates",
    "gravel-driveway",
    "loose-stone",
    "shingle-driveway",
    "garden-path",
    "decorative-border",
    "pebble-border",
    "cobbles",
    "french-drain",
    "drainage",
    "sharp-sand",
    "building-sand",
    "ballast",
    "sand-and-gravel",
    "loose-fill",
    "topsoil-supply"
  ] as const,

  supportedSizes: ["landscape", "square", "portrait"] as const,
  compact: true,
  requiresProductFeed: false
} as const;

export type CalcGravelAppSize =
  (typeof CALC_GRAVEL_APP_MANIFEST)["supportedSizes"][number];
