// src/app/nex-native/chat-standard/_engine/control-resolver.ts
//
// Theme Engine · Controls Treatment resolver · sealed 2026-10-06.
// --------------------------------------------------------------
// Resolves the universal chat controls (header R1 buttons · composer
// container · + button · send button) into a theme-aware React style
// bundle that the Standard Experience shell AND the three universal
// overlays (header icons · chrome · composer footer) consume
// identically.
//
// Pure module · no "use client" · no React runtime dependency · just
// `React.CSSProperties` types from the type-only React import. That
// means this file is importable from Server Components, Client
// Components, and the universal overlays alike without crossing the
// boundary.
//
// Universal Theme Controls Rule (sealed 2026-10-06):
//
//   1 · Every control surface is SOLID · never semi-transparent to
//       the point of disappearing against a wallpaper.
//   2 · Header buttons + composer container derive their chrome from
//       the active ThemePackage's resolved `deep` (anchor dark) and
//       `primary` (accent border) so the controls feel like part of
//       the world.
//   3 · The + button is a UNIVERSAL NEX semantic indicator (same
//       philosophy as the NEW badge): background stays near-black on
//       every world so "add to this chat" is instantly recognisable.
//       Only its border/glow is theme-tinted for integration.
//   4 · The send button is a solid filled action button in the
//       theme's primary colour. The sealed 2026-10-05 "SEND_GREEN
//       everywhere" rule is superseded by this · the universal
//       recognisability now comes from (a) its fixed outside-right
//       position, (b) its solid filled treatment, and (c) its glyph.
//   5 · Icons automatically pick a contrasting colour on their own
//       background via `iconColorOn()`. A future World with a very
//       light primary gets dark icons; a dark primary gets light
//       icons. No per-world overrides.
//   6 · The sealed 2026-10-05 "composer pill is transparent" R3
//       revision 2 doctrine is EXPLICITLY SUPERSEDED by this rule:
//       the composer container is now solid themed. The outlined
//       pill was pretty but disappeared against some wallpapers.
//
// Load-bearing anti-patterns (regression tests enforce):
//
//   · Never render a universal control with `background: "transparent"`
//     or `background: "${colour}22"` (13% alpha) · both patterns
//     caused the original visibility regression.
//   · Never hardcode SEND_GREEN or any other fixed send colour · the
//     send button is theme-primary.
//   · Never per-theme-id branch inside the resolver · the single
//     resolver works for every world.

import type React from "react";

/** The subset of a resolved ColourSystem the controls resolver
 *  consumes. Mirrors `Required<ColourSystem>` from theme-package
 *  without importing the full engine type (keeps this module usable
 *  by the universal overlays which may not have a ThemePackage). */
export interface ControlsPalette {
  primary: string;
  secondary: string;
  highlight: string;
  deep: string;
}

/** The resolved control style bundle. Each field is a React style
 *  object ready to spread into a `<button>`'s `style` prop (except
 *  `sendButton` which takes a `disabled` flag so the shell can pick
 *  the right variant). */
export interface ControlsTreatment {
  /** Header R1 button at rest · solid deep bg · theme-accent border */
  headerButton: React.CSSProperties;
  /** Header R1 button when toggled on (e.g. Shop open) · solid
   *  primary bg · auto-contrast icon colour baked into `.color` */
  headerButtonActive: React.CSSProperties;
  /** Universal NEX + button at rest · universal near-black bg ·
   *  theme-tinted border for integration */
  plusButton: React.CSSProperties;
  /** Universal NEX + button when menu is open · still near-black bg,
   *  but theme primary border saturates */
  plusButtonActive: React.CSSProperties;
  /** Send button · solid filled theme primary · auto-contrast icon.
   *  Call with `disabled = true` for the dim variant. */
  sendButton: (disabled: boolean) => React.CSSProperties;
  /** Composer container (pill) · solid themed bg + theme-accent
   *  border · replaces the sealed-away `background: "transparent"` */
  composerContainer: React.CSSProperties;
  /** Palette echoed back for callers that need to style sibling
   *  elements (e.g. divider inside the composer) with the same
   *  resolved colours. */
  colors: ControlsPalette;
}

