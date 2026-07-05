// Xrated Design System — named palettes + BrandTokens translator.
//
// Palettes are named theme variants merchants can pick from without
// having to edit individual tokens. Every palette shares the same
// spacing / radius / shadow / motion — only colour changes. That
// keeps switching palettes visually consistent across the whole app.
//
// brandTokensToDesignTheme translates the existing Studio brand
// tokens (BrandTokens = Record<string, unknown> keyed "kind.key") into
// a strongly-typed DesignTheme. This is the single bridge between
// the legacy studio_brand_tokens store and the new Design System.

import type { BrandTokens } from "@/lib/studio/sectionTypes";
import { DEFAULT_DESIGN_THEME, type DesignTheme } from "./types";

// ─── Named palettes ────────────────────────────────────────────

export type PaletteId =
  | "yellow-industrial"
  | "forest-green"
  | "royal-blue"
  | "warm-red"
  | "graphite"
  | "sunrise-orange";

export const PALETTES: Record<PaletteId, DesignTheme> = {
  "yellow-industrial": DEFAULT_DESIGN_THEME,

  "forest-green": {
    ...DEFAULT_DESIGN_THEME,
    color: {
      ...DEFAULT_DESIGN_THEME.color,
      primary: "#2E7D32",
      primaryHover: "#1B5E20",
      primaryInk: "#FFFFFF",
      accent: "#66BB6A"
    }
  },

  "royal-blue": {
    ...DEFAULT_DESIGN_THEME,
    color: {
      ...DEFAULT_DESIGN_THEME.color,
      primary: "#1E40AF",
      primaryHover: "#1E3A8A",
      primaryInk: "#FFFFFF",
      accent: "#3B82F6"
    }
  },

  "warm-red": {
    ...DEFAULT_DESIGN_THEME,
    color: {
      ...DEFAULT_DESIGN_THEME.color,
      primary: "#B91C1C",
      primaryHover: "#991B1B",
      primaryInk: "#FFFFFF",
      accent: "#EF4444"
    }
  },

  graphite: {
    ...DEFAULT_DESIGN_THEME,
    color: {
      ...DEFAULT_DESIGN_THEME.color,
      primary: "#262626",
      primaryHover: "#171717",
      primaryInk: "#FFFFFF",
      accent: "#525252"
    }
  },

  "sunrise-orange": {
    ...DEFAULT_DESIGN_THEME,
    color: {
      ...DEFAULT_DESIGN_THEME.color,
      primary: "#EA580C",
      primaryHover: "#C2410C",
      primaryInk: "#FFFFFF",
      accent: "#FB923C"
    }
  }
};

export function getPalette(id: PaletteId): DesignTheme {
  return PALETTES[id];
}

export function listPalettes(): { id: PaletteId; theme: DesignTheme }[] {
  return (Object.keys(PALETTES) as PaletteId[]).map((id) => ({
    id,
    theme: PALETTES[id]
  }));
}

// ─── BrandTokens → DesignTheme translator ─────────────────────

/** Read the flat "kind.key" BrandTokens map (as stored in
 *  studio_brand_tokens) and produce a strongly-typed DesignTheme.
 *  Missing tokens fall through to DEFAULT_DESIGN_THEME so the design
 *  system always renders a complete theme. */
export function brandTokensToDesignTheme(tokens: BrandTokens): DesignTheme {
  const base = DEFAULT_DESIGN_THEME;
  const read = <T>(key: string, fallback: T): T => {
    const value = tokens[key];
    return (value ?? fallback) as T;
  };

  return {
    color: {
      primary: read("color.primary", base.color.primary),
      primaryHover: read("color.primaryHover", base.color.primaryHover),
      primaryInk: read("color.primaryInk", base.color.primaryInk),
      ink: read("color.ink", base.color.ink),
      inkInverse: read("color.inkInverse", base.color.inkInverse),
      muted: read("color.muted", base.color.muted),
      subtle: read("color.subtle", base.color.subtle),
      surface: read("color.surface", base.color.surface),
      surfaceElevated: read(
        "color.surfaceElevated",
        base.color.surfaceElevated
      ),
      accent: read("color.accent", base.color.accent),
      success: read("color.success", base.color.success),
      danger: read("color.danger", base.color.danger),
      warning: read("color.warning", base.color.warning),
      border: read("color.border", base.color.border)
    },
    font: {
      family: read("font.family", base.font.family),
      heading: read("font.heading", base.font.heading),
      body: read("font.body", base.font.body),
      mono: read("font.mono", base.font.mono),
      scale: read("font.scale", base.font.scale),
      weightRegular: base.font.weightRegular,
      weightMedium: base.font.weightMedium,
      weightBold: base.font.weightBold,
      weightExtraBold: base.font.weightExtraBold,
      leadingTight: base.font.leadingTight,
      leadingNormal: base.font.leadingNormal,
      leadingRelaxed: base.font.leadingRelaxed,
      trackingTight: base.font.trackingTight,
      trackingNormal: base.font.trackingNormal,
      trackingWide: base.font.trackingWide
    },
    radius: {
      xs: read("radius.xs", base.radius.xs),
      sm: read("radius.sm", base.radius.sm),
      md: read("radius.md", base.radius.md),
      lg: read("radius.lg", base.radius.lg),
      xl: read("radius.xl", base.radius.xl),
      full: read("radius.full", base.radius.full)
    },
    spacing: {
      xs: read("spacing.xs", base.spacing.xs),
      sm: read("spacing.sm", base.spacing.sm),
      md: read("spacing.md", base.spacing.md),
      lg: read("spacing.lg", base.spacing.lg),
      xl: read("spacing.xl", base.spacing.xl),
      xxl: read("spacing.xxl", base.spacing.xxl)
    },
    shadow: {
      none: read("shadow.none", base.shadow.none),
      sm: read("shadow.sm", base.shadow.sm),
      md: read("shadow.md", base.shadow.md),
      lg: read("shadow.lg", base.shadow.lg),
      xl: read("shadow.xl", base.shadow.xl)
    },
    motion: {
      fast: read("motion.fast", base.motion.fast),
      normal: read("motion.normal", base.motion.normal),
      slow: read("motion.slow", base.motion.slow),
      easeStandard: base.motion.easeStandard,
      easeEmphasis: base.motion.easeEmphasis,
      easeDecelerate: base.motion.easeDecelerate
    },
    gradient: base.gradient,
    pattern: base.pattern,
    iconStyle: base.iconStyle,
    effect: base.effect,
    mode: base.mode,
    brandOverrides: base.brandOverrides
  };
}
