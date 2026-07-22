// Brand Interpretation Engine — turns a BrandRecord into a full
// DesignTokens object. Per V3 Q15.
//
// Deterministic. No AI. The token engine sits between Brand DNA and
// every output surface (compiler, exporters, Studios). Change Brand
// DNA once, every downstream surface updates automatically.

import type { BrandRecord } from "@/lib/design/brand/schema";
import {
  DEFAULT_SPACING, DEFAULT_RADIUS, DEFAULT_ELEVATION,
  TOKEN_ENGINE_VERSION,
  type DesignTokens, type PremiumProfile, type PremiumTokens
} from "./core";

export function interpret(brand: BrandRecord): DesignTokens {
  const profile = profileFromPositioning(brand.positioning);

  return {
    version: TOKEN_ENGINE_VERSION,

    core: {
      primary:    brand.colour.primary,
      secondary:  brand.colour.secondary,
      accent:     brand.colour.accent,
      background: "#FBF6EC",             // platform off-white
      surface:    "#FFFFFF",
      text:       "#0A0A0A",
      textMuted:  "#5A5A5A",
      success:    "#166534",             // brand green dark
      warning:    "#F59E0B",
      danger:     "#DC2626",
      info:       "#3B82F6"
    },

    typography: {
      headingFont:    brand.typography.primary,
      bodyFont:       brand.typography.secondary ?? brand.typography.primary,
      displayFont:    brand.typography.primary,
      weights:        [400, 600, 800],
      letterSpacing:  [-0.02, 0, 0.06],
      lineHeight:     [1.1, 1.4, 1.6]
    },

    spacing:   DEFAULT_SPACING,
    radius:    DEFAULT_RADIUS,
    elevation: DEFAULT_ELEVATION,

    icons: {
      strokeWidth:  profile === "luxury" ? 1.5 : 2,
      sizes:        [12, 16, 20, 24, 32],
      style:        "outline"
    },

    motion: {
      fastMs:   100,
      normalMs: 200,
      slowMs:   300,
      spring:   { stiffness: 220, damping: 26 }
    },

    premium: premiumFor(profile),

    vehicle: {
      logoWidthPct:   profile === "luxury" ? 11 : 14,
      phoneHeightPct: 7,
      heroPanelPct:   profile === "luxury" ? 28 : 34,
      marginPct:      profile === "luxury" ? 8  : 5,
      panelAngleDeg:  24,
      wrapPaddingMm:  10,
      qrSizeMm:       25
    },

    print: {
      bleedMm:    3,
      safeAreaMm: 5,
      marginMm:   10,
      dpi:        300,
      colourMode: "CMYK"
    }
  };
}

// ─── Premium profile from positioning language ──────────────────

function profileFromPositioning(positioning: string): PremiumProfile {
  const p = positioning.toLowerCase();
  if (p.includes("luxury") || p.includes("premium residential") || p.includes("bespoke")) return "luxury";
  if (p.includes("premium") || p.includes("high-end") || p.includes("architectural")) return "premium";
  if (p.includes("budget") || p.includes("emergency") || p.includes("value")) return "budget";
  return "mid";
}

function premiumFor(profile: PremiumProfile): PremiumTokens {
  switch (profile) {
    case "luxury":
      return {
        profile,
        whitespacePct: 24, photographyRatio: 0.65, informationDensity: 3,
        logoWeightMultiplier: 1.2, visualNoise: "low"
      };
    case "premium":
      return {
        profile,
        whitespacePct: 20, photographyRatio: 0.55, informationDensity: 4,
        logoWeightMultiplier: 1.1, visualNoise: "low"
      };
    case "mid":
      return {
        profile,
        whitespacePct: 16, photographyRatio: 0.45, informationDensity: 5,
        logoWeightMultiplier: 1.0, visualNoise: "medium"
      };
    case "budget":
      return {
        profile,
        whitespacePct: 12, photographyRatio: 0.3, informationDensity: 6,
        logoWeightMultiplier: 0.9, visualNoise: "high"
      };
  }
}

// ─── Path lookup for compiler use ───────────────────────────────

/** Dotted-path read: e.g. get(tokens, "vehicle.logoWidthPct"). */
export function get(tokens: DesignTokens, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = tokens;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}
