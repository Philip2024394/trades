// calc-paint — App-store manifest.
//
// Wraps the pure-function paint calculator (src/lib/calculators/paint.ts)
// as a three-size embeddable widget for merchant sites.
//
// Trade allowlist: painters + decorators + carpenters (for their own
// timber joinery: doors / skirting / architraves) + fencers (for
// treating / painting the fences they install) + general builders +
// metalworkers (for railings/gates they fit).
//
// EXCLUDED: plasterer (does not trade in wood or paint finishing).

import { Paintbrush } from "lucide-react";

export const CALC_PAINT_APP_MANIFEST = {
  slug: "calc-paint",
  name: "Paint Calculator",
  category: "calculator" as const,
  version: "1.0.0",
  description:
    "Estimate paint quantity, tin packs, labour cost, and shopping list for 9 real-world scenarios: full room / single wall / external masonry / doors / windows / timber fence / metal railing / skirting.",
  icon: Paintbrush,

  /** Which trades can install this app. */
  tradeAllowlist: [
    "painter",
    "decorator",
    "carpenter",
    "fencer",
    "general-builder",
    "metalworker"
  ] as const,

  /** Which services in a trade's primary/secondary list unlock this
   *  app automatically. */
  autoInstallOnService: [
    "painting",
    "decorating",
    "wall-painting",
    "external-painting",
    "door-installation",
    "fire-doors",
    "internal-doors",
    "composite-doors",
    "skirting",
    "architraves",
    "fencing",
    "metal-railings",
    "gates"
  ] as const,

  /** Supported embed sizes. */
  supportedSizes: ["landscape", "square", "portrait"] as const,

  /** Compact enough to embed anywhere. */
  compact: true,

  /** Requires a merchant product feed to price against — falls back to
   *  UK trade-price defaults when absent. */
  requiresProductFeed: false
} as const;

export type CalcPaintAppSize = (typeof CALC_PAINT_APP_MANIFEST)["supportedSizes"][number];
