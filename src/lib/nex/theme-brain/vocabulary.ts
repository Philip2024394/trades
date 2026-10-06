// src/lib/nex/theme-brain/vocabulary.ts
//
// Snapshot of the Theme Engine vocabulary the Brain is allowed to
// select from. This is the SOURCE OF TRUTH FOR CAPABILITY VALIDATION
// in Phase 1 · if a token isn't listed here, the Brain reports a
// missing_capability instead of inventing it.
//
// The lists mirror the type unions in
//   src/lib/nex-native/theme-package/types.ts
// but are expressed as runtime arrays so the Brain can enumerate them,
// score matches, and emit traces.
//
// Load-bearing: this file must stay in sync with the type unions. The
// capability-validator asserts the arrays are a complete reflection of
// the union · a drift between the two triggers a test failure.

import type {
  AnimationPersonality,
  BubbleMaterial,
  BubbleShape,
  ShopTreatment,
  AmbientLayer,
  MotionToken,
} from "@/lib/nex-native/theme-package/types";

// ─── Animation personalities (10 sealed) ────────────────────────────

export const AVAILABLE_PERSONALITIES: readonly AnimationPersonality[] = [
  "drift",
  "flicker",
  "sway",
  "bounce",
  "orbit",
  "creep",
  "slide",
  "glitch",
  "warm",
  "neon",
] as const;

// ─── Bubble materials (10 sealed) ───────────────────────────────────

export const AVAILABLE_MATERIALS: readonly BubbleMaterial[] = [
  "glass",
  "solid",
  "gradient",
  "glow",
  "parchment",
  "frosting",
  "water",
  "driftwood",
  "ceramic",
  "warm-liquid",
  "neon-glass",
] as const;

// ─── Bubble shapes ──────────────────────────────────────────────────

export const AVAILABLE_SHAPES: readonly BubbleShape[] = [
  "classic",
  "pill",
  "square",
  "outlined",
  "gradient",
  "water-droplet",
  "shell",
  "domed",
] as const;

// ─── Motion tokens ──────────────────────────────────────────────────

export const AVAILABLE_MOTION_TOKENS: readonly MotionToken[] = [
  "fade-in",
  "slide-up",
  "pop",
  "drift-in",
  "ripple-in",
  "sprinkle-burst",
  "shimmer",
  "wobble",
  "flicker",
  "warm-rise-in",
  "warm-pulse",
  "warm-glow-react",
  "dissolve",
  "none",
] as const;

// ─── Ambient families ───────────────────────────────────────────────

type AmbientFamily = NonNullable<AmbientLayer["families"]>[number];

export const AVAILABLE_AMBIENT_FAMILIES: readonly AmbientFamily[] = [
  "particles-up",
  "sparkles",
  "mist",
  "bubbles-rising",
  "light-rays",
  "sparks",
  "heat-shimmer",
  "leaves-falling",
  "stars",
  "snow",
  "sun-dapple",
  "pollen-float",
  "neon-flicker",
  "rain-streak",
] as const;

// ─── Shop treatment vocabulary ──────────────────────────────────────

type ShopCardStyle = NonNullable<ShopTreatment["cardStyle"]>;
type ShopProductFraming = NonNullable<ShopTreatment["productFraming"]>;

export const AVAILABLE_SHOP_CARD_STYLES: readonly ShopCardStyle[] = [
  "glass",
  "ticket",
  "terminal",
  "driftwood-board",
  "shell",
  "wood-plank",
  "ceramic-tile",
  "marble-top",
] as const;

export const AVAILABLE_SHOP_PRODUCT_FRAMINGS: readonly ShopProductFraming[] = [
  "card",
  "float",
  "buoy",
  "coaster",
  "mug",
  "saucer-under-glass",
] as const;

// ─── Sticker concept keywords with existing SVG renderers ───────────
//
// These are concept keywords the sticker-generator in the UI layer has
// renderers for. The Brain may select from this list; a request for an
// unlisted sticker concept triggers a capability gap. The list mirrors
// the renderers in src/app/nex-native/chat-standard/_engine/sticker-generator.tsx
// and must be kept in sync (reflected via test).

export const AVAILABLE_STICKER_CONCEPTS: readonly string[] = [
  // Ocean
  "fish",
  "shell",
  "octopus",
  "wave",
  "treasure",
  "diver",
  "bubble",
  // Coffee
  "mug",
  "espresso",
  "latte-art",
  "croissant",
  "coffee",
  "steam",
  "bean",
  // Botanical
  "fern",
  "plant-pot",
  "teacup",
  "honey-jar",
  "leaf",
  // Midnight
  "vinyl-record",
  "moon",
  "neon-heart",
  "jazz-note",
  // French
  "baguette",
  "macaron",
  "wine-glass",
  "beret",
  "eiffel-tower",
] as const;

// ─── Type helpers for the selector/validator ────────────────────────

export type AvailableAmbientFamily = AmbientFamily;
export type AvailableShopCardStyle = ShopCardStyle;
export type AvailableShopProductFraming = ShopProductFraming;
