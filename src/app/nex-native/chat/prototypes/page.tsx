// src/app/nex-native/chat/prototypes/page.tsx
//
// NEX Friend Chat · 10 futuristic design prototypes.
// --------------------------------------------------
// Scrollable gallery. Each of 10 previews renders a shared sample
// conversation in a 390-wide phone frame using a distinctive visual
// language. This surface exists ONLY as a design tool · none of the
// prototypes are wired to the real backend (no send, no realtime, no
// links). Real chat lives at /nex-native/chat/peer/[accountId].
//
// Approved 2026-09-27 · designer wants a fresh direction away from
// generic WhatsApp / iMessage / Signal patterns.

import * as React from "react";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-static";

// Prototypes that have been promoted to full live pages · gallery
// sections for these get an "Open live →" link that routes to the real
// backend-wired page. Keep in sync with actual routes in this dir.
const LIVE_PREVIEW_ROUTES: Record<string, string> = {
  "portrait-bloom": "/nex-native/chat/prototypes/portrait-bloom",
  "depth-cards": "/nex-native/chat/prototypes/depth-cards",
};

// -----------------------------------------------------------------------------
// Shared sample data · one conversation, ten treatments.
// -----------------------------------------------------------------------------

const SAMPLE_FRIEND = {
  name: "Maria Santos",
  profession: "Footwear designer",
  avatarUrl:
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop",
};

interface SampleMessage {
  id: string;
  mine: boolean;
  body: string;
  time: string;
  read?: boolean;
}

const SAMPLE_MESSAGES: SampleMessage[] = [
  {
    id: "m1",
    mine: false,
    body: "Hey! Just saw your latest product post. Looks amazing! 👋",
    time: "09:42",
  },
  {
    id: "m2",
    mine: true,
    body: "Thanks! I'm really happy with how it turned out. The materials are so much better than I expected.",
    time: "09:44",
    read: true,
  },
  {
    id: "m3",
    mine: false,
    body: "Love the color options. More styles soon?",
    time: "09:45",
  },
  {
    id: "m4",
    mine: true,
    body: "Yes! Working on a new collection right now.",
    time: "09:47",
    read: true,
  },
  {
    id: "m5",
    mine: false,
    body: "Perfect. Would love to give feedback before you launch. 🙏",
    time: "09:48",
  },
];

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  cyan: "#009FEF",
  cyanDeep: "#063B67",
  orange: "#FF7800",
  purple: "#6945F5",
  green: "#16D66B",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
};

// -----------------------------------------------------------------------------
// Gallery page shell.
// -----------------------------------------------------------------------------

interface PrototypeMeta {
  id: string;
  name: string;
  tagline: string;
  render: (props: PrototypeRenderProps) => React.ReactNode;
}

interface PrototypeRenderProps {
  friend: typeof SAMPLE_FRIEND;
  messages: SampleMessage[];
}

const PROTOTYPES: PrototypeMeta[] = [
  {
    id: "portrait-bloom",
    name: "Portrait Bloom",
    tagline:
      "Full portrait fades into the abyss · messages float in the darkness below their face.",
    render: PortraitBloom,
  },
  {
    id: "presence-orb",
    name: "Presence Orb",
    tagline:
      "Central glowing orb pulses with life · messages arc outward from the presence.",
    render: PresenceOrb,
  },
  {
    id: "aurora-stream",
    name: "Aurora Stream",
    tagline:
      "Slow aurora borealis behind glass tiles · atmospheric, cinematic, alive.",
    render: AuroraStream,
  },
  {
    id: "constellation",
    name: "Constellation",
    tagline:
      "Deep space · messages are stars connected by faint lines · latest is brightest.",
    render: Constellation,
  },
  {
    id: "voice-wave",
    name: "Voice Wave",
    tagline:
      "Waveform first · messages annotate the audio of your relationship.",
    render: VoiceWave,
  },
  {
    id: "depth-cards",
    name: "Depth Cards",
    tagline:
      "3D stack of cards · newest front-and-center · older recede into perspective.",
    render: DepthCards,
  },
  {
    id: "ambient-room",
    name: "Ambient Room",
    tagline:
      "Their blurred portrait as ambient light · messages emerge from their side of the room.",
    render: AmbientRoom,
  },
  {
    id: "neural-bloom",
    name: "Neural Bloom",
    tagline:
      "Central neuron · messages bloom outward on organic curves · a growing synapse.",
    render: NeuralBloom,
  },
  {
    id: "timeline-braid",
    name: "Timeline Braid",
    tagline:
      "Horizontal time axis · their messages branch up · yours branch down · woven history.",
    render: TimelineBraid,
  },
  {
    id: "tiktok-vertical",
    name: "TikTok Vertical",
    tagline:
      "Full-screen swipe-through cards · one message at a time · immersive.",
    render: TikTokVertical,
  },
];

