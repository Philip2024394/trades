// src/lib/nex-native/chat-render/chrome/bubbles/index.ts
//
// The DEFAULT chrome · classic Portrait Bloom bubbles.
// ------------------------------------------------------------------
// Phase 1 · this chrome IS today's PortraitBloomShell. Re-exporting
// preserves behaviour bit-for-bit while letting the registry own the
// resolution boundary. Zero regression risk.
//
// Phase 2+ · when we lift the bubble renderer out of the shell into
// this folder, this file becomes the folder's public entrypoint and
// the shell becomes a thin composition of CORE + this chrome.

import { PortraitBloomShell } from "@/app/nex-native/chat/_portrait-bloom-shell";
import type { ChromeSet } from "../../contract";

export const bubblesChrome: ChromeSet = {
  id: "bubbles",
  label: "Portrait Bloom · bubbles",
  PeerChatShell: PortraitBloomShell,
};
