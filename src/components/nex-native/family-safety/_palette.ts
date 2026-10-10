// src/components/nex-native/family-safety/_palette.ts
//
// NEX Family Safety · colour tokens · authored 2026-10-10.
// --------------------------------------------------------
// Inherits the solid NEX palette (navy bg, cyan info, orange brand)
// and adds a single new semantic token:
//
//   familyGreen = #22C55E  ·  the family-warm "all is well" accent.
//                             Used for active-link chips, successful
//                             confirmations, and the home hero
//                             accent. Never used as a destructive CTA.
//
// The emergency red (#DC2626) is REFERENCED here read-only for the
// "I feel pressured" tertiary CTA, which belongs to FS-2 scope. FS-1
// does NOT style any destructive action with red.
//
// Load-bearing anti-patterns:
//   · Do NOT recolour Vault / Socials / Emergency / Settings chrome
//     from this palette. familyGreen is reserved for Family Safety.
//   · Do NOT introduce new generic hex. Derive from this file (or the
//     sealed NEX_SETTINGS palette) · if a token is missing, add it
//     here first.
//   · Do NOT theme Family Safety per active World. Family Safety is
//     a functional safety surface · solid NEX palette.

export const FAMILY_SAFETY_PALETTE = {
  bg: "#020914",
  surface: "#0E1526",
  surfaceHi: "#182540",
  surfaceMuted: "#03101D",
  textPrimary: "#F2F5F8",
  textSecondary: "#B5C3D6",
  textDim: "#7D9BC0",

  // Brand + info · reused across NEX.
  cyan: "#00AFFF",
  cyanMuted: "rgba(0, 175, 255, 0.14)",
  cyanBorder: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
  orangeMuted: "rgba(255, 114, 0, 0.14)",

  // Family-warm accent · the only new semantic token.
  familyGreen: "#22C55E",
  familyGreenMuted: "rgba(34, 197, 94, 0.14)",
  familyGreenBorder: "rgba(34, 197, 94, 0.45)",

  // Status tones · derived.
  amber: "#F59E0B",
  amberMuted: "rgba(245, 158, 11, 0.14)",
  amberBorder: "rgba(245, 158, 11, 0.45)",

  // Emergency red · read-only reference. FS-1 never applies this.
  emergency: "#DC2626",
  emergencyMuted: "rgba(220, 38, 38, 0.18)",
  emergencyBorder: "rgba(220, 38, 38, 0.55)",

  divider: "rgba(125, 155, 192, 0.14)",
} as const;

export type FamilySafetyPaletteToken = keyof typeof FAMILY_SAFETY_PALETTE;

/** Font family used across every Family Safety route · matches the
 *  product-wide default. */
export const FAMILY_SAFETY_FONT =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
