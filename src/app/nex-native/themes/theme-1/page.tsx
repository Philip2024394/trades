// src/app/nex-native/themes/theme-1/page.tsx
//
// Bridge 27 · Theme 1 (Night Sky) admin preview.
// -----------------------------------------------
// Shares the SAME navigation conventions as Pink Dream (peer-only
// header · Home + Shop pink circles on right · naked composer with
// + / smile / send buttons) but paints the FEED differently:
// Prototype 02 (Sky Cards) — cloud-shaped floating messages —
// attached to the left/right window edges like Pink Dream's tabs.
//
// This is exactly the doctrine: nav = shared, feed = distinct.
// Two themes, two worlds, same muscle-memory.

import type * as React from "react";
import { Theme1Composer } from "./_composer";

export const dynamic = "force-static";
export const runtime = "nodejs";
export const metadata = { title: "NEX · Theme 1 · Night Sky preview" };

const P = {
  accent: "#7EB6FF",      // Theme 1 accent (light sky blue)
  accentDeep: "#009FEF",  // Deeper blue for rims + ticks
  orange: "#FF7800",      // Theme 1 composer accent (Maria's send)
  peach: "#FFC97C",       // Warm complement
  softWhite: "#FFF5FA",
  midnight: "#050B18",
  panelMuted: "#8CA5C7",
};

const SANS =
  "'Inter', 'Manrope', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const WALLPAPER =
  "https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-theme-hero/maria-santos-hero-1790481483761.png";

interface Msg {
  side: "in" | "out";
  body: string;
  time: string;
  read?: boolean;
}
const CONVO: Msg[] = [
  { side: "in", body: "Sunset shoot went perfectly ✨\nWant to see the proofs?", time: "18:04" },
  { side: "out", body: "Yes please. Send whenever.", time: "18:06", read: true },
  { side: "in", body: "Sending the top 10 now.\nRoll #2 is my favourite.", time: "18:07" },
  { side: "out", body: "The one with the golden hour light?\nLegendary.", time: "18:08", read: true },
];

