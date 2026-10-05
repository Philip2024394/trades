// src/app/nex-native/chat-standard/_engine/types.ts
//
// Phase 2A.0 · Theme Engine type contracts.
//
// Load-bearing: NEX owns the experience. The Theme Engine owns how
// that experience feels. Every type below is a vocabulary token — a
// theme supplies what it customises, the engine defaults the rest.

// ─── Animation personality ──────────────────────────────────────────

/** A one-word animation personality a theme can declare. The engine
 *  translates this into concrete motion tokens for every surface
 *  (bubble entrance, idle, reaction, ambient layer, button press, etc).
 *  Extendable as new worlds emerge · founder-approved list for 2A.0:
 *    drift   · ocean, tropical
 *    flicker · fire
 *    sway    · forest, autumn
 *    bounce  · cakes, party
 *    orbit   · space
 *    creep   · halloween, haunted-hotel
 *    slide   · racing, cyber-grid
 *    glitch  · joker
 *  Themes may ALSO supply a personality array (e.g. ["drift","shimmer"])
 *  when a single word under-describes them. The engine uses the first
 *  as primary. */
export type AnimationPersonality =
  | "drift"
  | "flicker"
  | "sway"
  | "bounce"
  | "orbit"
  | "creep"
  | "slide"
  | "glitch"
  // NEW general personality · slow / warm / aromatic. Suits coffee,
  // bakery, candle, fireplace, laundry, apothecary — any theme where
  // the vibe is gentle warmth rising. Rising-steam ambient + warm
  // breath idle + warm-glow reaction.
  | "warm";

// ─── Colour system ──────────────────────────────────────────────────

export interface ColourSystem {
  /** Primary brand/accent · required · drives bubble rim, button accent,
   *  reaction glow, send button. */
  primary: string;
  /** Secondary · drives idle UI tints, composer rim fallback. */
  secondary?: string;
  /** Highlight · drives selected states, hover, active chip. */
  highlight?: string;
  /** Glow · drives sparkle colour, button glow, reaction burst colour. */
  glow?: string;
  /** Deep · drives bubble material backgrounds, dim overlays. */
  deep?: string;
}

// ─── Package vocabulary ─────────────────────────────────────────────

export type BubbleShape =
  | "classic"
  | "pill"
  | "square"
  | "outlined"
  | "gradient"
  | "water-droplet" // Ocean · asymmetric curved droplet
  | "shell" // Ocean · scalloped shell edge
  // NEW general shape · a rounded vessel silhouette (slightly wider at
  // the base than the top). Suits ceramic / crafted-goods themes
  // without being tied to coffee specifically.
  | "domed";

export type BubbleMaterial =
  | "glass"
  | "solid"
  | "gradient"
  | "glow"
  | "parchment"
  | "frosting"
  | "water"
  | "driftwood"
  // NEW general materials · ceramic is a matte-glazed solid surface
  // with a subtle rim-light. warm-liquid is a hot drink's rich gradient
  // (strong amber core → dark edges) with a surface steam shimmer.
  // Both work for any warm/craft/cafe theme, not just coffee.
  | "ceramic"
  | "warm-liquid";

export type MotionToken =
  | "fade-in"
  | "slide-up"
  | "pop"
  | "drift-in"
  | "ripple-in"
  | "sprinkle-burst"
  | "shimmer"
  | "wobble"
  | "flicker"
  // NEW general tokens · warm themes benefit, generic enough to reuse
  | "warm-rise-in" // gentle fade + small upward lift + warmth filter
  | "warm-pulse" // slow brightness breath, like a cup catching light
  | "warm-glow-react" // reaction expands a warm glow halo
  | "dissolve"
  | "none";

export interface BubblePackage {
  shape?: BubbleShape;
  material?: BubbleMaterial;
  motion?: {
    entrance?: MotionToken;
    idle?: MotionToken;
    reaction?: MotionToken;
    departure?: MotionToken;
  };
  effects?: {
    sendFlicker?: boolean;
    receiveRipple?: boolean;
    sparkleOnSend?: boolean;
    bubbleTrailOnSend?: boolean; // ocean · rising bubble trail
  };
}

export interface ComposerPackage {
  material?: BubbleMaterial;
  sendGlyph?: string; // e.g. "↑", "➤", "🫧" (ocean)
  shape?: "pill" | "rounded" | "water"; // water = subtle warp
  motion?: { onFocus?: MotionToken; onSend?: MotionToken };
}

export interface EmojiPresentation {
  tileSize?: number;
  colorShift?: string | null;
  bounceOnPick?: boolean;
  framingKind?: "none" | "water-ring" | "card" | "sticker"; // ocean uses water-ring
}

