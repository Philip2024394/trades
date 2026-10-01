"use client";

// src/app/nex-native/_shell.tsx
//
// Wave P1 · NEX Chat Shell (integrated into the /nex-native pilot).
// -----------------------------------------------------------------
// Option A · Founder-authorised integration wave (2026-09-24).
//
// This is a thin CLIENT wrapper around the proven /nex-native pilot
// pages · it does not replace the pilot's Server Component rendering,
// only lifts its already-rendered JSX into the shared NEX HUD shell.
//
// P1 scope · frameless=true (mobile-first shell without phone bezel):
//   · full-viewport background · NEX visual identity
//   · locked to 100dvh · body scrolls inside · no viewport creep
//   · theme applied via prop (defaults to titanium)
//   · no rail / no header icons / no composer slot (P2 wires keypad)
//   · no NEX_MOCK_FRIENDS · no /nexapp workspaces
//
// P2 addition (2026-09-24) · Capabilities menu overlay:
//   · fixed-position "Menu" button visible on all shell surfaces
//   · opens a drawer showing GREEN keypad tiles only
//   · tiles route to /nex-native destinations (no fake buttons)
//   · authority map at docs/nex-p2-tile-authority-map-2026-09-24.md
//
// Preservation contract:
//   · pilot Server Components keep rendering the same JSX as before
//   · Server Actions still bind to the same forms
//   · ConversationPoller still refreshes RSC on new messages
//   · world-scale acceptance harness must remain 12/12 GREEN
//   · each page provides its own <main> (single document landmark)

import React from "react";
import "./nex-native.css";
import { NexHudFrame } from "@/components/nexapp/NexHudFrame";

interface NexNativeShellProps {
  /** Pilot content rendered by the parent Server Component · MUST
   *  include a <main> element for accessibility. The shell is a pure
   *  viewport wrapper and does not provide its own <main>. */
  children: React.ReactNode;
  /** Theme id · one of "titanium" / "pink-metal" / "gold" / "signon" · P3 adds a picker + persistence. */
  themeId?: string;
  /** Legacy prop · kept for callers that pass it. The Capabilities
   *  menu was retired 2026-10-01 (visual clash with Joker theme), so
   *  this flag is now a no-op. Safe to remove from callers. */
  hideCapabilitiesMenu?: boolean;
}

export function NexNativeShell({
  children,
  themeId,
}: NexNativeShellProps) {
  // Slice 7b · applies chat_theme via data attribute for CSS variable hooks.
  // Each nex-native page passes session.account.chat_theme when it has session.
  const chatTheme = themeId && ["default","titanium","pink","gold","night"].includes(themeId)
    ? themeId
    : "default";
  return (
    <NexHudFrame themeId={themeId} frameless>
      <div
        data-nex-chat-theme={chatTheme}
        className="nex-native-root nex-chat-theme-scope"
      >
        {children}
      </div>
    </NexHudFrame>
  );
}
