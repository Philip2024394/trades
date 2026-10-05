// src/app/nex-native/chat-standard/packages/ocean.package.ts
//
// Phase 2A.0 · Ocean Theme Package · greenfield pilot.
//
// Founder creative seed:
//   name/concept  : Ocean · underwater · peaceful · premium
//   personality   : drift (float · ripple · shimmer)
//   colours       : deep blue / turquoise / white / aqua glow
//   intro         : scripted-animation placeholder (video asset
//                   supplied later by founder; the engine renders
//                   a programmatic drift intro in the meantime)
//   wallpaper     : CSS-generated deep-blue gradient placeholder
//                   (real wallpaper asset supplied later)
//
// Everything else below is Ocean's visual-identity vocabulary. The
// engine translates these tokens into concrete treatments. If any
// token is removed from this file, the engine still produces a
// valid Ocean treatment — just slightly less rich. That's the
// vocabulary-not-checklist rule in action.

import type { ThemePackage } from "../_engine/types";

export const OCEAN_PACKAGE: ThemePackage = {
  identity: {
    id: "ocean",
    name: "Ocean",
    tagline: "Peaceful underwater · drift · shimmer",
    conceptOneLine: "Ocean · underwater · peaceful · premium",
  },
  colours: {
    primary: "#2E90B5", // deep blue
    secondary: "#4FC3DC", // turquoise
    highlight: "#E8F7FF", // white foam
    glow: "rgba(130,210,255,0.55)", // aqua glow
    deep: "#0A2535", // abyss
  },
  personality: "drift",

  // 02 Intro · scripted-animation placeholder until founder supplies
  // the real Ocean MP4. Engine's intro resolver returns this; the
  // intro-overlay renders a procedurally-animated drift gradient.
  intro: {
    kind: "standard",
    videoUrl: null,
    scriptedAnimation: "ocean-drift",
    playPolicy: "twice-then-skip",
  },

  // 03 Environment · wallpaper is a CSS gradient placeholder. The
  // acceptance test is "remove the wallpaper, does it still feel
  // Ocean?" — so this slot is explicitly minimal. The theme must
  // feel Ocean WITHOUT this.
  wallpaperUrl: null, // engine falls back to its own layered CSS gradient
  wallpaperScrim: "default",

  // 06-09 Bubbles · the single most important Ocean choice.
  bubbles: {
    shape: "water-droplet",
    material: "water",
    motion: {
      entrance: "drift-in",
      idle: "shimmer",
      reaction: "ripple-in",
      departure: "dissolve",
    },
    effects: {
      sendFlicker: false,
      receiveRipple: true,
      sparkleOnSend: false,
      bubbleTrailOnSend: true, // Ocean-exclusive: rising bubble trail
    },
  },

  // 10 Emoji · water-ring framing so every emoji feels like it sits
  // in a tiny droplet of its own.
  emoji: {
    tileSize: 38,
    framingKind: "water-ring",
    bounceOnPick: false,
    colorShift: null,
  },

  // 11 Stickers · engine generates SVG stickers from these keywords.
  // No external asset dependency; the Ocean sticker set appears
  // immediately with no uploads.
  stickers: {
    conceptKeywords: ["fish", "shell", "octopus", "wave", "treasure", "diver", "bubble"],
  },

  // 12 Reactions · ocean-themed glyphs instead of the generic set.
  reactions: {
    glyphs: ["💙", "🫧", "🐚", "🐟", "✨", "🐙"],
  },

  // 13 Composer · a "water" shape (asymmetric soft curve) + bubble
  // send glyph so the composer feels integrated with the sea.
  composer: {
    material: "water",
    sendGlyph: "🫧",
    shape: "water",
  },

  // 16/17 Shop + Product cards · driftwood-board treatment with
  // slow "current" scroll feel and buoy framing so products feel
  // like they belong underwater.
  shop: {
    cardStyle: "driftwood-board",
    scrollFeel: "current",
    productFraming: "buoy",
  },

  // 23 Ambient animation · dense bubbles-rising + light-rays, plus a
  // thin mist layer for depth-haze. Mist stays sparse (engine clamps to
  // reasonable count) so the water never looks murky — it just suggests
  // the far distance fading into deeper blue.
  ambient: {
    density: "dense",
    families: ["bubbles-rising", "light-rays", "mist"],
  },
};
