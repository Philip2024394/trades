// src/app/nex-native/chat-standard/packages/_test-fixtures/bundle-b-fixture.package.ts
//
// EXTENSION BATCH 001 · TEST FIXTURE · BUNDLE B
//
// NOT a production world. Exists only to visually verify that the
// Bundle B general engine capabilities (neon-flicker + rain-streak
// ambient families + neon-glass material + neon personality +
// Midnight sticker renderers) resolve and render correctly.
//
// Do NOT use this package as the basis for a production world. The
// production Midnight Café world remains unauthorised.

import type { ThemePackage } from "../../_engine/types";

export const BUNDLE_B_FIXTURE: ThemePackage = {
  identity: {
    id: "_test-bundle-b",
    name: "Bundle B fixture",
    tagline: "Capability verification only",
    conceptOneLine:
      "test fixture · neon-flicker + rain-streak + neon-glass + neon personality + Midnight stickers",
  },
  colours: {
    primary: "#FF4CB4", // hot magenta tube
    secondary: "#48C8FF", // electric blue tube
    highlight: "#FFC8E8",
    glow: "rgba(255,80,220,0.7)",
    deep: "#0E0E22",
  },
  personality: "neon",
  wallpaperUrl: null,
  wallpaperScrim: "default",
  bubbles: {
    shape: "pill",
    material: "neon-glass",
  },
  stickers: {
    conceptKeywords: [
      "vinyl-record",
      "moon",
      "neon-heart",
      "jazz-note",
      "espresso",
    ],
  },
  ambient: {
    density: "dense",
    families: ["neon-flicker", "rain-streak", "sparkles"],
  },
};
