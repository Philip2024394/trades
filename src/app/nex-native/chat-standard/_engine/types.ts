// src/app/nex-native/chat-standard/_engine/types.ts
//
// Phase 2A.0 · Theme Engine type contracts.
//
// Load-bearing: NEX owns the experience. The Theme Engine owns how
// that experience feels. Every type below is a vocabulary token — a
// theme supplies what it customises, the engine defaults the rest.
//
// 2026-10-05 EXTRACTION:
//   All input-side types (ThemePackage + vocabulary tokens) were
//   moved to src/lib/nex-native/theme-package/types.ts so the
//   NEX core / brain layer can depend on them without crossing
//   the forbidden dependency direction (core must not import from
//   app). This file now RE-EXPORTS those types so every existing
//   caller continues to work without modification · verified by
//   full regression (TypeScript + Vitest + architecture scan).
//
//   The React-dependent OUTPUT types (BubbleTreatment,
//   ComposerTreatment, etc) remain here · they belong in the UI
//   layer because they carry React.CSSProperties.

// ─── Re-exported input types from the core-owned contract ───────────
//
// Historical consumers continue to import from this path (e.g.
// `import type { ThemePackage } from "./types"`). The declarations
// now live in src/lib/nex-native/theme-package/types.ts.
export type {
  AnimationPersonality,
  ColourSystem,
  BubbleShape,
  BubbleMaterial,
  MotionToken,
  BubblePackage,
  ComposerPackage,
  EmojiPresentation,
  StickerSet,
  ReactionTreatment,
  ShopTreatment,
  AmbientLayer,
  StandardIntro,
  BusinessIntro,
  IntroSource,
  IntroResolverInput,
  ThemeIdentity,
  TypographyPackage,
  ThemePackage,
} from "@/lib/nex-native/theme-package/types";

// ─── Resolved treatments (what the engine returns to surfaces) ──────
//
// These remain in the UI layer because they carry React.CSSProperties
// / React.JSX.Element. Keeping them here preserves the clean
// dependency direction: core input types ↑ · UI output types stay.

export interface BubbleTreatment {
  geometry: {
    borderRadius: string;
    padding: string;
  };
  material: {
    background: string;
    backdropFilter?: string;
    border: string;
    boxShadow: string;
  };
  motion: {
    entrance: string; // CSS animation name
    idle: string | null;
    reaction: string | null;
  };
  effects: {
    sendFlicker: boolean;
    receiveRipple: boolean;
    sparkleOnSend: boolean;
    bubbleTrailOnSend: boolean;
  };
  typography: {
    color: string;
    textShadow: string;
    fontWeight: number;
  };
  /** Optional overlay rendered INSIDE the bubble, aria-hidden, pointer-
   *  events none. Materials like "water" use this for a slow drift of
   *  inner light so the bubble feels fluid at rest. */
  innerLightOverlay?: React.CSSProperties;
}

export interface ComposerTreatment {
  containerStyle: React.CSSProperties;
  inputStyle: React.CSSProperties;
  sendButtonStyle: React.CSSProperties;
  sendGlyph: string;
  focusAnimation: string | null;
}

export interface EmojiTreatment {
  tileSize: number;
  tileStyle: React.CSSProperties;
  colorFilter: string | null;
  pickAnimation: string | null;
}

export interface AmbientTreatment {
  families: Array<{
    kind: string;
    color: string;
    density: number;
    speedSeconds: number;
    size: number;
  }>;
}

export interface ShopTreatmentResolved {
  containerStyle: React.CSSProperties;
  cardStyle: React.CSSProperties;
  cardAccentStyle: React.CSSProperties;
  scrollSnap: "mandatory" | "proximity" | "none";
  productFraming: "card" | "float" | "buoy";
}

export interface ReactionTreatmentResolved {
  glyphs: string[];
  chipStyle: React.CSSProperties;
  burstAnimation: string | null;
}

export interface StickerTreatment {
  slugs: string[]; // ordered list of sticker slugs for this theme
  render: (slug: string, size: number) => React.JSX.Element;
}

// Re-export React import so types that reference React.CSSProperties
// resolve when consumers import from this module without a React import.
import type React from "react";
export type { React };