export default function PrototypeGalleryPage() {
  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
        @keyframes nex-orb-pulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50%      { transform: scale(1.06); opacity: 1; }
        }
        @keyframes nex-aurora-shift {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(-8%, 5%) scale(1.15); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes nex-typing-dot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30%           { opacity: 1;   transform: translateY(-3px); }
        }
        @keyframes nex-star-twinkle {
          0%, 100% { opacity: 0.4; }
          50%      { opacity: 1; }
        }
        @keyframes nex-wave-move {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.text,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "24px 16px 40px",
        }}
      >
        <header style={{ maxWidth: 900, margin: "0 auto 28px" }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            NEX Chat · from the future
          </h1>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 14,
              color: NEX.textDim,
              maxWidth: 620,
              lineHeight: 1.55,
            }}
          >
            Ten prototype directions away from generic chat UI. Each renders
            the same sample conversation with Maria Santos in a distinct
            visual language. None are wired to the real backend — this is a
            design exploration, not a build.
          </p>
        </header>

        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            display: "grid",
            gap: 32,
          }}
        >
          {PROTOTYPES.map((p, i) => (
            <PrototypeSection key={p.id} index={i + 1} meta={p} />
          ))}
        </div>
      </main>
    </>
  );
}

function PrototypeSection({
  index,
  meta,
}: {
  index: number;
  meta: PrototypeMeta;
}) {
  const liveHref = LIVE_PREVIEW_ROUTES[meta.id];
  return (
    <section
      id={meta.id}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        gap: 14,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: NEX.orange,
            fontWeight: 600,
          }}
        >
          Prototype {String(index).padStart(2, "0")}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h2
            style={{
              margin: "4px 0 6px",
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.005em",
            }}
          >
            {meta.name}
          </h2>
          {liveHref && (
            <Link
              href={liveHref}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 12px",
                borderRadius: 999,
                background: "rgba(255,120,0,0.12)",
                border: `1px solid ${NEX.orange}`,
                color: NEX.orange,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                textDecoration: "none",
              }}
            >
              Open live →
            </Link>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 13, color: NEX.textDim, lineHeight: 1.55 }}>
          {meta.tagline}
        </p>
      </div>

      <PhoneFrame>
        {meta.render({ friend: SAMPLE_FRIEND, messages: SAMPLE_MESSAGES })}
      </PhoneFrame>
    </section>
  );
}

/** Renders its children inside a mobile-shaped frame · 390x720 · so
 *  each prototype is compared at a realistic phone size. */
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 390,
        margin: "0 auto",
        height: 720,
        borderRadius: 32,
        overflow: "hidden",
        background: NEX.bg,
        border: "1px solid rgba(0,159,239,0.18)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.55), 0 0 0 6px rgba(0,0,0,0.6)",
        position: "relative",
      }}
    >
      {children}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Prototype 01 · Portrait Bloom
// -----------------------------------------------------------------------------

