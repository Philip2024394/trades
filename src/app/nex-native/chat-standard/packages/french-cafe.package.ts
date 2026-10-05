// src/app/nex-native/chat-standard/packages/french-cafe.package.ts
//
// Batch 001 · World 3 · French Café.
//
// Founder creative seed:
//   intent        : elegant · refined · timeless
//   feel          : a Parisian café on a quiet evening — polished
//                   marble counter, soft candlelight, parchment-pale
//                   bubbles that read like a handwritten note, the
//                   faintest sparkle catching the glassware
//   personality   : warm (slow gentle rise · warm pulse · warm halo)
//   typography    : serif stack (Playfair / Didot / Bodoni / Georgia)
//                   · the single strongest signature of this world
//   bubbles       : pill-shaped parchment · soft matte warm paper
//   colours       : rose-wood primary / cream / porcelain highlight /
//                   gold-leaf glow / deep espresso-brown
//   intro         : scripted-animation placeholder · twice-then-skip
//   wallpaper     : none · engine's warm deep-brown gradient carries it
//
// Important: this file contains CREATIVE decisions only. The Theme
// Engine does NOT branch on "french-cafe". Every token is general
// engine vocabulary approved in Phase 2A.0 + Engine Extension Batch 001.
//
// gold-shimmer is NOT used · founder-directed to attempt the refined
// gold feel using already-approved sparkles + colour tuning + marble
// treatment. If it proves insufficient after visual review a new
// GENERAL capability may be proposed · never a world-specific hack.

import type { ThemePackage } from "../_engine/types";

export const FRENCH_CAFE_PACKAGE: ThemePackage = {
  identity: {
    id: "french-cafe",
    name: "French Café",
    tagline: "Marbre · parchment · candlelight · elegance",
    conceptOneLine:
      "French Café · elegant · refined · timeless",
  },
  colours: {
    primary: "#A6734A", // antique rose-wood
    secondary: "#F2E4CF", // cream
    highlight: "#F8ECD5", // porcelain
    glow: "rgba(230, 195, 115, 0.70)", // gold-leaf tint (the "refined gold")
    deep: "#2A1810", // espresso-brown shadow
  },
  personality: "warm",

  // 05 Typography · the strongest single signature of this world.
  // Serif stack with safe fallbacks · the engine renders this through
  // CSS vars with `inherit` defaults, so if none of Playfair / Didot
  // / Bodoni resolve in the client the browser falls through to
  // Georgia / generic serif. No new font-loading infrastructure.
  typography: {
    fontFamily:
      "'Playfair Display', 'Didot', 'Bodoni Moda', Georgia, serif",
    headingWeight: 700,
    bodyWeight: 500,
    letterSpacing: "0.015em",
  },

  // 02 Intro · scripted-animation placeholder.
  intro: {
    kind: "standard",
    videoUrl: null,
    scriptedAnimation: "french-elegance-rise",
    playPolicy: "twice-then-skip",
  },

  // 03 Environment · no wallpaper · the warm deep-brown gradient
  // carries it with the ambient layer providing the candle breath
  // and sparkle highlights.
  wallpaperUrl: null,
  wallpaperScrim: "default",

  // 06-09 Bubbles · pill + parchment. The warm personality supplies
  // the gentle rise entrance, slow warm pulse idle, warm glow react.
  // Parchment reads as soft matte paper · the handwritten-note feel.
  bubbles: {
    shape: "pill",
    material: "parchment",
    effects: {
      sendFlicker: false,
      receiveRipple: false,
      sparkleOnSend: true, // a single gold-leaf sparkle above the sent note
      bubbleTrailOnSend: false,
    },
  },

  // 10 Emoji · card framing with a soft warm backdrop so each emoji
  // sits like an engraving on cream card.
  emoji: {
    tileSize: 38,
    framingKind: "card",
    bounceOnPick: false,
    colorShift: null,
  },

  // 11 Stickers · the French sticker vocabulary approved in Engine
  // Extension Batch 001. "croissant" exists already from the general
  // SVG renderer map.
  stickers: {
    conceptKeywords: [
      "baguette",
      "macaron",
      "wine-glass",
      "beret",
      "eiffel-tower",
      "croissant",
    ],
  },

  // 12 Reactions · elegant / Parisian glyph set.
  reactions: {
    glyphs: ["🥐", "🍷", "🥮", "✨", "🕯️", "🗼"],
  },

  // 13 Composer · parchment material + pill shape · the composer
  // reads as a quill-ready card. Send glyph is a classic feather so
  // sending feels like signing a note.
  composer: {
    material: "parchment",
    sendGlyph: "✒",
    shape: "pill",
  },

  // 16/17 Shop + Product cards · marble-top (polished stone with
  // hairline gold border + top specular) with momentum scroll and
  // saucer-under-glass product framing (round, museum-case feel ·
  // precisely what a patisserie counter looks like).
  shop: {
    cardStyle: "marble-top",
    scrollFeel: "momentum",
    productFraming: "saucer-under-glass",
  },

  // 23 Ambient · the French signature. Deliberately NOT dense ·
  // elegance is restraint. Candle breath + fine sparkle + a soft
  // morning mist layer.
  //
  // warm-glow-pulse → soft radial glows (candles, hanging lanterns)
  //                   breathing slowly behind the scene
  // sparkles → fine light-catching motes · the "refined gold feel"
  //            is carried here through glow-tint, not a new effect
  // mist → the faintest haze of a Parisian morning for depth
  ambient: {
    density: "medium",
    families: ["warm-glow-pulse", "sparkles", "mist"],
  },
};
