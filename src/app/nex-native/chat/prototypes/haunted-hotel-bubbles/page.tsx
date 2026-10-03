// src/app/nex-native/chat/prototypes/haunted-hotel-bubbles/page.tsx
//
// Design preview · Haunted Hotel · 10 chat-bubble prototypes.
// Pure design surface — no backend data, no auth gate, no telemetry.
// Each bubble is a self-contained visual treatment for the premium
// "Haunted Hotel" theme (named by founder 2026-10-03).

import Link from "next/link";
import { HauntedHotelAtmosphere } from "@/components/nex-native/HauntedHotelAtmosphere";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAMPLE_FROM = "Maria";
const SAMPLE_TIME = "02:17";

interface Prototype {
  n: number;
  name: string;
  tagline: string;
  body: string;
  render: () => React.ReactElement;
}

export default function HauntedHotelBubblesPage(): React.ReactElement {
  const prototypes: Prototype[] = [
    {
      n: 1,
      name: "Misted White · Crack Effect",
      tagline: "porcelain glass, hairline fractures bloom from the corner",
      body: "The lobby is quiet tonight. Too quiet.",
      render: () => <MistedCrackBubble />,
    },
    {
      n: 2,
      name: "Candlelit Parchment",
      tagline: "aged letter paper under a trembling candle, wax-sealed",
      body: "Your room will be ready at midnight. Not before.",
      render: () => <CandlelitParchmentBubble />,
    },
    {
      n: 3,
      name: "Shadow-Veiled Obsidian",
      tagline: "wet obsidian panel · ghostly whisper outline flickers",
      body: "Did you hear the piano? There's no piano here.",
      render: () => <ObsidianBubble />,
    },
    {
      n: 4,
      name: "Chandelier Crystal · Prism Edge",
      tagline: "faceted leaded glass · caustics bloom along the rim",
      body: "The chandelier is swinging again. There is no draft.",
      render: () => <ChandelierCrystalBubble />,
    },
    {
      n: 5,
      name: "Victorian Lace Border",
      tagline: "ivory bubble framed by heirloom black lace",
      body: "A gentleman from room 12 is asking about you.",
      render: () => <VictorianLaceBubble />,
    },
    {
      n: 6,
      name: "Fog-Draped Mirror · Breath Fog",
      tagline: "silvered mirror face · breath-fog blooms and dissolves",
      body: "Please don't look behind you.",
      render: () => <FogMirrorBubble />,
    },
    {
      n: 7,
      name: "Haunted Elevator · Brass Numeral",
      tagline: "brass elevator plate · the floor dial is stuck on 13",
      body: "The elevator keeps going to the 13th floor by itself.",
      render: () => <ElevatorBrassBubble />,
    },
    {
      n: 8,
      name: "Peeling Wallpaper · Damask",
      tagline: "faded damask bubble · the top-right curl exposes raw plaster",
      body: "Behind the wallpaper there is a doorway nobody uses.",
      render: () => <PeelingWallpaperBubble />,
    },
    {
      n: 9,
      name: "Flickering Neon Vacancy",
      tagline: "'vacancy' sign red neon tube, letters stutter at random",
      body: "We always have a vacancy for you.",
      render: () => <NeonVacancyBubble />,
    },
    {
      n: 10,
      name: "Spectral Smoke Trail",
      tagline: "translucent bubble bleeding white smoke tendrils from the edges",
      body: "Something followed me up from the basement.",
      render: () => <SpectralSmokeBubble />,
    },
  ];

  return (
    <>
      <style>{`
        html, body { background: #0b0712 !important; }

        @keyframes hh-candle {
          0%, 100% { filter: brightness(1.0); box-shadow: 0 0 24px rgba(255,170,70,0.42), inset 0 0 20px rgba(255,195,110,0.35); }
          40%      { filter: brightness(1.14); box-shadow: 0 0 36px rgba(255,170,70,0.6), inset 0 0 28px rgba(255,210,130,0.5); }
          65%      { filter: brightness(0.92); box-shadow: 0 0 18px rgba(255,170,70,0.3), inset 0 0 14px rgba(255,180,90,0.28); }
        }
        @keyframes hh-whisper {
          0%, 100% { opacity: 0.3; filter: blur(0.4px); }
          50%      { opacity: 0.7; filter: blur(0.2px); }
        }
        @keyframes hh-prism {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes hh-breath {
          0%, 100% { opacity: 0; transform: scale(0.6); }
          40%      { opacity: 0.75; transform: scale(1.0); }
          80%      { opacity: 0.3; transform: scale(1.3); }
        }
        @keyframes hh-neon {
          0%, 46%, 48%, 100% { opacity: 1; filter: drop-shadow(0 0 10px #ff2b4a) drop-shadow(0 0 20px rgba(255,43,74,0.5)); }
          47%                { opacity: 0.25; filter: drop-shadow(0 0 2px #ff2b4a); }
          76%, 78%           { opacity: 0.4; }
          77%                { opacity: 1; }
        }
        @keyframes hh-smoke {
          0%   { transform: translateY(0) translateX(0) scale(0.9); opacity: 0.0; filter: blur(10px); }
          25%  { opacity: 0.65; }
          100% { transform: translateY(-70px) translateX(10px) scale(1.8); opacity: 0; filter: blur(26px); }
        }
        @keyframes hh-elevator-tick {
          0%, 92%, 100% { opacity: 1; }
          93%           { opacity: 0.2; }
          95%           { opacity: 1; }
          97%           { opacity: 0.3; }
        }

        /* ── Haunted Hotel atmospheric keyframes live in the shared
             HauntedHotelAtmosphere component · see
             src/components/nex-native/HauntedHotelAtmosphere.tsx ── */

        .hh-crack-svg { position: absolute; inset: 0; pointer-events: none; opacity: 0.45; }
        .hh-caustic {
          background: linear-gradient(110deg,
            rgba(255,255,255,0) 0%,
            rgba(205, 190, 255, 0.6) 24%,
            rgba(180, 230, 255, 0.55) 36%,
            rgba(255, 240, 190, 0.55) 48%,
            rgba(255, 190, 220, 0.55) 60%,
            rgba(190, 230, 255, 0.55) 72%,
            rgba(255,255,255,0) 100%);
          background-size: 220% 100%;
          animation: hh-prism 7.5s linear infinite;
        }
      `}</style>

      <main
        style={{
          position: "relative",
          minHeight: "100dvh",
          backgroundColor: "#0b0712",
          color: "#f4f0ea",
          fontFamily:
            "'Georgia', 'Cormorant Garamond', ui-serif, Georgia, serif",
          padding: "32px 20px calc(env(safe-area-inset-bottom, 0) + 48px)",
          overflow: "hidden",
        }}
      >
        {/* ── Haunted Hotel atmosphere · lights flicker + weld sparks ── */}
        <HauntedHotelAtmosphere />

        {/* Dark atmospheric veil over the background image */}
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            background:
              "radial-gradient(ellipse at 50% 40%, rgba(10,6,20,0.35) 0%, rgba(5,3,12,0.78) 85%)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        <div style={{ position: "relative", zIndex: 2, maxWidth: 1080, margin: "0 auto" }}>
          <header style={{ textAlign: "center", marginBottom: 32 }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: "rgba(240,220,200,0.65)",
                marginBottom: 10,
              }}
            >
              Haunted Hotel · premium theme · bubble gallery
            </div>
            <h1
              style={{
                fontSize: 34,
                fontWeight: 400,
                margin: 0,
                letterSpacing: "0.02em",
                color: "#f6ecdd",
                textShadow:
                  "0 2px 24px rgba(0,0,0,0.6), 0 0 36px rgba(255,170,70,0.08)",
              }}
            >
              Ten ways to speak in a haunted room
            </h1>
            <p
              style={{
                fontSize: 13,
                color: "rgba(240,220,200,0.55)",
                marginTop: 8,
                fontStyle: "italic",
              }}
            >
              Each bubble is a visual treatment candidate for the Haunted Hotel chat theme.
              Design preview only · no backend, no delivery, no telemetry.
            </p>
          </header>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
              gap: 20,
            }}
          >
            {prototypes.map((p) => (
              <article
                key={p.n}
                style={{
                  background:
                    "linear-gradient(180deg, rgba(20,14,26,0.65) 0%, rgba(12,8,20,0.75) 100%)",
                  border: "1px solid rgba(255,220,180,0.08)",
                  borderRadius: 18,
                  padding: "22px 20px 20px",
                  boxShadow: "0 24px 50px rgba(0,0,0,0.55)",
                  backdropFilter: "blur(6px)",
                  WebkitBackdropFilter: "blur(6px)",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
                  <span
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "rgba(255,170,70,0.75)",
                    }}
                  >
                    Prototype {String(p.n).padStart(2, "0")}
                  </span>
                  <span
                    style={{
                      fontSize: 15,
                      color: "#f4ecdd",
                      fontWeight: 500,
                    }}
                  >
                    {p.name}
                  </span>
                </div>

                {/* Bubble stage */}
                <div
                  style={{
                    position: "relative",
                    minHeight: 150,
                    padding: "22px 10px",
                    borderRadius: 12,
                    background:
                      "linear-gradient(135deg, rgba(10,6,16,0.5) 0%, rgba(20,14,28,0.3) 100%)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    alignItems: "flex-start",
                    overflow: "hidden",
                  }}
                >
                  {/* Context bubble above (peer side) — gives a chat-feel */}
                  <div
                    style={{
                      alignSelf: "flex-start",
                      maxWidth: "72%",
                      padding: "7px 11px",
                      fontSize: 11.5,
                      color: "rgba(240,230,220,0.55)",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 12,
                      fontStyle: "italic",
                    }}
                  >
                    {SAMPLE_FROM} · {SAMPLE_TIME}
                  </div>

                  <div style={{ alignSelf: "flex-start", maxWidth: "90%" }}>
                    <PrototypeShell>{p.render()}</PrototypeShell>
                  </div>
                </div>

                <p
                  style={{
                    marginTop: 12,
                    marginBottom: 0,
                    fontSize: 12.5,
                    color: "rgba(240,220,200,0.65)",
                    fontStyle: "italic",
                    lineHeight: 1.5,
                  }}
                >
                  {p.tagline}
                </p>
              </article>
            ))}
          </section>

          <footer
            style={{
              marginTop: 42,
              textAlign: "center",
              fontSize: 11,
              color: "rgba(240,220,200,0.4)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            <Link
              href="/nex-native/chat/prototypes"
              style={{ color: "rgba(240,220,200,0.6)", textDecoration: "none" }}
            >
              ← back to chat prototypes
            </Link>
          </footer>
        </div>
      </main>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// Shared shell · provides consistent stage width for each bubble
// ────────────────────────────────────────────────────────────────────

function PrototypeShell({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>{children}</div>;
}

const BODY_FONT: React.CSSProperties = {
  fontFamily: "'Georgia', 'Cormorant Garamond', ui-serif, Georgia, serif",
  fontSize: 15,
  lineHeight: 1.42,
  letterSpacing: "0.005em",
};

const META_FONT: React.CSSProperties = {
  fontFamily: "'Georgia', ui-serif, serif",
  fontSize: 10,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
};

// ────────────────────────────────────────────────────────────────────
// 01 · Misted White · Crack Effect
// ────────────────────────────────────────────────────────────────────

function MistedCrackBubble(): React.ReactElement {
  return (
    <div
      style={{
        position: "relative",
        padding: "16px 22px 14px",
        borderRadius: "22px 22px 22px 6px",
        background:
          "linear-gradient(140deg, rgba(255,255,255,0.92) 0%, rgba(228,222,214,0.88) 100%)",
        color: "#1a1510",
        boxShadow:
          "0 24px 42px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}
    >
      <svg
        viewBox="0 0 320 110"
        preserveAspectRatio="none"
        className="hh-crack-svg"
        aria-hidden
      >
        <g stroke="#1a1510" strokeWidth="0.6" fill="none" strokeLinecap="round">
          <path d="M 240 0 L 232 18 L 240 32 L 228 46 L 240 64" />
          <path d="M 232 18 L 210 22 L 196 14 L 180 20" />
          <path d="M 240 32 L 260 36 L 272 48" />
          <path d="M 228 46 L 212 56 L 198 54 L 180 64" />
          <path d="M 240 64 L 248 86 L 240 110" />
          <path d="M 196 14 L 190 2" />
          <path d="M 272 48 L 290 54" />
        </g>
      </svg>
      {/* Mist corner */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -24,
          right: -24,
          width: 90,
          height: 90,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 65%)",
          filter: "blur(10px)",
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />
      <p style={{ margin: 0, ...BODY_FONT }}>The lobby is quiet tonight. Too quiet.</p>
      <div
        style={{
          marginTop: 6,
          ...META_FONT,
          color: "rgba(26,21,16,0.5)",
          textAlign: "right",
        }}
      >
        {SAMPLE_TIME}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// 02 · Candlelit Parchment
// ────────────────────────────────────────────────────────────────────

function CandlelitParchmentBubble(): React.ReactElement {
  return (
    <div
      style={{
        position: "relative",
        padding: "18px 22px 14px",
        borderRadius: "14px 14px 14px 4px",
        background:
          "linear-gradient(145deg, #f5e9ca 0%, #e9d6a4 55%, #d9bf85 100%)",
        color: "#3a2612",
        animation: "hh-candle 3.5s ease-in-out infinite",
        boxShadow: "0 20px 36px rgba(0,0,0,0.55)",
      }}
    >
      {/* Wax seal */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -10,
          right: -8,
          width: 32,
          height: 32,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 35% 30%, #e63b2f 0%, #8a1a12 60%, #5a0a05 100%)",
          boxShadow: "0 4px 10px rgba(0,0,0,0.6), inset -3px -3px 6px rgba(0,0,0,0.4)",
          display: "grid",
          placeItems: "center",
          color: "rgba(255,210,160,0.7)",
          fontSize: 14,
          fontFamily: "'Georgia', serif",
          fontStyle: "italic",
          transform: "rotate(-10deg)",
        }}
      >
        ℋ
      </div>
      <p style={{ margin: 0, ...BODY_FONT, fontStyle: "italic" }}>
        Your room will be ready at midnight. Not before.
      </p>
      <div
        style={{
          marginTop: 8,
          ...META_FONT,
          color: "rgba(58,38,18,0.55)",
          textAlign: "right",
        }}
      >
        {SAMPLE_TIME}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// 03 · Shadow-Veiled Obsidian
// ────────────────────────────────────────────────────────────────────

function ObsidianBubble(): React.ReactElement {
  return (
    <div
      style={{
        position: "relative",
        padding: "18px 22px 14px",
        borderRadius: "20px 20px 20px 6px",
        background:
          "linear-gradient(135deg, #0e0a14 0%, #1a1322 50%, #0a070e 100%)",
        color: "#e8dfd0",
        boxShadow:
          "0 24px 42px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 40px rgba(0,0,0,0.6)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {/* Whisper outline (glow stroke that flickers) */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 1,
          borderRadius: "19px 19px 19px 5px",
          boxShadow:
            "inset 0 0 0 1px rgba(230,220,200,0.35), 0 0 14px rgba(230,220,200,0.18)",
          animation: "hh-whisper 2.6s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />
      <p style={{ margin: 0, ...BODY_FONT, position: "relative" }}>
        Did you hear the piano? There&rsquo;s no piano here.
      </p>
      <div
        style={{
          marginTop: 6,
          ...META_FONT,
          color: "rgba(232,223,208,0.5)",
          textAlign: "right",
          position: "relative",
          display: "flex",
          justifyContent: "flex-end",
          gap: 6,
          alignItems: "center",
        }}
      >
        <span>{SAMPLE_TIME}</span>
        <span style={{ color: "#9a1a1a", fontSize: 11 }}>✓✓</span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// 04 · Chandelier Crystal · Prism Edge
// ────────────────────────────────────────────────────────────────────

function ChandelierCrystalBubble(): React.ReactElement {
  return (
    <div
      style={{
        position: "relative",
        padding: "18px 22px 14px",
        borderRadius: 16,
        background:
          "linear-gradient(135deg, rgba(230,235,245,0.84) 0%, rgba(205,215,230,0.78) 100%)",
        color: "#1a2030",
        boxShadow:
          "0 24px 42px rgba(80,100,160,0.3), inset 0 1px 0 rgba(255,255,255,0.9)",
        clipPath:
          "polygon(0 10%, 10% 0, 90% 0, 100% 10%, 100% 90%, 90% 100%, 10% 100%, 0 90%)",
        overflow: "hidden",
      }}
    >
      {/* Prismatic edge rail */}
      <div
        aria-hidden
        className="hh-caustic"
        style={{
          position: "absolute",
          inset: 0,
          mixBlendMode: "overlay",
          opacity: 0.65,
          pointerEvents: "none",
        }}
      />
      {/* Hanging crystal pendant */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -14,
          right: 24,
          width: 10,
          height: 20,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(180,210,255,0.5) 100%)",
          clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
        }}
      />
      <p style={{ margin: 0, ...BODY_FONT, position: "relative" }}>
        The chandelier is swinging again. There is no draft.
      </p>
      <div
        style={{
          marginTop: 6,
          ...META_FONT,
          color: "rgba(26,32,48,0.55)",
          textAlign: "right",
          position: "relative",
        }}
      >
        {SAMPLE_TIME}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// 05 · Victorian Lace Border
// ────────────────────────────────────────────────────────────────────

function VictorianLaceBubble(): React.ReactElement {
  // Lace pattern as repeating SVG background (data URL)
  const laceSvg = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 16'>
      <g fill='none' stroke='%23111' stroke-width='0.8' opacity='0.9'>
        <circle cx='8' cy='8' r='3'/>
        <circle cx='20' cy='8' r='3'/>
        <circle cx='32' cy='8' r='3'/>
        <path d='M 2 8 L 5 8 M 11 8 L 17 8 M 23 8 L 29 8 M 35 8 L 38 8'/>
        <path d='M 8 5 L 8 2 M 20 5 L 20 2 M 32 5 L 32 2'/>
        <path d='M 8 11 L 8 14 M 20 11 L 20 14 M 32 11 L 32 14'/>
      </g>
    </svg>`,
  )}`;
  return (
    <div
      style={{
        position: "relative",
        padding: "22px 20px 20px",
        borderRadius: 6,
        background: "#f6ecd9",
        color: "#2a1a0e",
        boxShadow: "0 22px 36px rgba(0,0,0,0.5)",
      }}
    >
      {/* Top lace band */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: 10,
          backgroundImage: `url("${laceSvg}")`,
          backgroundRepeat: "repeat-x",
          backgroundSize: "auto 10px",
          opacity: 0.85,
        }}
      />
      {/* Bottom lace band */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 10,
          backgroundImage: `url("${laceSvg}")`,
          backgroundRepeat: "repeat-x",
          backgroundSize: "auto 10px",
          opacity: 0.85,
          transform: "scaleY(-1)",
        }}
      />
      <p style={{ margin: 0, ...BODY_FONT, fontStyle: "italic" }}>
        A gentleman from room 12 is asking about you.
      </p>
      <div
        style={{
          marginTop: 6,
          ...META_FONT,
          color: "rgba(42,26,14,0.55)",
          textAlign: "right",
        }}
      >
        {SAMPLE_TIME}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// 06 · Fog-Draped Mirror · Breath Fog
// ────────────────────────────────────────────────────────────────────

function FogMirrorBubble(): React.ReactElement {
  return (
    <div
      style={{
        position: "relative",
        padding: "18px 22px 14px",
        borderRadius: 14,
        background:
          "linear-gradient(145deg, #c4ccd4 0%, #e6ecef 30%, #a8b2bb 70%, #d4dade 100%)",
        color: "#141a22",
        boxShadow:
          "0 24px 42px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -2px 0 rgba(0,0,0,0.18)",
        overflow: "hidden",
      }}
    >
      {/* Breath-fog blobs that bloom and dissolve */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "22%",
          top: "40%",
          width: 70,
          height: 70,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 70%)",
          filter: "blur(6px)",
          animation: "hh-breath 4.2s ease-in-out infinite",
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          right: "18%",
          top: "15%",
          width: 55,
          height: 55,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0) 70%)",
          filter: "blur(5px)",
          animation: "hh-breath 5.1s ease-in-out infinite",
          animationDelay: "1.6s",
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />
      <p style={{ margin: 0, ...BODY_FONT, position: "relative", textShadow: "0 1px 0 rgba(255,255,255,0.5)" }}>
        Please don&rsquo;t look behind you.
      </p>
      <div
        style={{
          marginTop: 6,
          ...META_FONT,
          color: "rgba(20,26,34,0.6)",
          textAlign: "right",
          position: "relative",
        }}
      >
        {SAMPLE_TIME}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// 07 · Haunted Elevator · Brass Numeral
// ────────────────────────────────────────────────────────────────────

function ElevatorBrassBubble(): React.ReactElement {
  return (
    <div
      style={{
        position: "relative",
        padding: "18px 22px 14px 70px",
        borderRadius: 10,
        background:
          "linear-gradient(135deg, #4a3315 0%, #76552b 30%, #d8a856 50%, #76552b 70%, #4a3315 100%)",
        backgroundSize: "260% 100%",
        color: "#2a1d08",
        boxShadow:
          "0 22px 36px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,220,150,0.5), inset 0 -1px 0 rgba(0,0,0,0.4)",
        overflow: "hidden",
      }}
    >
      {/* Floor dial */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 12,
          top: "50%",
          transform: "translateY(-50%)",
          width: 44,
          height: 44,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 35% 30%, #2a1a06 0%, #0f0a02 70%)",
          display: "grid",
          placeItems: "center",
          boxShadow:
            "inset 0 2px 4px rgba(0,0,0,0.9), 0 0 0 2px #d8a856, 0 0 0 3px rgba(0,0,0,0.6)",
        }}
      >
        <span
          style={{
            fontFamily: "'Georgia', 'Playfair Display', serif",
            color: "#d8a856",
            fontSize: 20,
            fontWeight: 700,
            textShadow: "0 0 6px rgba(216,168,86,0.8)",
            animation: "hh-elevator-tick 4.8s steps(1) infinite",
          }}
        >
          13
        </span>
      </div>
      <p style={{ margin: 0, ...BODY_FONT, color: "#f6ecd9" }}>
        The elevator keeps going to the 13th floor by itself.
      </p>
      <div
        style={{
          marginTop: 6,
          ...META_FONT,
          color: "rgba(246,236,217,0.65)",
          textAlign: "right",
        }}
      >
        {SAMPLE_TIME}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// 08 · Peeling Wallpaper · Damask
// ────────────────────────────────────────────────────────────────────

function PeelingWallpaperBubble(): React.ReactElement {
  const damaskSvg = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'>
      <rect width='60' height='60' fill='%23613a2a'/>
      <g fill='none' stroke='%238a5a3a' stroke-width='1' opacity='0.85'>
        <path d='M 30 8 C 20 18, 20 30, 30 40 C 40 30, 40 18, 30 8 Z'/>
        <path d='M 30 20 C 24 26, 24 34, 30 40'/>
        <circle cx='30' cy='46' r='2'/>
        <path d='M 8 30 Q 14 24, 20 30 Q 14 36, 8 30 Z'/>
        <path d='M 52 30 Q 46 24, 40 30 Q 46 36, 52 30 Z'/>
      </g>
    </svg>`,
  )}`;
  return (
    <div
      style={{
        position: "relative",
        padding: "18px 22px 14px",
        borderRadius: 8,
        backgroundImage: `url("${damaskSvg}")`,
        backgroundSize: "60px 60px",
        color: "#f3e2cc",
        boxShadow: "0 22px 36px rgba(0,0,0,0.65), inset 0 0 60px rgba(0,0,0,0.4)",
        overflow: "hidden",
      }}
    >
      {/* Peeled corner reveal */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 60,
          height: 60,
          background:
            "linear-gradient(225deg, #2a1a10 0%, #4a2f1e 50%, transparent 60%)",
          clipPath: "polygon(100% 0, 0 0, 100% 100%)",
          filter: "drop-shadow(-2px 2px 4px rgba(0,0,0,0.6))",
        }}
      />
      {/* Shadow of the curl */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 2,
          right: 12,
          width: 36,
          height: 2,
          background: "rgba(0,0,0,0.5)",
          filter: "blur(2px)",
          transform: "rotate(-45deg)",
          transformOrigin: "right",
        }}
      />
      <p style={{ margin: 0, ...BODY_FONT, position: "relative", textShadow: "0 1px 2px rgba(0,0,0,0.7)" }}>
        Behind the wallpaper there is a doorway nobody uses.
      </p>
      <div
        style={{
          marginTop: 6,
          ...META_FONT,
          color: "rgba(243,226,204,0.6)",
          textAlign: "right",
          position: "relative",
        }}
      >
        {SAMPLE_TIME}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// 09 · Flickering Neon Vacancy
// ────────────────────────────────────────────────────────────────────

function NeonVacancyBubble(): React.ReactElement {
  return (
    <div
      style={{
        position: "relative",
        padding: "18px 22px 16px",
        borderRadius: 14,
        background: "rgba(10,6,16,0.7)",
        color: "#ffeef0",
        border: "2px solid #ff2b4a",
        boxShadow:
          "0 0 10px rgba(255,43,74,0.6), 0 0 24px rgba(255,43,74,0.35), inset 0 0 12px rgba(255,43,74,0.3)",
        animation: "hh-neon 3.4s steps(1) infinite",
      }}
    >
      <div
        style={{
          marginBottom: 8,
          ...META_FONT,
          color: "#ff2b4a",
          textShadow: "0 0 6px #ff2b4a, 0 0 12px rgba(255,43,74,0.6)",
          letterSpacing: "0.3em",
        }}
      >
        · Vacancy ·
      </div>
      <p style={{ margin: 0, ...BODY_FONT, color: "#ffeef0" }}>
        We always have a vacancy for you.
      </p>
      <div
        style={{
          marginTop: 6,
          ...META_FONT,
          color: "rgba(255,238,240,0.55)",
          textAlign: "right",
        }}
      >
        {SAMPLE_TIME}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// 10 · Spectral Smoke Trail
// ────────────────────────────────────────────────────────────────────

function SpectralSmokeBubble(): React.ReactElement {
  return (
    <div
      style={{
        position: "relative",
        padding: "18px 22px 14px",
        borderRadius: "18px 18px 18px 4px",
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.12) 0%, rgba(180,195,215,0.18) 100%)",
        color: "#f0e7dc",
        border: "1px solid rgba(255,255,255,0.15)",
        boxShadow:
          "0 24px 42px rgba(0,0,0,0.5), inset 0 0 30px rgba(255,255,255,0.08)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        overflow: "visible",
      }}
    >
      {/* Smoke tendrils rising from the top edge */}
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          aria-hidden
          style={{
            position: "absolute",
            left: `${20 + i * 22}%`,
            top: -10,
            width: 36,
            height: 36,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(255,255,255,0.78) 0%, rgba(230,235,245,0.3) 40%, rgba(255,255,255,0) 70%)",
            filter: "blur(10px)",
            animation: `hh-smoke ${5 + i * 0.7}s ease-out ${i * 0.9}s infinite`,
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />
      ))}
      <p style={{ margin: 0, ...BODY_FONT, position: "relative" }}>
        Something followed me up from the basement.
      </p>
      <div
        style={{
          marginTop: 6,
          ...META_FONT,
          color: "rgba(240,231,220,0.6)",
          textAlign: "right",
          position: "relative",
        }}
      >
        {SAMPLE_TIME}
      </div>
    </div>
  );
}
