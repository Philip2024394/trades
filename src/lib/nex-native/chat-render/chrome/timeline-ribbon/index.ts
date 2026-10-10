// src/lib/nex-native/chat-render/chrome/timeline-ribbon/index.ts
//
// Timeline Ribbon chrome · Pink Dream (Theme 4) · Phase 3 stub.
// ------------------------------------------------------------------
// Sealed spec: /nex-native/themes/pink-dream
//
// Phase 1 · delegates to the bubbles chrome so every existing
// Pink-Dream user's peer chat still renders exactly as it does
// today. Zero regression until Phase 3 lifts the timeline-ribbon
// renderer from the preview page into a real chrome implementation.

import type { ChromeSet } from "../../contract";
import { bubblesChrome } from "../bubbles";

export const timelineRibbonChrome: ChromeSet = {
  ...bubblesChrome,
  id: "timeline_ribbon",
  label:
    "Pink Dream · timeline ribbon (Phase 3 stub · delegates to bubbles)",
};
