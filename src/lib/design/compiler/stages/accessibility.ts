// Stage 7 — Accessibility constraints.
//
// WCAG-informed rules the compiler injects as preservations regardless
// of surface. Van wraps + business cards + workwear all read at high
// speed and often in low light. This stage enforces contrast, minimum
// legibility ratios, and 3-second-comprehension rules.

import type { Constraint } from "../ir";

export const ACCESSIBILITY_STAGE_VERSION = "1.0.0";

/** Universal accessibility constraints per WCAG 2.2 AA + trades-specific
 *  legibility research (van wrap read at 25m minimum, workwear at 10m). */
export function accessibilityConstraints(surface: string): Constraint[] {
  const base: Constraint[] = [
    { kind: "require", target: "contrast ratio 4.5:1 for phone number and business name", source: "accessibility", reason: "WCAG 2.2 AA text contrast" },
    { kind: "require", target: "minimum tap-target 44px equivalent for any digital surface", source: "accessibility", reason: "WCAG 2.2 AAA target size" },
    { kind: "forbid",  target: "text under 12px equivalent", source: "accessibility", reason: "legibility floor" }
  ];

  if (surface === "vehicle") {
    return base.concat([
      { kind: "require", target: "business name legible at 25 metres from van side", source: "accessibility", reason: "vehicle read distance" },
      { kind: "require", target: "phone number height minimum 120mm on van side", source: "accessibility", reason: "read from moving car" },
      { kind: "forbid",  target: "reflective type below Class RA1", source: "accessibility", reason: "night visibility" }
    ]);
  }

  if (surface === "workwear") {
    return base.concat([
      { kind: "require", target: "back logo legible at 10 metres", source: "accessibility", reason: "site crew identification" },
      { kind: "require", target: "chest embroidery minimum 8mm letter height", source: "accessibility", reason: "embroidery detail floor" }
    ]);
  }

  if (surface === "business-card") {
    return base.concat([
      { kind: "require", target: "core information legible without glasses at reading distance", source: "accessibility", reason: "hand-off use case" }
    ]);
  }

  return base;
}
