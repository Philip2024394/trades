// NEX Sample · PINK frame preview · Philip 2026-08-28.
//
// Isolated preview of the phone frame tinted pink · no orange accent lights ·
// no rail, no chat, no content. Just the frame visual so Philip can see the
// look before committing to a pink theme.
//
// Route: /nex-sample-pink
// Uses CSS filter (hue-rotate + saturate) to shift the frame's orange accents
// toward pink. Base metal/black areas are unaffected by hue-rotate.

"use client";

import { BEZEL_ASPECT_RATIO } from "@/components/nexapp/hud/geometry";

export default function NexSamplePinkPage() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 24,
        fontFamily: `-apple-system, "SF Pro Text", "Segoe UI", system-ui, sans-serif`,
        color: "rgba(245,245,245,0.7)",
      }}
    >
      {/* Small label at top */}
      <div
        style={{
          position: "absolute",
          top: 24,
          left: 24,
          fontSize: 12,
          letterSpacing: 0.6,
          color: "rgba(245,245,245,0.6)",
        }}
      >
        NEX SAMPLE · pink frame · no accent lights · /nex-sample-pink
      </div>

      {/* Aspect-locked phone container · ROSE GOLD METAL treatment.
          Philip 2026-08-28: "how about the metal pink color."
          Sepia base + hue-rotate → warm rose-gold metallic (not flat pink).
          Multi-layer sheen sells the polished-metal reflectivity. */}
      <div
        style={{
          position: "relative",
          height: "85vh",
          aspectRatio: BEZEL_ASPECT_RATIO,
          background: "#000000",
          // Rose-gold glow bloom · warmer than pure pink · reads as metal.
          filter: "drop-shadow(0 0 40px rgba(230,140,150,0.55)) drop-shadow(0 0 90px rgba(180,90,110,0.30))",
        }}
      >
        {/* Frame image · ROSE GOLD METALLIC conversion.
            sepia(0.5)     · adds warm gold undertone (base metal warmth)
            hue-rotate(310) · shifts warm gold → warm pink (rose gold territory)
            saturate(1.7)   · richer pink saturation on metallic base
            brightness(1.12)· polished-metal feels LIT, not painted
            contrast(1.08)  · deepens shadows for metallic depth */}
        <img
          src="/nex/hud-frame-v12.png"
          alt="NEX frame · rose gold metal preview"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "fill",
            filter: "sepia(0.5) hue-rotate(310deg) saturate(1.7) brightness(1.12) contrast(1.08)",
            pointerEvents: "none",
          }}
        />
        {/* Rose gold gradient overlay · warmer diagonal sheen · pinks + gold
            + copper undertones. mix-blend-mode: overlay so it only affects
            lit metal areas, black stays black. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, rgba(255,190,175,0.35) 0%, rgba(244,169,155,0.15) 25%, rgba(230,140,150,0.25) 55%, rgba(200,110,130,0.20) 100%)",
            mixBlendMode: "overlay",
            pointerEvents: "none",
          }}
        />
        {/* Anisotropic metal shine · TWO thin bright bands (top + upper-mid) ·
            simulates brushed-metal + polished light-catching highlight. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0,
            height: "40%",
            background:
              "linear-gradient(to bottom, rgba(255,240,230,0.28) 0%, rgba(255,220,205,0.10) 55%, transparent 100%)",
            mixBlendMode: "soft-light",
            pointerEvents: "none",
          }}
        />
        {/* Bottom depth · slight darker shadow lower-third for metal weight */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            bottom: 0, left: 0, right: 0,
            height: "30%",
            background:
              "linear-gradient(to top, rgba(80,20,40,0.28) 0%, transparent 100%)",
            mixBlendMode: "multiply",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Bottom caption */}
      <div
        style={{
          fontSize: 11,
          color: "rgba(245,245,245,0.45)",
          letterSpacing: 0.4,
          textAlign: "center",
          maxWidth: 480,
          padding: "0 16px",
        }}
      >
        Filter: <span style={{ color: "#f472b6" }}>hue-rotate(300deg) saturate(1.4)</span>
        <br />
        Tune these values in <code>src/app/nex-sample-pink/page.tsx</code>
      </div>
    </div>
  );
}
