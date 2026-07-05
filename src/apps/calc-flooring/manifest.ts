// calc-flooring — App-store manifest.
//
// Wraps src/lib/calculators/flooring.ts (5 scenarios) in a 3-size
// embeddable widget. Covers wood / laminate / vinyl / LVT / carpet
// flooring — TILE floors have their own dedicated calc-tiles app
// (Phase 3).
//
// EXCLUDED: plasterer (does not trade in floor coverings) · tiler
// (uses calc-tiles instead).

import { Layers } from "lucide-react";

export const CALC_FLOORING_APP_MANIFEST = {
  slug: "calc-flooring",
  name: "Flooring Calculator",
  category: "calculator" as const,
  version: "1.0.0",
  description:
    "Estimate m², waste %, box count, underlay, beading, and labour cost for 5 real-world flooring scenarios: rectangular / L-shape / stairs / hallway / multi-room.",
  icon: Layers,

  tradeAllowlist: [
    "carpenter",
    "floor-layer",
    "kitchen-fitter",
    "bathroom-fitter",
    "general-builder"
  ] as const,

  autoInstallOnService: [
    "flooring",
    "floor-installation",
    "laminate-flooring",
    "engineered-wood",
    "solid-wood-flooring",
    "vinyl-flooring",
    "lvt",
    "luxury-vinyl-tile",
    "carpet-fitting",
    "stair-carpet",
    "hallway-flooring",
    "kitchen-flooring",
    "bathroom-flooring"
  ] as const,

  supportedSizes: ["landscape", "square", "portrait"] as const,
  compact: true,
  requiresProductFeed: false
} as const;

export type CalcFlooringAppSize =
  (typeof CALC_FLOORING_APP_MANIFEST)["supportedSizes"][number];
