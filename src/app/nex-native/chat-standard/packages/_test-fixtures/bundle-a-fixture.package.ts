// src/app/nex-native/chat-standard/packages/_test-fixtures/bundle-a-fixture.package.ts
//
// EXTENSION BATCH 001 · TEST FIXTURE · BUNDLE A
//
// NOT a production world. Exists only to visually verify that the
// Bundle A general engine capabilities (sun-dapple + pollen-float
// ambient families + Botanical sticker renderers) resolve and render
// correctly through the sealed Theme Engine.
//
// Do NOT use this package as the basis for a production world. The
// production Botanical Café world remains unauthorised and will be
// built as a separate package once Batch 001 world construction is
// authorised.

import type { ThemePackage } from "../../_engine/types";

export const BUNDLE_A_FIXTURE: ThemePackage = {
  identity: {
    id: "_test-bundle-a",
    name: "Bundle A fixture",
    tagline: "Capability verification only",
    conceptOneLine:
      "test fixture · sun-dapple + pollen-float + Botanical stickers",
  },
  colours: {
    primary: "#3F8A4F",
    secondary: "#8DBF6F",
    highlight: "#F7E7B2",
    glow: "rgba(255,220,120,0.78)",
    deep: "#1F3A24",
  },
  personality: "sway",
  wallpaperUrl: null,
  wallpaperScrim: "default",
  bubbles: {
    shape: "domed",
    material: "ceramic",
  },
  stickers: {
    conceptKeywords: ["fern", "plant-pot", "teacup", "honey-jar", "leaf"],
  },
  ambient: {
    density: "dense",
    families: ["sun-dapple", "pollen-float", "sparkles"],
  },
};
