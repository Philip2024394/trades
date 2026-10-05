// src/app/nex-native/chat-standard/packages/botanical-cafe.package.ts
//
// Batch 001 · World 1 · Botanical Café.
//
// Founder creative seed:
//   intent        : fresh · natural · beautiful
//   feel          : a sunlit greenhouse café — ceramic cups on a long
//                   wooden counter, afternoon light passing through
//                   foliage, pollen catching the beam, slow drift of
//                   falling leaves at the edges
//   personality   : sway (gentle wind tilt on entrance)
//   bubbles       : domed vessel · matte-glazed ceramic
//   colours       : leaf green / fresh young-leaf / cream-daylight /
//                   honey-sun glow / woodland shade
//   intro         : scripted-animation placeholder · twice-then-skip
//   wallpaper     : none (engine's deep green gradient + ambient layer
//                   carry the atmosphere · acceptance test applies)
//
// Important: this file contains CREATIVE decisions only. The Theme
// Engine does NOT branch on "botanical-cafe". Every token below is a
// general engine vocabulary item. If you delete this file, nothing in
// the engine breaks — Botanical Café simply stops existing.

import type { ThemePackage } from "../_engine/types";

export const BOTANICAL_CAFE_PACKAGE: ThemePackage = {
  identity: {
    id: "botanical-cafe",
    name: "Botanical Café",
    tagline: "Sunlit greenhouse · ceramic + living plants",
    conceptOneLine:
      "Botanical Café · fresh · natural · beautiful",
  },
  colours: {
    primary: "#3F7A4A", // deep leaf green
    secondary: "#86B46A", // young fresh leaf
    highlight: "#F5EBCC", // afternoon daylight through foliage (cream)
    glow: "rgba(240, 215, 140, 0.60)", // honey-sun through canopy
    deep: "#17281A", // woodland shade
  },
  personality: "sway",

  // 02 Intro · scripted-animation placeholder until a real intro video
  // is supplied by the business owner (standard theme intro). Business
  // Introduction (paid, per upload) overrides this when active via the
  // engine's resolveIntro.
  intro: {
    kind: "standard",
    videoUrl: null,
    scriptedAnimation: "botanical-sun-filter",
    playPolicy: "twice-then-skip",
  },

  // 03 Environment · no wallpaper · the engine's deep-tinted gradient
  // and ambient layer carry the greenhouse atmosphere.
  wallpaperUrl: null,
  wallpaperScrim: "default",

  // 06-09 Bubbles · "ceramic" matte-glazed vessel + "domed" shape so
  // messages feel like plant pots on a counter. The sway personality's
  // tilted entrance reads like a leaf settling onto the shelf. We
  // override the (null) reaction to a warm glow so a message landing
  // feels acknowledged without disturbing the calm.
  bubbles: {
    shape: "domed",
    material: "ceramic",
    motion: {
      reaction: "warm-glow-react",
    },
    effects: {
      sendFlicker: false,
      receiveRipple: false,
      sparkleOnSend: true, // honey-sun sparkle catching the pot's rim
      bubbleTrailOnSend: false,
    },
  },

  // 10 Emoji · card framing with a warm backdrop so each emoji feels
  // placed on a glazed tile.
  emoji: {
    tileSize: 38,
    framingKind: "card",
    bounceOnPick: false,
    colorShift: null,
  },

  // 11 Stickers · the Botanical sticker vocabulary approved in Engine
  // Extension Batch 001. Teacup included because a greenhouse café
  // still serves tea.
  stickers: {
    conceptKeywords: [
      "fern",
      "plant-pot",
      "teacup",
      "honey-jar",
      "leaf",
      "croissant",
    ],
  },

  // 12 Reactions · botanical / warm-afternoon glyph set.
  reactions: {
    glyphs: ["🌿", "🌱", "🍯", "🫖", "☀️", "🌼"],
  },

  // 13 Composer · ceramic material + rounded shape so the composer
  // reads as another vessel on the counter. Send glyph is a small
  // leaf — this is a greenhouse café, we send with a leaf.
  composer: {
    material: "ceramic",
    sendGlyph: "🌿",
    shape: "rounded",
  },

  // 16/17 Shop + Product cards · ceramic-tile shop treatment (glazed
  // tabletop) with momentum scroll + coaster framing (round warm
  // discs under each product · like a saucer under a potted herb).
  shop: {
    cardStyle: "ceramic-tile",
    scrollFeel: "momentum",
    productFraming: "coaster",
  },

  // 23 Ambient · the Botanical signature. The sway personality's
  // default is ["leaves-falling", "sparkles"]; we extend it with the
  // two new Extension Batch 001 families so the stage is lit by
  // dappled afternoon sun and pollen drifts through the light.
  //
  // sun-dapple → soft moving patches of light suggest beams through
  //              leaves overhead
  // pollen-float → warm tinted particles catch the beam as they rise
  // leaves-falling → occasional falling leaf at the edges reinforces
  //                  that we are indoors with the greenhouse open
  // sparkles → fine light-catching motes keep the whole stage alive
  ambient: {
    density: "dense",
    families: ["sun-dapple", "pollen-float", "leaves-falling", "sparkles"],
  },
};
