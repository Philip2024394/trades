// calc-skirting — App-store manifest.
//
// Trim Carpenter Calculator — the carpenter's rate card + customer
// quote form in one app. 7 services (skirting, door frames single +
// double, architrave single + double, window boards, loft ladder).
// Services hide from the customer view when their rate is 0.

import { Hammer } from "lucide-react";

export const CALC_SKIRTING_APP_MANIFEST = {
  slug: "calc-skirting",
  name: "Trim Carpenter Calculator",
  category: "calculator" as const,
  version: "1.0.0",
  description:
    "The carpenter's rate card + customer quote form in one app. 7 UK services: skirting installation · door frames (single / double) · architrave (single / double) · window boards · loft ladder installation. Services hide when their rate is set to 0.",
  icon: Hammer,

  tradeAllowlist: [
    "carpenter",
    "joiner",
    "trim-carpenter",
    "general-builder"
  ] as const,

  autoInstallOnService: [
    "skirting",
    "skirting-boards",
    "architrave",
    "door-hanging",
    "door-frame",
    "door-lining",
    "window-boards",
    "internal-sills",
    "loft-ladder",
    "loft-ladder-installation",
    "trim-carpentry",
    "second-fix-carpentry"
  ] as const,

  supportedSizes: ["landscape", "square", "portrait"] as const,
  compact: true,
  requiresProductFeed: false
} as const;

export type CalcSkirtingAppSize =
  (typeof CALC_SKIRTING_APP_MANIFEST)["supportedSizes"][number];
