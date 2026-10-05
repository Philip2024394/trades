// src/app/nex-native/chat-standard/packages/_test-fixtures/bundle-c-fixture.package.ts
//
// EXTENSION BATCH 001 · TEST FIXTURE · BUNDLE C
//
// NOT a production world. Exists only to visually verify that the
// Bundle C general engine capabilities (typography tokens, marble-top
// card style, saucer-under-glass product framing, French sticker
// renderers) resolve and render correctly.
//
// Do NOT use this package as the basis for a production world. The
// production French Café world remains unauthorised.

import type { ThemePackage } from "../../_engine/types";

export const BUNDLE_C_FIXTURE: ThemePackage = {
  identity: {
    id: "_test-bundle-c",
    name: "Bundle C fixture",
    tagline: "Capability verification only",
    conceptOneLine:
      "test fixture · typography + marble-top + saucer-under-glass + French stickers",
  },
  colours: {
    primary: "#A6734A", // antique rose-wood
    secondary: "#F2E4CF", // cream
    highlight: "#F8ECD5", // porcelain
    glow: "rgba(230,195,115,0.7)", // gold-leaf tint
    deep: "#2E1E12",
  },
  personality: "warm",
  typography: {
    // Serif stack for the elegant Parisian feel. If none of the names
    // resolve in the client, the stack falls through to the browser's
    // generic serif · still elegant.
    fontFamily: "'Playfair Display', 'Didot', 'Bodoni Moda', Georgia, serif",
    headingWeight: 700,
    bodyWeight: 500,
    letterSpacing: "0.015em",
  },
  wallpaperUrl: null,
  wallpaperScrim: "default",
  bubbles: {
    shape: "pill",
    material: "parchment",
  },
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
  shop: {
    cardStyle: "marble-top",
    productFraming: "saucer-under-glass",
    scrollFeel: "momentum",
  },
  ambient: {
    density: "medium",
    families: ["sparkles", "warm-glow-pulse", "mist"],
  },
};
