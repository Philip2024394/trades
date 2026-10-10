// src/components/nex-native/account-gate/_palette.ts
//
// NEX Settings Header · Account-Gate palette · sealed 2026-10-10.
// ---------------------------------------------------------------
// The gate uses a muted amber-to-orange gradient on the 3D lock icon.
// Amber (not red) is deliberate · the gate signals "create an account
// to unlock", not "forbidden/alarming" (red is reserved for Emergency).
//
// Load-bearing anti-patterns:
//   · Never recolour to red · red is Emergency (`EMERGENCY_PALETTE`).
//   · Never swap for cyan · cyan is the UNLOCKED / normal-nav colour
//     in the shared page header; the lock must visually contrast.
//   · Never introduce new generic hex outside this file.

export const ACCOUNT_GATE_PALETTE = {
  // Modal / overlay chrome · aligned with the NEX dark navy.
  overlay: "rgba(2, 9, 20, 0.72)",
  panel: "#03101D",
  panelBorder: "rgba(0, 175, 255, 0.35)",
  textPrimary: "#F2F5F8",
  textSecondary: "#B5C3D6",
  textDim: "#7D9BC0",

  // Primary CTA · reuse the sealed NEX brand orange.
  ctaBg: "#FF7200",
  ctaBgHover: "#FF8A2A",
  ctaText: "#1A0D00",

  // Secondary (dismiss) CTA · ghost against the panel.
  dismissText: "#B5C3D6",
  dismissBorder: "rgba(181, 195, 214, 0.30)",

  // Lock icon · the 3D gradient tokens.
  lockAmberTop: "#FFC46B",
  lockAmberMid: "#FF8A2A",
  lockAmberBot: "#C85A00",
  lockShackle: "#8A4A00",
  lockShackleHi: "#F5C06B",
  lockHighlight: "rgba(255, 232, 180, 0.75)",
  lockShadow: "rgba(0, 0, 0, 0.55)",
  lockKeyhole: "#1A0D00",
} as const;

export type AccountGatePaletteToken = keyof typeof ACCOUNT_GATE_PALETTE;
