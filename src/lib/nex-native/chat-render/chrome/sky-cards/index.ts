// src/lib/nex-native/chat-render/chrome/sky-cards/index.ts
//
// Sky Cards chrome · Theme 1 (Night Sky) · Phase 3 stub.
// ------------------------------------------------------------------
// Sealed spec: /nex-native/themes/theme-1
//
// Phase 1 · delegates to the bubbles chrome so every existing
// Theme-1 user's peer chat still renders exactly as it does today.
// Zero regression until Phase 3 lifts the sky-cards renderer from
// the preview page into a real chrome implementation.
//
// Doctrine: this file OWNS Theme 1's runtime rendering when Phase 3
// lands. Do not modify Theme 1's runtime behaviour from any other
// file after that lift — go through this chrome.

import type { ChromeSet } from "../../contract";
import { bubblesChrome } from "../bubbles";

export const skyCardsChrome: ChromeSet = {
  ...bubblesChrome,
  id: "sky_cards",
  label: "Night Sky · cloud panels (Phase 3 stub · delegates to bubbles)",
};
