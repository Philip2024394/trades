"use client";

// src/app/nex-native/cover/preview/_phone-frame.tsx
//
// Phone-frame wrapper for cover previews · Founder-set 2026-09-30.
// -------------------------------------------------------------------
// The doctrine says covers are mobile-first premium products, so
// desktop preview must SHOW them at app-size — never stretched to
// a laptop's full width. This wrapper:
//
//   · On mobile (< 768px viewport) · frame is invisible, cover fills
//     the viewport as it would on a real phone
//   · On desktop · cover renders inside a phone-shaped device
//     silhouette (~390px wide, iPhone-15 proportions) centered on
//     the page, on a dim backdrop. Feels like a designer's mockup.
//
// The child is the ENTIRE cover surface (theme skin + layout). We
// clip to the phone silhouette so wallpaper + sticky bars stay
// contained inside the frame.
//
// One toggle in the top-left · "Full width" · flips off the frame
// for the current view if the visitor wants to inspect at true
// scale. Preference not persisted (preview surface only).

import * as React from "react";

const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;
// Founder direction 2026-09-30 · phone chassis pure black + stage
// backdrop pure black so the device silhouette reads as a real black
// phone on a black stage.
const NEX_STAGE_BG = "#000000";
const PHONE_CHASSIS = "#000000";

export function PhoneFrame({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <>
      <style>{`
        @keyframes phone-glow {
          0%, 100% { box-shadow: 0 24px 60px rgba(0,0,0,0.7), 0 0 42px rgba(255,255,255,0.06); }
          50%      { box-shadow: 0 24px 60px rgba(0,0,0,0.7), 0 0 68px rgba(255,255,255,0.1); }
        }
        /* Hide the cover's inner scrollbar on every layout · scroll
           still works (touch + wheel + keyboard), just no visible rail. */
        [data-nex-phone-scroll] { scrollbar-width: none; -ms-overflow-style: none; }
        [data-nex-phone-scroll]::-webkit-scrollbar { width: 0; height: 0; display: none; }
        /* Mobile · frame collapses entirely, cover fills viewport */
        @media (max-width: 767px) {
          [data-nex-phone-frame] {
            padding: 0 !important;
            min-height: 100dvh !important;
            background: transparent !important;
          }
          [data-nex-phone-frame] [data-nex-phone-device] {
            width: 100% !important;
            height: auto !important;
            min-height: 100dvh !important;
            max-width: none !important;
            border-radius: 0 !important;
            border: none !important;
            box-shadow: none !important;
            animation: none !important;
          }
          [data-nex-phone-frame] [data-nex-phone-notch] { display: none !important; }
          [data-nex-phone-frame] [data-nex-phone-home]  { display: none !important; }
        }
      `}</style>

      <div
        data-nex-phone-frame
        style={{
          minHeight: "100dvh",
          background: NEX_STAGE_BG,
          padding: "48px 20px 40px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 14,
        }}
      >
        <div
          data-nex-phone-device
          style={{
            position: "relative",
            width: PHONE_WIDTH,
            height: PHONE_HEIGHT,
            minHeight: PHONE_HEIGHT,
            maxWidth: PHONE_WIDTH,
            borderRadius: 46,
            border: `10px solid ${PHONE_CHASSIS}`,
            outline: "1px solid rgba(255,255,255,0.08)",
            overflow: "hidden",
            background: "#000",
            boxShadow: "0 24px 60px rgba(0,0,0,0.7), 0 0 42px rgba(255,255,255,0.06)",
            animation: "phone-glow 6s ease-in-out infinite",
          }}
        >
          <div
            data-nex-phone-notch
            aria-hidden
            style={{
              position: "absolute",
              top: 6,
              left: "50%",
              transform: "translateX(-50%)",
              width: 118,
              height: 32,
              borderRadius: 22,
              background: "#000",
              zIndex: 200,
              boxShadow: "0 2px 4px rgba(0,0,0,0.35) inset",
            }}
          />

          {/* The actual cover surface · scrolls within the frame.
              Scrollbar hidden via [data-nex-phone-scroll] rules above. */}
          <div
            data-nex-phone-scroll
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              overflowY: "auto",
              overflowX: "hidden",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {children}
          </div>

          <div
            data-nex-phone-home
            aria-hidden
            style={{
              position: "absolute",
              bottom: 6,
              left: "50%",
              transform: "translateX(-50%)",
              width: 130,
              height: 4,
              borderRadius: 999,
              background: "rgba(255,255,255,0.55)",
              zIndex: 200,
            }}
          />
        </div>
      </div>
    </>
  );
}
