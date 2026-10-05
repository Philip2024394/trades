// src/app/nex-native/chat-standard/packages/coffee.package.ts
//
// Phase 2A.0 · Coffee Theme Package · greenfield second-world proof.
//
// Founder creative seed:
//   name/concept  : Coffee · slow mornings · warm aroma · cosy
//   personality   : warm (steam rising · warm pulse · aroma)
//   colours       : espresso / caramel / cream / amber glow
//   intro         : scripted-animation placeholder (video asset
//                   supplied later; the engine renders a programmatic
//                   warm-rise intro in the meantime)
//   wallpaper     : none (acceptance test · engine's deep-tinted
//                   gradient takes over)
//
// Important: this file contains CREATIVE decisions only. The engine
// does not branch on `coffee` anywhere. Every token below is a general
// engine vocabulary item. If you remove this file, nothing in the
// engine breaks · Coffee just stops existing.

import type { ThemePackage } from "../_engine/types";

export const COFFEE_PACKAGE: ThemePackage = {
  identity: {
    id: "coffee",
    name: "Coffee",
    tagline: "Slow mornings · warm aroma · amber light",
    conceptOneLine: "Coffee · slow mornings · warm aroma · cosy",
  },
  colours: {
    primary: "#6B3F22", // espresso
    secondary: "#C8976B", // caramel
    highlight: "#F7E7CA", // cream foam
    glow: "rgba(232, 170, 90, 0.55)", // amber warm glow
    deep: "#2A160A", // dark roast
  },
  personality: "warm",

  // 02 Intro · scripted-animation placeholder until a real intro video
  // is supplied by the business owner (standard theme intro). Business
  // Introduction (paid, per upload) overrides this when active · engine
  // resolveIntro handles the switch.
  intro: {
    kind: "standard",
    videoUrl: null,
    scriptedAnimation: "coffee-warm-rise",
    playPolicy: "twice-then-skip",
  },

  // 03 Environment · no wallpaper. Engine's deep-tinted gradient and
  // warm ambient families carry the atmosphere.
  wallpaperUrl: null,
  wallpaperScrim: "default",

  // 06-09 Bubbles · "warm-liquid" material + "domed" vessel silhouette.
  // Entrance is warm-rise-in (gentle lift + warmth filter), idle is a
  // slow warm pulse, reaction expands a warm glow halo.
  bubbles: {
    shape: "domed",
    material: "warm-liquid",
    motion: {
      entrance: "warm-rise-in",
      idle: "warm-pulse",
      reaction: "warm-glow-react",
      departure: "dissolve",
    },
    effects: {
      sendFlicker: false,
      receiveRipple: false,
      sparkleOnSend: true, // small aroma sparkles above the sent bubble
      bubbleTrailOnSend: false, // no water-column trail (that's Ocean)
    },
  },

  // 10 Emoji · card framing with a warm backdrop so each emoji feels
  // placed on a small ceramic tile rather than floating.
  emoji: {
    tileSize: 38,
    framingKind: "card",
    bounceOnPick: false,
    colorShift: null,
  },

  // 11 Stickers · engine SVG generator renders coffee / mug / croissant
  // / latte-art / espresso / steam / bean out of the colour system.
  stickers: {
    conceptKeywords: [
      "mug",
      "espresso",
      "latte-art",
      "croissant",
      "coffee",
      "steam",
      "bean",
    ],
  },

  // 12 Reactions · warm glyph set instead of the generic one.
  reactions: {
    glyphs: ["☕", "🥐", "🤎", "✨", "🫖", "🥮"],
  },

  // 13 Composer · ceramic material + rounded shape · the composer feels
  // like a warm vessel. Send glyph is a steam puff to telegraph "warm".
  composer: {
    material: "ceramic",
    sendGlyph: "☕",
    shape: "rounded",
  },

  // 16/17 Shop + Product cards · wood-plank cards (café shelf feel)
  // with momentum scroll + coaster framing so products sit on small
  // round discs like a saucer on the counter.
  shop: {
    cardStyle: "wood-plank",
    scrollFeel: "momentum",
    productFraming: "coaster",
  },

  // 23 Ambient · dense warm atmosphere. Steam rising + warm glow
  // (hanging lamps / candlelight) + sparkles (aroma particles catching
  // light). Mist omitted · steam is already the moisture layer.
  ambient: {
    density: "dense",
    families: ["steam-rising", "warm-glow-pulse", "sparkles"],
  },
};
