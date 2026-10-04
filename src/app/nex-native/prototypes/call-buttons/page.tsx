// src/app/nex-native/prototypes/call-buttons/page.tsx
//
// Prototype page · five distinct "touch screen" style call-button
// treatments laid out on the real Create Account / Call Center
// canvas so the founder can pick a direction without having to
// imagine them. No behaviour · pure visual sketch.

import type * as React from "react";

export const dynamic = "force-dynamic";

const PAL = {
  bg: "#020914",
  glow: "rgba(0,175,255,0.09)",
  text: "#F2F5FA",
  textDim: "#A6ADC2",
  textMuted: "#6B7490",
  orange: "#FF9933",
  orangeDeep: "#FF7200",
  cyan: "#4C8DF2",
  cyanBright: "#00AFFF",
  darkRed: "#991B1B",
};

const BUTTONS: Array<{ label: string; icon: React.ReactNode; tone?: "danger" }> = [
  { label: "Mute",    icon: <MicIcon /> },
  { label: "Speaker", icon: <SpeakerIcon /> },
  { label: "Keypad",  icon: <KeypadIcon /> },
  { label: "Add",     icon: <AddIcon /> },
  { label: "Record",  icon: <RecordIcon /> },
  { label: "End",     icon: <EndIcon />, tone: "danger" },
];

export default function CallButtonPrototypes(): React.JSX.Element {
  return (
    <>
      <style>{`
        html, body { background: ${PAL.bg} !important; }
      `}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: PAL.bg,
          color: PAL.text,
          padding: "calc(env(safe-area-inset-top, 0) + 20px) 20px 48px",
          position: "relative",
          overflow: "hidden",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(60% 40% at 50% 0%, rgba(0,175,255,0.09), transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 460, margin: "0 auto" }}>
          <header style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.3em", color: PAL.textDim, fontWeight: 600 }}>
              NEX · CALL BUTTON PROTOTYPES
            </div>
            <h1 style={{ margin: "8px 0 4px", fontSize: 22, fontWeight: 700 }}>
              Five directions
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: PAL.textDim, lineHeight: 1.5 }}>
              Pick the shape language for the touch-screen call surface.
              Icons + labels identical across all five.
            </p>
          </header>

          <PrototypeSection
            index={1}
            name="Panel"
            tagline="Rounded tiles · cyan edge glow · Tesla dashboard"
            renderGrid={PanelGrid}
          />
          <PrototypeSection
            index={2}
            name="Hex"
            tagline="Honeycomb hexagons · pure sci-fi · unusual silhouette"
            renderGrid={HexGrid}
          />
          <PrototypeSection
            index={3}
            name="Glass"
            tagline="Frosted glass squares · Vision Pro / iOS 26 feel"
            renderGrid={GlassGrid}
          />
          <PrototypeSection
            index={4}
            name="Neon"
            tagline="Transparent centre · neon outline · arcade / retro-future"
            renderGrid={NeonGrid}
          />
          <PrototypeSection
            index={5}
            name="HUD"
            tagline="Clipped-corner polygons · video-game HUD brackets"
            renderGrid={HudGrid}
          />
        </div>
      </main>
    </>
  );
}