export default function Theme1PreviewPage() {
  return (
    <div
      data-nex-theme1-preview
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        color: P.softWhite,
        fontFamily: SANS,
        overflow: "hidden",
        backgroundColor: P.midnight,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&family=Manrope:wght@400;500;700;800&display=swap');
        [data-nex-theme1-preview] * { box-sizing: border-box; }
        html:has([data-nex-theme1-preview]),
        body:has([data-nex-theme1-preview]) {
          margin: 0; padding: 0; background: ${P.midnight};
        }
        @keyframes t1-portrait-ping {
          0%   { transform: scale(1);   opacity: 0.55; }
          80%  { transform: scale(1.55); opacity: 0; }
          100% { transform: scale(1.55); opacity: 0; }
        }
        [data-nex-theme1-preview] [data-t1-ping] {
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          border: 2px solid rgba(126, 182, 255, 0.75);
          animation: t1-portrait-ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
          pointer-events: none;
        }
        [data-nex-theme1-preview] [data-t1-ping-2] { animation-delay: 0.9s; }
        @keyframes t1-moon-glow {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50%      { opacity: 0.85; transform: scale(1.08); }
        }
        [data-nex-theme1-preview] [data-t1-moon] {
          position: absolute;
          left: 60%;
          top: 8%;
          width: 32%;
          height: 22%;
          z-index: 3;
          pointer-events: none;
          background: radial-gradient(
            ellipse at center,
            rgba(225, 238, 255, 0.85) 0%,
            rgba(126, 182, 255, 0.55) 35%,
            rgba(0, 159, 239, 0.25) 60%,
            transparent 82%
          );
          filter: blur(16px);
          mix-blend-mode: screen;
          animation: t1-moon-glow 8s ease-in-out infinite;
        }
        [data-nex-theme1-preview] [data-t1-scroll] {
          scrollbar-width: none;
          mask-image: linear-gradient(
            180deg,
            transparent 0px,
            rgba(0,0,0,0.20) 12px,
            rgba(0,0,0,0.65) 28px,
            #000 40px,
            #000 100%
          );
          -webkit-mask-image: linear-gradient(
            180deg,
            transparent 0px,
            rgba(0,0,0,0.20) 12px,
            rgba(0,0,0,0.65) 28px,
            #000 40px,
            #000 100%
          );
        }
        [data-nex-theme1-preview] [data-t1-scroll]::-webkit-scrollbar {
          display: none; width: 0; height: 0;
        }
        @keyframes t1-cloud-drift {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-3px); }
        }
      `}</style>

      {/* Wallpaper · Maria's hero photograph as the sky */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          backgroundImage: `url(${WALLPAPER})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div aria-hidden data-t1-moon />

      {/* Very light readability overlay */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          background:
            "linear-gradient(180deg, rgba(5,11,24,0.10) 0%, rgba(5,11,24,0.28) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ---------------- Header ---------------- */}
      <header
        style={{
          position: "relative",
          zIndex: 5,
          padding: "calc(env(safe-area-inset-top, 0) + 6px) 14px 6px",
          background: "transparent",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {/* Portrait · ping rings + camera charm (Maria is a
           photographer · her identity glyph = camera in blue) */}
        <div style={{ position: "relative", width: 52, height: 52, flexShrink: 0 }}>
          <span aria-hidden data-t1-ping />
          <span aria-hidden data-t1-ping data-t1-ping-2 />
          <div
            aria-hidden
            style={{
              position: "relative",
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: `url(${WALLPAPER}) center/cover`,
              border: "2px solid rgba(255,255,255,0.85)",
              boxShadow: `0 0 12px ${P.accentDeep}`,
            }}
          />
          <span
            aria-hidden
            style={{
              position: "absolute",
              bottom: -4,
              right: -4,
              zIndex: 3,
              lineHeight: 0,
            }}
          >
            <BlueCamera size={20} />
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "-0.005em",
              color: P.softWhite,
              lineHeight: 1.15,
            }}
          >
            Maria
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: P.accent,
              marginTop: 2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Photographer
          </div>
        </div>
        {/* Shared right cluster · Shop + Home · blue circles here
           to signal Theme 1's identity while keeping the SHAPE
           identical to Pink Dream. */}
        <a href="/nex-native/maria" aria-label="Visit Maria's shop" style={blueCircleStyle()}>
          <ShopGlyph />
        </a>
        <a href="/nex-native/chat" aria-label="Home" style={blueCircleStyle()}>
          <HomeGlyph />
        </a>
      </header>

      {/* ---------------- Conversation ---------------- */}
      <main
        data-t1-scroll
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          minHeight: 0,
          width: "100%",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          padding: "4px 0 14px 0",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {CONVO.map((m, i) => {
          const prev = CONVO[i - 1];
          const speakerChanged = !prev || prev.side !== m.side;
          const gapTop = speakerChanged ? 6 : 0;
          // Bridge 27e · Maria's blue frost restored per Founder
          // direction 2026-09-28 · only YOU cards move to white
          // frosted glass. Two distinct materials · Maria = tinted
          // sky panel · You = neutral white glass slab.
          if (m.side === "in") {
            return (
              <SkyCard
                key={i}
                side="left"
                speaker="Maria"
                body={m.body}
                time={m.time}
                extraTop={gapTop}
                fill="rgba(0, 159, 239, 0.28)"
                border="rgba(126, 182, 255, 0.75)"
                accent={P.accentDeep}
                textColor="#F4F7FC"
                eyebrowColor="#B4DBFF"
                driftDelay={`${i * 0.4}s`}
              />
            );
          }
          return (
            <SkyCard
              key={i}
              side="right"
              speaker={`You${m.read ? " · ✓✓" : ""}`}
              body={m.body}
              time={m.time}
              extraTop={gapTop}
              // Bridge 27f · true glass panel · vertical gradient
              // (bright top → dim bottom) simulates the light
              // refracting through a real glass slab. Higher-alpha
              // border catches light on the edge. Backdrop blur
              // bumped to 28px on this card so the wallpaper reads
              // as diffused through frosted crystal.
              fill="linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.18) 100%)"
              border="rgba(255, 255, 255, 0.85)"
              accent="#FFFFFF"
              textColor="#0A1830"
              eyebrowColor="#1E4A7A"
              driftDelay={`${i * 0.4 + 0.2}s`}
              glass
            />
          );
        })}
      </main>

      {/* Composer · same shape as Pink Dream · blue palette */}
      <Theme1Composer />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── *
 *  SkyCard · cloud-shape panel with drift · attaches to L or R    *
 * ─────────────────────────────────────────────────────────────── */

function SkyCard({
  side,
  speaker,
  body,
  time,
  extraTop,
  fill,
  border,
  accent,
  textColor,
  eyebrowColor,
  driftDelay,
  glass,
}: {
  side: "left" | "right";
  speaker: string;
  body: string;
  time: string;
  extraTop: number;
  fill: string;
  border: string;
  accent: string;
  textColor: string;
  eyebrowColor: string;
  driftDelay: string;
  /** Bridge 27f · when true, layer in extra glass effects · thicker
   *  backdrop blur, prominent inner top-highlight, subtle bottom
   *  inner glow, and a bright edge sparkle in the top-inside corner. */
  glass?: boolean;
}) {
  const isRight = side === "right";
  return (
    <div
      style={{
        marginTop: extraTop + 4,
        maxWidth: "calc(78% + 30px)",
        marginLeft: isRight ? "auto" : undefined,
        display: isRight ? "flex" : undefined,
        justifyContent: isRight ? "flex-end" : undefined,
      }}
    >
      <div
        style={{
          position: "relative",
          display: "inline-block",
          maxWidth: "100%",
          padding: "10px 16px 12px",
          borderRadius: isRight
            ? "24px 0 0 24px"
            : "0 24px 24px 0",
          background: fill,
          borderTop: `1px solid ${border}`,
          borderBottom: `1px solid ${border}`,
          borderLeft: isRight ? `1px solid ${border}` : `3px solid ${accent}`,
          borderRight: isRight ? `3px solid ${accent}` : `1px solid ${border}`,
          backdropFilter: glass
            ? "blur(28px) saturate(180%)"
            : "blur(20px) saturate(120%)",
          WebkitBackdropFilter: glass
            ? "blur(28px) saturate(180%)"
            : "blur(20px) saturate(120%)",
          boxShadow: glass
            ? [
                // Outer drop-shadow · direction from the attach edge
                isRight
                  ? "-10px 8px 24px rgba(0,0,0,0.32)"
                  : "10px 8px 24px rgba(0,0,0,0.32)",
                // Prominent inner top highlight (glass shine)
                "inset 0 1px 0 rgba(255,255,255,0.85)",
                // Softer secondary highlight for depth
                "inset 0 2px 3px rgba(255,255,255,0.30)",
                // Inner bottom edge for refraction
                "inset 0 -1px 0 rgba(255,255,255,0.20)",
              ].join(", ")
            : isRight
              ? `-8px 6px 20px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.18)`
              : `8px 6px 20px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.18)`,
          animation: `t1-cloud-drift 5s ease-in-out ${driftDelay} infinite`,
          overflow: "hidden",
        }}
      >
        {/* Bridge 27f · diagonal glass shine · a long soft white
           streak crossing the top-inside corner opposite the attach
           edge · mimics the light-catch on a real piece of curved
           glass. Only rendered when glass prop is true. */}
        {glass && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: -10,
              [isRight ? "left" : "right"]: -10,
              width: "70%",
              height: 22,
              background:
                "linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.65) 45%, rgba(255,255,255,0.85) 50%, transparent 100%)",
              transform: "rotate(-8deg)",
              pointerEvents: "none",
              filter: "blur(4px)",
              opacity: 0.85,
            }}
          />
        )}
        <div
          style={{
            position: "relative",
            fontSize: 10,
            letterSpacing: "0.22em",
            color: eyebrowColor,
            fontWeight: 700,
            textTransform: "uppercase",
            marginBottom: 4,
            textAlign: isRight ? "right" : "left",
          }}
        >
          {speaker} · {time}
        </div>
        <div
          style={{
            position: "relative",
            fontSize: 15,
            lineHeight: 1.45,
            color: textColor,
            whiteSpace: "pre-wrap",
            letterSpacing: "-0.003em",
            textAlign: isRight ? "right" : "left",
          }}
        >
          {body}
        </div>
        {/* Cloud bumps · bottom edge, opposite the attach side, so
           the panel silhouette reads as a soft cloud rolling off
           its window frame anchor. */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            bottom: -6,
            [isRight ? "left" : "right"]: 16,
            width: 18,
            height: 12,
            borderRadius: "50%",
            background: fill,
            border: `1px solid ${border}`,
            borderTop: "none",
            backdropFilter: "blur(14px) saturate(140%)",
            WebkitBackdropFilter: "blur(14px) saturate(140%)",
          }}
        />
        <span
          aria-hidden
          style={{
            position: "absolute",
            bottom: -3,
            [isRight ? "left" : "right"]: 8,
            width: 10,
            height: 7,
            borderRadius: "50%",
            background: fill,
            border: `1px solid ${border}`,
            borderTop: "none",
          }}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── *
 *  Header glyphs · Blue variants                                  *
 * ─────────────────────────────────────────────────────────────── */

