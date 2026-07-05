// calc-decking — App-store manifest.
//
// Wraps src/lib/calculators/decking.ts. Carpenter primary trade.
// Wood app — plasterer explicitly excluded per standing rule.

import { Rows3 } from "lucide-react";

export const CALC_DECKING_APP_MANIFEST = {
  slug: "calc-decking",
  name: "Decking Calculator",
  category: "calculator" as const,
  version: "1.0.0",
  description:
    "Estimate boards, joists, and screws for 3 UK deck layouts: simple rectangle · L-shape · multi-level with steps. 144 mm boards + 5 mm gap default, joists @ 400 mm centres, 10 screws per board.",
  icon: Rows3,

  tradeAllowlist: [
    "carpenter",
    "landscape-gardener",
    "garden-builder",
    "general-builder"
  ] as const,

  autoInstallOnService: [
    "decking",
    "deck-installation",
    "timber-deck",
    "composite-deck",
    "garden-deck",
    "patio-deck",
    "raised-deck",
    "multi-level-deck"
  ] as const,

  supportedSizes: ["landscape", "square", "portrait"] as const,
  compact: true,
  requiresProductFeed: false
} as const;

export type CalcDeckingAppSize =
  (typeof CALC_DECKING_APP_MANIFEST)["supportedSizes"][number];
