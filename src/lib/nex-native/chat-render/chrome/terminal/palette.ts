// src/lib/nex-native/chat-render/chrome/terminal/palette.ts
//
// Cyber Grid · terminal chrome · shared palette + fonts.
// -------------------------------------------------------------------
// One source of truth for every terminal-styled surface:
//   · chat-render/chrome/terminal/PeerChatShell.tsx     (runtime)
//   · app/nex-native/themes/cyber-grid/page.tsx         (preview)
//   · app/nex-native/themes/cyber-grid/product/page.tsx (product page)
//
// Change here → change everywhere. Sealed 2026-09-29.

export const TERMINAL_PALETTE = {
  bg: "#050b09",
  panelDim: "rgba(94,120,102,0.9)",
  bannerRule: "rgba(60,90,72,0.55)",
  mariaName: "#5FED8B",
  philipName: "#FF9142",
  timestamp: "#5F7A67",
  chevron: "#3E9F63",
  body: "#E7ECE4",
  cursor: "#4CFF7A",
  glow: "rgba(76,255,122,0.16)",
} as const;

export const TERMINAL_MONO =
  "'Cascadia Mono', 'JetBrains Mono', 'IBM Plex Mono', 'Fira Code', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace";