/** Universal NEX "add" semantic surface · same philosophy as the
 *  universal gold NEW badge · stays near-black regardless of the
 *  active ThemePackage so "add to this chat" is instantly
 *  recognisable on every world. */
export const PLUS_BUTTON_INK = "#0F0F10";

/** Relative luminance of a hex colour on a 0-1 scale.
 *  Simplified ITU-R BT.601 weighting · ok for contrast picks ·
 *  returns 0.5 (neutral) for unparseable input so callers never
 *  crash on malformed data. */
export function luminance(hex: string): number {
  const clean = hex.replace(/^#/, "");
  if (clean.length !== 3 && clean.length !== 6) return 0.5;
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Pick a contrasting foreground colour for a background.
 *  Returns `onDark` when the background is dark enough to need a
 *  light foreground, `onLight` otherwise. */
export function iconColorOn(
  bg: string,
  onDark: string,
  onLight: string,
): string {
  return luminance(bg) < 0.5 ? onDark : onLight;
}

/** Resolve every universal chat control into a theme-aware style
 *  bundle. Pure function · the SAME palette produces the SAME
 *  treatment · callable from server + client + overlays. */
export function resolveControlsTreatment(
  palette: ControlsPalette,
): ControlsTreatment {
  const { primary, highlight, deep, secondary } = palette;

  // Header R1 button · solid dark anchor + theme-accent border +
  // highlight icon · stays visible on every wallpaper.
  const headerButton: React.CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: 999,
    border: `1px solid ${primary}`,
    background: deep,
    color: highlight,
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    flexShrink: 0,
    padding: 0,
    textDecoration: "none",
    transition: "background 160ms ease-out, border-color 160ms ease-out",
  };

  // Header R1 button active · solid primary bg · auto-contrast icon.
  const headerButtonActive: React.CSSProperties = {
    ...headerButton,
    background: primary,
    color: iconColorOn(primary, highlight, deep),
  };

  // Universal + button · UNIVERSAL dark anchor regardless of world ·
  // theme accent border for integration · highlight icon (icons sit
  // on a universal dark surface so a universal light icon is always
  // safe).
  const plusButton: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: 999,
    border: `1px solid ${primary}`,
    background: PLUS_BUTTON_INK,
    color: highlight,
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    flexShrink: 0,
    padding: 0,
    transition: "background 160ms ease-out, border 160ms ease-out",
  };

  // Plus active · same universal dark, brighter theme ring +
  // subtle glow so the "menu open" state reads clearly.
  const plusButtonActive: React.CSSProperties = {
    ...plusButton,
    border: `2px solid ${primary}`,
    boxShadow: `0 0 0 2px ${primary}55`,
  };

  // Send button · solid theme primary · auto-contrast icon · subtle
  // outer glow in theme colour so the primary action still has
  // visual weight on busy wallpapers.
  const sendButton = (disabled: boolean): React.CSSProperties => ({
    width: 40,
    height: 40,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    cursor: disabled ? "default" : "pointer",
    flexShrink: 0,
    padding: 0,
    background: primary,
    border: `1px solid ${primary}`,
    color: iconColorOn(primary, highlight, deep),
    fontSize: 16,
    fontWeight: 800,
    opacity: disabled ? 0.5 : 1,
    boxShadow: disabled
      ? "none"
      : `0 4px 12px ${primary}55, inset 0 1px 1px ${highlight}55`,
    transition:
      "background 160ms ease-out, opacity 160ms ease-out, box-shadow 160ms ease-out",
  });

  // Composer container · solid deep bg + theme accent border ·
  // replaces the sealed-away transparent pill treatment.
  const composerContainer: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "0 10px",
    height: 44,
    borderRadius: 999,
    background: deep,
    border: `1px solid ${primary}`,
    boxShadow: `0 2px 10px ${deep}99`,
  };

  return {
    headerButton,
    headerButtonActive,
    plusButton,
    plusButtonActive,
    sendButton,
    composerContainer,
    colors: { primary, secondary, highlight, deep },
  };
}
