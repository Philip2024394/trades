// Button style families — 7 curated mood packs.
//
// A style family is a NAMED delta over a button registration's baked-in
// styling. Applying a family produces:
//
//   • state overrides (colours, shadows, transform, borders)
//   • motion adjustments (calmer motion for corporate, playful for bold)
//   • shape hints (pill for modern, sharp for trade, radius scale)
//   • typography weights + letter-spacing tweaks (via CSS on the
//     rendered button — the theme adapter applies them from the
//     merchant's brand tokens)
//
// Families are additive — merchant can layer a family on top of any
// registered variant. Content (label, href, icon) is NEVER touched.

import type {
  ButtonState,
  ButtonStyleFamily,
  MotionSpec,
  ShadowPreset,
  ShapeSpec,
  StateOverrides
} from "./types";

// ─── Public shape ────────────────────────────────────────

export type ButtonStyleFamilyPack = {
  id: ButtonStyleFamily;
  label: string;
  pitch: string;
  /** Preview swatch used in the picker. */
  thumbnail: {
    from: string;
    to: string;
    ink: string;
    accent: string;
  };
  /** State overrides layered on top of the variant's own defaults. */
  states: Partial<Record<ButtonState, StateOverrides>>;
  /** Motion overrides — undefined means "keep the variant's". */
  motion: Partial<MotionSpec>;
  /** Shape override — override the variant's shape if the family
   *  dictates one (e.g. Luxury forces subtle radius). */
  shape?: ShapeSpec;
  /** Typography deltas applied via inline style at render time. */
  typography: {
    fontWeight?: number;
    letterSpacingEm?: number;
    textTransform?: "uppercase" | "none";
  };
};

// ─── Registry ───────────────────────────────────────────

