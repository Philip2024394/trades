// src/app/nex-native/shop-prototypes/caption-readability/page.tsx
//
// Prototype · caption readability · sealed 2026-10-01.
// -----------------------------------------------------------------------------
// Twenty variations of the "gray caption" problem on the same cyan-tinted
// shop-chooser card background (Sell Products / Sell Food / Affiliate).
// Scroll the page end-to-end and pick the treatment that reads cleanest
// without inverting the card's visual hierarchy. The icon + label + caption
// text are identical in every row — only the caption treatment changes.
//
// Not a feature · not linked from the nav · live only at
// /nex-native/shop-prototypes/caption-readability so the founder can
// compare, pick a winner, and then we promote it into _shop-grid-modal.tsx.

import type * as React from "react";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CAPTION = "Physical goods · home-made, retail, trades, maker.";
const LABEL = "Sell Products";

interface Variant {
  n: number;
  name: string;
  captionStyle: React.CSSProperties;
  captionText?: React.ReactNode;
  // Optional wrapper around the caption · lets us try pill/chip
  // containers without rewriting the card layout.
  captionWrapperStyle?: React.CSSProperties;
}

const VARIANTS: Variant[] = [
  {
    n: 1,
    name: "Baseline · current state (reference)",
    captionStyle: {
      fontSize: 13,
      fontWeight: 600,
      lineHeight: 1.4,
      color: "#8B95A5",
    },
  },
  {
    n: 2,
    name: "Soft text-shadow",
    captionStyle: {
      fontSize: 13,
      fontWeight: 600,
      lineHeight: 1.4,
      color: "#8B95A5",
      textShadow: "0 1px 2px rgba(0,0,0,0.45)",
    },
  },
  {
    n: 3,
    name: "Heavy text-shadow",
    captionStyle: {
      fontSize: 13,
      fontWeight: 600,
      lineHeight: 1.4,
      color: "#8B95A5",
      textShadow: "0 2px 4px rgba(0,0,0,0.75)",
    },
  },
  {
    n: 4,
    name: "Letter outline · webkit-text-stroke",
    captionStyle: {
      fontSize: 13,
      fontWeight: 600,
      lineHeight: 1.4,
      color: "#B4BAC3",
      WebkitTextStroke: "0.3px rgba(0,0,0,0.65)",
    },
  },
  {
    n: 5,
    name: "Dual shadow · TV-broadcast legibility",
    captionStyle: {
      fontSize: 13,
      fontWeight: 600,
      lineHeight: 1.4,
      color: "#B4BAC3",
      textShadow:
        "0 0 2px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.5)",
    },
  },
  {
    n: 6,
    name: "Brighter neutral gray · no shadow",
    captionStyle: {
      fontSize: 13,
      fontWeight: 600,
      lineHeight: 1.4,
      color: "#B4BAC3",
    },
  },
  {
    n: 7,
    name: "White with low opacity",
    captionStyle: {
      fontSize: 13,
      fontWeight: 600,
      lineHeight: 1.4,
      color: "rgba(255,255,255,0.68)",
    },
  },
  {
    n: 8,
    name: "Caps · wide letter-spacing · metadata feel",
    captionStyle: {
      fontSize: 11,
      fontWeight: 700,
      lineHeight: 1.4,
      color: "#A0A6B0",
      textTransform: "uppercase",
      letterSpacing: "0.12em",
    },
  },
  {
    n: 9,
    name: "Italic muted",
    captionStyle: {
      fontSize: 13,
      fontWeight: 500,
      lineHeight: 1.4,
      color: "#A0A6B0",
      fontStyle: "italic",
    },
  },
  {
    n: 10,
    name: "Monospace · looks like metadata",
    captionStyle: {
      fontSize: 12,
      fontWeight: 500,
      lineHeight: 1.4,
      color: "#9FA9B9",
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, 'Cascadia Mono', monospace",
    },
  },
  {
    n: 11,
    name: "Dark pill container · high contrast backdrop",
    captionStyle: {
      fontSize: 12,
      fontWeight: 600,
      lineHeight: 1.4,
      color: "#C7D4E6",
    },
    captionWrapperStyle: {
      display: "inline-block",
      background: "rgba(2,9,20,0.6)",
      padding: "3px 8px",
      borderRadius: 6,
      marginTop: 4,
    },
  },
  {
    n: 12,
    name: "Cyan-hairline pill · outline only",
    captionStyle: {
      fontSize: 12,
      fontWeight: 600,
      lineHeight: 1.4,
      color: "#C7D4E6",
    },
    captionWrapperStyle: {
      display: "inline-block",
      background: "transparent",
      border: "1px solid rgba(0,159,239,0.4)",
      padding: "3px 8px",
      borderRadius: 999,
      marginTop: 4,
    },
  },
  {
    n: 13,
    name: "Filled cyan-tinted chip",
    captionStyle: {
      fontSize: 12,
      fontWeight: 600,
      lineHeight: 1.4,
      color: "#DCECFF",
    },
    captionWrapperStyle: {
      display: "inline-block",
      background: "rgba(0,159,239,0.22)",
      padding: "3px 10px",
      borderRadius: 6,
      marginTop: 4,
    },
  },
  {
    n: 14,
    name: "Accent underline",
    captionStyle: {
      fontSize: 13,
      fontWeight: 600,
      lineHeight: 1.4,
      color: "#A8B2BF",
    },
    captionWrapperStyle: {
      display: "inline-block",
      borderBottom: "1px solid rgba(0,159,239,0.45)",
      paddingBottom: 2,
      marginTop: 4,
    },
  },
  {
    n: 15,
    name: "Bullet prefix · tiny lead-in",
    captionStyle: {
      fontSize: 13,
      fontWeight: 600,
      lineHeight: 1.4,
      color: "#A0A6B0",
    },
    captionText: (
      <>
        <span style={{ color: "#009FEF", marginRight: 6 }}>•</span>
        {CAPTION}
      </>
    ),
  },
  {
    n: 16,
    name: "Two-tone split · bright anchor + muted rest",
    captionStyle: {
      fontSize: 13,
      fontWeight: 500,
      lineHeight: 1.4,
      color: "#8B95A5",
    },
    captionText: (
      <>
        <span style={{ color: "#DCECFF", fontWeight: 700 }}>
          Physical goods
        </span>{" "}
        · home-made, retail, trades, maker.
      </>
    ),
  },
  {
    n: 17,
    name: "Word chips · each tag its own small pill",
    captionStyle: {
      fontSize: 11,
      fontWeight: 600,
      lineHeight: 1.4,
      color: "#C7D4E6",
    },
    captionText: (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
        {["Physical", "Home-made", "Retail", "Trades", "Maker"].map((t) => (
          <span
            key={t}
            style={{
              display: "inline-block",
              padding: "2px 8px",
              borderRadius: 999,
              background: "rgba(0,159,239,0.15)",
              border: "1px solid rgba(0,159,239,0.3)",
              fontSize: 10,
              fontWeight: 600,
              color: "#C7D4E6",
              letterSpacing: "0.02em",
            }}
          >
            {t}
          </span>
        ))}
      </div>
    ),
  },
  {
    n: 18,
    name: "Scrim behind the caption only",
    captionStyle: {
      fontSize: 13,
      fontWeight: 600,
      lineHeight: 1.4,
      color: "#C7D4E6",
    },
    captionWrapperStyle: {
      display: "inline-block",
      background:
        "linear-gradient(180deg, rgba(2,9,20,0.5), rgba(2,9,20,0.25))",
      padding: "3px 8px",
      borderRadius: 4,
      marginTop: 4,
    },
  },
  {
    n: 19,
    name: "Larger weight · same color (brute force)",
    captionStyle: {
      fontSize: 13,
      fontWeight: 800,
      lineHeight: 1.4,
      color: "#8B95A5",
    },
  },
  {
    n: 20,
    name: "Faint cyan tint instead of neutral gray",
    captionStyle: {
      fontSize: 13,
      fontWeight: 600,
      lineHeight: 1.4,
      color: "#8BA9D1",
    },
  },
];

