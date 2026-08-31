// Preview mockup · Philip 2026-08-29 v2.
//
// Demonstrates: full-height background sitting inside the outer phone edge,
// with a horizontal row of glass landscape buttons continuously sliding
// right → left. Buttons enter from under the right frame edge, glide
// slowly across the viewport, disappear under the left frame edge, and
// loop. The NEX phone frame overlays everything so both left and right
// sides of the buttons are naturally clipped by the frame silhouette.
//
// Visit /nexapp/slider-sample to view.

"use client";

import React from "react";

const SLIDER_BG_URL =
  "https://ik.imagekit.io/ctlxgvqcm/ChatGPT%20Image%20Aug%2029,%202026,%2003_15_20%20AM.png";

const FRAME_SRC = "/nex/hud-frame-v12.png";
// Presentation aspect · matches BEZEL_METAL in geometry.ts (850×1850).
const BEZEL_W  = "min(100dvw, calc(100dvh * 850 / 1850))";
const BEZEL_H  = "min(100dvh, calc(100dvw * 1850 / 850))";
const H_GUTTER = `max(0px, calc((100dvw - ${BEZEL_W}) / 2))`;
const V_GUTTER = `max(0px, calc((100dvh - ${BEZEL_H}) / 2))`;

// Duplicated so the marquee has enough content to loop seamlessly.
const SECTIONS = [
  "Feed", "Businesses", "Marketplace", "Mobility",
  "Rentals", "LIVE", "Near me", "Events", "Places",
];
const MARQUEE = [...SECTIONS, ...SECTIONS]; // loop content

export default function SliderSamplePage() {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "#050505",
      overflow: "hidden",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    }}>
      {/* ── BEZEL ENVELOPE · everything inside is clipped to the phone silhouette ── */}
      <div style={{
        position: "absolute",
        top:    V_GUTTER,
        left:   H_GUTTER,
        width:  BEZEL_W,
        height: BEZEL_H,
        overflow: "hidden",
        zIndex: 10,
      }}>
        {/* Slider background image · inside the phone edge · full bezel */}
        <div style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url('${SLIDER_BG_URL}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}>
          {/* Subtle dark wash so glass reads cleanly */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(90deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.35) 100%)",
          }} />

          {/* ── MARQUEE TRACK · horizontal row · translates right → left ──
              The track lives inside the frame's inner content chamber
              (top/bottom clipped by the frame chrome, left/right clipped
              by the outer bezel silhouette). Buttons in a flex row · the
              whole row animates translateX from +100% → -100% on loop, so
              buttons enter from under the right frame edge, cross the
              viewport, and disappear under the left frame edge. */}
          <div style={{
            position: "absolute",
            top:    "42%",     // centered vertically in the viewport
            height: "88px",
            left:   0,
            right:  0,
            overflow: "hidden",  // extra safety · frame will clip too
            display: "flex",
            alignItems: "center",
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              padding: "0 24px",
              whiteSpace: "nowrap",
              animation: "nex-marquee-left 18s linear infinite",
              willChange: "transform",
            }}>
              {MARQUEE.map((label, i) => (
                <button
                  key={`${label}-${i}`}
                  style={{
                    flex: "0 0 auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "16px 32px",
                    minWidth: 180,
                    minHeight: 56,
                    background: "rgba(255,255,255,0.10)",
                    backdropFilter: "blur(20px) saturate(1.4)",
                    WebkitBackdropFilter: "blur(20px) saturate(1.4)",
                    border: "1px solid rgba(255,255,255,0.24)",
                    borderRadius: 16,
                    boxShadow: `
                      inset 0 1px 0 rgba(255,255,255,0.28),
                      0 8px 22px rgba(0,0,0,0.35)
                    `,
                    color: "rgba(248,249,252,1)",
                    fontFamily: "inherit",
                    fontSize: 17,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    textAlign: "center",
                    cursor: "pointer",
                    textShadow: "0 1px 2px rgba(0,0,0,0.55)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Static caption above the marquee · so Philip can watch the
              row slide underneath it. */}
          <div style={{
            position: "absolute",
            top: "30%",
            left: 0, right: 0,
            textAlign: "center",
            color: "rgba(245,246,250,0.95)",
            fontSize: 12, letterSpacing: 2, fontWeight: 800,
            textTransform: "uppercase",
            textShadow: "0 1px 2px rgba(0,0,0,0.7)",
            pointerEvents: "none",
          }}>
            NEX · glass slider · right → left
          </div>
        </div>
      </div>

      {/* ── FRAME · sits ABOVE everything · clips slider + buttons to phone silhouette ── */}
      <img
        src={FRAME_SRC}
        alt=""
        aria-hidden
        style={{
          position: "absolute",
          top:    V_GUTTER,
          left:   H_GUTTER,
          width:  BEZEL_W,
          height: BEZEL_H,
          objectFit: "fill",
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 20,
        }}
      />

      {/* Route label · so Philip knows which page this is */}
      <div style={{
        position: "absolute",
        top: 12, left: 12,
        padding: "4px 10px",
        borderRadius: 6,
        background: "rgba(20,22,26,0.85)",
        border: "1px solid rgba(249,115,22,0.45)",
        color: "rgba(249,115,22,0.95)",
        fontSize: 10, fontWeight: 800, letterSpacing: 1.5,
        textTransform: "uppercase",
        zIndex: 100,
        pointerEvents: "none",
      }}>
        NEX Slider Preview · /nexapp/slider-sample
      </div>

      <style jsx>{`
        @keyframes nex-marquee-left {
          /* Enter from off-screen right, cross the viewport, exit off-screen left */
          from { transform: translateX(100%); }
          to   { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
