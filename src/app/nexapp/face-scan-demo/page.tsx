// src/app/nexapp/face-scan-demo/page.tsx
//
// Founder Phase 33 · pixel-perfect reconstruction from the reference.
// The reference PNG is used ONLY at build time by
// scripts/generate-face-points.mjs. This runtime page renders the
// extracted points via WebGL.

"use client";

import { NexHolographicPixelFace } from "@/components/nex-app/face/NexHolographicPixelFace";

export default function NexFaceScanDemoPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000000",
        color: "#e2e8f0",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        padding: "1.75rem 1rem 3rem",
      }}
      data-nex-face-demo="true"
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div
          style={{
            fontSize: 12, letterSpacing: "0.14em", color: "#7dd3fc",
            textTransform: "uppercase", textAlign: "center", marginBottom: 8,
          }}
        >
          NEX · Pixel reconstruction
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, textAlign: "center", margin: "0 0 4px" }}>
          Live
        </h1>
        <p style={{ fontSize: 13, textAlign: "center", color: "#94a3b8", marginBottom: 22 }}>
          21,254 individual particles reconstructed from the reference at build time · rendered
          in real-time by WebGL · shaders animate each pixel independently.
        </p>

        <NexHolographicPixelFace maxWidth={560} />

        <p style={{ marginTop: 22, fontSize: 12, color: "#64748b", textAlign: "center" }}>
          Build pipeline: <code>scripts/generate-face-points.mjs</code> →{" "}
          <code>public/nex/face-points.json</code> → WebGL Points.
        </p>
      </div>
    </main>
  );
}
