// src/app/nex-native/vault/home/_palette.ts
//
// Shared Vault interior palette · founder-sealed §10.0.2 (one-interior rule).
// Every Vault interior surface imports from here · the single source of
// truth for interior tokens. Doorway personality still lives per-theme
// at the doorway (§10.0.1); interior stays uniformly dark + glass.
//
// Design update 2026-10-03 · founder direction: deeper dark base,
// glassmorphism panels and buttons, modern iconography. The glass
// tokens are translucent colors meant to be combined with the
// `backdropBlur` property on surfaces that want the frosted effect.

export const NEX = {
  // Deeper near-black base so the orange accent and the glass highlights
  // feel properly recessed. (Prior value #0A0608.)
  bg: "#06040A",
  // Subtle warm radial glow painted behind the top of the viewport so the
  // dark base doesn't read flat. Applied on home + room backgrounds via
  // an aria-hidden layer so interactive surfaces still render over it.
  bgGradient:
    "radial-gradient(90% 50% at 50% -10%, rgba(255, 138, 42, 0.08), transparent 72%)",

  // Translucent panels for glassmorphism. Combine with `backdropBlur`
  // and `glassBorder` on each surface. For form controls where blur
  // interferes with native rendering, use `panelSolid` instead.
  panel: "rgba(22, 16, 12, 0.62)",
  panelHigh: "rgba(30, 22, 18, 0.78)",
  panelSolid: "#16100C",
  panelSolidHigh: "#1E1612",

  textPrimary: "#F7EFE4",
  textSecondary: "#C9B99E",
  textMuted: "#8A7E6E",
  accent: "#FF8A2A",
  accentSoft: "rgba(255, 138, 42, 0.14)",
  accentStrong: "rgba(255, 138, 42, 0.26)",

  divider: "rgba(247, 239, 228, 0.10)",
  glassBorder: "rgba(247, 239, 228, 0.08)",
  glassBorderStrong: "rgba(247, 239, 228, 0.16)",

  // Shadows tuned for the translucent panels: a soft deep drop plus an
  // inset top-edge highlight that reads as a glass bevel.
  cardShadow:
    "0 1px 2px rgba(0,0,0,0.5), 0 14px 36px rgba(0,0,0,0.42), inset 0 1px 0 rgba(247,239,228,0.06)",
  chipShadow:
    "0 1px 1px rgba(0,0,0,0.35), 0 6px 18px rgba(0,0,0,0.32), inset 0 1px 0 rgba(247,239,228,0.06)",
  pressedShadow:
    "0 1px 1px rgba(0,0,0,0.35), inset 0 1px 2px rgba(0,0,0,0.6)",

  // Backdrop-filter value for glass surfaces. Browsers that don't
  // support it fall back cleanly to the translucent panel color.
  backdropBlur: "blur(14px) saturate(140%)",

  sans:
    "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
} as const;

/** Convenience · spread into any surface that should render as glass. */
export const GLASS: React.CSSProperties = {
  background: NEX.panel,
  backdropFilter: NEX.backdropBlur,
  WebkitBackdropFilter: NEX.backdropBlur,
  border: `1px solid ${NEX.glassBorder}`,
  boxShadow: NEX.cardShadow,
};

/** Lighter glass variant for inline chips / smaller rows. */
export const GLASS_CHIP: React.CSSProperties = {
  background: NEX.panel,
  backdropFilter: NEX.backdropBlur,
  WebkitBackdropFilter: NEX.backdropBlur,
  border: `1px solid ${NEX.glassBorder}`,
  boxShadow: NEX.chipShadow,
};
