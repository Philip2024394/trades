// src/lib/nex-native/chat-render/chrome/terminal/index.ts
//
// Terminal chrome · Cyber Grid (Theme 5) · PHASE 2 SHIPPING.
// ------------------------------------------------------------------
// Sealed spec: /nex-native/themes/cyber-grid
//   · monospace font throughout
//   · `> <name> [HH:MM]: <body>` prompt-shaped rows
//   · block cursor composer
//   · terminal-styled shop-slider modal
//
// Phase 2 · shipping: this chrome now renders a real terminal shell
// on peer chat when the peer's theme has layout_style='terminal'.
// See ./PeerChatShell.tsx for the implementation + the doctrine
// notes on which features are deferred to Phase 2b (reactions,
// delete, reply UI, attachment upload, safe-trade, product inquiry).
//
// If a Cyber Grid user needs a deferred feature, they should
// temporarily switch to a bubbles-based theme.

import type { ChromeSet } from "../../contract";
import { TerminalPeerChatShell } from "./PeerChatShell";

export const terminalChrome: ChromeSet = {
  id: "terminal",
  label: "Cyber Grid · terminal log",
  PeerChatShell: TerminalPeerChatShell,
};
