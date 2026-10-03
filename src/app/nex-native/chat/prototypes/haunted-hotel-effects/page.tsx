// src/app/nex-native/chat/prototypes/haunted-hotel-effects/page.tsx
//
// Design preview · Haunted Hotel · 20 cinematic effect prototypes.
// Pure design surface · no backend, no auth gate, no telemetry. Each
// effect is a self-contained visual treatment that could later be
// promoted to a toggleable Joker-style control-panel card and plugged
// into the depth-cards pilot.
//
// Keyframes are prefixed `hh-fx-` to keep this file isolated from
// the pilot's own keyframes.

import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Effect {
  n: number;
  name: string;
  tagline: string;
  render: () => React.ReactElement;
}

export default function HauntedHotelEffectsPage(): React.ReactElement {
  const effects: Effect[] = [
    { n: 1,  name: "Lightning Flash + Thunder-Glow",   tagline: "full-screen white flash · 2s delayed thunder vignette pulse",                 render: () => <LightningFlash /> },
    { n: 2,  name: "Phantom Silhouette",               tagline: "a hooded figure crosses the top of the frame · lamps dim as it passes",      render: () => <PhantomSilhouette /> },
    { n: 3,  name: "The Second Blow-Out",              tagline: "one lamp relights by itself after the climax · flickers alone · dies again", render: () => <SecondBlowout /> },
    { n: 4,  name: "Dust Motes in Lamp Beams",         tagline: "tiny particles drifting in the lit cones · perpetual · zero cost",           render: () => <DustMotes /> },
    { n: 5,  name: "Reflected Ghost Bubble",           tagline: "every sent bubble spawns a flipped translucent twin on the peer side",       render: () => <ReflectedBubble /> },
    { n: 6,  name: "Rolling Fog from Edges",           tagline: "theatrical fog drifts in from the left/right, denser than the footer smoke", render: () => <RollingFog /> },
    { n: 7,  name: "Rain Streaks · Window Downpour",   tagline: "diagonal silver streaks + occasional heavy burst · rain against the glass",  render: () => <RainStreaks /> },
    { n: 8,  name: "Vignette Breathing",               tagline: "the dark corners inhale and exhale slowly · the building is alive",          render: () => <VignetteBreathing /> },
    { n: 9,  name: "Elevator 13 Ping",                 tagline: "brass '13' floor-plate glyph flashes in a corner every ~90s",                render: () => <ElevatorPing /> },
    { n: 10, name: "Phantom Typing · Serif Ellipsis",  tagline: "three dots fade in sequence · occasional glitch to a Victorian ellipsis",    render: () => <PhantomTyping /> },
    { n: 11, name: "Cursor Whisper Trail",             tagline: "a faint grey-breath trail follows mouse movement · dissipates in ~0.6s",     render: () => <CursorWhisperTrail /> },
    { n: 12, name: "Message Materialize Through Smoke", tagline: "new peer messages don't appear · they bloom out of dispersing smoke",       render: () => <MaterializeThroughSmoke /> },
    { n: 13, name: "Shutter Rattle",                   tagline: "a gust shakes the whole frame horizontally every ~45s · brief · ominous",    render: () => <ShutterRattle /> },
    { n: 14, name: "Candle Wax Drip",                  tagline: "a wax tear forms on the composer rim and slides slowly down",                render: () => <CandleWaxDrip /> },
    { n: 15, name: "Clock Chime · Bell Aura",          tagline: "once per hour · lamps dim and a bell-shaped glow pulses from a corner",      render: () => <ClockChime /> },
    { n: 16, name: "Cold Draft · Chill Particles",     tagline: "scrolling fast triggers a horizontal sweep of blue-white chill particles",   render: () => <ColdDraft /> },
    { n: 17, name: "Cobweb Growing",                   tagline: "a spider web slowly materialises in a corner over ~45s",                    render: () => <CobwebGrowing /> },
    { n: 18, name: "Scrawled Writing on Glass",        tagline: "letters appear one by one as if written in fog · '…are you alone?'",         render: () => <ScrawledWriting /> },
    { n: 19, name: "Grandfather Clock Pendulum",       tagline: "a swinging pendulum shadow sweeps the floor-edge · steady · 2s cadence",     render: () => <GrandfatherPendulum /> },
    { n: 20, name: "Candelabra Silhouette · Flames",   tagline: "a tall candelabra flickers against the wall · three independent flames",     render: () => <CandelabraSilhouette /> },
  ];

  return (
    <>
      <style>{`
        html, body { background: #0b0712 !important; }

        /* ── Shared cinematic keyframes · hh-fx-* namespace ── */
        @keyframes hh-fx-lightning {
          0%, 15%, 100%     { opacity: 0; }
          2%                { opacity: 1; }
          3%                { opacity: 0.3; }
          4%                { opacity: 1; }
          5%, 14%           { opacity: 0; }
          9%                { opacity: 0.6; }
          10%               { opacity: 0.2; }
        }
        @keyframes hh-fx-thunder-vignette {
          0%, 8%, 24%, 100% { opacity: 0; }
          12%               { opacity: 0.9; }
          18%               { opacity: 0.4; }
        }
        @keyframes hh-fx-phantom-walk {
          0%                { transform: translateX(110%); opacity: 0; }
          10%               { opacity: 0.8; }
          50%               { opacity: 0.95; }
          90%               { opacity: 0.6; }
          100%              { transform: translateX(-110%); opacity: 0; }
        }
        @keyframes hh-fx-phantom-dim {
          0%, 30%, 70%, 100% { opacity: 0; }
          50%                { opacity: 0.5; }
        }
        @keyframes hh-fx-second-blowout {
          0%, 40%           { opacity: 0; filter: blur(14px); }
          45%, 48%          { opacity: 0.5; }
          46%, 47%          { opacity: 0.15; }
          55%, 58%, 62%     { opacity: 0.9; }
          56%, 59%          { opacity: 0.3; }
          80%               { opacity: 0.75; filter: blur(10px); }
          85%               { opacity: 0.1; filter: blur(16px); }
          92%               { opacity: 0.4; }
          95%               { opacity: 0.05; filter: blur(22px); }
          100%              { opacity: 0; filter: blur(26px); }
        }
        @keyframes hh-fx-dust-drift {
          0%                { transform: translate(0, 0); opacity: 0; }
          10%               { opacity: 0.9; }
          80%               { opacity: 0.6; }
          100%              { transform: translate(var(--hh-fx-dx, 20px), 140px); opacity: 0; }
        }
        @keyframes hh-fx-ghost-echo {
          0%                { opacity: 0; transform: translateX(-16px) scaleX(-1); }
          15%               { opacity: 0.55; }
          40%               { opacity: 0.35; }
          80%               { opacity: 0.1; transform: translateX(-40px) scaleX(-1); }
          100%              { opacity: 0; transform: translateX(-52px) scaleX(-1); }
        }
        @keyframes hh-fx-fog-drift {
          0%                { transform: translateX(var(--hh-fx-fog-from, -40%)) scale(1); opacity: 0; }
          20%               { opacity: 0.7; }
          80%               { opacity: 0.5; }
          100%              { transform: translateX(var(--hh-fx-fog-to, 40%)) scale(1.4); opacity: 0; }
        }
        @keyframes hh-fx-rain-fall {
          0%                { transform: translate(0, -30%) rotate(14deg); opacity: 0; }
          10%               { opacity: 0.75; }
          100%              { transform: translate(-14%, 130%) rotate(14deg); opacity: 0; }
        }
        @keyframes hh-fx-vignette-breath {
          0%, 100%          { opacity: 0.55; }
          50%               { opacity: 0.9; }
        }
        @keyframes hh-fx-elevator-ping {
          0%, 85%, 100%     { opacity: 0; transform: scale(0.9); }
          88%               { opacity: 1; transform: scale(1); }
          92%               { opacity: 0.6; transform: scale(1.08); }
          96%               { opacity: 0.1; transform: scale(1.14); }
        }
        @keyframes hh-fx-typing-dot {
          0%, 60%, 100%     { opacity: 0.2; transform: translateY(0); }
          30%               { opacity: 1; transform: translateY(-3px); }
        }
        @keyframes hh-fx-whisper-dot {
          0%                { opacity: 0; transform: scale(0.4); }
          25%               { opacity: 0.8; transform: scale(1); }
          100%              { opacity: 0; transform: scale(1.6); filter: blur(6px); }
        }
        @keyframes hh-fx-materialize {
          0%                { opacity: 0; transform: translateY(10px) scale(0.9); filter: blur(14px); }
          40%               { opacity: 0.5; filter: blur(8px); }
          100%              { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes hh-fx-materialize-smoke {
          0%                { opacity: 0; transform: translateY(0) scale(0.6); filter: blur(10px); }
          20%               { opacity: 0.9; }
          100%              { opacity: 0; transform: translateY(-40px) scale(1.9); filter: blur(26px); }
        }
        @keyframes hh-fx-rattle {
          0%, 86%, 100%     { transform: translateX(0); }
          88%               { transform: translateX(-3px); }
          89%               { transform: translateX(4px); }
          90%               { transform: translateX(-5px); }
          91%               { transform: translateX(3px); }
          92%               { transform: translateX(-2px); }
          93%               { transform: translateX(1px); }
        }
        @keyframes hh-fx-wax-drip {
          0%                { transform: translateY(0) scaleY(0.4); opacity: 0.6; }
          10%               { opacity: 1; }
          80%               { transform: translateY(90px) scaleY(1); opacity: 0.9; }
          100%              { transform: translateY(100px) scaleY(1.3); opacity: 0; }
        }
        @keyframes hh-fx-bell-pulse {
          0%, 85%, 100%     { opacity: 0.3; transform: scale(1); filter: blur(14px); }
          92%               { opacity: 1; transform: scale(1.2); filter: blur(10px); }
          96%               { opacity: 0.6; transform: scale(1.3); filter: blur(14px); }
        }
        @keyframes hh-fx-cold-sweep {
          0%, 100%          { transform: translateX(-30%); opacity: 0; }
          30%               { opacity: 0.95; }
          70%               { opacity: 0.6; }
          95%               { transform: translateX(130%); opacity: 0; }
        }
        @keyframes hh-fx-cobweb-grow {
          0%, 10%           { opacity: 0; stroke-dashoffset: 400; }
          60%, 100%         { opacity: 0.85; stroke-dashoffset: 0; }
        }
        @keyframes hh-fx-scrawl {
          0%                { stroke-dashoffset: 400; opacity: 0; filter: blur(2px); }
          20%               { opacity: 1; }
          85%               { stroke-dashoffset: 0; opacity: 1; filter: blur(0); }
          100%              { opacity: 0; filter: blur(4px); }
        }
        @keyframes hh-fx-pendulum {
          0%, 100%          { transform: rotate(-24deg); }
          50%               { transform: rotate(24deg); }
        }
        @keyframes hh-fx-flame-flicker {
          0%, 100%          { transform: scaleY(1) translateY(0); filter: brightness(1); }
          25%               { transform: scaleY(1.15) translateY(-1px); filter: brightness(1.3); }
          50%               { transform: scaleY(0.9) translateY(1px); filter: brightness(0.85); }
          75%               { transform: scaleY(1.08) translateY(-2px); filter: brightness(1.15); }
        }
      `}</style>

      <main
        style={{
          minHeight: "100dvh",
          backgroundColor: "#0b0712",
          color: "#f4f0ea",
          fontFamily:
            "'Georgia', 'Cormorant Garamond', ui-serif, Georgia, serif",
          padding: "32px 20px calc(env(safe-area-inset-bottom, 0) + 48px)",
          backgroundImage:
            "radial-gradient(ellipse at 50% 30%, rgba(32,18,42,0.55) 0%, rgba(5,3,12,0.9) 85%)",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
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
              Haunted Hotel · effect gallery
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
              Twenty prototypes · twenty wows
            </h1>
            <p
              style={{
                fontSize: 13,
                color: "rgba(240,220,200,0.55)",
                marginTop: 8,
                fontStyle: "italic",
              }}
            >
              Cinematic effect candidates for the Haunted Hotel theme. Each
              one is a self-contained prototype · ready to be promoted to a
              toggle card and plugged into the depth-cards pilot.
            </p>
          </header>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
              gap: 18,
            }}
          >
            {effects.map((e) => (
              <article
                key={e.n}
                style={{
                  background:
                    "linear-gradient(180deg, rgba(20,14,26,0.65) 0%, rgba(12,8,20,0.75) 100%)",
                  border: "1px solid rgba(255,220,180,0.08)",
                  borderRadius: 18,
                  padding: "20px 20px 18px",
                  boxShadow: "0 24px 50px rgba(0,0,0,0.55)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "rgba(255,170,70,0.75)",
                    }}
                  >
                    Fx {String(e.n).padStart(2, "0")}
                  </span>
                  <span
                    style={{
                      fontSize: 15,
                      color: "#f4ecdd",
                      fontWeight: 500,
                    }}
                  >
                    {e.name}
                  </span>
                </div>

                <div
                  style={{
                    position: "relative",
                    height: 180,
                    borderRadius: 12,
                    overflow: "hidden",
                    background:
                      "linear-gradient(180deg, #140a1e 0%, #0a060f 100%)",
                    border: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  {e.render()}
                </div>

                <p
                  style={{
                    margin: 0,
                    fontSize: 12.5,
                    color: "rgba(240,220,200,0.65)",
                    fontStyle: "italic",
                    lineHeight: 1.5,
                  }}
                >
                  {e.tagline}
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
// FX 01 · Lightning Flash + Thunder-Glow Vignette
// ────────────────────────────────────────────────────────────────────

function LightningFlash(): React.ReactElement {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <WindowSilhouette />
      {/* Flash sheet */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(220,230,255,0.9) 60%, rgba(255,255,255,0.4) 100%)",
          animationName: "hh-fx-lightning",
          animationDuration: "6.5s",
          animationIterationCount: "infinite",
          animationTimingFunction: "steps(1)",
          mixBlendMode: "screen",
        }}
      />
      {/* Thunder vignette · delayed glow pulse */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(80,110,180,0) 20%, rgba(60,80,160,0.5) 70%, rgba(0,0,0,0.9) 100%)",
          animationName: "hh-fx-thunder-vignette",
          animationDuration: "6.5s",
          animationIterationCount: "infinite",
          animationTimingFunction: "ease-in-out",
        }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// FX 02 · Phantom Silhouette
// ────────────────────────────────────────────────────────────────────

function PhantomSilhouette(): React.ReactElement {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <WindowSilhouette />
      {/* Dim pass */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at 50% 50%, transparent 20%, rgba(0,0,0,0.65) 90%)",
          animationName: "hh-fx-phantom-dim",
          animationDuration: "7s",
          animationIterationCount: "infinite",
          animationTimingFunction: "ease-in-out",
        }}
      />
      {/* Hooded figure · SVG · walks right-to-left */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 24,
          left: 0,
          width: "100%",
          height: "100%",
          animationName: "hh-fx-phantom-walk",
          animationDuration: "7s",
          animationIterationCount: "infinite",
          animationTimingFunction: "linear",
        }}
      >
        <svg viewBox="0 0 60 140" width={40} height={110} style={{ display: "block" }}>
          <path
            d="M 30 10 C 20 10, 14 20, 16 32 L 14 46 L 10 70 L 12 110 L 20 110 L 22 80 L 28 80 L 28 110 L 34 110 L 36 80 L 42 80 L 44 110 L 50 110 L 48 70 L 46 46 L 44 32 C 46 20, 40 10, 30 10 Z"
            fill="rgba(10,8,14,0.95)"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="0.5"
          />
        </svg>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// FX 03 · Second Blow-Out · one lamp relights alone
// ────────────────────────────────────────────────────────────────────

function SecondBlowout(): React.ReactElement {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <WindowSilhouette />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "40%",
          marginLeft: -70,
          marginTop: -70,
          width: 140,
          height: 140,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,220,150,0.95) 0%, rgba(255,180,80,0.6) 35%, rgba(255,140,40,0) 70%)",
          animationName: "hh-fx-second-blowout",
          animationDuration: "16s",
          animationIterationCount: "infinite",
          animationTimingFunction: "steps(1)",
          mixBlendMode: "screen",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "70%",
          marginLeft: -1,
          width: 2,
          height: 60,
          background:
            "linear-gradient(180deg, rgba(255,210,130,0.9) 0%, rgba(255,210,130,0) 100%)",
          animationName: "hh-fx-second-blowout",
          animationDuration: "16s",
          animationIterationCount: "infinite",
          animationTimingFunction: "steps(1)",
          mixBlendMode: "screen",
        }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// FX 04 · Dust Motes in Lamp Beams
// ────────────────────────────────────────────────────────────────────

function DustMotes(): React.ReactElement {
  const motes = [
    { x: 48, delay: 0.0, dur: 7, dx: 20 },
    { x: 52, delay: 1.1, dur: 8, dx: -15 },
    { x: 46, delay: 2.4, dur: 9, dx: 25 },
    { x: 54, delay: 3.6, dur: 6.5, dx: -10 },
    { x: 50, delay: 4.3, dur: 8.4, dx: 18 },
    { x: 44, delay: 5.0, dur: 7.6, dx: -22 },
    { x: 56, delay: 5.8, dur: 9.3, dx: 12 },
    { x: 49, delay: 6.5, dur: 7.1, dx: -8 },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {/* Lamp cone */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 10,
          marginLeft: -70,
          width: 140,
          height: 180,
          background:
            "radial-gradient(ellipse 50% 100% at 50% 0%, rgba(255,220,140,0.35) 0%, rgba(255,200,100,0.12) 50%, rgba(255,200,100,0) 85%)",
          mixBlendMode: "screen",
        }}
      />
      {motes.map((m, i) => (
        <div
          key={i}
          style={
            {
              position: "absolute",
              left: `${m.x}%`,
              top: 20,
              width: 3,
              height: 3,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(255,240,210,0.95) 0%, rgba(255,240,210,0) 70%)",
              animationName: "hh-fx-dust-drift",
              animationDuration: `${m.dur}s`,
              animationIterationCount: "infinite",
              animationTimingFunction: "linear",
              animationDelay: `${m.delay}s`,
              "--hh-fx-dx": `${m.dx}px`,
              mixBlendMode: "screen",
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// FX 05 · Reflected Ghost Bubble
// ────────────────────────────────────────────────────────────────────

function ReflectedBubble(): React.ReactElement {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
      {/* Ghost echo on the LEFT (peer side) */}
      <div
        style={{
          padding: "10px 14px",
          borderRadius: "16px 16px 16px 4px",
          background: "linear-gradient(145deg, rgba(255,255,255,0.1) 0%, rgba(200,210,230,0.15) 100%)",
          border: "1px solid rgba(255,255,255,0.14)",
          color: "rgba(240,230,220,0.75)",
          fontSize: 12,
          maxWidth: 160,
          backdropFilter: "blur(6px)",
          animationName: "hh-fx-ghost-echo",
          animationDuration: "6s",
          animationIterationCount: "infinite",
          animationTimingFunction: "ease-out",
          mixBlendMode: "screen",
        }}
      >
        Here but not here.
      </div>
      {/* Original bubble on the RIGHT (mine) */}
      <div
        style={{
          padding: "10px 14px",
          borderRadius: "16px 16px 4px 16px",
          background: "linear-gradient(145deg, rgba(255,255,255,0.18) 0%, rgba(180,195,215,0.22) 100%)",
          border: "1px solid rgba(255,255,255,0.22)",
          color: "#f0e7dc",
          fontSize: 12,
          maxWidth: 160,
          backdropFilter: "blur(8px)",
        }}
      >
        Here but not here.
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// FX 06 · Rolling Fog from Edges
// ────────────────────────────────────────────────────────────────────

function RollingFog(): React.ReactElement {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <WindowSilhouette />
      {[0, 1, 2].map((i) => (
        <div
          key={`l-${i}`}
          style={
            {
              position: "absolute",
              left: 0,
              top: `${20 + i * 25}%`,
              width: 220,
              height: 80,
              borderRadius: "50%",
              background:
                "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(255,255,255,0.75) 0%, rgba(220,225,240,0.3) 50%, rgba(255,255,255,0) 80%)",
              filter: "blur(16px)",
              animationName: "hh-fx-fog-drift",
              animationDuration: `${8 + i * 2}s`,
              animationIterationCount: "infinite",
              animationTimingFunction: "linear",
              animationDelay: `${i * 2.5}s`,
              "--hh-fx-fog-from": "-60%",
              "--hh-fx-fog-to": "160%",
              mixBlendMode: "screen",
            } as React.CSSProperties
          }
        />
      ))}
      {[0, 1].map((i) => (
        <div
          key={`r-${i}`}
          style={
            {
              position: "absolute",
              right: 0,
              top: `${35 + i * 22}%`,
              width: 220,
              height: 80,
              borderRadius: "50%",
              background:
                "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(255,255,255,0.65) 0%, rgba(220,225,240,0.25) 50%, rgba(255,255,255,0) 80%)",
              filter: "blur(18px)",
              animationName: "hh-fx-fog-drift",
              animationDuration: `${9 + i * 2}s`,
              animationIterationCount: "infinite",
              animationTimingFunction: "linear",
              animationDelay: `${1.5 + i * 3}s`,
              "--hh-fx-fog-from": "60%",
              "--hh-fx-fog-to": "-160%",
              mixBlendMode: "screen",
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// FX 07 · Rain Streaks
// ────────────────────────────────────────────────────────────────────

function RainStreaks(): React.ReactElement {
  const streaks = [
    { x: 8,  delay: 0.0, dur: 1.4 },
    { x: 18, delay: 0.3, dur: 1.6 },
    { x: 26, delay: 0.5, dur: 1.3 },
    { x: 34, delay: 0.1, dur: 1.5 },
    { x: 42, delay: 0.7, dur: 1.4 },
    { x: 50, delay: 0.4, dur: 1.7 },
    { x: 58, delay: 0.2, dur: 1.3 },
    { x: 66, delay: 0.6, dur: 1.6 },
    { x: 74, delay: 0.9, dur: 1.4 },
    { x: 82, delay: 0.8, dur: 1.5 },
    { x: 90, delay: 0.3, dur: 1.6 },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <WindowSilhouette />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, rgba(80,100,160,0.1) 0%, rgba(40,60,100,0.2) 100%)",
          mixBlendMode: "screen",
        }}
      />
      {streaks.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${s.x}%`,
            top: 0,
            width: 1,
            height: 60,
            background:
              "linear-gradient(180deg, rgba(220,235,255,0) 0%, rgba(220,235,255,0.85) 60%, rgba(220,235,255,0) 100%)",
            animationName: "hh-fx-rain-fall",
            animationDuration: `${s.dur}s`,
            animationIterationCount: "infinite",
            animationTimingFunction: "linear",
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// FX 08 · Vignette Breathing
// ────────────────────────────────────────────────────────────────────

function VignetteBreathing(): React.ReactElement {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <WindowSilhouette />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 20%, rgba(0,0,0,0.4) 55%, rgba(0,0,0,0.95) 100%)",
          animationName: "hh-fx-vignette-breath",
          animationDuration: "6s",
          animationIterationCount: "infinite",
          animationTimingFunction: "ease-in-out",
        }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// FX 09 · Elevator 13 Ping
// ────────────────────────────────────────────────────────────────────

function ElevatorPing(): React.ReactElement {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", display: "grid", placeItems: "center" }}>
      <div
        style={{
          position: "relative",
          width: 90,
          height: 90,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 35% 30%, #2a1a06 0%, #0f0a02 70%)",
          boxShadow:
            "inset 0 3px 6px rgba(0,0,0,0.9), 0 0 0 3px #d8a856, 0 0 0 4px rgba(0,0,0,0.6)",
          display: "grid",
          placeItems: "center",
          animationName: "hh-fx-elevator-ping",
          animationDuration: "5s",
          animationIterationCount: "infinite",
          animationTimingFunction: "steps(1)",
        }}
      >
        <span
          style={{
            fontFamily: "'Georgia', 'Playfair Display', serif",
            color: "#d8a856",
            fontSize: 38,
            fontWeight: 700,
            textShadow: "0 0 10px rgba(216,168,86,0.85), 0 0 20px rgba(216,168,86,0.4)",
          }}
        >
          13
        </span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// FX 10 · Phantom Typing · Serif Ellipsis
// ────────────────────────────────────────────────────────────────────

function PhantomTyping(): React.ReactElement {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
      <div
        style={{
          padding: "14px 20px",
          borderRadius: "18px 18px 18px 4px",
          background: "linear-gradient(145deg, rgba(16,43,70,0.9) 0%, rgba(10,29,49,0.9) 100%)",
          border: "1px solid rgba(105,170,220,0.14)",
          display: "flex",
          gap: 6,
          alignItems: "center",
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#e8dfd0",
              animationName: "hh-fx-typing-dot",
              animationDuration: "1.4s",
              animationIterationCount: "infinite",
              animationTimingFunction: "ease-in-out",
              animationDelay: `${i * 0.18}s`,
            }}
          />
        ))}
        <span
          style={{
            marginLeft: 4,
            fontFamily: "'Georgia', serif",
            fontStyle: "italic",
            color: "rgba(232,223,208,0.4)",
            fontSize: 13,
          }}
        >
          ⋯
        </span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// FX 11 · Cursor Whisper Trail (auto-animated preview)
// ────────────────────────────────────────────────────────────────────

function CursorWhisperTrail(): React.ReactElement {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <WindowSilhouette />
      {Array.from({ length: 8 }).map((_, i) => {
        const t = i / 7;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${15 + t * 70}%`,
              top: `${30 + Math.sin(t * Math.PI) * 20}%`,
              width: 14,
              height: 14,
              marginLeft: -7,
              marginTop: -7,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(230,235,250,0.85) 0%, rgba(255,255,255,0) 70%)",
              filter: "blur(2px)",
              animationName: "hh-fx-whisper-dot",
              animationDuration: "2s",
              animationIterationCount: "infinite",
              animationTimingFunction: "ease-out",
              animationDelay: `${i * 0.15}s`,
              mixBlendMode: "screen",
            }}
          />
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// FX 12 · Message Materialize Through Smoke
// ────────────────────────────────────────────────────────────────────

function MaterializeThroughSmoke(): React.ReactElement {
  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
      {/* Smoke dispersing */}
      {[0, 1, 2, 3].map((i) => (
        <div
          key={`s-${i}`}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 60,
            height: 60,
            marginLeft: -30,
            marginTop: -30,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(255,255,255,0.75) 0%, rgba(230,235,245,0.2) 50%, rgba(255,255,255,0) 80%)",
            filter: "blur(10px)",
            transform: `translateX(${(i - 1.5) * 20}px)`,
            animationName: "hh-fx-materialize-smoke",
            animationDuration: "4s",
            animationIterationCount: "infinite",
            animationTimingFunction: "ease-out",
            animationDelay: `${i * 0.25}s`,
            mixBlendMode: "screen",
          }}
        />
      ))}
      {/* The emerging bubble */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: "10px 14px",
          borderRadius: "16px 16px 16px 4px",
          background: "linear-gradient(145deg, rgba(16,43,70,0.95) 0%, rgba(10,29,49,0.95) 100%)",
          border: "1px solid rgba(105,170,220,0.14)",
          color: "#e8dfd0",
          fontSize: 13,
          animationName: "hh-fx-materialize",
          animationDuration: "4s",
          animationIterationCount: "infinite",
          animationTimingFunction: "ease-out",
        }}
      >
        Did you call me?
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// FX 13 · Shutter Rattle
// ────────────────────────────────────────────────────────────────────

function ShutterRattle(): React.ReactElement {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        animationName: "hh-fx-rattle",
        animationDuration: "3s",
        animationIterationCount: "infinite",
        animationTimingFunction: "steps(1)",
      }}
    >
      <WindowSilhouette />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// FX 14 · Candle Wax Drip
// ────────────────────────────────────────────────────────────────────

function CandleWaxDrip(): React.ReactElement {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", display: "grid", placeItems: "center" }}>
      {/* Composer rim */}
      <div
        style={{
          position: "relative",
          width: "80%",
          height: 36,
          borderRadius: 999,
          background:
            "linear-gradient(180deg, rgba(70,45,15,0.3) 0%, rgba(100,70,30,0.6) 100%)",
          border: "1px solid rgba(216,168,86,0.4)",
          boxShadow: "0 10px 24px rgba(0,0,0,0.6)",
        }}
      >
        {/* Dripping wax */}
        <div
          style={{
            position: "absolute",
            left: "28%",
            top: "100%",
            width: 10,
            height: 18,
            background:
              "linear-gradient(180deg, #ffd27a 0%, #f5a84a 50%, #c47c2a 100%)",
            borderRadius: "50% 50% 50% 50% / 20% 20% 80% 80%",
            boxShadow: "0 0 10px rgba(255,180,80,0.7)",
            animationName: "hh-fx-wax-drip",
            animationDuration: "5.5s",
            animationIterationCount: "infinite",
            animationTimingFunction: "ease-in",
            transformOrigin: "50% 0",
          }}
        />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// FX 15 · Clock Chime · Bell Aura
// ────────────────────────────────────────────────────────────────────

function ClockChime(): React.ReactElement {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", display: "grid", placeItems: "center" }}>
      <div
        style={{
          position: "relative",
          width: 90,
          height: 90,
        }}
      >
        {/* Pulsing aura */}
        <div
          style={{
            position: "absolute",
            inset: -30,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(255,220,160,0.9) 0%, rgba(255,170,90,0.35) 40%, rgba(255,140,60,0) 70%)",
            animationName: "hh-fx-bell-pulse",
            animationDuration: "4s",
            animationIterationCount: "infinite",
            animationTimingFunction: "ease-in-out",
            mixBlendMode: "screen",
          }}
        />
        {/* Bell silhouette */}
        <svg viewBox="0 0 60 60" width="100%" height="100%" style={{ position: "relative" }}>
          <path
            d="M 30 10 L 30 14 M 20 16 C 20 10, 40 10, 40 16 L 42 42 L 18 42 Z M 16 44 L 44 44 M 28 48 L 32 48"
            fill="rgba(216,168,86,0.9)"
            stroke="#8a5a2a"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// FX 16 · Cold Draft · Chill Particles
// ────────────────────────────────────────────────────────────────────

function ColdDraft(): React.ReactElement {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <WindowSilhouette />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 60,
          height: "100%",
          background:
            "linear-gradient(90deg, rgba(220,240,255,0.9) 0%, rgba(180,220,255,0.5) 50%, rgba(180,220,255,0) 100%)",
          filter: "blur(12px)",
          animationName: "hh-fx-cold-sweep",
          animationDuration: "4s",
          animationIterationCount: "infinite",
          animationTimingFunction: "ease-in-out",
          mixBlendMode: "screen",
        }}
      />
      {/* Chill particles trailing */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: `${15 + (i % 4) * 20}%`,
            left: -10,
            width: 3,
            height: 3,
            borderRadius: "50%",
            background: "rgba(220,240,255,0.9)",
            boxShadow: "0 0 4px rgba(220,240,255,0.8)",
            animationName: "hh-fx-cold-sweep",
            animationDuration: `${3.5 + (i % 4) * 0.3}s`,
            animationIterationCount: "infinite",
            animationTimingFunction: "ease-in-out",
            animationDelay: `${i * 0.08}s`,
          }}
        />
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// FX 17 · Cobweb Growing
// ────────────────────────────────────────────────────────────────────

function CobwebGrowing(): React.ReactElement {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <WindowSilhouette />
      <svg
        viewBox="0 0 120 120"
        style={{ position: "absolute", top: 0, right: 0, width: 120, height: 120 }}
      >
        <g
          fill="none"
          stroke="rgba(230,230,240,0.85)"
          strokeWidth="0.8"
          strokeDasharray="400"
          style={{
            animationName: "hh-fx-cobweb-grow",
            animationDuration: "5s",
            animationIterationCount: "infinite",
            animationTimingFunction: "ease-out",
          }}
        >
          {/* Radials */}
          <line x1="120" y1="0" x2="0" y2="120" />
          <line x1="120" y1="0" x2="20" y2="120" />
          <line x1="120" y1="0" x2="60" y2="120" />
          <line x1="120" y1="0" x2="120" y2="120" />
          <line x1="120" y1="0" x2="0" y2="80" />
          <line x1="120" y1="0" x2="0" y2="40" />
          {/* Arcs */}
          <path d="M 120 24 Q 92 42, 110 60" />
          <path d="M 120 48 Q 76 60, 100 92" />
          <path d="M 120 72 Q 60 76, 72 118" />
          <path d="M 108 0 Q 76 32, 36 60" />
        </g>
      </svg>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// FX 18 · Scrawled Writing on Glass
// ────────────────────────────────────────────────────────────────────

function ScrawledWriting(): React.ReactElement {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", display: "grid", placeItems: "center" }}>
      <WindowSilhouette />
      <svg viewBox="0 0 300 60" width="80%" height="60" style={{ position: "relative" }}>
        <path
          d="M 10 40 Q 20 20, 35 40 Q 45 50, 55 30 L 60 42
             M 80 40 Q 95 20, 100 42
             M 125 40 Q 135 24, 150 40
             M 170 40 Q 180 28, 190 40 Q 200 48, 212 32
             M 232 40 Q 244 22, 258 40
             M 272 36 L 278 42
             M 285 36 L 291 42"
          fill="none"
          stroke="rgba(240,230,220,0.9)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="400"
          style={{
            animationName: "hh-fx-scrawl",
            animationDuration: "7s",
            animationIterationCount: "infinite",
            animationTimingFunction: "ease-in-out",
          }}
        />
      </svg>
      <span
        aria-hidden
        style={{
          position: "absolute",
          bottom: 16,
          color: "rgba(240,230,220,0.35)",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        …are you alone?
      </span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// FX 19 · Grandfather Clock Pendulum
// ────────────────────────────────────────────────────────────────────

function GrandfatherPendulum(): React.ReactElement {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", display: "grid", placeItems: "center" }}>
      <div
        style={{
          position: "relative",
          width: 180,
          height: 180,
        }}
      >
        {/* Anchor */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            width: 10,
            height: 10,
            marginLeft: -5,
            borderRadius: "50%",
            background: "#d8a856",
            boxShadow: "0 0 6px rgba(216,168,86,0.6)",
          }}
        />
        {/* Pendulum rod + bob · pivots from top-centre */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 5,
            transformOrigin: "50% 0",
            animationName: "hh-fx-pendulum",
            animationDuration: "2.4s",
            animationIterationCount: "infinite",
            animationTimingFunction: "ease-in-out",
          }}
        >
          <div
            style={{
              width: 2,
              height: 120,
              marginLeft: -1,
              background: "linear-gradient(180deg, #8a5a2a 0%, #4a3015 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: -14,
              top: 110,
              width: 30,
              height: 30,
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 35% 30%, #e6b872 0%, #a07430 60%, #4a3015 100%)",
              boxShadow: "0 4px 10px rgba(0,0,0,0.6)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// FX 20 · Candelabra Silhouette · Three Flames
// ────────────────────────────────────────────────────────────────────

function CandelabraSilhouette(): React.ReactElement {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", display: "grid", placeItems: "center" }}>
      <div style={{ position: "relative", width: 160, height: 160 }}>
        {/* Candelabra body */}
        <svg viewBox="0 0 160 160" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <g fill="rgba(26,16,8,0.95)" stroke="rgba(216,168,86,0.3)" strokeWidth="0.6">
            {/* Base */}
            <rect x="68" y="135" width="24" height="5" rx="1" />
            <rect x="60" y="140" width="40" height="6" rx="2" />
            {/* Central stem */}
            <rect x="78" y="60" width="4" height="80" />
            {/* Arms */}
            <path d="M 80 80 Q 50 80, 40 55 L 40 70 Q 50 72, 70 92" />
            <path d="M 80 80 Q 110 80, 120 55 L 120 70 Q 110 72, 90 92" />
            {/* Candle cups */}
            <rect x="36" y="50" width="8" height="8" rx="1" />
            <rect x="116" y="50" width="8" height="8" rx="1" />
            <rect x="74" y="48" width="12" height="10" rx="1" />
            {/* Candles */}
            <rect x="37" y="36" width="6" height="14" fill="#ead8a8" />
            <rect x="117" y="36" width="6" height="14" fill="#ead8a8" />
            <rect x="75" y="30" width="10" height="18" fill="#ead8a8" />
          </g>
        </svg>
        {/* Three independent flames · flicker with different timings */}
        {[
          { left: 40, top: 20, delay: 0,   dur: 1.4 },
          { left: 80, top: 14, delay: 0.3, dur: 1.6 },
          { left: 120, top: 20, delay: 0.6, dur: 1.3 },
        ].map((f, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: f.left,
              top: f.top,
              width: 10,
              height: 18,
              marginLeft: -5,
              background:
                "radial-gradient(ellipse 60% 100% at 50% 100%, #ffe28a 0%, #ff9a2a 55%, rgba(255,120,30,0) 90%)",
              filter: "blur(0.6px)",
              borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
              transformOrigin: "50% 100%",
              animationName: "hh-fx-flame-flicker",
              animationDuration: `${f.dur}s`,
              animationIterationCount: "infinite",
              animationTimingFunction: "ease-in-out",
              animationDelay: `${f.delay}s`,
              boxShadow: "0 -4px 14px rgba(255,170,70,0.65), 0 0 10px rgba(255,210,120,0.5)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Shared · faint window silhouette used as a backdrop in several cards
// ────────────────────────────────────────────────────────────────────

function WindowSilhouette(): React.ReactElement {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        background:
          "linear-gradient(180deg, rgba(45,30,55,0.5) 0%, rgba(16,10,20,0.9) 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "25%",
          marginLeft: -60,
          width: 120,
          height: 100,
          border: "1px solid rgba(216,168,86,0.18)",
          borderRadius: 2,
          background:
            "linear-gradient(180deg, rgba(70,55,90,0.55) 0%, rgba(30,20,45,0.2) 100%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            bottom: 0,
            width: 1,
            background: "rgba(216,168,86,0.18)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            height: 1,
            background: "rgba(216,168,86,0.18)",
          }}
        />
      </div>
    </div>
  );
}
