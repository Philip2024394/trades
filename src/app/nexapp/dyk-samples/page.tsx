// Sample route · Philip 2026-08-29.
//
// Five "Did You Know" glass-container designs shown side-by-side over
// the brushed-metal chat background so you can compare visually and
// pick which style to ship. Each card carries the same content so only
// the design varies.
//
// Visit /nexapp/dyk-samples to view.

"use client";

import React from "react";

const CHAT_BG =
  "https://ik.imagekit.io/ctlxgvqcm/ChatGPT%20Image%20Aug%2029,%202026,%2011_18_17%20AM.png";

const BEZEL_W  = "min(100dvw, calc(100dvh * 850 / 1850))";
const H_GUTTER = `max(0px, calc((100dvw - ${BEZEL_W}) / 2))`;

const DYK_TITLE = "Did you know";
const DYK_BODY  = "Indonesia has more than 17,000 islands, but only around 6,000 of them are inhabited.";
const DYK_SOURCE = "Wikipedia · Geography of Indonesia";

type Variant = {
  id: string;
  label: string;
  description: string;
  render: () => React.ReactNode;
};

// ── VARIANT 1 · Frosted cyan glass (holo) ──────────────────────────────
function V1_HoloCyan() {
  return (
    <div style={{
      position: "relative",
      overflow: "hidden",
      padding: "14px 16px",
      borderRadius: 12,
      background: "linear-gradient(180deg, rgba(74,201,255,0.14) 0%, rgba(74,201,255,0.06) 100%)",
      border: "1px solid rgba(163,226,255,0.55)",
      boxShadow: "0 0 16px rgba(74,201,255,0.30), inset 0 1px 0 rgba(163,226,255,0.35)",
      backdropFilter: "blur(10px) saturate(1.15)",
      WebkitBackdropFilter: "blur(10px) saturate(1.15)",
      color: "rgba(220,240,255,0.98)",
    }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.6, textTransform: "uppercase", color: "rgba(163,226,255,0.85)", marginBottom: 6, textShadow: "0 0 8px rgba(74,201,255,0.35)" }}>
        {DYK_TITLE}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.45, fontWeight: 500 }}>
        {DYK_BODY}
      </div>
      <div style={{ marginTop: 8, fontSize: 10, opacity: 0.55, letterSpacing: 0.3 }}>
        {DYK_SOURCE}
      </div>
    </div>
  );
}

// ── VARIANT 2 · Dark glass, orange accent ──────────────────────────────
function V2_DarkOrange() {
  return (
    <div style={{
      position: "relative",
      padding: "14px 16px",
      borderRadius: 12,
      background: "linear-gradient(180deg, rgba(12,14,18,0.85) 0%, rgba(6,8,12,0.92) 100%)",
      border: "1px solid rgba(249,115,22,0.55)",
      boxShadow: "0 0 12px rgba(249,115,22,0.25), inset 0 1px 0 rgba(255,255,255,0.06)",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
      color: "rgba(245,245,245,0.96)",
    }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.6, textTransform: "uppercase", color: "rgba(251,146,60,0.98)", marginBottom: 6 }}>
        {DYK_TITLE}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.45, fontWeight: 500 }}>
        {DYK_BODY}
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: "rgba(148,163,184,0.75)", letterSpacing: 0.3 }}>
        {DYK_SOURCE}
      </div>
    </div>
  );
}

// ── VARIANT 3 · Neon outline (transparent) ─────────────────────────────
function V3_NeonOutline() {
  return (
    <div style={{
      position: "relative",
      padding: "14px 16px",
      borderRadius: 14,
      background: "rgba(0,0,0,0.20)",
      border: "1.5px solid rgba(163,226,255,0.85)",
      boxShadow: "0 0 12px rgba(74,201,255,0.55), inset 0 0 12px rgba(74,201,255,0.15)",
      color: "rgba(240,248,255,0.98)",
    }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "rgba(163,226,255,1)", marginBottom: 6, textShadow: "0 0 8px rgba(74,201,255,0.85)" }}>
        {DYK_TITLE}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.45, fontWeight: 500, textShadow: "0 0 6px rgba(74,201,255,0.20)" }}>
        {DYK_BODY}
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: "rgba(163,226,255,0.60)", letterSpacing: 0.3 }}>
        {DYK_SOURCE}
      </div>
    </div>
  );
}

