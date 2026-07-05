// calc-plasterboard — App-store manifest.
//
// Wraps src/lib/calculators/plasterboard.ts (3 UK scenarios). This
// is where plasterer IS the primary trade — the standing wood
// exclusion for plasterers doesn't apply here.
//
// EXCLUDED: painter · decorator · carpenter · tiler · electrician ·
// plumber · fencer · bricklayer.

import { LayoutGrid } from "lucide-react";

export const CALC_PLASTERBOARD_APP_MANIFEST = {
  slug: "calc-plasterboard",
  name: "Plasterboard Calculator",
  category: "calculator" as const,
  version: "1.0.0",
  description:
    "Estimate plasterboard sheets, drywall screws, scrim tape, and joint filler for 3 UK scenarios: walls · ceilings · whole room. Standard UK 1200×2400 mm and 1200×1800 mm sheet sizes · moisture-resistant option for bathrooms/kitchens.",
  icon: LayoutGrid,

  tradeAllowlist: [
    "plasterer",
    "drywall-installer",
    "dry-liner",
    "general-builder"
  ] as const,

  autoInstallOnService: [
    "plasterboard",
    "plasterboarding",
    "dry-lining",
    "drywall",
    "stud-wall",
    "partition-wall",
    "ceiling-installation",
    "ceiling-repair",
    "loft-conversion-boarding",
    "moisture-resistant-board",
    "green-board"
  ] as const,

  supportedSizes: ["landscape", "square", "portrait"] as const,
  compact: true,
  requiresProductFeed: false
} as const;

export type CalcPlasterboardAppSize =
  (typeof CALC_PLASTERBOARD_APP_MANIFEST)["supportedSizes"][number];
