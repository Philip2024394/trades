// src/lib/nex/hq-theme.ts
//
// Shared NEX DNA theme constants for the workstation + new HQ surfaces.
// Mirrors docs/nex-design-tokens.json (v1.0.0). Used as string literals in
// Tailwind arbitrary values and inline styles so the sanctioned palette
// never drifts.

export const NEX_DNA = {
  navy:        "#0B1220",  // deep navy base
  navySoft:    "#0E1B33",  // gradient midpoint
  navyMid:     "#111827",  // card surface
  cyan:        "#22D3EE",  // electric cyan · tech/info
  orange:      "#F97316",  // NEX orange · actions
  orangeDeep:  "#EA580C",  // orange pressed
  softWhite:   "#F9FAFB",  // text on dark
  slate:       "#94A3B8",  // secondary text · borders
  success:     "#22C55E",  // verified · live
  warning:     "#F59E0B",  // pending · awaiting
  danger:      "#EF4444",  // rejected · reverted
  gold:        "#EAB308",  // founder-signature rows
} as const;

export const NEX_SURFACE = {
  cardBg:      "rgba(14, 27, 51, 0.6)",
  cardBorder:  "rgba(148, 163, 184, 0.18)",
  cardHover:   "rgba(14, 27, 51, 0.8)",
  inputBg:     "rgba(255, 255, 255, 0.03)",
  inputBorder: "rgba(148, 163, 184, 0.24)",
  focusRing:   NEX_DNA.cyan,
} as const;

/** Class helper: deep-navy scoped root · applies to any HQ workstation page. */
export const NEX_WORKSTATION_ROOT_CLASS = "nex-workstation-root";
