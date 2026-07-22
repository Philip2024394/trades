// Tailwind exporter — DesignTokens → tailwind.config theme extension.
// Per V3 Q15 platform exports.

import type { DesignTokens } from "../core";

export type TailwindThemeExtension = {
  colors:      Record<string, string>;
  fontFamily:  Record<string, string[]>;
  spacing:     Record<string, string>;
  borderRadius: Record<string, string>;
  boxShadow:   Record<string, string>;
};

export function exportTailwind(tokens: DesignTokens): TailwindThemeExtension {
  return {
    colors: {
      "brand-primary":    tokens.core.primary,
      "brand-secondary":  tokens.core.secondary,
      "brand-accent":     tokens.core.accent,
      "brand-background": tokens.core.background,
      "brand-surface":    tokens.core.surface,
      "brand-text":       tokens.core.text,
      "brand-text-muted": tokens.core.textMuted,
      "brand-success":    tokens.core.success,
      "brand-warning":    tokens.core.warning,
      "brand-danger":     tokens.core.danger,
      "brand-info":       tokens.core.info
    },
    fontFamily: {
      "brand-heading": [tokens.typography.headingFont, "sans-serif"],
      "brand-body":    [tokens.typography.bodyFont,    "sans-serif"],
      "brand-display": [tokens.typography.displayFont, "sans-serif"]
    },
    spacing: Object.fromEntries(
      tokens.spacing.map((v, i) => [`brand-${i}`, `${v}px`])
    ),
    borderRadius: Object.fromEntries(
      tokens.radius.map((v, i) => [`brand-${i}`, `${v}px`])
    ),
    boxShadow: Object.fromEntries(
      tokens.elevation.map((e) => [`brand-${e.level}`, e.webShadow])
    )
  };
}
