"use client";

// src/app/nex-native/_trust-scan/trust-scan-skin.tsx
//
// NEX Trust Scan · canonical NEX skin · sealed 2026-10-01.
// -----------------------------------------------------------------------------
// This is the ONE visual identity for Trust Scan across every chat theme.
// Founder-sealed invariant: the Trust Scan report must look identical
// whether the viewer is on the Joker theme, Pink Dream, Night Sky,
// Titanium, Gold, or any future theme. Themes DO NOT reskin it.
//
// Why: Trust Scan is a NEX PRODUCT, not a theme flourish. A buyer who
// learns to read the signals on one phone must recognise the same
// report shape on every other phone. Consistent branding also protects
// the feature from being misread as cosmetic entertainment.
//
// The engine still accepts a `skin` prop (future-proofing for
// internationalised copy, high-contrast mode, admin dashboard reuse,
// etc.) but every chat-theme invocation imports NEX_TRUST_SCAN_SKIN
// from this file. Do not create per-theme skins.

import * as React from "react";
import type { TrustScanSkin } from "./trust-scan-types";

function NexShieldGlyph(): React.JSX.Element {
  return (
    <div
      aria-hidden
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: "rgba(0,0,0,0.5)",
        border: "1px solid rgba(0,175,255,0.5)",
        display: "grid",
        placeItems: "center",
        boxShadow: "0 0 14px rgba(0,175,255,0.35)",
      }}
    >
      <svg width="22" height="24" viewBox="0 0 22 24" aria-hidden>
        {/* Shield silhouette */}
        <path
          d="M11 1.5 L19.5 4.5 V12 C19.5 17.5 15.5 21 11 22.5 C6.5 21 2.5 17.5 2.5 12 V4.5 Z"
          fill="rgba(0,175,255,0.14)"
          stroke="#00AFFF"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Inner check */}
        <path
          d="M7 11.5 L10 14.5 L15 8.5"
          fill="none"
          stroke="#00AFFF"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export const NEX_TRUST_SCAN_SKIN: TrustScanSkin = {
  fontMono:
    "'JetBrains Mono', 'Space Mono', 'Menlo', 'Consolas', monospace",
  fontDisplay:
    "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  colors: {
    background:
      "linear-gradient(180deg, rgba(4,10,24,0.985) 0%, rgba(2,8,20,0.995) 100%)",
    textPrimary: "#F2F5F8",
    textMuted: "rgba(220,230,245,0.6)",
    accent: "#00AFFF",
    danger: "#FF5A5A",
    warn: "#FFC24A",
    success: "#8FFF6E",
    rim: "rgba(0,175,255,0.35)",
  },
  cinematic: {
    // No image · the reveal phase uses a soft cyan radial wash instead
    // of a themed photograph, keeping the identity NEX-branded on
    // every chat theme.
    revealImageUrl: undefined,
    receivingLabel: "ANALYSING ACCOUNT…",
    receivingSubtitle: "// signal gather · encrypted",
    revealLabel: "ACCOUNT IDENTIFIED",
    revealSubtitle: "nex trust record",
  },
  headerGlyph: <NexShieldGlyph />,
  headerEyebrow: "NEX TRUST SCAN",
};
