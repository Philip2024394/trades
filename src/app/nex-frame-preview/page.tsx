// NEX Frame Preview · Philip 2026-08-28.
//
// Utility page · shows the phone frame with:
//   · NO orange lights / accents (fully desaturated · silvery metal)
//   · TRANSPARENT interior viewport (checkerboard behind so the transparency
//     is visible · easy to copy / screenshot the frame silhouette alone)
//   · No chat, rail, orb, composer, or any interior chrome
//
// Use this page to copy the clean bezel shape into other surfaces.

"use client";

import React, { useState } from "react";
import { BEZEL_ASPECT_RATIO, BEZEL_METAL } from "@/components/nexapp/hud/geometry";

const FRAME_SRC = "/nex/hud-frame-v12.png";

async function downloadDesaturatedPng() {
  // Load the raw frame image, redraw through canvas with grayscale filter,
  // export as transparent PNG. Interior alpha is preserved because canvas
  // starts transparent and we only draw the image on top.
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = FRAME_SRC;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("frame image failed to load"));
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.filter = "grayscale(1) brightness(0.85)";
  ctx.drawImage(img, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "nex-frame-no-lights.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Transparent checkerboard so users can clearly see where the interior is
// see-through vs. where the bezel silhouette starts. 16px squares.
const CHECKER_BG =
  "conic-gradient(#e5e7eb 25%, #ffffff 25% 50%, #e5e7eb 50% 75%, #ffffff 75%) 0 0 / 16px 16px";

export default function NexFramePreviewPage() {
  const [busy, setBusy] = useState(false);
  const handleSave = async () => {
    setBusy(true);
    try { await downloadDesaturatedPng(); } finally { setBusy(false); }
  };
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: CHECKER_BG,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: `-apple-system, "SF Pro Text", "Segoe UI", system-ui, sans-serif`,
      }}
    >
      {/* Frame container · locked to bezel aspect · fits inside viewport. */}
      <div
        style={{
          position: "relative",
          aspectRatio: BEZEL_ASPECT_RATIO,
          width: `min(100dvw, calc(100dvh * ${BEZEL_METAL.w} / ${BEZEL_METAL.h}))`,
          height: "auto",
          maxHeight: "100dvh",
        }}
      >
        <img
          src={FRAME_SRC}
          alt="NEX phone frame (no lights)"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "fill",
            // Fully desaturated · no orange · matches cinema mode without accents.
            filter: "grayscale(1) brightness(0.85)",
            pointerEvents: "none",
            userSelect: "none",
          }}
          draggable={false}
        />
      </div>

      {/* Save toolbar · top-right · z:10 above the frame. */}
      <div
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          display: "flex",
          gap: 8,
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          style={{
            padding: "8px 14px",
            background: busy ? "#9ca3af" : "#111827",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.3,
            cursor: busy ? "wait" : "pointer",
            boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
          }}
        >
          {busy ? "Saving…" : "Save PNG (no lights)"}
        </button>
        <a
          href={FRAME_SRC}
          download="nex-frame-original.png"
          style={{
            padding: "8px 14px",
            background: "#374151",
            color: "#fff",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.3,
            textDecoration: "none",
            boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
          }}
        >
          Save original
        </a>
      </div>

      {/* Corner label · doesn't appear in a screenshot crop of the frame. */}
      <div
        style={{
          position: "fixed",
          bottom: 12,
          left: 12,
          padding: "6px 10px",
          background: "rgba(0,0,0,0.65)",
          color: "#fff",
          fontSize: 11,
          borderRadius: 6,
          letterSpacing: 0.3,
          pointerEvents: "none",
        }}
      >
        NEX Frame preview · no lights · transparent inner · /nex-frame-preview
      </div>
    </div>
  );
}
