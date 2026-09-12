"use client";

// src/components/nex-app/home/HomeConsole.tsx
//
// NEX Frameless Recovery · Slice 1 · Shared dark console chrome
// Philip 2026-09-07
//
// The bottom "console" shell that hosts the recovered NexComposer +
// NexKeypad. Replaces the SHARED CONSOLE WRAPPER that NexAppShell used
// to provide inside the phone frame (see NexKeypad.tsx:435 comment).
//
// Frameless contract:
//   · position:fixed at the bottom of the viewport
//   · safe-area aware (padding-bottom = safe-area-inset-bottom)
//   · full-width edge-to-edge
//   · dark graphite bg + subtle blur + soft rim highlight (no phone frame)
//   · rounded top rim so the composer pill visually belongs to the console
//   · z-index above the workspace but below floating panels (kebab)
//
// Layout:
//   composer sits at top of the console (always visible)
//   keypad slides in below when keypadOpen is true
//
// The console is presentational only · state lives in the parent client.

import type { ReactNode } from "react";

export type HomeConsoleProps = {
  composer: ReactNode;
  keypad?: ReactNode;
  keypadOpen: boolean;
};

export function HomeConsole({ composer, keypad, keypadOpen }: HomeConsoleProps) {
  return (
    <div
      data-testid="nex-home-console"
      data-keypad-open={keypadOpen}
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 20,
        // Dark console chrome · matches the phone-frame footer's dark
        // treatment but built for the frameless viewport. Rounded top
        // rim so the composer pill reads as belonging to the console
        // rather than floating above the page.
        background: "linear-gradient(180deg, rgba(10, 12, 18, 0.94) 0%, rgba(6, 8, 12, 0.98) 100%)",
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        boxShadow: "0 -6px 24px rgba(0, 0, 0, 0.35)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        transition: "min-height 260ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* Composer zone · always visible · fixed height so the keypad
          can slide in below without pushing the composer around. */}
      <div
        style={{
          position: "relative",
          height: 64,
          display: "flex",
          alignItems: "center",
          paddingTop: 6,
          paddingBottom: 2,
        }}
      >
        {composer}
      </div>

      {/* Keypad zone · rendered only when the composer requests it. The
          keypad component itself owns its slide-up animation (see
          NexKeypad.tsx keyframes nex-keypad-in). Kept edge-to-edge to
          match the standard mobile keyboard treatment. */}
      {keypadOpen && keypad ? (
        <div
          data-testid="nex-home-keypad-zone"
          style={{
            width: "100%",
            paddingLeft: 4,
            paddingRight: 4,
          }}
        >
          {keypad}
        </div>
      ) : null}
    </div>
  );
}
