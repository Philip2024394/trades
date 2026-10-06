// src/app/nex-native/chat-standard/packages/food.package.ts
//
// Food Theme Package · sealed 2026-10-06.
//
// Founder creative seed:
//   name/concept  : Food · grilled · fire · warmth · premium
//   personality   : warm (ember flicker · heat lift · smoke drift)
//   colours       : ember orange / char brown / cream flame / warm glow
//                   / charcoal deep
//   intro         : skewers + steak over a grill (sealed asset supplied
//                   2026-10-06 · lives in public/nex-themes/
//                   food-intro.mp4). No scripted fallback this round ·
//                   the engine renders a plain fade if the video can't
//                   play.
//   wallpaper     : grilled food plate (sealed asset supplied 2026-10-06
//                   · lives in public/nex-themes/food-grill.png). The
//                   engine falls back to its layered CSS gradient when
//                   the wallpaper is absent.
//
// Category assignment:
//   Lives in the "explore" category per the sealed Step 1A doctrine
//   ("A real category is only added when a genuine family of Worlds
//    warrants it. Do not invent categories to fill slots.") Food is
//   currently a single World · a dedicated "food" category can be
//   created later when more food Worlds exist (grill · smokehouse ·
//   bakery · ramen etc.) in a separate founder authorisation.

import type { ThemePackage } from "../_engine/types";

export const FOOD_PACKAGE: ThemePackage = {
  identity: {
    id: "food",
    name: "Food",
    tagline: "Grilled · fire · warmth",
    conceptOneLine: "Food · grilled · fire · warmth · premium",
    categoryId: "explore",
  },
  colours: {
    primary: "#D97845", // ember orange · the flame kissing the meat
    secondary: "#8B4513", // charred saddle brown
    highlight: "#FFE8B5", // cream flame highlight
    glow: "rgba(255,150,60,0.60)", // warm fire glow
    deep: "#1A0F08", // charcoal ash deep
  },
  personality: "warm",

  // 02 Intro · grilling footage (sealed 2026-10-06). The engine
  // prefers videoUrl · no scripted fallback declared this round ·
  // if the MP4 fails to load the engine's intro resolver still
  // renders a clean fade into the chat.
  intro: {
    kind: "standard",
    videoUrl: "/nex-themes/food-intro.mp4",
    scriptedAnimation: null,
    playPolicy: "twice-then-skip",
  },

  // 03 Environment · grilled food plate wallpaper (sealed 2026-10-06).
  // The engine falls back to its layered CSS gradient when wallpaperUrl
  // is null.
  wallpaperUrl: "/nex-themes/food-grill.png",
  wallpaperScrim: "default",

  // 06-09 Bubbles · ceramic plate feel with warm-liquid interior ·
  // the domed shape reads as "food vessel" without being tied to any
  // one dish.
  bubbles: {
    shape: "domed",
    material: "warm-liquid",
    motion: {
      entrance: "rise-in",
      idle: "warm-breath",
      reaction: "ripple-in",
      departure: "dissolve",
    },
    effects: {
      sendFlicker: true, // ember spark on send
      receiveRipple: true,
      sparkleOnSend: true, // flying ember particles
      bubbleTrailOnSend: false,
    },
  },

  // 10 Emoji · card framing feels like a food menu card.
  emoji: {
    tileSize: 38,
    framingKind: "card",
    bounceOnPick: false,
    colorShift: null,
  },

  // 11 Stickers · engine generates SVG stickers from these keywords.
  stickers: {
    conceptKeywords: [
      "flame",
      "steak",
      "skewer",
      "grill",
      "ember",
      "pepper",
      "chef",
    ],
  },

  // 12 Reactions · food-themed glyphs.
  reactions: {
    glyphs: ["🔥", "🍖", "🥩", "😋", "✨", "👨‍🍳"],
  },

  // 13 Composer · warm-liquid pill + fire send glyph.
  composer: {
    material: "warm-liquid",
    sendGlyph: "🔥",
    shape: "pill",
  },

  // 16/17 Shop + Product cards · menu-card treatment with a
  // gentle current scroll and card framing so dishes read as
  // menu items.
  shop: {
    cardStyle: "menu-card",
    scrollFeel: "current",
    productFraming: "card",
  },

  // 23 Ambient animation · drifting warm embers + a thin smoke band ·
  // sparse enough that food wallpaper remains the hero.
  ambient: {
    density: "medium",
    families: ["embers", "smoke", "warm-glow"],
  },
};