function PrototypeSection({
  index,
  name,
  tagline,
  renderGrid,
}: {
  index: number;
  name: string;
  tagline: string;
  renderGrid: () => React.JSX.Element;
}): React.JSX.Element {
  return (
    <section
      style={{
        marginBottom: 32,
        padding: "20px 16px 24px",
        borderRadius: 20,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: PAL.orange,
            letterSpacing: "0.12em",
          }}
        >
          0{index}
        </span>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{name}</h2>
      </div>
      <p
        style={{
          margin: "0 0 18px",
          fontSize: 12,
          color: PAL.textDim,
          lineHeight: 1.4,
        }}
      >
        {tagline}
      </p>
      {renderGrid()}
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────── *
 * 01 · PANEL · rounded-rectangle tiles with cyan edge glow         *
 * ──────────────────────────────────────────────────────────────── */

function PanelGrid(): React.JSX.Element {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 14,
        placeItems: "center",
      }}
    >
      {BUTTONS.map((b) => {
        const danger = b.tone === "danger";
        return (
          <div
            key={b.label}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
          >
            <div
              style={{
                width: 76,
                height: 68,
                borderRadius: 16,
                background: danger ? PAL.darkRed : PAL.orange,
                color: "#fff",
                display: "grid",
                placeItems: "center",
                border: `1px solid ${danger ? "rgba(153,27,27,0.9)" : "rgba(76,141,242,0.55)"}`,
                boxShadow: danger
                  ? "0 10px 24px rgba(153,27,27,0.45)"
                  : `0 0 0 1px rgba(76,141,242,0.35), 0 0 22px rgba(76,141,242,0.25), 0 8px 18px rgba(255,153,51,0.22)`,
              }}
            >
              {b.icon}
            </div>
            <span style={{ fontSize: 11.5, color: PAL.textDim, fontWeight: 500 }}>
              {b.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── *
 * 02 · HEX · hexagonal buttons · honeycomb                         *
 * ──────────────────────────────────────────────────────────────── */

function HexGrid(): React.JSX.Element {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 14,
        placeItems: "center",
      }}
    >
      {BUTTONS.map((b) => {
        const danger = b.tone === "danger";
        return (
          <div
            key={b.label}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
          >
            <div
              style={{
                position: "relative",
                width: 78,
                height: 86,
              }}
            >
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
                  background: danger ? PAL.darkRed : PAL.orange,
                  filter: danger
                    ? "drop-shadow(0 10px 20px rgba(153,27,27,0.45))"
                    : "drop-shadow(0 0 14px rgba(76,141,242,0.4)) drop-shadow(0 8px 18px rgba(255,153,51,0.25))",
                }}
              />
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 2,
                  clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
                  background: danger ? PAL.darkRed : PAL.orange,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  color: "#fff",
                  zIndex: 1,
                }}
              >
                {b.icon}
              </div>
            </div>
            <span style={{ fontSize: 11.5, color: PAL.textDim, fontWeight: 500 }}>
              {b.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── *
 * 03 · GLASS · frosted square tiles · Vision Pro feel              *
 * ──────────────────────────────────────────────────────────────── */

function GlassGrid(): React.JSX.Element {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 14,
        placeItems: "center",
      }}
    >
      {BUTTONS.map((b) => {
        const danger = b.tone === "danger";
        return (
          <div
            key={b.label}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 20,
                background: danger
                  ? "rgba(153,27,27,0.78)"
                  : "rgba(255,255,255,0.08)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                border: `1px solid ${danger ? "rgba(255,120,120,0.3)" : "rgba(255,255,255,0.22)"}`,
                color: danger ? "#fff" : PAL.orange,
                display: "grid",
                placeItems: "center",
                boxShadow: danger
                  ? "0 10px 24px rgba(153,27,27,0.45)"
                  : "inset 0 1px 0 rgba(255,255,255,0.2), 0 6px 16px rgba(0,0,0,0.4)",
              }}
            >
              {b.icon}
            </div>
            <span style={{ fontSize: 11.5, color: PAL.textDim, fontWeight: 500 }}>
              {b.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── *
 * 04 · NEON · outlined only · arcade / retro-future                *
 * ──────────────────────────────────────────────────────────────── */

function NeonGrid(): React.JSX.Element {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 14,
        placeItems: "center",
      }}
    >
      {BUTTONS.map((b) => {
        const danger = b.tone === "danger";
        const stroke = danger ? PAL.darkRed : PAL.orange;
        return (
          <div
            key={b.label}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
          >
            <div
              style={{
                width: 76,
                height: 68,
                borderRadius: 14,
                background: "transparent",
                border: `2px solid ${stroke}`,
                color: stroke,
                display: "grid",
                placeItems: "center",
                boxShadow: `0 0 14px ${stroke}66, inset 0 0 10px ${stroke}22`,
                position: "relative",
              }}
            >
              {b.icon}
              {/* Corner nicks for the neon-arcade vibe */}
              {["tl", "tr", "bl", "br"].map((corner) => (
                <span
                  key={corner}
                  aria-hidden
                  style={{
                    position: "absolute",
                    width: 10,
                    height: 10,
                    borderColor: stroke,
                    borderStyle: "solid",
                    borderWidth: 0,
                    ...(corner === "tl"
                      ? { top: -1, left: -1, borderTopWidth: 2, borderLeftWidth: 2 }
                      : corner === "tr"
                        ? { top: -1, right: -1, borderTopWidth: 2, borderRightWidth: 2 }
                        : corner === "bl"
                          ? { bottom: -1, left: -1, borderBottomWidth: 2, borderLeftWidth: 2 }
                          : { bottom: -1, right: -1, borderBottomWidth: 2, borderRightWidth: 2 }),
                  }}
                />
              ))}
            </div>
            <span style={{ fontSize: 11.5, color: PAL.textDim, fontWeight: 500 }}>
              {b.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── *
 * 05 · HUD · clipped-corner polygons · video-game HUD              *
 * ──────────────────────────────────────────────────────────────── */

function HudGrid(): React.JSX.Element {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 14,
        placeItems: "center",
      }}
    >
      {BUTTONS.map((b) => {
        const danger = b.tone === "danger";
        const bg = danger ? PAL.darkRed : PAL.orange;
        return (
          <div
            key={b.label}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
          >
            <div
              style={{
                position: "relative",
                width: 80,
                height: 72,
              }}
            >
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  clipPath:
                    "polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px)",
                  background: bg,
                  boxShadow: danger
                    ? "0 10px 24px rgba(153,27,27,0.45)"
                    : "0 10px 24px rgba(255,153,51,0.3)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  color: "#fff",
                  zIndex: 1,
                }}
              >
                {b.icon}
              </div>
              {/* HUD corner brackets · cyan */}
              {!danger && (
                <>
                  {(["tl", "tr", "bl", "br"] as const).map((c) => (
                    <HudBracket key={c} corner={c} />
                  ))}
                </>
              )}
            </div>
            <span style={{ fontSize: 11.5, color: PAL.textDim, fontWeight: 500 }}>
              {b.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function HudBracket({
  corner,
}: {
  corner: "tl" | "tr" | "bl" | "br";
}): React.JSX.Element {
  const base: React.CSSProperties = {
    position: "absolute",
    width: 14,
    height: 14,
    borderColor: PAL.cyanBright,
    borderStyle: "solid",
    borderWidth: 0,
    filter: `drop-shadow(0 0 6px ${PAL.cyan})`,
  };
  const offset = -4;
  switch (corner) {
    case "tl": return <span aria-hidden style={{ ...base, top: offset, left: offset, borderTopWidth: 2, borderLeftWidth: 2 }} />;
    case "tr": return <span aria-hidden style={{ ...base, top: offset, right: offset, borderTopWidth: 2, borderRightWidth: 2 }} />;
    case "bl": return <span aria-hidden style={{ ...base, bottom: offset, left: offset, borderBottomWidth: 2, borderLeftWidth: 2 }} />;
    case "br": return <span aria-hidden style={{ ...base, bottom: offset, right: offset, borderBottomWidth: 2, borderRightWidth: 2 }} />;
  }
}

/* ──────────────────────────────────────────────────────────────── *
 * Icons · shared across all 5 prototypes                            *
 * ──────────────────────────────────────────────────────────────── */

function MicIcon(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x={9} y={2} width={6} height={12} rx={3} />
      <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
      <line x1={12} y1={19} x2={12} y2={22} />
      <line x1={8} y1={22} x2={16} y2={22} />
    </svg>
  );
}
function SpeakerIcon(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}
function KeypadIcon(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      {[
        [4, 4], [11, 4], [18, 4],
        [4, 11], [11, 11], [18, 11],
        [4, 18], [11, 18], [18, 18],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={1.6} />
      ))}
    </svg>
  );
}
function AddIcon(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx={9} cy={7} r={4} />
      <line x1={19} y1={8} x2={19} y2={14} />
      <line x1={16} y1={11} x2={22} y2={11} />
    </svg>
  );
}
function RecordIcon(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden>
      <circle cx={12} cy={12} r={10} fill="none" stroke="currentColor" strokeWidth={1.9} />
      <circle cx={12} cy={12} r={4.5} fill="currentColor" />
    </svg>
  );
}
function EndIcon(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.28-1.28a2 2 0 0 1 2.11-.45c.9.35 1.84.6 2.8.72a2 2 0 0 1 1.72 2z" transform="rotate(135 12 12)" />
    </svg>
  );
}