function PortraitBloom({ friend, messages }: PrototypeRenderProps) {
  return (
    <div style={{ position: "absolute", inset: 0, background: NEX.bg }}>
      {/* Portrait fills top 55% and fades to nothing */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "58%",
          backgroundImage: `url(${friend.avatarUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center 25%",
          maskImage:
            "linear-gradient(180deg, #000 0%, #000 55%, rgba(0,0,0,0.5) 78%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(180deg, #000 0%, #000 55%, rgba(0,0,0,0.5) 78%, transparent 100%)",
        }}
      />
      {/* Deep abyss gradient below */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, transparent 40%, rgba(2,9,20,0.7) 60%, #020914 78%)",
        }}
      />
      {/* Name overlay */}
      <div
        style={{
          position: "absolute",
          top: 24,
          left: 20,
          right: 20,
          color: NEX.text,
          textShadow: "0 2px 12px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.75, letterSpacing: "0.06em" }}>
          NEX · CHATTING
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>
          {friend.name.toUpperCase()}
        </div>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>
          {friend.profession}
        </div>
      </div>

      {/* Messages float in the lower half */}
      <div
        style={{
          position: "absolute",
          bottom: 88,
          left: 16,
          right: 16,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {messages.slice(-3).map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.mine ? "flex-end" : "flex-start",
              maxWidth: "78%",
              padding: "10px 14px",
              borderRadius: 18,
              background: m.mine
                ? "linear-gradient(120deg, #087FFF 0%, #6945F5 100%)"
                : "rgba(255,255,255,0.06)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              border: m.mine ? "none" : "1px solid rgba(255,255,255,0.08)",
              color: NEX.text,
              fontSize: 14,
              lineHeight: 1.45,
              boxShadow: m.mine
                ? "0 8px 22px rgba(8,127,255,0.35)"
                : "0 4px 14px rgba(0,0,0,0.5)",
            }}
          >
            {m.body}
          </div>
        ))}
      </div>

      <FakeComposer accent="linear-gradient(135deg,#008CFF,#4657FF,#FF7A00)" />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Prototype 02 · Presence Orb
// -----------------------------------------------------------------------------

function PresenceOrb({ friend, messages }: PrototypeRenderProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(ellipse at 50% 22%, rgba(0,159,239,0.18) 0%, rgba(2,9,20,0.9) 55%, #020914 90%)",
      }}
    >
      {/* Orb */}
      <div
        style={{
          position: "absolute",
          top: 42,
          left: "50%",
          transform: "translateX(-50%)",
          width: 130,
          height: 130,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 40% 30%, rgba(180,220,255,0.9), rgba(0,159,239,0.55) 45%, rgba(105,69,245,0.5) 75%, rgba(0,0,0,0) 100%)",
          boxShadow:
            "0 0 60px rgba(0,159,239,0.55), inset 0 0 40px rgba(255,255,255,0.15)",
          animation: "nex-orb-pulse 3s ease-in-out infinite",
          overflow: "hidden",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={friend.avatarUrl}
          alt=""
          style={{
            position: "absolute",
            inset: 18,
            width: "calc(100% - 36px)",
            height: "calc(100% - 36px)",
            borderRadius: "50%",
            objectFit: "cover",
            opacity: 0.9,
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          top: 188,
          left: 0,
          right: 0,
          textAlign: "center",
          color: NEX.text,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 600 }}>{friend.name}</div>
        <div style={{ fontSize: 12, color: NEX.textDim, marginTop: 3 }}>
          {friend.profession} · online
        </div>
      </div>

      {/* Messages orbiting outward */}
      <div
        style={{
          position: "absolute",
          top: 245,
          left: 20,
          right: 20,
          bottom: 100,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          gap: 10,
        }}
      >
        {messages.map((m, i) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.mine ? "flex-end" : "flex-start",
              maxWidth: "76%",
              padding: "10px 14px",
              borderRadius: 18,
              background: m.mine
                ? "rgba(255,120,0,0.14)"
                : "rgba(0,159,239,0.12)",
              border: `1px solid ${
                m.mine ? "rgba(255,120,0,0.35)" : "rgba(0,159,239,0.35)"
              }`,
              color: NEX.text,
              fontSize: 14,
              lineHeight: 1.4,
              marginLeft: m.mine ? 0 : `${i * 4}px`,
              marginRight: m.mine ? `${i * 4}px` : 0,
            }}
          >
            {m.body}
          </div>
        ))}
      </div>

      <FakeComposer accent={NEX.cyan} />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Prototype 03 · Aurora Stream
// -----------------------------------------------------------------------------

function AuroraStream({ friend, messages }: PrototypeRenderProps) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "#020a15" }}>
      {/* Aurora layers · slow drift */}
      <div
        style={{
          position: "absolute",
          inset: "-20%",
          background:
            "conic-gradient(from 200deg, rgba(0,255,180,0.28), rgba(0,159,239,0.28), rgba(105,69,245,0.28), rgba(255,120,0,0.18), rgba(0,255,180,0.28))",
          filter: "blur(60px)",
          animation: "nex-aurora-shift 18s ease-in-out infinite",
          opacity: 0.75,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(2,10,21,0.4) 0%, rgba(2,10,21,0.75) 65%, rgba(2,10,21,0.95) 100%)",
        }}
      />

      <MiniHeader friend={friend} />

      <div
        style={{
          position: "absolute",
          top: 90,
          left: 14,
          right: 14,
          bottom: 100,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          gap: 8,
          overflow: "hidden",
        }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.mine ? "flex-end" : "flex-start",
              maxWidth: "76%",
              padding: "10px 14px",
              borderRadius: 20,
              background: "rgba(255,255,255,0.06)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: NEX.text,
              fontSize: 14,
              lineHeight: 1.45,
              boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
            }}
          >
            {m.body}
          </div>
        ))}
      </div>

      <FakeComposer accent="linear-gradient(135deg, #00ffb4, #009fef, #6945f5)" />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Prototype 04 · Constellation
// -----------------------------------------------------------------------------

function Constellation({ friend, messages }: PrototypeRenderProps) {
  const stars = React.useMemo(() => {
    const list: { x: number; y: number; r: number; d: number }[] = [];
    // Deterministic pseudo-random so it renders consistently in SSR.
    let s = 1337;
    const rnd = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    for (let i = 0; i < 60; i++) {
      list.push({
        x: rnd() * 390,
        y: rnd() * 720,
        r: rnd() * 1.2 + 0.4,
        d: rnd() * 4,
      });
    }
    return list;
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(ellipse at 50% 40%, #061224 0%, #02060e 100%)",
      }}
    >
      {/* Starfield */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        {stars.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill="#F4F7FC"
            opacity={0.6}
            style={{
              animation: `nex-star-twinkle 4s ease-in-out ${s.d}s infinite`,
            }}
          />
        ))}
      </svg>

      <MiniHeader friend={friend} accent={NEX.cyan} translucent />

      {/* Messages as constellation nodes · connected by thin lines */}
      <div
        style={{
          position: "absolute",
          top: 100,
          left: 0,
          right: 0,
          bottom: 100,
        }}
      >
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
          }}
          viewBox="0 0 390 520"
          preserveAspectRatio="none"
        >
          <path
            d="M 60 90 L 260 170 L 90 260 L 300 340 L 80 430"
            stroke="rgba(0,159,239,0.35)"
            strokeWidth={1}
            fill="none"
          />
        </svg>
        {messages.map((m, i) => {
          const positions = [
            { top: 60, left: 20 },
            { top: 140, left: 130 },
            { top: 230, left: 30 },
            { top: 310, left: 150 },
            { top: 400, left: 40 },
          ];
          const pos = positions[i] ?? { top: 480, left: 40 };
          const brightness = 0.5 + (i / messages.length) * 0.5;
          return (
            <div
              key={m.id}
              style={{
                position: "absolute",
                top: pos.top,
                left: pos.left,
                maxWidth: 200,
                color: NEX.text,
                opacity: brightness,
              }}
            >
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: m.mine ? NEX.orange : NEX.cyan,
                  marginRight: 8,
                  verticalAlign: "middle",
                  boxShadow: `0 0 12px ${m.mine ? NEX.orange : NEX.cyan}`,
                }}
              />
              <span
                style={{
                  display: "inline-block",
                  fontSize: 13,
                  lineHeight: 1.4,
                  verticalAlign: "middle",
                  textShadow: "0 1px 4px rgba(0,0,0,0.85)",
                }}
              >
                {m.body}
              </span>
            </div>
          );
        })}
      </div>

      <FakeComposer accent={NEX.cyan} />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Prototype 05 · Voice Wave
// -----------------------------------------------------------------------------

function VoiceWave({ friend, messages }: PrototypeRenderProps) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "#04101f" }}>
      <MiniHeader friend={friend} />

      {/* Ambient waveform at top */}
      <div
        style={{
          position: "absolute",
          top: 90,
          left: 16,
          right: 16,
          height: 110,
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(0,159,239,0.18) 0%, transparent 70%)",
          borderRadius: 16,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          gap: 3,
          padding: "0 12px",
        }}
      >
        {Array.from({ length: 60 }).map((_, i) => {
          const h = 6 + Math.abs(Math.sin(i * 0.6) * 40) + Math.abs(Math.sin(i * 0.13) * 30);
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                width: 3,
                height: h,
                borderRadius: 2,
                background:
                  i < 25
                    ? "linear-gradient(180deg, #009fef, #6945f5)"
                    : "rgba(255,255,255,0.14)",
              }}
            />
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          top: 220,
          left: 16,
          right: 16,
          bottom: 100,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexDirection: m.mine ? "row-reverse" : "row",
            }}
          >
            <div
              style={{
                flexShrink: 0,
                width: 40,
                height: 32,
                borderRadius: 8,
                background: m.mine
                  ? "linear-gradient(120deg, #087FFF, #6945F5)"
                  : "rgba(0,159,239,0.14)",
                border: m.mine
                  ? "none"
                  : "1px solid rgba(0,159,239,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
              }}
            >
              {[0, 1, 2, 3, 4].map((k) => (
                <span
                  key={k}
                  style={{
                    display: "inline-block",
                    width: 2,
                    height: 6 + Math.abs(Math.sin((k + 1) * 1.7) * 12),
                    background: "rgba(255,255,255,0.85)",
                    borderRadius: 1,
                  }}
                />
              ))}
            </div>
            <div
              style={{
                flex: 1,
                fontSize: 14,
                color: NEX.text,
                lineHeight: 1.4,
                textAlign: m.mine ? "right" : "left",
              }}
            >
              {m.body}
              <div
                style={{
                  fontSize: 10,
                  color: NEX.textMute,
                  marginTop: 2,
                  letterSpacing: "0.06em",
                }}
              >
                {m.time}
              </div>
            </div>
          </div>
        ))}
      </div>

      <FakeComposer accent={NEX.cyan} composerLabel="Hold to talk · tap to type" />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Prototype 06 · Depth Cards
// -----------------------------------------------------------------------------

function DepthCards({ friend, messages }: PrototypeRenderProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(ellipse at 50% 60%, #0a1a30 0%, #020914 80%)",
        perspective: "1200px",
      }}
    >
      <MiniHeader friend={friend} />

      <div
        style={{
          position: "absolute",
          top: 110,
          left: 20,
          right: 20,
          bottom: 100,
          transformStyle: "preserve-3d",
        }}
      >
        {messages.map((m, i) => {
          const depth = messages.length - 1 - i; // 0 for newest
          const scale = 1 - depth * 0.05;
          const translateY = depth * -32;
          const translateZ = -depth * 30;
          const opacity = 1 - depth * 0.18;
          return (
            <div
              key={m.id}
              style={{
                position: "absolute",
                bottom: 20 + depth * 6,
                left: m.mine ? "18%" : 0,
                right: m.mine ? 0 : "18%",
                padding: "14px 18px",
                borderRadius: 20,
                background: m.mine
                  ? "linear-gradient(120deg, #087FFF, #6945F5)"
                  : "linear-gradient(145deg, #102B46, #0A1D31)",
                border: m.mine
                  ? "none"
                  : "1px solid rgba(105,170,220,0.08)",
                color: NEX.text,
                fontSize: 14,
                lineHeight: 1.45,
                transform: `translateY(${translateY}px) translateZ(${translateZ}px) scale(${scale})`,
                opacity,
                boxShadow: m.mine
                  ? `0 12px 30px rgba(8,127,255,${0.28 - depth * 0.05})`
                  : `0 12px 30px rgba(0,0,0,${0.4 - depth * 0.06})`,
                zIndex: 10 - depth,
              }}
            >
              {m.body}
            </div>
          );
        })}
      </div>

      <FakeComposer accent="linear-gradient(135deg,#008CFF,#4657FF,#FF7A00)" />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Prototype 07 · Ambient Room
// -----------------------------------------------------------------------------

function AmbientRoom({ friend, messages }: PrototypeRenderProps) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "#050a12" }}>
      {/* Blurred portrait as ambient wall */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${friend.avatarUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center 20%",
          filter: "blur(38px) saturate(1.1)",
          opacity: 0.32,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 30% 40%, rgba(0,159,239,0.14), transparent 60%), radial-gradient(circle at 70% 70%, rgba(255,120,0,0.10), transparent 55%), linear-gradient(180deg, rgba(2,9,20,0.4) 0%, rgba(2,9,20,0.7) 60%, #020914 100%)",
        }}
      />

      <MiniHeader friend={friend} translucent />

      <div
        style={{
          position: "absolute",
          top: 100,
          left: 16,
          right: 16,
          bottom: 100,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          gap: 10,
        }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.mine ? "flex-end" : "flex-start",
              maxWidth: "76%",
              padding: "11px 14px",
              borderRadius: 20,
              background: m.mine
                ? "rgba(255,120,0,0.12)"
                : "rgba(0,159,239,0.10)",
              border: `1px solid ${
                m.mine ? "rgba(255,120,0,0.4)" : "rgba(0,159,239,0.35)"
              }`,
              color: NEX.text,
              fontSize: 14,
              lineHeight: 1.45,
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              boxShadow: m.mine
                ? "0 -6px 22px rgba(255,120,0,0.14)"
                : "0 -6px 22px rgba(0,159,239,0.14)",
            }}
          >
            {m.body}
          </div>
        ))}
      </div>

      <FakeComposer accent={NEX.orange} />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Prototype 08 · Neural Bloom
// -----------------------------------------------------------------------------

function NeuralBloom({ friend, messages }: PrototypeRenderProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(ellipse at 50% 55%, #0a1830 0%, #020914 75%)",
      }}
    >
      <MiniHeader friend={friend} />

      {/* Central node with rings */}
      <div
        style={{
          position: "absolute",
          top: 100,
          left: 0,
          right: 0,
          bottom: 100,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "45%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 60,
            height: 60,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 30% 30%, rgba(0,159,239,1), rgba(0,159,239,0.6) 50%, rgba(105,69,245,0.4) 90%)",
            boxShadow:
              "0 0 40px rgba(0,159,239,0.5), 0 0 0 12px rgba(0,159,239,0.08), 0 0 0 40px rgba(0,159,239,0.05)",
          }}
        />
        {/* Rings */}
        {[80, 140, 210].map((r, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: "45%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: r * 2,
              height: r * 2,
              borderRadius: "50%",
              border: `1px solid rgba(0,159,239,${0.14 - i * 0.03})`,
            }}
          />
        ))}
        {/* Messages placed on rings */}
        {messages.map((m, i) => {
          const angles = [200, 40, 165, 340, 90];
          const radii = [80, 90, 140, 145, 210];
          const angle = angles[i] ?? 0;
          const radius = radii[i] ?? 90;
          const rad = (angle * Math.PI) / 180;
          const x = Math.cos(rad) * radius;
          const y = Math.sin(rad) * radius;
          return (
            <div
              key={m.id}
              style={{
                position: "absolute",
                top: `calc(45% + ${y}px)`,
                left: `calc(50% + ${x}px)`,
                transform: "translate(-50%, -50%)",
                maxWidth: 150,
                padding: "8px 12px",
                borderRadius: 14,
                background: m.mine
                  ? "rgba(255,120,0,0.14)"
                  : "rgba(0,159,239,0.14)",
                border: `1px solid ${
                  m.mine ? "rgba(255,120,0,0.4)" : "rgba(0,159,239,0.4)"
                }`,
                color: NEX.text,
                fontSize: 11,
                lineHeight: 1.35,
                textAlign: "center",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
              }}
            >
              {m.body}
            </div>
          );
        })}
      </div>

      <FakeComposer accent={NEX.cyan} />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Prototype 09 · Timeline Braid
// -----------------------------------------------------------------------------

function TimelineBraid({ friend, messages }: PrototypeRenderProps) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "#020914" }}>
      <MiniHeader friend={friend} />

      <div
        style={{
          position: "absolute",
          top: 100,
          left: 0,
          right: 0,
          bottom: 100,
          overflow: "hidden",
        }}
      >
        {/* Central time axis */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "50%",
            height: 2,
            background:
              "linear-gradient(90deg, rgba(0,159,239,0.5), rgba(105,69,245,0.5), rgba(255,120,0,0.5))",
            transform: "translateY(-50%)",
          }}
        />

        {messages.map((m, i) => {
          const step = 66;
          const leftPct = 8 + i * 16;
          const above = !m.mine;
          return (
            <React.Fragment key={m.id}>
              {/* Tick */}
              <div
                style={{
                  position: "absolute",
                  left: `${leftPct}%`,
                  top: "50%",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: above ? NEX.cyan : NEX.orange,
                  transform: "translate(-50%, -50%)",
                  boxShadow: `0 0 12px ${above ? NEX.cyan : NEX.orange}`,
                }}
              />
              {/* Branch line */}
              <div
                style={{
                  position: "absolute",
                  left: `calc(${leftPct}% - 0.5px)`,
                  top: above ? `calc(50% - ${step}px)` : "50%",
                  width: 1,
                  height: step,
                  background: above
                    ? `linear-gradient(180deg, rgba(0,159,239,0.5), rgba(0,159,239,0.05))`
                    : `linear-gradient(180deg, rgba(255,120,0,0.05), rgba(255,120,0,0.5))`,
                }}
              />
              {/* Message card */}
              <div
                style={{
                  position: "absolute",
                  left: `${leftPct}%`,
                  top: above
                    ? `calc(50% - ${step + 74}px)`
                    : `calc(50% + ${step - 4}px)`,
                  transform: "translateX(-50%)",
                  width: 130,
                  padding: "8px 10px",
                  borderRadius: 12,
                  background: above
                    ? "rgba(0,159,239,0.08)"
                    : "rgba(255,120,0,0.08)",
                  border: `1px solid ${
                    above ? "rgba(0,159,239,0.4)" : "rgba(255,120,0,0.4)"
                  }`,
                  color: NEX.text,
                  fontSize: 10,
                  lineHeight: 1.35,
                }}
              >
                {m.body}
                <div
                  style={{
                    marginTop: 3,
                    fontSize: 8,
                    color: NEX.textMute,
                    letterSpacing: "0.06em",
                  }}
                >
                  {m.time}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <FakeComposer accent="linear-gradient(135deg,#009fef,#ff7a00)" />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Prototype 10 · TikTok Vertical
// -----------------------------------------------------------------------------

function TikTokVertical({ friend, messages }: PrototypeRenderProps) {
  // Show the middle message as the "current" card · previous message
  // peeks above, next message peeks below.
  const currentIdx = 2;
  const prev = messages[currentIdx - 1];
  const current = messages[currentIdx];
  const next = messages[currentIdx + 1];
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#000",
        overflow: "hidden",
      }}
    >
      {/* Blurred portrait as ambient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${friend.avatarUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(50px) saturate(1.3) brightness(0.7)",
          opacity: 0.9,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0.75) 100%)",
        }}
      />

      {/* Top identity bar */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          right: 20,
          color: NEX.text,
          display: "flex",
          alignItems: "center",
          gap: 10,
          zIndex: 3,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={friend.avatarUrl}
          alt=""
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "1.5px solid #fff",
            objectFit: "cover",
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{friend.name}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
            {friend.profession} · Live
          </div>
        </div>
        <button
          type="button"
          style={{
            padding: "6px 14px",
            borderRadius: 999,
            background: NEX.orange,
            color: "#fff",
            border: "none",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Follow
        </button>
      </div>

      {/* Previous message peek */}
      {prev && (
        <div
          style={{
            position: "absolute",
            top: 88,
            left: 24,
            right: 24,
            padding: "10px 14px",
            borderRadius: 16,
            background: "rgba(0,0,0,0.35)",
            color: "rgba(255,255,255,0.6)",
            fontSize: 12,
            lineHeight: 1.35,
            border: "1px solid rgba(255,255,255,0.06)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
        >
          {prev.body}
        </div>
      )}

      {/* Current card · full attention */}
      {current && (
        <div
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            top: "36%",
            transform: "translateY(-50%)",
            padding: "22px 20px 20px",
            borderRadius: 24,
            background: current.mine
              ? "linear-gradient(120deg, rgba(8,127,255,0.85), rgba(105,69,245,0.85))"
              : "rgba(0,0,0,0.55)",
            border: current.mine
              ? "none"
              : "1px solid rgba(255,255,255,0.08)",
            color: "#fff",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.14em",
              opacity: 0.75,
              textTransform: "uppercase",
              marginBottom: 6,
              fontWeight: 600,
            }}
          >
            {current.mine ? "You said" : `${friend.name.split(" ")[0]} said`}
            · {current.time}
          </div>
          <div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.32 }}>
            {current.body}
          </div>
        </div>
      )}

      {/* Next message peek */}
      {next && (
        <div
          style={{
            position: "absolute",
            bottom: 130,
            left: 24,
            right: 24,
            padding: "10px 14px",
            borderRadius: 16,
            background: "rgba(0,0,0,0.35)",
            color: "rgba(255,255,255,0.6)",
            fontSize: 12,
            lineHeight: 1.35,
            border: "1px solid rgba(255,255,255,0.06)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
        >
          {next.body}
        </div>
      )}

      {/* Swipe hint */}
      <div
        style={{
          position: "absolute",
          bottom: 92,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 10,
          color: "rgba(255,255,255,0.5)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        Swipe ↓ for next
      </div>

      <FakeComposer accent={NEX.orange} translucent />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Shared helpers.
// -----------------------------------------------------------------------------

function MiniHeader({
  friend,
  accent,
  translucent = false,
}: {
  friend: typeof SAMPLE_FRIEND;
  accent?: string;
  translucent?: boolean;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        padding: "18px 16px 12px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: translucent
          ? "transparent"
          : "linear-gradient(180deg, rgba(2,9,20,0.88) 0%, rgba(2,9,20,0) 100%)",
        zIndex: 4,
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: `1px solid ${accent ?? "rgba(0,159,239,0.35)"}`,
          overflow: "hidden",
          background: NEX.cyanDeep,
          flexShrink: 0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={friend.avatarUrl}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: NEX.text,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {friend.name}
        </div>
        <div style={{ fontSize: 10, color: NEX.textDim }}>
          {friend.profession}
        </div>
      </div>
      <div
        style={{
          fontSize: 10,
          color: NEX.green,
          padding: "3px 8px",
          borderRadius: 999,
          background: "rgba(22,214,107,0.14)",
          border: "1px solid rgba(22,214,107,0.35)",
          letterSpacing: "0.06em",
        }}
      >
        LIVE
      </div>
    </div>
  );
}

function FakeComposer({
  accent,
  composerLabel = "Write a message...",
  translucent = false,
}: {
  accent: string;
  composerLabel?: string;
  translucent?: boolean;
}) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "10px 14px 18px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: translucent
          ? "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 100%)"
          : "linear-gradient(180deg, rgba(2,9,20,0) 0%, rgba(2,9,20,0.75) 40%, rgba(2,9,20,0.95) 100%)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        zIndex: 5,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "1px solid rgba(0,159,239,0.35)",
          background: "rgba(4,20,36,0.7)",
          display: "grid",
          placeItems: "center",
          color: NEX.text,
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        +
      </div>
      <div
        style={{
          flex: 1,
          height: 44,
          padding: "0 16px",
          borderRadius: 22,
          background: "rgba(4,20,36,0.85)",
          border: "1px solid rgba(0,159,239,0.35)",
          display: "flex",
          alignItems: "center",
          color: NEX.textDim,
          fontSize: 13,
        }}
      >
        {composerLabel}
      </div>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: accent,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M22 2 11 13" />
          <path d="M22 2 15 22 11 13 2 9 22 2z" />
        </svg>
      </div>
    </div>
  );
}