function blueCircleStyle(): React.CSSProperties {
  return {
    width: 30,
    height: 30,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #7EB6FF, #009FEF)",
    border: "1px solid rgba(180,220,255,0.85)",
    boxShadow: "0 3px 10px rgba(0,159,239,0.35)",
    color: "#050B18",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    flexShrink: 0,
  };
}

function BlueCamera({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      style={{
        display: "inline-block",
        verticalAlign: "-0.18em",
        filter: "drop-shadow(0 0 6px rgba(0,159,239,0.85))",
        flexShrink: 0,
      }}
    >
      <defs>
        <linearGradient id="t1-cam" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#B4DBFF" />
          <stop offset="55%" stopColor="#009FEF" />
          <stop offset="100%" stopColor="#005AAA" />
        </linearGradient>
      </defs>
      <path
        d="M4 8h3l1.5-2h7L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"
        fill="url(#t1-cam)"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3.5" fill="rgba(5,11,24,0.65)" stroke="rgba(255,255,255,0.85)" strokeWidth="0.8" />
      <circle cx="10.4" cy="11.6" r="0.9" fill="rgba(255,255,255,0.7)" />
    </svg>
  );
}

function HomeGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 12l9-9 9 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ShopGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 8l1.5-4h15L21 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 8h16v11a1 1 0 01-1 1H5a1 1 0 01-1-1V8z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9 8V5m6 3V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
