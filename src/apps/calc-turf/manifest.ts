// calc-turf — App-store manifest.
//
// Wraps src/lib/calculators/turf.ts. Landscaper's / gardener's app.

import { Sprout } from "lucide-react";

export const CALC_TURF_APP_MANIFEST = {
  slug: "calc-turf",
  name: "Turf & Topsoil Calculator",
  category: "calculator" as const,
  version: "1.0.0",
  description:
    "Estimate turf rolls + topsoil + levelling sand for 2 UK scenarios: simple lawn (existing prep) · full prep + turf (rotovate, topsoil, level, lay). Standard 1 m × 410 mm rolls (0.41 m² each), 50 mm topsoil depth default, 24 h laying window warning.",
  icon: Sprout,

  tradeAllowlist: [
    "landscape-gardener",
    "gardener",
    "garden-builder",
    "turf-installer",
    "general-builder"
  ] as const,

  autoInstallOnService: [
    "turf",
    "turfing",
    "lawn-installation",
    "new-lawn",
    "topsoil-delivery",
    "garden-levelling",
    "rotovation",
    "lawn-repair"
  ] as const,

  supportedSizes: ["landscape", "square", "portrait"] as const,
  compact: true,
  requiresProductFeed: false
} as const;

export type CalcTurfAppSize =
  (typeof CALC_TURF_APP_MANIFEST)["supportedSizes"][number];
