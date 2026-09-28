// src/app/nex-native/themes/chat-feed-prototypes/page.tsx
//
// Bridge 26 · 10 creative chat-feed designs that REPLACE the
// traditional bubble pattern. Scroll gallery for design approval.
// Every prototype ships two speakers (M · Maria, P · Philip) so
// you can see how the design handles alternation.
//
// URL: /nex-native/themes/chat-feed-prototypes

import type * as React from "react";

export const dynamic = "force-static";
export const runtime = "nodejs";
export const metadata = { title: "NEX · 10 chat feed prototypes" };

const SANS =
  "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const MONO =
  "'JetBrains Mono', 'SF Mono', ui-monospace, Menlo, Consolas, monospace";
const SERIF =
  "'Cormorant Garamond', 'EB Garamond', Georgia, serif";
const HAND =
  "'Caveat', 'Segoe Script', 'Bradley Hand', cursive";
const DISPLAY =
  "'Manrope', ui-sans-serif, system-ui, -apple-system, sans-serif";

interface Msg {
  who: "m" | "p";
  body: string;
  time: string;
}
const CONVO: Msg[] = [
  { who: "m", body: "Sunset tonight is unreal — running by the pier?", time: "18:04" },
  { who: "p", body: "On my way. Grab you a coffee?", time: "18:06" },
  { who: "m", body: "Yes please. Oat + cinnamon 🤎", time: "18:07" },
  { who: "p", body: "Locked. See you in 10.", time: "18:08" },
];

