"use client";

// src/components/nexapp/hud/NexFrameViewport.tsx
//
// NEX Frame Viewport · CANONICAL · Philip 2026-08-27.
//
// The ONE reusable wrapper for content that must live inside the transparent
// inner display area of the NEX frame. Every NEX page places its content
// inside this component. Do not re-implement placement per page.
//
// Positioning is bezel-scoped: fixed at the bezel wrapper, then insets to
// the measured inner viewport (see NEX_INNER_VIEWPORT in geometry.ts).
//
// USAGE
//
//   <NexFrameViewport>
//     <video src="..." style={{ width: "100%", height: "100%", objectFit: "cover" }} />
//   </NexFrameViewport>
//
//   <NexFrameViewport pointerEvents="auto" onBackdropClick={onClose}>
//     ...swipable content...
//   </NexFrameViewport>
//
// Content is edge-to-edge inside the viewport. If you want padding, add it
// on the child. NEVER extend outside these bounds — the frame artwork owns
// everything outside.

import type { CSSProperties, ReactNode } from "react";
import { BEZEL_W_CSS, NEX_INNER_VIEWPORT_CSS } from "./geometry";

interface Props {
  children: ReactNode;
  /** Backdrop background (behind children, fills the viewport). Default black. */
  background?: string;
  /** Optional handler for taps on the viewport area (not the children). */
  onBackdropClick?: () => void;
  /** zIndex of the viewport itself. Default 15 (matches Mascot stage). */
  zIndex?: number;
  /** Extra style override for the OUTER bezel wrapper (rare). */
  bezelStyle?: CSSProperties;
  /** Extra style override for the INNER viewport (rare). */
  viewportStyle?: CSSProperties;
}

// Bezel-scoped horizontal gutter · matches NexHudFrame + NexMascotStage math.
const H_GUTTER = `max(0px, calc((100dvw - ${BEZEL_W_CSS}) / 2))`;

export function NexFrameViewport({
  children,
  background = "#000",
  onBackdropClick,
  zIndex = 15,
  bezelStyle,
  viewportStyle,
}: Props) {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        right: H_GUTTER,
        width: BEZEL_W_CSS,
        height: "100dvh",
        overflow: "hidden",
        zIndex,
        pointerEvents: "none",   // let bezel image + rail buttons stay tappable outside viewport
        ...bezelStyle,
      }}
    >
      {/* Inner viewport · fixed to the measured transparent bounds of the
          frame · content lives edge-to-edge here · frame artwork paints on
          top by virtue of higher z-index in NexHudFrame. */}
      <div
        onClick={onBackdropClick}
        style={{
          position: "absolute",
          top:    NEX_INNER_VIEWPORT_CSS.top,
          bottom: NEX_INNER_VIEWPORT_CSS.bottom,
          left:   NEX_INNER_VIEWPORT_CSS.left,
          right:  NEX_INNER_VIEWPORT_CSS.right,
          background,
          overflow: "hidden",
          pointerEvents: "auto",
          ...viewportStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
}
