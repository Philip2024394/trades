// calc-fencing — App-store manifest.
//
// Wraps src/lib/calculators/fencing.ts. Fencer / landscape trade.
// Wood + concrete — plasterer excluded (wood app per standing rule).

import { Fence } from "lucide-react";

export const CALC_FENCING_APP_MANIFEST = {
  slug: "calc-fencing",
  name: "Fencing Calculator",
  category: "calculator" as const,
  version: "1.0.0",
  description:
    "Estimate panels, posts, postcrete + gate hardware for 3 UK fence layouts: straight run · L-corner · gated. 1.83 m panel default, 100×100 mm posts at 600 mm depth, 20 kg postcrete per post.",
  icon: Fence,

  tradeAllowlist: [
    "fencer",
    "landscape-gardener",
    "garden-builder",
    "general-builder",
    "carpenter"
  ] as const,

  autoInstallOnService: [
    "fencing",
    "fence-installation",
    "garden-fence",
    "boundary-fence",
    "closeboard-fence",
    "featheredge-fence",
    "lap-panel-fence",
    "gate-installation",
    "gravel-boards"
  ] as const,

  supportedSizes: ["landscape", "square", "portrait"] as const,
  compact: true,
  requiresProductFeed: false
} as const;

export type CalcFencingAppSize =
  (typeof CALC_FENCING_APP_MANIFEST)["supportedSizes"][number];