const CARD_BG =
  "linear-gradient(180deg, rgba(0,159,239,0.14) 0%, rgba(0,159,239,0.06) 100%)";
const CARD_BORDER = "1px solid rgba(0,159,239,0.5)";
const SHELL_BG =
  "linear-gradient(180deg, rgba(6,15,28,0.18) 0%, rgba(3,10,20,0.32) 100%), url(/nex-themes/joker-shop-bg.png) center center / cover no-repeat";

export default function CaptionReadabilityProtoPage(): React.JSX.Element {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: SHELL_BG,
        padding: "32px 16px 80px",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        color: "#F4F7FC",
      }}
    >
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.26em",
            textTransform: "uppercase",
            color: "#009FEF",
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          Prototype · Caption readability
        </div>
        <h1
          style={{
            margin: "0 0 10px",
            fontSize: 24,
            fontWeight: 700,
            lineHeight: 1.15,
            color: "#FFFFFF",
            textShadow: "0 1px 3px rgba(0,0,0,0.65)",
          }}
        >
          Pick the caption treatment that reads cleanest
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 13,
            lineHeight: 1.5,
            color: "#B4BAC3",
          }}
        >
          Same cyan-tinted shop-chooser card background. Same icon,
          label, and caption text. Only the <strong>caption treatment</strong>{" "}
          changes between rows. Scroll end-to-end and tell me which number
          wins — I'll promote it into the real{" "}
          <code
            style={{
              background: "rgba(0,159,239,0.14)",
              padding: "1px 6px",
              borderRadius: 4,
              fontSize: 11,
            }}
          >
            _shop-grid-modal.tsx
          </code>
          .
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {VARIANTS.map((v) => (
            <section key={v.n}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  marginBottom: 6,
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.55)",
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    color: "#009FEF",
                    fontWeight: 800,
                  }}
                >
                  #{String(v.n).padStart(2, "0")}
                </span>
                <span>{v.name}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 16px",
                  borderRadius: 14,
                  background: CARD_BG,
                  border: CARD_BORDER,
                }}
              >
                <div
                  style={{
                    flexShrink: 0,
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid rgba(0,159,239,0.35)",
                    display: "grid",
                    placeItems: "center",
                    color: "#009FEF",
                  }}
                >
                  <svg
                    width={22}
                    height={22}
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M5 7h14l-1.5 12a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8L5 7Z"
                      stroke="currentColor"
                      strokeWidth={1.6}
                      strokeLinejoin="round"
                    />
                    <path
                      d="M9 7V5a3 3 0 0 1 6 0v2"
                      stroke="currentColor"
                      strokeWidth={1.6}
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      letterSpacing: "0.01em",
                      color: "#F4F7FC",
                    }}
                  >
                    {LABEL}
                  </div>
                  {v.captionWrapperStyle ? (
                    <div style={v.captionWrapperStyle}>
                      <span style={v.captionStyle}>
                        {v.captionText ?? CAPTION}
                      </span>
                    </div>
                  ) : (
                    <div style={{ ...v.captionStyle, marginTop: 3 }}>
                      {v.captionText ?? CAPTION}
                    </div>
                  )}
                </div>
                <div
                  aria-hidden
                  style={{
                    flexShrink: 0,
                    color: "#009FEF",
                    fontSize: 18,
                    lineHeight: 1,
                  }}
                >
                  →
                </div>
              </div>
            </section>
          ))}
        </div>

        <div
          style={{
            marginTop: 40,
            padding: "16px 18px",
            borderRadius: 12,
            background: "rgba(2,9,20,0.75)",
            border: "1px solid rgba(0,159,239,0.3)",
            fontSize: 12,
            color: "#C7D4E6",
            lineHeight: 1.55,
          }}
        >
          Tell me which # you want and I'll replace the live caption
          treatment with it. If none quite land, I can mix two (e.g. #2
          shadow + #6 brighter gray) or spin another 10 variations.
        </div>
      </div>
    </div>
  );
}
