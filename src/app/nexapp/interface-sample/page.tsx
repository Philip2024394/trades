// Preview route · Philip 2026-08-29.
//
// Thin wrapper around <NexInterfaceHero /> so the composed interface can
// be viewed at /nexapp/interface-sample without opening the drawer. The
// same component powers the Discover room's activated background.

"use client";

import React from "react";
import { NexInterfaceHero } from "@/components/nexapp/NexInterfaceHero";

const FRAME_SRC = "/nex/hud-frame-master.png";
const BEZEL_W  = "min(100dvw, calc(100dvh * 850 / 1850))";
const BEZEL_H  = "min(100dvh, calc(100dvw * 1850 / 850))";
const H_GUTTER = `max(0px, calc((100dvw - ${BEZEL_W}) / 2))`;
const V_GUTTER = `max(0px, calc((100dvh - ${BEZEL_H}) / 2))`;

export default function InterfaceSamplePage() {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "#020306",
      overflow: "hidden",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    }}>
      {/* Bezel envelope · clips interface hero to the phone silhouette */}
      <div style={{
        position: "absolute",
        top:    V_GUTTER,
        left:   H_GUTTER,
        width:  BEZEL_W,
        height: BEZEL_H,
        overflow: "hidden",
        zIndex: 10,
      }}>
        <NexInterfaceHero shiftXpx={-15} />
      </div>

      {/* Phone frame · above the hero · clips to silhouette */}
      <img
        src={FRAME_SRC}
        alt=""
        aria-hidden
        style={{
          position: "absolute",
          top: V_GUTTER, left: H_GUTTER,
          width: BEZEL_W, height: BEZEL_H,
          objectFit: "fill",
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 20,
        }}
      />

      <div style={{
        position: "absolute", top: 12, left: 12,
        padding: "4px 10px", borderRadius: 6,
        background: "rgba(20,22,26,0.85)",
        border: "1px solid rgba(249, 115, 22, 0.45)",
        color: "rgba(254, 215, 170, 0.95)",
        fontSize: 10, fontWeight: 800, letterSpacing: 1.5,
        textTransform: "uppercase",
        zIndex: 100, pointerEvents: "none",
      }}>
        NEX Interface Preview · /nexapp/interface-sample
      </div>
    </div>
  );
}