export interface StickerSet {
  /** When the theme supplies real sticker art, provide a URL per slug.
   *  When omitted, the engine's SVG generator produces a theme-coherent
   *  set from colour system + personality + conceptKeywords. */
  explicit?: Record<string, string>;
  /** Keywords for the SVG generator · ocean example: ["fish","shell",
   *  "octopus","wave","diver","bubble","treasure"]. */
  conceptKeywords?: string[];
}

export interface ReactionTreatment {
  glyphs?: string[]; // emoji sequence for the picker
  burstMotion?: MotionToken;
  chipMaterial?: BubbleMaterial;
}

export interface ShopTreatment {
  cardStyle?:
    | "glass"
    | "ticket"
    | "terminal"
    | "driftwood-board"
    | "shell"
    // NEW general card styles for warm themes
    | "wood-plank" // wooden café shelf / timber workshop
    | "ceramic-tile"; // glazed tile / cosy backdrop
  scrollFeel?: "snap" | "momentum" | "current";
  productFraming?:
    | "card"
    | "float"
    | "buoy"
    // NEW · "coaster" (round warm disc) and "mug" (rounded top vessel)
    | "coaster"
    | "mug";
}

export interface AmbientLayer {
  /** How many ambient particles / effects to spawn · engine clamps. */
  density?: "sparse" | "medium" | "dense";
  /** Visual family for the ambient layer. ocean = bubbles-rising +
   *  light-rays. fire = sparks-rising + heat-shimmer. etc. The engine
   *  resolves this from personality when omitted. */
  families?: Array<
    | "particles-up"
    | "sparkles"
    | "mist"
    | "bubbles-rising"
    | "light-rays"
    | "sparks"
    | "heat-shimmer"
    | "leaves-falling"
    | "stars"
    | "snow"
  >;
}

// ─── Intro architecture (Business Intro aware · 2026-10-05) ─────────

export interface StandardIntro {
  kind: "standard";
  /** Theme-supplied video URL (preferred) · or null to use scripted. */
  videoUrl: string | null;
  /** Scripted animation name · engine renders a programmatic animation
   *  when the theme has no video asset yet. "ocean-drift" · "fire-rise"
   *  · "cakes-sprinkle" etc. Keyed into the ambient layer's family. */
  scriptedAnimation: string | null;
  /** Visitor-frequency rule (sealed 2026-10-05): seen 0 or 1 times
   *  → play. seen 2+ times → skip. */
  playPolicy: "twice-then-skip";
}

export interface BusinessIntro {
  kind: "business";
  /** Owner-uploaded 5-8s 16:9 MP4 · supplied by the business-intro
   *  entitlement system (not implemented in 2A.0). */
  videoUrl: string;
  /** Policy for business intro visibility · 2A.0 default "always-when-on". */
  playPolicy: "always-when-on";
}

export type IntroSource = StandardIntro | BusinessIntro;

export interface IntroResolverInput {
  package: ThemePackage;
  /** Owner has enabled their paid Business Intro · supplied by caller
   *  from account entitlement system (fixture `false` in 2A.0 preview). */
  businessIntroEnabled: boolean;
  /** Visitor's seen-count for the standard intro of this theme ·
   *  supplied by caller from a seen-count store (fixture 0 in 2A.0
   *  preview). */
  viewerSeenCount: number;
}

// ─── The top-level Theme Package ────────────────────────────────────

export interface ThemeIdentity {
  id: string;
  name: string;
  tagline: string;
  conceptOneLine: string; // e.g. "Ocean / underwater / peaceful / premium"
}

export interface ThemePackage {
  identity: ThemeIdentity;
  colours: ColourSystem;
  /** Required · drives motion resolution for every surface. */
  personality: AnimationPersonality;

  // 02 Intro
  intro?: StandardIntro;
  /** Set by caller when the business owner has uploaded a video and
   *  flipped Business Intro ON. Not a theme-authored field. */
  businessIntro?: BusinessIntro;

  // 03 Environment
  wallpaperUrl?: string | null;
  wallpaperScrim?: "default" | "soft" | "none";

  // 06-09 Bubbles
  bubbles?: BubblePackage;

  // 10 Emoji
  emoji?: EmojiPresentation;

  // 11 Stickers
  stickers?: StickerSet;

  // 12 Reactions
  reactions?: ReactionTreatment;

  // 13 Composer
  composer?: ComposerPackage;

  // 16/17 Shop + product cards
  shop?: ShopTreatment;

  // 23 Ambient animation
  ambient?: AmbientLayer;
}

// ─── Resolved treatments (what the engine returns to surfaces) ──────

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
