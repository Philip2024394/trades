// src/components/nex-native/emergency/_palette.ts
//
// NEX Emergency Help · colour tokens · sealed 2026-10-10.
// -------------------------------------------------------
// Emergency surfaces inherit the solid NEX palette (navy bg, cyan
// info, orange brand) and add a single new semantic token:
//   emergency = #DC2626  ·  red reserved for emergency CTAs,
//                           active-incident chrome and the SIMULATED
//                           badge accent.
//
// Load-bearing anti-patterns:
//   · Never recolour Vault / Socials / Settings chrome from this
//     palette. Red is reserved for Emergency Help.
//   · Never use orange for an emergency CTA · orange is brand only.
//   · Never introduce new generic hex. Derive from this file or the
//     sealed NEX_SETTINGS palette in `_settings-shell.tsx`.

export const EMERGENCY_PALETTE = {
  bg: "#020914",
  surface: "#0E1526",
  surfaceHi: "#182540",
  surfaceMuted: "#03101D",
  textPrimary: "#F2F5F8",
  textSecondary: "#B5C3D6",
  textDim: "#7D9BC0",
  emergency: "#DC2626",
  emergencyMuted: "rgba(220, 38, 38, 0.18)",
  emergencyBorder: "rgba(220, 38, 38, 0.55)",
  cyan: "#00AFFF",
  cyanMuted: "rgba(0, 175, 255, 0.14)",
  orange: "#FF7200",
  amber: "#F59E0B",
  divider: "rgba(125, 155, 192, 0.14)",
  success: "#22C55E",
} as const;

export type EmergencyPaletteToken = keyof typeof EMERGENCY_PALETTE;
