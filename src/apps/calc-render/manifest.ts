// calc-render — App-store manifest.
//
// Standalone render calc — quicker + more focused than the full
// calc-plastering app. Plasterer IS the primary trade here (render
// is their patch), so no wood-exclusion issues.

import { Brush } from "lucide-react";

export const CALC_RENDER_APP_MANIFEST = {
  slug: "calc-render",
  name: "Render Calculator",
  category: "calculator" as const,
  version: "1.0.0",
  description:
    "Quick estimate for sand:cement or K Rend / silicone render on external walls + chimney stacks. Scaffold + lead flashing prompted separately for chimney work. 25 kg bag default, +10% waste.",
  icon: Brush,

  tradeAllowlist: [
    "plasterer",
    "rendering-specialist",
    "general-builder"
  ] as const,

  autoInstallOnService: [
    "render",
    "rendering",
    "external-render",
    "sand-cement-render",
    "silicone-render",
    "k-rend",
    "monocouche",
    "chimney-render",
    "chimney-repair"
  ] as const,

  supportedSizes: ["landscape", "square", "portrait"] as const,
  compact: true,
  requiresProductFeed: false
} as const;

export type CalcRenderAppSize =
  (typeof CALC_RENDER_APP_MANIFEST)["supportedSizes"][number];
