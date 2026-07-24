// Stage 8 — Print Rules.
//
// Print-specific preservations that keep artwork production-ready.
// Cast wrap vinyl minimums, bleed, safe area, embroidery stroke width.
// Injected as constraints only when the surface produces physical
// artwork (vehicle wrap, workwear, signage, business card, letterhead).

import type { Constraint } from "../ir";

export const PRINT_RULES_VERSION = "1.0.0";

const PRINT_SURFACES = new Set(["vehicle", "workwear", "signage", "business-card", "invoice", "letterhead", "print"]);

export function printRuleConstraints(surface: string): Constraint[] {
  if (!PRINT_SURFACES.has(surface)) return [];

  const base: Constraint[] = [
    { kind: "require", target: "300 dpi minimum at final size", source: "print-rules", reason: "print resolution floor" },
    { kind: "require", target: "3mm bleed on all edges",       source: "print-rules", reason: "trim safety" },
    { kind: "require", target: "CMYK-safe colour palette",     source: "print-rules", reason: "prevent RGB shift on press" }
  ];

  if (surface === "vehicle") {
    return base.concat([
      { kind: "require", target: "cast vinyl compatible (3M IJ280 or equivalent)", source: "print-rules", reason: "wrap durability" },
      { kind: "require", target: "no critical text within 20mm of any panel seam", source: "print-rules", reason: "install tolerance" }
    ]);
  }

  if (surface === "workwear") {
    return base.concat([
      { kind: "require", target: "embroidery stroke minimum 1.5mm", source: "print-rules", reason: "thread physical minimum" },
      { kind: "forbid",  target: "gradients on embroidery-only garments", source: "print-rules", reason: "cannot embroider gradient" }
    ]);
  }

  if (surface === "signage") {
    return base.concat([
      { kind: "require", target: "safe area 50mm inset on 8x4 boards", source: "print-rules", reason: "frame + fixings" }
    ]);
  }

  return base;
}