export default function ChatFeedPrototypesPage() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0B0F1A",
        color: "#F4F7FC",
        fontFamily: SANS,
        padding: "24px 12px 60px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Manrope:wght@400;600;800&family=JetBrains+Mono:wght@400;600&family=Caveat:wght@400;600;700&family=Cormorant+Garamond:wght@400;500;600&display=swap');
        body { margin: 0; padding: 0; background: #0B0F1A; }
        @keyframes proto-scan { 0%,100%{transform:translateX(-100%)} 50%{transform:translateX(100%)} }
        @keyframes proto-flicker { 0%,60%,100%{opacity:1} 62%,64%{opacity:.6} }
        @keyframes proto-drift { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
      `}</style>

      <header style={{ maxWidth: 440, margin: "0 auto 26px" }}>
        <div style={eyebrow("#FF7800")}>Bridge 26 · design gallery</div>
        <h1
          style={{
            margin: "6px 0 6px",
            fontFamily: DISPLAY,
            fontSize: 28,
            lineHeight: 1.1,
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          10 chat feeds without the boring bubble
        </h1>
        <p style={{ margin: 0, color: "#8BA9D1", fontSize: 13, lineHeight: 1.55 }}>
          Two speakers, four messages each. Scroll to pick the ones NEX
          should build into shippable themes.
        </p>
      </header>

      <div
        style={{
          maxWidth: 440,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <Card index={1} title="Timeline Ribbon" caption="Vertical spine · messages hang off ticks like a train timetable.">
          <TimelineRibbon />
        </Card>
        <Card index={2} title="Sky Cards" caption="Cloud-shaped floating messages · romantic dreamy sky bg.">
          <SkyCards />
        </Card>
        <Card index={3} title="Polaroid Stack" caption="Rotated photo-card messages · handwritten timestamps.">
          <PolaroidStack />
        </Card>
        <Card index={4} title="Movie Subtitle" caption="Full-width typography · no container · pure cinematic type.">
          <MovieSubtitle />
        </Card>
        <Card index={5} title="Terminal Console" caption="Prompt prefixes · monospace · blinking cursor.">
          <TerminalConsole />
        </Card>
        <Card index={6} title="Voice Wave" caption="Waveform-backed rows · every message reads like an audio note.">
          <VoiceWave />
        </Card>
        <Card index={7} title="Neon Signs" caption="Glowing script · different neon colours per speaker.">
          <NeonSigns />
        </Card>
        <Card index={8} title="Handwritten Notes" caption="Paper notes · slight rotation · pastel washi tape.">
          <HandwrittenNotes />
        </Card>
        <Card index={9} title="Ticker Tape" caption="Long horizontal ribbons · slight wave · industrial feel.">
          <TickerTape />
        </Card>
        <Card index={10} title="Thread Beads" caption="Beads on a coloured thread · each speaker owns a colour.">
          <ThreadBeads />
        </Card>
      </div>

      <footer style={{ maxWidth: 440, margin: "40px auto 0", textAlign: "center", color: "#526B89", fontSize: 11 }}>
        Pick any number of these · they can also mix and match per theme.
      </footer>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── *
 *  Shared card frame                                              *
 * ─────────────────────────────────────────────────────────────── */

function Card({
  index,
  title,
  caption,
  children,
}: {
  index: number;
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        borderRadius: 20,
        overflow: "hidden",
        background: "#131a2b",
        border: "1px solid rgba(139,169,209,0.16)",
      }}
    >
      <div style={{ padding: "14px 16px 10px" }}>
        <div style={eyebrow("#00AFFF")}>{index.toString().padStart(2, "0")} · prototype</div>
        <div style={{ fontSize: 17, fontWeight: 800, marginTop: 3 }}>{title}</div>
        <div style={{ fontSize: 12, color: "#8BA9D1", marginTop: 3, lineHeight: 1.55 }}>{caption}</div>
      </div>
      <div style={{ padding: "0 8px 16px" }}>{children}</div>
    </section>
  );
}

function eyebrow(color: string): React.CSSProperties {
  return {
    fontSize: 10,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    color,
    fontWeight: 700,
  };
}

/* ─────────────────────────────────────────────────────────────── *
 *  1 · Timeline Ribbon                                            *
 * ─────────────────────────────────────────────────────────────── */

function TimelineRibbon() {
  return (
    <div
      style={{
        position: "relative",
        padding: "12px 12px 12px 44px",
        background:
          "linear-gradient(180deg, #0f172a 0%, #131a2b 100%)",
        borderRadius: 14,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 18,
          bottom: 18,
          left: 28,
          width: 2,
          background:
            "linear-gradient(180deg, rgba(255,120,0,0.9) 0%, rgba(0,175,255,0.9) 100%)",
        }}
      />
      {CONVO.map((m, i) => {
        const mine = m.who === "p";
        return (
          <div key={i} style={{ position: "relative", padding: "10px 0" }}>
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: -22,
                top: 12,
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: mine ? "#00AFFF" : "#FF7800",
                boxShadow: `0 0 8px ${mine ? "rgba(0,175,255,0.55)" : "rgba(255,120,0,0.55)"}`,
              }}
            />
            <div style={{ fontSize: 10, letterSpacing: "0.14em", color: mine ? "#00AFFF" : "#FF7800", fontWeight: 700, textTransform: "uppercase" }}>
              {mine ? "Philip" : "Maria"} · {m.time}
            </div>
            <div style={{ fontSize: 15, marginTop: 3, lineHeight: 1.45 }}>{m.body}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── *
 *  2 · Sky Cards                                                  *
 * ─────────────────────────────────────────────────────────────── */

function SkyCards() {
  return (
    <div
      style={{
        borderRadius: 14,
        padding: "18px 14px",
        background:
          "linear-gradient(180deg, #F9C6D2 0%, #C6A5E0 55%, #7EB1E0 100%)",
        color: "#1a0f22",
        minHeight: 240,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {CONVO.map((m, i) => {
        const mine = m.who === "p";
        return (
          <div
            key={i}
            style={{
              alignSelf: mine ? "flex-end" : "flex-start",
              maxWidth: "78%",
              position: "relative",
              padding: "12px 18px",
              borderRadius: 30,
              background: "rgba(255,255,255,0.85)",
              boxShadow:
                "0 8px 22px rgba(97,63,142,0.22), inset 0 1px 0 rgba(255,255,255,0.9)",
              backdropFilter: "blur(6px)",
              animation: `proto-drift ${5 + i * 0.6}s ease-in-out infinite`,
            }}
          >
            <div style={{ fontSize: 9, letterSpacing: "0.16em", color: mine ? "#5f3aa0" : "#3a5f8f", fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>
              {mine ? "Philip" : "Maria"} · {m.time}
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.4 }}>{m.body}</div>
            {/* cloud bumps */}
            <span aria-hidden style={{ position: "absolute", bottom: -8, [mine ? "right" : "left"]: 24, width: 20, height: 14, borderRadius: "50%", background: "rgba(255,255,255,0.85)" }} />
            <span aria-hidden style={{ position: "absolute", bottom: -4, [mine ? "right" : "left"]: 12, width: 12, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.7)" }} />
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── *
 *  3 · Polaroid Stack                                             *
 * ─────────────────────────────────────────────────────────────── */

function PolaroidStack() {
  return (
    <div
      style={{
        borderRadius: 14,
        padding: "22px 12px 32px",
        background:
          "radial-gradient(ellipse at top, #2c1e14 0%, #0e0806 100%)",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      {CONVO.map((m, i) => {
        const mine = m.who === "p";
        const rot = mine ? 1.5 : -1.8;
        return (
          <div
            key={i}
            style={{
              alignSelf: mine ? "flex-end" : "flex-start",
              width: "72%",
              transform: `rotate(${rot}deg)`,
              background: "#FBFAF3",
              padding: "12px 12px 20px",
              boxShadow:
                "0 10px 24px rgba(0,0,0,0.55), 0 1px 0 rgba(0,0,0,0.15)",
              color: "#211a12",
            }}
          >
            <div
              style={{
                background:
                  mine
                    ? "linear-gradient(135deg, #ffd6a5, #ffb480)"
                    : "linear-gradient(135deg, #cdb4db, #a2d2ff)",
                borderRadius: 3,
                padding: "12px 14px",
                fontSize: 14,
                lineHeight: 1.4,
                color: "#231a10",
                fontFamily: SERIF,
              }}
            >
              {m.body}
            </div>
            <div
              style={{
                marginTop: 10,
                fontFamily: HAND,
                fontSize: 16,
                lineHeight: 1,
                color: "#4a3527",
                textAlign: mine ? "right" : "left",
              }}
            >
              — {mine ? "Philip" : "Maria"} · {m.time}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── *
 *  4 · Movie Subtitle                                             *
 * ─────────────────────────────────────────────────────────────── */

function MovieSubtitle() {
  return (
    <div
      style={{
        borderRadius: 14,
        padding: "28px 12px 12px",
        background:
          "linear-gradient(180deg, #050506 0%, #0f0f14 100%)",
        minHeight: 240,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        gap: 12,
      }}
    >
      {CONVO.map((m, i) => {
        const mine = m.who === "p";
        return (
          <div key={i} style={{ textAlign: "center", opacity: 0.4 + (i / CONVO.length) * 0.6 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: mine ? "#FFC97C" : "#7CC0FF",
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              {mine ? "Philip" : "Maria"}
            </div>
            <div
              style={{
                fontFamily: SERIF,
                fontSize: 22,
                lineHeight: 1.25,
                color: "#F4F1E6",
                fontWeight: 500,
                textShadow: "0 1px 0 rgba(0,0,0,0.9), 0 2px 6px rgba(0,0,0,0.55)",
                letterSpacing: "-0.005em",
              }}
            >
              &ldquo;{m.body}&rdquo;
            </div>
            <div style={{ fontSize: 9, letterSpacing: "0.18em", color: "#8b8074", marginTop: 4 }}>{m.time}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── *
 *  5 · Terminal Console                                           *
 * ─────────────────────────────────────────────────────────────── */

function TerminalConsole() {
  return (
    <div
      style={{
        borderRadius: 14,
        padding: "18px 16px",
        background: "#0A0F0A",
        fontFamily: MONO,
        border: "1px solid rgba(0,255,120,0.18)",
        boxShadow: "inset 0 0 60px rgba(0,255,120,0.08)",
        color: "#B8FFCC",
      }}
    >
      <div style={{ fontSize: 10, color: "#4CFF9F", marginBottom: 10, opacity: 0.7 }}>
        nex-chat v3 · maria ↔ philip · secure
      </div>
      {CONVO.map((m, i) => {
        const mine = m.who === "p";
        return (
          <div key={i} style={{ fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
            <span style={{ color: mine ? "#7CC0FF" : "#FF9F7C", fontWeight: 600 }}>
              {mine ? "> philip" : "> maria"}
            </span>
            <span style={{ color: "#4a5a4d" }}> [{m.time}]</span>
            <span style={{ color: "#B8FFCC" }}>: {m.body}</span>
          </div>
        );
      })}
      <div style={{ marginTop: 8, fontSize: 13 }}>
        <span style={{ color: "#7CC0FF" }}>&gt; philip</span>
        <span style={{ color: "#B8FFCC" }}>: </span>
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 14,
            background: "#4CFF9F",
            verticalAlign: "middle",
            animation: "proto-flicker 1.1s steps(2) infinite",
          }}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── *
 *  6 · Voice Wave                                                 *
 * ─────────────────────────────────────────────────────────────── */

function VoiceWave() {
  return (
    <div
      style={{
        borderRadius: 14,
        padding: "14px 12px",
        background: "linear-gradient(180deg, #101827, #1c2438)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {CONVO.map((m, i) => {
        const mine = m.who === "p";
        const accent = mine ? "#7CC0FF" : "#FFC97C";
        // Deterministic bar heights per message so SSR + client match.
        const bars = Array.from({ length: 26 }, (_, k) =>
          6 + Math.abs(Math.sin(k * (m.who === "p" ? 0.7 : 0.5) + i)) * 22,
        );
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, flexDirection: mine ? "row-reverse" : "row" }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: accent, color: "#0B0F1A", display: "grid", placeItems: "center", fontWeight: 800, flexShrink: 0 }}>
              {mine ? "P" : "M"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 34 }}>
                {bars.map((h, k) => (
                  <div key={k} style={{ width: 3, height: h, borderRadius: 2, background: accent, opacity: 0.35 + (k / bars.length) * 0.65 }} />
                ))}
              </div>
              <div style={{ fontSize: 13, color: "#F4F7FC", marginTop: 4, lineHeight: 1.4 }}>{m.body}</div>
              <div style={{ fontSize: 10, color: "#526B89", marginTop: 2, letterSpacing: "0.06em" }}>{m.time}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── *
 *  7 · Neon Signs                                                 *
 * ─────────────────────────────────────────────────────────────── */

function NeonSigns() {
  return (
    <div
      style={{
        borderRadius: 14,
        padding: "26px 12px",
        background: "#050411",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {CONVO.map((m, i) => {
        const mine = m.who === "p";
        const color = mine ? "#7C6BFF" : "#FF4F9E";
        const glow = mine ? "rgba(124,107,255,0.75)" : "rgba(255,79,158,0.75)";
        return (
          <div key={i} style={{ textAlign: mine ? "right" : "left" }}>
            <div style={{ fontSize: 10, letterSpacing: "0.22em", color, opacity: 0.8, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>
              {mine ? "philip" : "maria"} · {m.time}
            </div>
            <div
              style={{
                fontFamily: HAND,
                fontSize: 28,
                lineHeight: 1.15,
                color,
                textShadow: `0 0 4px ${color}, 0 0 12px ${glow}, 0 0 28px ${glow}`,
                animation: `proto-flicker 4s ease-in-out ${i * 0.4}s infinite`,
              }}
            >
              {m.body}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── *
 *  8 · Handwritten Notes                                          *
 * ─────────────────────────────────────────────────────────────── */

function HandwrittenNotes() {
  return (
    <div
      style={{
        borderRadius: 14,
        padding: "20px 12px",
        background: "linear-gradient(160deg, #efe9dd 0%, #d9cfba 100%)",
        color: "#2a2011",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {CONVO.map((m, i) => {
        const mine = m.who === "p";
        const rot = mine ? 1.2 : -1.4;
        const paper = mine ? "#FFF7E5" : "#EAF3FF";
        const tape = mine ? "#FFC97C" : "#B4D9FF";
        return (
          <div
            key={i}
            style={{
              position: "relative",
              alignSelf: mine ? "flex-end" : "flex-start",
              width: "80%",
              transform: `rotate(${rot}deg)`,
              background: paper,
              padding: "16px 14px 12px",
              boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
              backgroundImage:
                "repeating-linear-gradient(180deg, transparent 0 22px, rgba(0,0,0,0.06) 22px 23px)",
            }}
          >
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: -10,
                left: mine ? "auto" : 16,
                right: mine ? 16 : "auto",
                width: 60,
                height: 20,
                background: tape,
                opacity: 0.85,
                transform: `rotate(${mine ? 6 : -6}deg)`,
                boxShadow: "0 2px 4px rgba(0,0,0,0.14)",
              }}
            />
            <div style={{ fontFamily: HAND, fontSize: 20, lineHeight: 1.25 }}>{m.body}</div>
            <div style={{ fontFamily: HAND, fontSize: 14, color: "#6b573c", marginTop: 6, textAlign: mine ? "right" : "left" }}>
              — {mine ? "Philip" : "Maria"}, {m.time}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── *
 *  9 · Ticker Tape                                                *
 * ─────────────────────────────────────────────────────────────── */

function TickerTape() {
  return (
    <div
      style={{
        borderRadius: 14,
        padding: "18px 0",
        background: "linear-gradient(180deg, #17131a, #24152d)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        overflow: "hidden",
      }}
    >
      {CONVO.map((m, i) => {
        const mine = m.who === "p";
        const bg = mine
          ? "linear-gradient(90deg, #ff4f9e 0%, #ffb877 100%)"
          : "linear-gradient(90deg, #7cc0ff 0%, #b57cff 100%)";
        return (
          <div
            key={i}
            style={{
              position: "relative",
              alignSelf: mine ? "flex-end" : "flex-start",
              maxWidth: "88%",
              padding: "8px 16px",
              background: bg,
              color: "#1a0f22",
              fontWeight: 600,
              fontSize: 14,
              transform: `rotate(${mine ? 0.7 : -0.7}deg)`,
              boxShadow: "0 6px 16px rgba(0,0,0,0.32)",
              // Serrated edges
              WebkitMaskImage:
                "radial-gradient(circle at 6px 6px, transparent 3px, #000 3.2px), radial-gradient(circle at calc(100% - 6px) 6px, transparent 3px, #000 3.2px)",
            }}
          >
            <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", marginRight: 8, opacity: 0.7 }}>
              {mine ? "PHI" : "MAR"}·{m.time}
            </span>
            {m.body}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── *
 *  10 · Thread Beads                                              *
 * ─────────────────────────────────────────────────────────────── */

function ThreadBeads() {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 14,
        padding: "18px 12px 22px 46px",
        background:
          "linear-gradient(180deg, #12172a 0%, #0b0f1a 100%)",
      }}
    >
      {/* the thread */}
      <svg
        aria-hidden
        style={{ position: "absolute", top: 0, bottom: 0, left: 24, width: 20, height: "100%" }}
        viewBox="0 0 20 400"
        preserveAspectRatio="none"
      >
        <path d="M10 0 Q 22 60 10 120 T 10 240 T 10 400" stroke="url(#thread-grad)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <defs>
          <linearGradient id="thread-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF7800" />
            <stop offset="100%" stopColor="#00AFFF" />
          </linearGradient>
        </defs>
      </svg>
      {CONVO.map((m, i) => {
        const mine = m.who === "p";
        const bead = mine ? "#00AFFF" : "#FF7800";
        return (
          <div key={i} style={{ position: "relative", padding: "8px 0 8px 22px" }}>
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: -24,
                top: 10,
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: `radial-gradient(circle at 30% 30%, #fff, ${bead} 65%, ${bead} 100%)`,
                boxShadow: `0 0 10px ${bead}88, inset -2px -2px 4px rgba(0,0,0,0.35)`,
              }}
            />
            <div style={{ fontSize: 10, letterSpacing: "0.14em", color: bead, fontWeight: 700, textTransform: "uppercase" }}>
              {mine ? "Philip" : "Maria"} · {m.time}
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.45, marginTop: 2 }}>{m.body}</div>
          </div>
        );
      })}
    </div>
  );
}
