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
  | "warm"
  // NEW general personality (Extension Batch 001 · founder-authorised
  // 2026-10-05) · electric / sharp-pulse / intermittent-glow. Suits
  // nightclub, arcade, cyberpunk, bar, racing, gaming, night-market,
  // jazz-club, noir — any world where the vibe is lit by neon tube
  // signage against darkness. Pairs by default with the
  // neon-flicker + rain-streak + sparkles ambient families.
  | "neon";

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
  | "warm-liquid"
  // NEW general material (Extension Batch 001 · founder-authorised
  // 2026-10-05) · dark glass body + saturated hot rim-glow reads as
  // a neon tube bending around text. Reusable by nightclub, arcade,
  // cyberpunk, bar, racing, gaming. Pairs well with personality:neon.
  | "neon-glass";

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
    | "ceramic-tile" // glazed tile / cosy backdrop
    // NEW general card style · Extension Batch 001 (founder-authorised
    // 2026-10-05) · polished stone card with hairline gold border and
    // soft top specular. Suits luxury, jewellery, patisserie, high-end
    // restaurant, spa, bridal · any "refined / premium" surface.
    | "marble-top";
  scrollFeel?: "snap" | "momentum" | "current";
  productFraming?:
    | "card"
    | "float"
    | "buoy"
    // NEW · "coaster" (round warm disc) and "mug" (rounded top vessel)
    | "coaster"
    | "mug"
    // NEW general framing · Extension Batch 001 · round framing with
    // top specular highlight and fine rim (museum-case feel). Suits
    // patisserie, jewellery, luxury, chocolate, perfume themes.
    | "saucer-under-glass";
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
    // NEW general ambient families · Extension Batch 001 (founder-
    // authorised 2026-10-05). Each is a reusable visual effect any
    // package may opt into.
    //
    // sun-dapple: slow-moving semi-transparent light patches drifting
    //   across the stage · suits garden, florist, greenhouse, tropical,
    //   outdoor restaurant, spa, meadow, wedding worlds.
    //
    // pollen-float: soft tinted particles with lateral drift (warmer
    //   and gentler than bubbles-rising) · suits garden, meadow,
    //   florist, wedding, outdoor-event worlds.
    //
    // neon-flicker: scattered sharp pulses with intermittent flicker
    //   suggesting neon tube signage · suits nightclub, arcade,
    //   cyberpunk, bar, racing, gaming, jazz-club worlds.
    //
    // rain-streak: thin vertical streaks of rain · suits noir, melan-
    //   choly, cinematic, monsoon, rooftop-at-night, jazz-club worlds.
    | "sun-dapple"
    | "pollen-float"
    | "neon-flicker"
    | "rain-streak"
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

/** 05 Typography · Extension Batch 001 (founder-authorised 2026-10-05).
 *  Optional typography overrides so themes with refined-text identity
 *  (Luxury, Jewellery, Patisserie, Fine Dining, Boutique Hotel, Wedding,
 *  Premium Restaurant) can request a serif or an elegant sans without
 *  the engine knowing which theme asked. Every field is optional ·
 *  backwards-compatible with existing Ocean and Coffee packages which
 *  continue to inherit the NEX default font. */
export interface TypographyPackage {
  /** CSS font-family stack · e.g. `"'Playfair Display', Georgia, serif"`.
   *  Package-authored string · the engine renders it through CSS vars,
   *  never parses it. */
  fontFamily?: string;
  /** Weight for headings / strong text · defaults to 700. */
  headingWeight?: number;
  /** Weight for body text · defaults to 500. */
  bodyWeight?: number;
  /** CSS letter-spacing · defaults to `"normal"`. */
  letterSpacing?: string;
}

export interface ThemePackage {
  identity: ThemeIdentity;
  colours: ColourSystem;
  /** Required · drives motion resolution for every surface. */
  personality: AnimationPersonality;

  // 05 Typography · optional refined-text override
  typography?: TypographyPackage;

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
