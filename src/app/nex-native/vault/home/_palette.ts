// src/app/nex-native/vault/home/_palette.ts
//
// Shared Vault interior palette · founder-sealed §10.0.2 (one-interior rule).
// Every Vault interior surface imports from here · the single source of
// truth for interior tokens. Doorway personality still lives per-theme
// at the doorway (§10.0.1); interior stays uniformly dark + glass.
//
// Design update 2026-10-07 · founder master-pass direction: Vault
// must look like NEX. The underlying visual language now matches
// `NEX_SETTINGS` (src/app/nex-native/settings/_settings-shell.tsx)
// and `NexPageHeader` (navy base + cyan primary + orange identity).
// Vault keeps its own identity through:
//   · the lock iconography (sealed per-surface)
//   · orange accent (brand continuity with the main NEX "X")
//   · subtle cyan protection glow on secure surfaces
//   · the glass-panel aesthetic
// but the colour SYSTEM is now the same navy/cyan/orange trio the
// rest of NEX uses. The result reads as "I'm inside NEX" not "I'm
// in a different app".
//
// Colour hierarchy
//   · base               · NEX deep navy
//   · panel / glass      · translucent navy over the base
//   · primary brand/CTA  · NEX orange (#FF7200) · continuity with "X"
//   · secure accent      · NEX cyan   (#00AFFF) · lock/protection
//   · text               · NEX off-white + steel-blue secondary

export const NEX = {
  // ── Base ────────────────────────────────────────────────────
  //
  // Matches NEX_SETTINGS.bg · the deep navy every NEX surface uses.
  // Prior value `#06040A` (warm near-black) was Vault-specific and
  // made the surface read as a different app.
  bg: "#020914",

  // Subtle cyan+orange radial glow painted behind the top of the
  // viewport so the dark base doesn't read flat. Cyan dominates
  // (secure identity) · orange softens the top (NEX brand).
  bgGradient:
    "radial-gradient(70% 50% at 50% -10%, rgba(0, 175, 255, 0.07), transparent 70%), radial-gradient(60% 50% at 50% 110%, rgba(255, 114, 0, 0.05), transparent 70%)",

  // ── Panels / glass ──────────────────────────────────────────
  //
  // Translucent navy panels. Combine with `backdropBlur` and
  // `glassBorder` on each surface. For form controls where blur
  // interferes with native rendering, use `panelSolid` instead.
  // Base hue sampled from NEX_SETTINGS.panel (#03101D).
  panel: "rgba(3, 16, 29, 0.70)",
  panelHigh: "rgba(5, 22, 38, 0.84)",
  panelSolid: "#03101D",
  panelSolidHigh: "#05162A",

  // ── Text hierarchy ──────────────────────────────────────────
  //
  // Mirrors NEX_SETTINGS text tokens for cross-surface consistency.
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  textMuted: "#526B89",

  // ── Primary accent · NEX orange (brand continuity) ──────────
  //
  // Vault keeps the NEX "X" orange as its primary CTA / brand chip
  // colour · same hue as the main NEX wordmark + the settings page
  // CTA. This is what the Vault chip, prominent CTAs, and the
  // Vault-specific brand chip use.
  accent: "#FF7200",
  accentSoft: "rgba(255, 114, 0, 0.14)",
  accentStrong: "rgba(255, 114, 0, 0.34)",

  // ── Secure accent · NEX cyan (lock / protection) ────────────
  //
  // The protection / lock / encrypted-content indicator. Mirrors
  // NexPageHeader + NEX_SETTINGS.cyan. Used for the Vault lock
  // badge, encrypted-attachment chip rims, secure-state glow, and
  // the "Locking Vault" overlay ring.
  secure: "#00AFFF",
  secureSoft: "rgba(0, 175, 255, 0.12)",
  secureStrong: "rgba(0, 175, 255, 0.35)",

  // ── Dividers / borders ──────────────────────────────────────
  divider: "rgba(125, 155, 192, 0.14)",
  glassBorder: "rgba(125, 155, 192, 0.14)",
  glassBorderStrong: "rgba(125, 155, 192, 0.26)",

  // ── Shadows ─────────────────────────────────────────────────
  //
  // Tuned for navy translucent panels: a soft deep drop plus an
  // inset top-edge highlight that reads as a glass bevel.
  cardShadow:
    "0 1px 2px rgba(0,0,0,0.5), 0 14px 36px rgba(0,0,0,0.42), inset 0 1px 0 rgba(242,245,248,0.06)",
  chipShadow:
    "0 1px 1px rgba(0,0,0,0.35), 0 6px 18px rgba(0,0,0,0.32), inset 0 1px 0 rgba(242,245,248,0.06)",
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

/** Secure-state chip · for lock badges, protected-content pills, and
 *  anywhere the UI needs to signal "this is encrypted / Vault-only".
 *  Uses the cyan secure accent, NOT the brand orange. */
export const SECURE_CHIP: React.CSSProperties = {
  background: NEX.secureSoft,
  color: NEX.secure,
  border: `1px solid ${NEX.secureStrong}`,
};