export const BUTTON_STYLE_FAMILIES: Record<ButtonStyleFamily, ButtonStyleFamilyPack> = {
  modern: {
    id: "modern",
    label: "Modern",
    pitch: "Product-tour clean. Rounded, airy, one confident shadow.",
    thumbnail: { from: "#F5F5F7", to: "#FFFFFF", ink: "#1D1D1F", accent: "#0071E3" },
    states: {
      default: { shadowPreset: "soft" },
      hover: { translateYPx: -1, shadowPreset: "floating" }
    },
    motion: { hover: "lift", press: "shrink" },
    shape: { kind: "rounded", perCornerPx: [12, 12, 12, 12] },
    typography: { fontWeight: 700, letterSpacingEm: 0, textTransform: "none" }
  },
  corporate: {
    id: "corporate",
    label: "Corporate",
    pitch: "Trusted, quiet, blue-suit dependable.",
    thumbnail: { from: "#0F172A", to: "#334155", ink: "#F8FAFC", accent: "#0EA5E9" },
    states: {
      default: { shadowPreset: "soft" },
      hover: { translateYPx: -1 }
    },
    motion: { hover: "lift", press: "shrink" },
    shape: { kind: "rect", radiusPx: 6 },
    typography: { fontWeight: 700, letterSpacingEm: 0.02 }
  },
  luxury: {
    id: "luxury",
    label: "Luxury",
    pitch: "Editorial serif energy. Small radius, long shadow.",
    thumbnail: { from: "#FBF7EF", to: "#F0E6D2", ink: "#1A1512", accent: "#C9A87C" },
    states: {
      default: { shadowPreset: "long" },
      hover: { translateYPx: -1 }
    },
    motion: { hover: "lift", press: "shrink" },
    shape: { kind: "rect", radiusPx: 4 },
    typography: {
      fontWeight: 600,
      letterSpacingEm: 0.18,
      textTransform: "uppercase"
    }
  },
  // Note: "Trade" is the label; the type union key is "construction"
  // for backward-compat with the existing ButtonStyleFamily enum.
  minimal: {
    id: "minimal",
    label: "Minimal",
    pitch: "Ink on paper. Zero decoration.",
    thumbnail: { from: "#FFFFFF", to: "#F5F5F5", ink: "#0A0A0A", accent: "#0A0A0A" },
    states: {
      default: { shadowPreset: "none", borderWidthPx: 1 },
      hover: { backgroundLiteral: "rgba(0,0,0,0.04)" }
    },
    motion: { hover: "none", press: "shrink" },
    shape: { kind: "rect", radiusPx: 0 },
    typography: { fontWeight: 500, letterSpacingEm: 0 }
  },
  glass: {
    id: "glass",
    label: "Glass",
    pitch: "Frosted panel with saturated accent + inner highlight.",
    thumbnail: { from: "#7C3AED", to: "#06B6D4", ink: "#FFFFFF", accent: "#06B6D4" },
    states: {
      default: {
        backgroundLiteral: "rgba(255,255,255,0.14)",
        inkLiteral: "#FFFFFF",
        shadowPreset: "glass",
        borderWidthPx: 1,
        borderLiteral: "rgba(255,255,255,0.24)"
      },
      hover: { backgroundLiteral: "rgba(255,255,255,0.2)" }
    },
    motion: { hover: "grow", press: "shrink" },
    shape: { kind: "rounded", perCornerPx: [16, 16, 16, 16] },
    typography: { fontWeight: 700, letterSpacingEm: 0.08 }
  },
  dark: {
    id: "dark",
    label: "Dark",
    pitch: "Onyx surface + hot accent + dev-tool tone.",
    thumbnail: { from: "#000000", to: "#171717", ink: "#FAFAFA", accent: "#F97316" },
    states: {
      default: {
        backgroundLiteral: "#0A0A0A",
        inkLiteral: "#FAFAFA",
        borderWidthPx: 1,
        borderLiteral: "#262626"
      },
      hover: { backgroundLiteral: "#171717" }
    },
    motion: { hover: "grow", press: "shrink" },
    shape: { kind: "rect", radiusPx: 6 },
    typography: {
      fontWeight: 700,
      letterSpacingEm: 0.06,
      textTransform: "uppercase"
    }
  },
  // Aliases the type union already declares — treat them as safe
  // fallbacks that reuse an existing pack for now.
  neumorphism: {
    id: "neumorphism",
    label: "Neumorphism",
    pitch: "Soft embossed pad. Trend piece; use with restraint.",
    thumbnail: { from: "#E0E5EC", to: "#C4CBD4", ink: "#0A0A0A", accent: "#0A0A0A" },
    states: {
      default: { shadowPreset: "neumorphic", backgroundLiteral: "#E0E5EC", inkLiteral: "#0A0A0A" }
    },
    motion: { hover: "none", press: "shrink" },
    shape: { kind: "rounded", perCornerPx: [16, 16, 16, 16] },
    typography: { fontWeight: 700, letterSpacingEm: 0.04 }
  },
  soft_ui: {
    id: "soft_ui",
    label: "Soft UI",
    pitch: "Pastel + generous radius. Beginner-safe.",
    thumbnail: { from: "#F3E8FF", to: "#DBEAFE", ink: "#3730A3", accent: "#7C3AED" },
    states: {
      default: { shadowPreset: "soft", backgroundLiteral: "#F3E8FF", inkLiteral: "#3730A3" }
    },
    motion: { hover: "lift", press: "shrink" },
    shape: { kind: "rounded", perCornerPx: [14, 14, 14, 14] },
    typography: { fontWeight: 600, letterSpacingEm: 0.04 }
  },
  material: {
    id: "material",
    label: "Material",
    pitch: "Google Material 3 baseline.",
    thumbnail: { from: "#6750A4", to: "#B69DF8", ink: "#FFFFFF", accent: "#6750A4" },
    states: {
      default: { shadowPreset: "layered", backgroundLiteral: "#6750A4", inkLiteral: "#FFFFFF" }
    },
    motion: { hover: "lift", press: "ripple" },
    shape: { kind: "rounded", perCornerPx: [20, 20, 20, 20] },
    typography: { fontWeight: 500, letterSpacingEm: 0.06 }
  },
  apple: {
    id: "apple",
    label: "Apple",
    pitch: "iOS button feel. Rounded, tight, restrained.",
    thumbnail: { from: "#F5F5F7", to: "#FFFFFF", ink: "#1D1D1F", accent: "#0071E3" },
    states: {
      default: { backgroundLiteral: "#0071E3", inkLiteral: "#FFFFFF", shadowPreset: "soft" }
    },
    motion: { hover: "grow", press: "shrink" },
    shape: { kind: "rounded", perCornerPx: [12, 12, 12, 12] },
    typography: { fontWeight: 600, letterSpacingEm: -0.01 }
  },
  google: {
    id: "google",
    label: "Google",
    pitch: "Material-adjacent. Simple, safe.",
    thumbnail: { from: "#4285F4", to: "#1A73E8", ink: "#FFFFFF", accent: "#4285F4" },
    states: {
      default: { backgroundLiteral: "#1A73E8", inkLiteral: "#FFFFFF", shadowPreset: "layered" }
    },
    motion: { hover: "lift", press: "ripple" },
    shape: { kind: "rounded", perCornerPx: [4, 4, 4, 4] },
    typography: { fontWeight: 500, letterSpacingEm: 0.02 }
  },
  construction: {
    id: "construction",
    label: "Trade",
    pitch: "Hi-vis, condensed type, hard shadow. Trades-native.",
    thumbnail: { from: "#0A0A0A", to: "#404040", ink: "#FFFFFF", accent: "#FFB300" },
    states: {
      default: { shadowPreset: "hard" },
      hover: { translateYPx: -1, shadowPreset: "hard" },
      pressed: { translateYPx: 1 }
    },
    motion: { hover: "lift", press: "shrink" },
    shape: { kind: "rect", radiusPx: 4 },
    typography: {
      fontWeight: 800,
      letterSpacingEm: 0.14,
      textTransform: "uppercase"
    }
  },
  industrial: {
    id: "industrial",
    label: "Industrial",
    pitch: "Cool steel, safety orange.",
    thumbnail: { from: "#404040", to: "#171717", ink: "#F5F5F5", accent: "#F97316" },
    states: {
      default: { backgroundLiteral: "#171717", inkLiteral: "#F5F5F5" }
    },
    motion: { hover: "lift", press: "shrink" },
    shape: { kind: "rect", radiusPx: 2 },
    typography: { fontWeight: 700, letterSpacingEm: 0.1, textTransform: "uppercase" }
  },
  bold: {
    id: "bold",
    label: "Bold",
    pitch: "Loud type, oversized, unignorable.",
    thumbnail: { from: "#DC2626", to: "#F59E0B", ink: "#FFFFFF", accent: "#DC2626" },
    states: {
      default: { backgroundLiteral: "#DC2626", inkLiteral: "#FFFFFF", shadowPreset: "hard" }
    },
    motion: { hover: "grow", press: "shrink" },
    shape: { kind: "rect", radiusPx: 4 },
    typography: { fontWeight: 900, letterSpacingEm: 0.02 }
  },
  elegant: {
    id: "elegant",
    label: "Elegant",
    pitch: "Serif, deep plum, gold accent.",
    thumbnail: { from: "#2A1834", to: "#4C1D6B", ink: "#F5EFE7", accent: "#D4AF37" },
    states: {
      default: { backgroundLiteral: "#2A1834", inkLiteral: "#F5EFE7", shadowPreset: "soft" }
    },
    motion: { hover: "grow", press: "shrink" },
    shape: { kind: "rect", radiusPx: 6 },
    typography: { fontWeight: 600, letterSpacingEm: 0.1 }
  },
  creative: {
    id: "creative",
    label: "Creative",
    pitch: "Playful shape + gradient. For agencies + studios.",
    thumbnail: { from: "#F472B6", to: "#8B5CF6", ink: "#FFFFFF", accent: "#F472B6" },
    states: {
      default: {
        backgroundLiteral: "linear-gradient(135deg, #F472B6 0%, #8B5CF6 100%)",
        inkLiteral: "#FFFFFF",
        shadowPreset: "glow"
      }
    },
    motion: { hover: "morph", press: "spring" },
    shape: { kind: "rounded", perCornerPx: [20, 8, 20, 8] },
    typography: { fontWeight: 700, letterSpacingEm: 0.04 }
  },
  light: {
    id: "light",
    label: "Light",
    pitch: "Bright surface, black ink. Airy.",
    thumbnail: { from: "#FFFFFF", to: "#F5F5F5", ink: "#0A0A0A", accent: "#0A0A0A" },
    states: {
      default: { backgroundLiteral: "#FFFFFF", inkLiteral: "#0A0A0A", borderWidthPx: 1, borderLiteral: "#E5E5E5" }
    },
    motion: { hover: "lift", press: "shrink" },
    shape: { kind: "rect", radiusPx: 8 },
    typography: { fontWeight: 600 }
  },
  high_contrast: {
    id: "high_contrast",
    label: "High Contrast",
    pitch: "Max WCAG contrast. Accessibility-first.",
    thumbnail: { from: "#000000", to: "#FFFFFF", ink: "#000000", accent: "#000000" },
    states: {
      default: {
        backgroundLiteral: "#000000",
        inkLiteral: "#FFFFFF",
        borderWidthPx: 2,
        borderLiteral: "#000000"
      }
    },
    motion: { hover: "none", press: "shrink" },
    shape: { kind: "rect", radiusPx: 0 },
    typography: { fontWeight: 800 }
  }
};

/** Merge a family's state deltas on top of the variant's own states.
 *  Family fields never overwrite variant fields that carry brand-token
 *  bindings — merchant brand identity wins over mood-pack literals. */
export function mergeFamily(
  variantStates: Partial<Record<ButtonState, StateOverrides>>,
  familyId: ButtonStyleFamily
): Partial<Record<ButtonState, StateOverrides>> {
  const pack = BUTTON_STYLE_FAMILIES[familyId];
  if (!pack) return variantStates;
  const out: Partial<Record<ButtonState, StateOverrides>> = { ...variantStates };
  for (const state of Object.keys(pack.states) as ButtonState[]) {
    out[state] = {
      ...(pack.states[state] ?? {}),
      ...(out[state] ?? {})
    };
  }
  return out;
}
