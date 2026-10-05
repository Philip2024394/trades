// src/app/nex-native/chat-standard/packages/midnight-cafe.package.ts
//
// Batch 001 · World 2 · Midnight Café.
//
// Founder creative seed:
//   intent        : dark · neon · late-night
//   feel          : a genuine late-night café / small night venue —
//                   rain outside, neon tube signage glowing against
//                   the dark glass, vinyl spinning, a quiet jazz
//                   current. Readable and usable · never a cyberpunk
//                   game UI
//   personality   : neon (strobed-settle flicker · saturated pulse ·
//                   electric strike reaction)
//   bubbles       : pill-shaped neon-glass tubes · dark glass body
//                   wrapped in a saturated hot rim-glow
//   colours       : hot magenta tube / electric blue tube / porcelain
//                   highlight / magenta glow / near-black deep
//   intro         : scripted-animation placeholder · twice-then-skip
//   wallpaper     : none (dark base + neon atmosphere carry it)
//
// Important: this file contains CREATIVE decisions only. The Theme
// Engine does NOT branch on "midnight-cafe". Every token is general
// engine vocabulary · the package authors the world, the engine
// resolves it.

import type { ThemePackage } from "../_engine/types";

export const MIDNIGHT_CAFE_PACKAGE: ThemePackage = {
  identity: {
    id: "midnight-cafe",
    name: "Midnight Café",
    tagline: "Rain on the glass · neon in the dark · vinyl spinning",
    conceptOneLine:
      "Midnight Café · dark · neon · late-night",
  },
  colours: {
    primary: "#FF3EA5", // hot magenta neon tube
    secondary: "#38C6FF", // electric blue neon tube
    highlight: "#F2E8FF", // porcelain under neon
    glow: "rgba(255, 70, 180, 0.70)", // magenta tube glow
    deep: "#0B0A1E", // deep night (not pure black · reads warmer)
  },
  personality: "neon",

  // 02 Intro · scripted-animation placeholder. Keeps the Business
  // Intro architecture intact; owners upload a real video later.
  intro: {
    kind: "standard",
    videoUrl: null,
    scriptedAnimation: "midnight-neon-strike",
    playPolicy: "twice-then-skip",
  },

  // 03 Environment · no wallpaper · the near-black deep tone plus the
  // neon ambient families carry the atmosphere entirely.
  wallpaperUrl: null,
  wallpaperScrim: "default",

  // 06-09 Bubbles · pill + neon-glass. The neon personality supplies
  // flicker-in entrance, saturated pulse idle, electric strike react.
  // No override · the personality carries it.
  bubbles: {
    shape: "pill",
    material: "neon-glass",
    effects: {
      sendFlicker: true, // small tube-struck flicker when a message sends
      receiveRipple: false,
      sparkleOnSend: false,
      bubbleTrailOnSend: false,
    },
  },

  // 10 Emoji · card framing with a dark backdrop so each emoji feels
  // lit against the night. No colour shift · colour comes from the
  // emoji itself glowing against black.
  emoji: {
    tileSize: 38,
    framingKind: "card",
    bounceOnPick: false,
    colorShift: null,
  },

  // 11 Stickers · the Midnight sticker vocabulary approved in Engine
  // Extension Batch 001 + espresso (it is still a café at midnight).
  stickers: {
    conceptKeywords: [
      "vinyl-record",
      "moon",
      "neon-heart",
      "jazz-note",
      "espresso",
      "mug",
    ],
  },

  // 12 Reactions · night-venue glyph set. No "coffee" · no "croissant"
  // · the midnight equivalent is a drink, a moon, a note, a spark.
  reactions: {
    glyphs: ["🌙", "🎵", "✨", "💫", "🫧", "💜"],
  },

  // 13 Composer · neon-glass container, pill shape, send glyph is a
  // bolt so sending reads as "striking the tube".
  composer: {
    material: "neon-glass",
    sendGlyph: "⚡",
    shape: "pill",
  },

  // 16/17 Shop + Product cards · glass cards (bar-top wet glow) with
  // snap scroll (crisp, precise · the stage is quiet enough to want
  // it) + float framing (products appear suspended, lit from behind).
  shop: {
    cardStyle: "glass",
    scrollFeel: "snap",
    productFraming: "float",
  },

  // 23 Ambient · the Midnight signature exactly as approved:
  // neon-flicker (scattered tube pulses) + rain-streak (rain on the
  // glass outside) + sparkles (fine saturated highlights catching the
  // tubes). Density dense to carry the night atmosphere.
  ambient: {
    density: "dense",
    families: ["neon-flicker", "rain-streak", "sparkles"],
  },
};