// ── VARIANT 4 · Layered glass with depth shadow ────────────────────────
function V4_LayeredDepth() {
  return (
    <div style={{
      position: "relative",
      padding: "16px 18px",
      borderRadius: 16,
      background: `
        linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 40%, rgba(255,255,255,0) 100%),
        linear-gradient(180deg, rgba(20,26,36,0.72) 0%, rgba(10,14,20,0.85) 100%)
      `,
      border: "1px solid rgba(255,255,255,0.10)",
      boxShadow: `
        0 12px 32px rgba(0,0,0,0.45),
        0 2px 6px rgba(0,0,0,0.3),
        inset 0 1px 0 rgba(255,255,255,0.15)
      `,
      backdropFilter: "blur(14px) saturate(1.2)",
      WebkitBackdropFilter: "blur(14px) saturate(1.2)",
      color: "rgba(245,246,250,0.98)",
    }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.6, textTransform: "uppercase", color: "rgba(163,226,255,0.85)", marginBottom: 6 }}>
        {DYK_TITLE}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.5, fontWeight: 500 }}>
        {DYK_BODY}
      </div>
      <div style={{ marginTop: 10, fontSize: 10, color: "rgba(148,163,184,0.75)", letterSpacing: 0.3, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 6 }}>
        {DYK_SOURCE}
      </div>
    </div>
  );
}

// ── VARIANT 5 · Holographic gradient border ────────────────────────────
function V5_HoloBorder() {
  return (
    <div style={{
      position: "relative",
      padding: "1.5px",
      borderRadius: 14,
      background: "linear-gradient(135deg, rgba(74,201,255,0.9) 0%, rgba(168,85,247,0.7) 50%, rgba(249,115,22,0.85) 100%)",
      boxShadow: "0 0 18px rgba(74,201,255,0.35)",
    }}>
      <div style={{
        padding: "14px 16px",
        borderRadius: 12.5,
        background: "linear-gradient(180deg, rgba(10,14,20,0.92) 0%, rgba(6,10,16,0.95) 100%)",
        color: "rgba(245,246,250,0.98)",
      }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.6, textTransform: "uppercase", color: "rgba(163,226,255,0.85)", marginBottom: 6 }}>
          {DYK_TITLE}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.45, fontWeight: 500 }}>
          {DYK_BODY}
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: "rgba(148,163,184,0.75)", letterSpacing: 0.3 }}>
          {DYK_SOURCE}
        </div>
      </div>
    </div>
  );
}

const VARIANTS: Variant[] = [
  { id: "v1", label: "V1 · Frosted cyan glass", description: "backdrop-blur, cyan tint, soft outer cyan glow", render: V1_HoloCyan },
  { id: "v2", label: "V2 · Dark glass + orange rim", description: "solid dark card, brand orange border + glow", render: V2_DarkOrange },
  { id: "v3", label: "V3 · Neon cyan outline", description: "transparent bg, bright neon border, glow both sides", render: V3_NeonOutline },
  { id: "v4", label: "V4 · Layered depth glass", description: "double-gradient bg, drop shadow, top highlight", render: V4_LayeredDepth },
  { id: "v5", label: "V5 · Holographic gradient border", description: "cyan→purple→orange gradient rim on dark core", render: V5_HoloBorder },
];

export default function DykSamplesPage() {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "#050505",
      overflow: "auto",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    }}>
      {/* Brushed-metal chat bg envelope so cards render against the real
          surface they'll ship on. */}
      <div style={{
        position: "fixed",
        top: 0,
        right: H_GUTTER,
        width: BEZEL_W,
        minHeight: "100dvh",
        backgroundImage: `url('${CHAT_BG}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        zIndex: 0,
        pointerEvents: "none",
      }} />

      {/* Content column · scrolls · sits above the bg */}
      <div style={{
        position: "relative",
        zIndex: 1,
        maxWidth: 420,
        margin: "0 auto",
        padding: "60px 20px 40px",
        color: "rgba(245,246,250,0.95)",
      }}>
        <div style={{
          textAlign: "center",
          marginBottom: 24,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase",
            color: "rgba(249,115,22,0.9)", marginBottom: 6,
          }}>
            NEX · Design samples
          </div>
          <div style={{ fontSize: 14, opacity: 0.75, lineHeight: 1.5 }}>
            5 glass-container styles for the &quot;Did You Know&quot; card. Pick which reads best against the chat background.
          </div>
        </div>

        {VARIANTS.map((v) => (
          <div key={v.id} style={{ marginBottom: 32 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 0.8,
              color: "rgba(163,226,255,0.85)", marginBottom: 6,
              textTransform: "uppercase",
            }}>
              {v.label}
            </div>
            <div style={{
              fontSize: 11, opacity: 0.6, marginBottom: 10, lineHeight: 1.4,
            }}>
              {v.description}
            </div>
            {v.render()}
          </div>
        ))}

        <div style={{
          marginTop: 40,
          padding: "12px 16px",
          borderRadius: 8,
          background: "rgba(0,0,0,0.5)",
          border: "1px solid rgba(249,115,22,0.35)",
          fontSize: 11,
          color: "rgba(251,146,60,0.9)",
          textAlign: "center",
        }}>
          Tell me which variant (V1–V5) to ship. I&apos;ll swap AmbientKnowledgeCard to match.
        </div>
      </div>
    </div>
  );
}
