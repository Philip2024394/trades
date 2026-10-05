"use client";

// src/app/nex-native/dev/ocean-animation-prototypes/_prototypes-client.tsx
//
// Ten advanced Ocean animation prototypes · pure SVG + CSS · zero
// dependencies on the Theme Engine. If a prototype is approved by
// the founder it later becomes a general engine capability (e.g.
// a new ambient family or motion token) · never a world-specific
// hack.

import * as React from "react";

const OCEAN = {
  deep: "#0A2535",
  primary: "#2E90B5",
  secondary: "#4FC3DC",
  highlight: "#E8F7FF",
  glow: "rgba(130,210,255,0.55)",
};

const OCEAN_BG = `radial-gradient(ellipse at 50% 10%, ${OCEAN.secondary} 0%, ${OCEAN.primary} 25%, ${OCEAN.deep} 72%, #000 100%)`;

// ─── Keyframes · one stylesheet shared across every tile ────────────

const KF = `
  /* 1 · Chain + Anchor */
  @keyframes p1-chain { 0%,100% { transform: rotate(-2.5deg); } 50% { transform: rotate(2.5deg); } }
  @keyframes p1-anchor-wobble { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(5deg); } }

  /* 2 · Scuba diver */
  @keyframes p2-descend {
    0%   { transform: translate3d(10px,-80px,0) rotate(-3deg); }
    50%  { transform: translate3d(-10px, 40px,0) rotate(4deg); }
    100% { transform: translate3d(10px, 160px,0) rotate(-2deg); opacity: 0; }
  }
  @keyframes p2-fin-kick { 0%,100% { transform: rotate(-6deg); } 50% { transform: rotate(10deg); } }
  @keyframes p2-bubble {
    0%   { transform: translate3d(0, 0, 0) scale(0.6); opacity: 0; }
    20%  { opacity: 0.95; }
    100% { transform: translate3d(var(--bx, 0px), -200px, 0) scale(1.2); opacity: 0; }
  }

  /* 3 · Boat on surface */
  @keyframes p3-sail {
    0%   { transform: translateX(-120px); }
    100% { transform: translateX(300px); }
  }
  @keyframes p3-wake { 0%,100% { opacity: 0.3; } 50% { opacity: 0.75; } }
  @keyframes p3-rock { 0%,100% { transform: rotate(-1.5deg); } 50% { transform: rotate(1.5deg); } }

  /* 4 · Fish school */
  @keyframes p4-swim {
    0%   { transform: translateX(-80px); }
    100% { transform: translateX(340px); }
  }
  @keyframes p4-tail { 0%,100% { transform: scaleX(1); } 50% { transform: scaleX(-1); } }
  @keyframes p4-waver { 0%,100% { transform: translateY(-3px); } 50% { transform: translateY(3px); } }

  /* 5 · Shark hits glass + crack */
  @keyframes p5-shark-charge {
    0%   { transform: translate3d(260px,  10px, 0) rotate(-8deg); opacity: 0; }
    15%  { opacity: 1; }
    40%  { transform: translate3d(-40px, 10px, 0) rotate(-2deg); }
    48%  { transform: translate3d(-70px, 10px, 0) rotate(0deg) scale(1.1); }
    55%  { transform: translate3d(-40px, 10px, 0) rotate(2deg); }
    80%  { transform: translate3d(260px, 10px, 0) rotate(8deg); opacity: 1; }
    82%  { opacity: 0; }
    100% { opacity: 0; }
  }
  @keyframes p5-crack {
    0%, 42%  { opacity: 0; transform: scale(0.3); }
    48%      { opacity: 1; transform: scale(1.05); }
    55%      { transform: scale(1); }
    78%      { opacity: 0.8; }
    85%      { opacity: 0; }
    100%     { opacity: 0; }
  }
  @keyframes p5-shake {
    0%, 40%, 60%, 100% { transform: translate(0, 0); }
    45% { transform: translate(-3px, 2px); }
    48% { transform: translate(4px, -2px); }
    51% { transform: translate(-2px, 3px); }
    54% { transform: translate(2px, -1px); }
  }

  /* 6 · Jellyfish */
  @keyframes p6-rise {
    0%   { transform: translateY(80px); opacity: 0; }
    15%  { opacity: 1; }
    80%  { opacity: 1; }
    100% { transform: translateY(-520px); opacity: 0; }
  }
  @keyframes p6-pulse { 0%,100% { transform: scaleY(1) scaleX(1); } 50% { transform: scaleY(0.78) scaleX(1.1); } }
  @keyframes p6-tent-wave { 0%,100% { transform: translateX(-2px); } 50% { transform: translateX(2px); } }

  /* 7 · Whale */
  @keyframes p7-pass {
    0%   { transform: translateX(-220px); }
    100% { transform: translateX(340px); }
  }
  @keyframes p7-tail { 0%,100% { transform: rotate(-6deg); } 50% { transform: rotate(8deg); } }
  @keyframes p7-spout {
    0%, 25%  { opacity: 0; transform: translateY(10px) scale(0.5); }
    35%      { opacity: 1; transform: translateY(-6px) scale(1); }
    65%      { opacity: 0.6; transform: translateY(-24px) scale(1.3); }
    80%, 100%{ opacity: 0; transform: translateY(-30px) scale(1.5); }
  }

  /* 8 · Octopus · each tentacle independent */
  @keyframes p8-head-bob { 0%,100% { transform: translateY(-2px); } 50% { transform: translateY(2px); } }
  @keyframes p8-t-a { 0%,100% { d: path("M0,0 Q6,10 2,22 Q-4,34 0,46"); } 50% { d: path("M0,0 Q-6,10 -2,22 Q6,34 2,46"); } }
  @keyframes p8-t-b { 0%,100% { d: path("M0,0 Q8,12 4,24 Q-2,36 2,48"); } 50% { d: path("M0,0 Q-4,12 2,24 Q8,36 -2,48"); } }
  @keyframes p8-t-c { 0%,100% { d: path("M0,0 Q4,10 -2,22 Q-10,34 -4,46"); } 50% { d: path("M0,0 Q10,10 6,22 Q0,34 4,46"); } }

  /* 9 · Light rays + caustics */
  @keyframes p9-ray { 0%,100% { opacity: 0.3; transform: skewX(-6deg); } 50% { opacity: 0.75; transform: skewX(0deg); } }
  @keyframes p9-caustic-a { 0%,100% { opacity: 0.1; transform: scale(0.9); } 50% { opacity: 0.6; transform: scale(1.15); } }
  @keyframes p9-caustic-b { 0%,100% { opacity: 0.55; transform: scale(1.1); } 50% { opacity: 0.1; transform: scale(0.85); } }

  /* 10 · Treasure chest */
  @keyframes p10-glow { 0%,100% { opacity: 0.3; transform: scale(0.95); } 50% { opacity: 0.9; transform: scale(1.1); } }
  @keyframes p10-sparkle {
    0%   { opacity: 0; transform: scale(0.3) rotate(0); }
    20%  { opacity: 1; }
    100% { opacity: 0; transform: scale(1.4) rotate(45deg); }
  }

  /* ambient rising bubbles for every tile */
  @keyframes bg-bubble {
    0%   { transform: translateY(0) scale(0.6); opacity: 0; }
    20%  { opacity: 0.6; }
    100% { transform: translateY(-520px) scale(1.1); opacity: 0; }
  }
`;

// ─── Shared tile frame ──────────────────────────────────────────────

function PrototypeTile({
  num,
  name,
  description,
  children,
}: {
  num: number;
  name: string;
  description: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          fontSize: 11,
          color: "#8BA9D1",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        {`Prototype ${num}`}
      </div>
      <div
        style={{
          fontSize: 14,
          color: "#F4F7FC",
          fontWeight: 700,
          marginTop: -2,
        }}
      >
        {name}
      </div>
      <div
        style={{
          width: "100%",
          aspectRatio: "7/12",
          borderRadius: 20,
          overflow: "hidden",
          background: OCEAN_BG,
          border: "1px solid rgba(0,175,255,0.3)",
          position: "relative",
        }}
      >
        <AmbientBubbles />
        {children}
      </div>
      <div style={{ fontSize: 11, color: "#8BA9D1", lineHeight: 1.4 }}>
        {description}
      </div>
    </div>
  );
}

function AmbientBubbles(): React.JSX.Element {
  const bubbles = [
    { left: "15%", size: 4, delay: 0, dur: 7 },
    { left: "32%", size: 6, delay: 2, dur: 8 },
    { left: "55%", size: 3, delay: 4, dur: 6 },
    { left: "75%", size: 5, delay: 1, dur: 7.5 },
    { left: "88%", size: 3, delay: 3, dur: 6.5 },
  ];
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {bubbles.map((b, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: b.left,
            bottom: 0,
            width: b.size,
            height: b.size,
            borderRadius: "50%",
            background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.85), ${OCEAN.highlight} 55%, ${OCEAN.secondary})`,
            boxShadow: `0 0 ${b.size * 2}px ${OCEAN.highlight}99`,
            animation: `bg-bubble ${b.dur}s linear ${b.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Prototype 1 · Chain + Anchor ───────────────────────────────────

function P1(): React.JSX.Element {
  const links = Array.from({ length: 14 });
  return (
    <svg
      viewBox="0 0 280 480"
      preserveAspectRatio="xMidYMid slice"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        animation: "p1-chain 6s ease-in-out infinite",
        transformOrigin: "140px 0",
      }}
      aria-hidden
    >
      <defs>
        <linearGradient id="p1-metal" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0b1419" />
          <stop offset="0.5" stopColor="#8aa0ad" />
          <stop offset="1" stopColor="#0b1419" />
        </linearGradient>
      </defs>
      {links.map((_, i) => (
        <g key={i} transform={`translate(140 ${20 + i * 20}) rotate(${i % 2 === 0 ? 0 : 90})`}>
          <ellipse rx="11" ry="7" fill="none" stroke="url(#p1-metal)" strokeWidth="3.5" />
        </g>
      ))}
      {/* Anchor */}
      <g
        transform="translate(140 340)"
        style={{ animation: "p1-anchor-wobble 5s ease-in-out infinite", transformOrigin: "140px 340px" }}
      >
        <line x1="0" y1="-10" x2="0" y2="60" stroke="url(#p1-metal)" strokeWidth="5" strokeLinecap="round" />
        <circle cx="0" cy="-6" r="7" fill="none" stroke="url(#p1-metal)" strokeWidth="4" />
        <line x1="-16" y1="12" x2="16" y2="12" stroke="url(#p1-metal)" strokeWidth="5" strokeLinecap="round" />
        <path
          d="M -32 60 Q -32 76 0 76 Q 32 76 32 60"
          fill="none"
          stroke="url(#p1-metal)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path d="M -40 56 L -28 68" stroke="url(#p1-metal)" strokeWidth="5" strokeLinecap="round" />
        <path d="M 40 56 L 28 68" stroke="url(#p1-metal)" strokeWidth="5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// ─── Prototype 2 · Scuba Diver ──────────────────────────────────────

function P2(): React.JSX.Element {
  const trails = Array.from({ length: 6 });
  return (
    <>
      <svg
        viewBox="0 0 280 480"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          animation: "p2-descend 9s ease-in-out infinite",
        }}
        aria-hidden
      >
        <g transform="translate(130 160)">
          <ellipse cx="0" cy="0" rx="24" ry="22" fill="#1b2a35" />
          <circle cx="0" cy="-2" r="14" fill="#4FC3DC" opacity="0.7" />
          <rect x="-30" y="-12" width="8" height="26" rx="3" fill="#1b2a35" />
          <rect x="22" y="-12" width="8" height="26" rx="3" fill="#1b2a35" />
          <rect x="-18" y="20" width="36" height="34" rx="12" fill="#273a46" />
          <rect x="-26" y="18" width="12" height="30" rx="4" fill="#1b2a35" />
          <rect x="14" y="18" width="12" height="30" rx="4" fill="#1b2a35" />
          <g style={{ animation: "p2-fin-kick 1.2s ease-in-out infinite", transformOrigin: "0 54px" }}>
            <path d="M -16 54 Q -24 72 -32 90 L -18 94 Q -6 70 0 56 Z" fill="#111e26" />
            <path d="M 16 54 Q 24 72 32 90 L 18 94 Q 6 70 0 56 Z" fill="#111e26" />
          </g>
          <rect x="-10" y="-8" width="20" height="4" rx="1.5" fill="#F4F7FC" opacity="0.9" />
        </g>
      </svg>
      {/* bubble trail */}
      <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        {trails.map((_, i) => (
          <span
            key={i}
            style={
              {
                position: "absolute",
                left: `${48 + i * 2}%`,
                top: "32%",
                width: 5 + (i % 2) * 2,
                height: 5 + (i % 2) * 2,
                borderRadius: "50%",
                background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.85), ${OCEAN.highlight} 55%, ${OCEAN.secondary})`,
                boxShadow: `0 0 6px ${OCEAN.highlight}aa`,
                animation: `p2-bubble ${3 + (i % 2)}s linear ${i * 0.5}s infinite`,
                "--bx": `${(i % 2 === 0 ? -1 : 1) * 10}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </>
  );
}

// ─── Prototype 3 · Boat on surface ──────────────────────────────────

function P3(): React.JSX.Element {
  return (
    <>
      {/* Surface line */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "22%",
          height: 2,
          background: `linear-gradient(90deg, transparent, ${OCEAN.highlight}66, transparent)`,
        }}
      />
      {/* Wake */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "24%",
          left: 0,
          right: 0,
          height: 20,
          background: `repeating-linear-gradient(90deg, transparent 0 8px, ${OCEAN.highlight}55 8px 14px, transparent 14px 22px)`,
          animation: "p3-wake 2s ease-in-out infinite",
        }}
      />
      {/* Boat */}
      <svg
        viewBox="0 0 280 480"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          animation: "p3-sail 10s linear infinite",
        }}
        aria-hidden
      >
        <g
          transform="translate(0 90)"
          style={{ animation: "p3-rock 3s ease-in-out infinite", transformOrigin: "60px 20px" }}
        >
          {/* Mast + sail */}
          <line x1="60" y1="-60" x2="60" y2="18" stroke="#2a1b10" strokeWidth="3" />
          <path d="M 60 -58 L 60 10 L 108 -10 Z" fill="#F4F7FC" opacity="0.9" />
          <path d="M 60 -56 L 60 -6 L 32 -16 Z" fill="#F4F7FC" opacity="0.75" />
          {/* Hull */}
          <path
            d="M 10 20 L 110 20 L 100 42 L 20 42 Z"
            fill="#2a1b10"
          />
          <line x1="20" y1="28" x2="100" y2="28" stroke="#5a3a20" strokeWidth="1.5" />
        </g>
      </svg>
    </>
  );
}

// ─── Prototype 4 · Fish school ──────────────────────────────────────

function Fish({
  x,
  y,
  size,
  tint,
}: {
  x: number;
  y: number;
  size: number;
  tint: string;
}): React.JSX.Element {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <g style={{ animation: "p4-tail 0.6s ease-in-out infinite", transformOrigin: "0px 0px" }}>
        <path d="M 0 0 L -12 -6 L -12 6 Z" fill={tint} opacity="0.85" />
      </g>
      <ellipse cx="4" cy="0" rx="10" ry="4.5" fill={tint} />
      <circle cx="10" cy="-1" r="1.2" fill="#0A2535" />
      <path d="M 0 -3 L 2 -6 L 5 -3" fill={tint} opacity="0.9" />
    </g>
  );
}

function P4(): React.JSX.Element {
  const fish = [
    { x: 20, y: 240, s: 1.3, c: OCEAN.highlight },
    { x: 0, y: 220, s: 1.0, c: OCEAN.secondary },
    { x: 0, y: 260, s: 1.0, c: OCEAN.secondary },
    { x: -20, y: 200, s: 0.9, c: OCEAN.highlight },
    { x: -20, y: 280, s: 0.9, c: OCEAN.highlight },
    { x: -40, y: 230, s: 0.8, c: OCEAN.secondary },
    { x: -40, y: 250, s: 0.8, c: OCEAN.secondary },
  ];
  return (
    <svg
      viewBox="0 0 280 480"
      preserveAspectRatio="xMidYMid slice"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        animation: "p4-swim 8s linear infinite",
      }}
      aria-hidden
    >
      <g style={{ animation: "p4-waver 2.4s ease-in-out infinite" }}>
        {fish.map((f, i) => (
          <Fish key={i} x={f.x} y={f.y} size={f.s} tint={f.c} />
        ))}
      </g>
    </svg>
  );
}

// ─── Prototype 5 · Shark hits glass + crack ─────────────────────────

function P5(): React.JSX.Element {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        animation: "p5-shake 6s ease-in-out infinite",
      }}
    >
      {/* Shark */}
      <svg
        viewBox="0 0 280 480"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
        aria-hidden
      >
        <g
          transform="translate(140 240)"
          style={{ animation: "p5-shark-charge 6s ease-in-out infinite" }}
        >
          <path
            d="M -70 0 Q -40 -22 20 -10 Q 60 -4 80 0 Q 60 4 20 10 Q -40 22 -70 0 Z"
            fill="#1a2a35"
          />
          <path d="M -70 0 L -92 -14 L -86 0 L -92 12 Z" fill="#1a2a35" />
          <path d="M -24 -14 L -14 -34 L -4 -14 Z" fill="#1a2a35" />
          <circle cx="56" cy="-3" r="2" fill="#F4F7FC" />
          <path d="M 60 4 L 76 2 L 70 6 L 76 8 L 60 10" fill="#F4F7FC" opacity="0.75" />
          <path d="M -10 10 Q 0 20 10 10" stroke="#F4F7FC" strokeWidth="1" fill="none" opacity="0.3" />
        </g>
      </svg>
      {/* Crack overlay */}
      <svg
        viewBox="0 0 280 480"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          animation: "p5-crack 6s ease-in-out infinite",
          transformOrigin: "60px 240px",
        }}
        aria-hidden
      >
        <g stroke="#F4F7FC" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.95">
          <path d="M 60 240 L 100 220" />
          <path d="M 60 240 L 110 250" />
          <path d="M 60 240 L 90 270" />
          <path d="M 60 240 L 50 190" />
          <path d="M 60 240 L 30 230" />
          <path d="M 60 240 L 40 280" />
          <path d="M 100 220 L 150 215 L 175 230" />
          <path d="M 90 270 L 130 300 L 150 310" />
          <path d="M 50 190 L 55 160 L 70 140" />
          <path d="M 30 230 L 10 210" />
          <path d="M 110 250 L 160 255" />
          <path d="M 100 220 L 95 200" />
          <path d="M 150 215 L 160 190" />
        </g>
        <circle cx="60" cy="240" r="6" fill="#F4F7FC" />
      </svg>
    </div>
  );
}

// ─── Prototype 6 · Jellyfish ────────────────────────────────────────

function P6(): React.JSX.Element {
  const tentacles = Array.from({ length: 8 });
  return (
    <svg
      viewBox="0 0 280 480"
      preserveAspectRatio="xMidYMid slice"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        animation: "p6-rise 11s linear infinite",
      }}
      aria-hidden
    >
      <defs>
        <radialGradient id="p6-bell" cx="0.5" cy="0.4">
          <stop offset="0" stopColor="rgba(255,255,255,0.9)" />
          <stop offset="0.5" stopColor="rgba(130,210,255,0.6)" />
          <stop offset="1" stopColor="rgba(130,210,255,0.1)" />
        </radialGradient>
      </defs>
      <g transform="translate(140 320)">
        <g style={{ animation: "p6-pulse 2.4s ease-in-out infinite", transformOrigin: "0 10px" }}>
          <path
            d="M -36 0 Q -36 -36 0 -36 Q 36 -36 36 0 Q 32 8 24 2 Q 16 10 8 2 Q 0 10 -8 2 Q -16 10 -24 2 Q -32 8 -36 0 Z"
            fill="url(#p6-bell)"
          />
          <circle cx="-12" cy="-18" r="3" fill="#F4F7FC" opacity="0.9" />
        </g>
        <g style={{ animation: "p6-tent-wave 2.4s ease-in-out infinite", transformOrigin: "0 0" }}>
          {tentacles.map((_, i) => {
            const offset = (i - 3.5) * 8;
            return (
              <path
                key={i}
                d={`M ${offset} 2 Q ${offset + 3} ${20 + i * 3} ${offset - 3} ${40 + i * 2} Q ${offset + 5} ${64 + i * 2} ${offset - 2} 86`}
                stroke="rgba(130,210,255,0.75)"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
            );
          })}
        </g>
      </g>
    </svg>
  );
}

// ─── Prototype 7 · Whale ────────────────────────────────────────────

function P7(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 280 480"
      preserveAspectRatio="xMidYMid slice"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        animation: "p7-pass 14s linear infinite",
      }}
      aria-hidden
    >
      <g transform="translate(0 260)">
        {/* Body */}
        <path
          d="M 0 0 Q 20 -30 80 -32 Q 160 -32 190 -8 L 210 -14 L 200 2 L 212 16 L 190 14 Q 160 32 80 32 Q 20 30 0 0 Z"
          fill="#1a2a35"
        />
        <path
          d="M 10 2 Q 30 -22 80 -24 Q 120 -24 150 -10"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
        />
        {/* Belly */}
        <path
          d="M 20 6 Q 60 20 140 20 Q 170 20 190 10"
          fill="rgba(255,255,255,0.08)"
        />
        {/* Eye */}
        <circle cx="178" cy="-6" r="2" fill="#F4F7FC" />
        {/* Tail wag */}
        <g
          transform="translate(0 0)"
          style={{ animation: "p7-tail 2.4s ease-in-out infinite", transformOrigin: "0 0" }}
        >
          <path d="M 0 0 L -14 -10 L -22 2 L -14 14 Z" fill="#1a2a35" />
        </g>
        {/* Dorsal fin */}
        <path d="M 112 -30 L 128 -46 L 138 -30 Z" fill="#1a2a35" />
        {/* Spout */}
        <g
          transform="translate(140 -36)"
          style={{ animation: "p7-spout 4s ease-in-out infinite", transformOrigin: "0 10px" }}
        >
          <ellipse cx="0" cy="-6" rx="6" ry="12" fill="rgba(232,247,255,0.75)" />
          <ellipse cx="-6" cy="-2" rx="3" ry="7" fill="rgba(232,247,255,0.55)" />
          <ellipse cx="6" cy="-2" rx="3" ry="7" fill="rgba(232,247,255,0.55)" />
        </g>
      </g>
    </svg>
  );
}

// ─── Prototype 8 · Octopus ──────────────────────────────────────────

function P8(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 280 480"
      preserveAspectRatio="xMidYMid slice"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
      }}
      aria-hidden
    >
      <g transform="translate(140 300)" style={{ animation: "p8-head-bob 3s ease-in-out infinite" }}>
        {/* Head */}
        <defs>
          <radialGradient id="p8-head" cx="0.5" cy="0.4">
            <stop offset="0" stopColor="#C94F7A" />
            <stop offset="1" stopColor="#5A1A33" />
          </radialGradient>
        </defs>
        <ellipse cx="0" cy="0" rx="40" ry="38" fill="url(#p8-head)" />
        <circle cx="-10" cy="-6" r="4" fill="#F4F7FC" />
        <circle cx="10" cy="-6" r="4" fill="#F4F7FC" />
        <circle cx="-10" cy="-6" r="2" fill="#0A2535" />
        <circle cx="10" cy="-6" r="2" fill="#0A2535" />
        <path d="M -8 10 Q 0 16 8 10" stroke="#5A1A33" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* Suckers scattered */}
        <circle cx="-18" cy="12" r="2" fill="#F4F7FC" opacity="0.5" />
        <circle cx="18" cy="12" r="2" fill="#F4F7FC" opacity="0.5" />
        {/* 8 tentacles */}
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i / 8) * Math.PI * 2;
          const x = Math.cos(angle) * 30;
          const kf = ["p8-t-a", "p8-t-b", "p8-t-c"][i % 3];
          return (
            <g
              key={i}
              transform={`translate(${x} ${28 + Math.sin(angle) * 6}) rotate(${(angle * 180) / Math.PI})`}
            >
              <path
                d="M 0 0 Q 6 10 2 22 Q -4 34 0 46"
                stroke="#8B2E55"
                strokeWidth="5"
                fill="none"
                strokeLinecap="round"
                style={{
                  animation: `${kf} ${1.8 + (i % 3) * 0.5}s ease-in-out infinite`,
                }}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// ─── Prototype 9 · Light rays + caustics ────────────────────────────

function P9(): React.JSX.Element {
  const rays = [10, 25, 45, 60, 78];
  const causticsA = [
    { l: "20%", t: "70%", r: 36 },
    { l: "60%", t: "76%", r: 44 },
    { l: "40%", t: "88%", r: 30 },
  ];
  const causticsB = [
    { l: "35%", t: "72%", r: 32 },
    { l: "72%", t: "84%", r: 38 },
    { l: "15%", t: "82%", r: 26 },
  ];
  return (
    <>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }} aria-hidden>
        {rays.map((pct, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${pct}%`,
              top: "-20%",
              width: 14,
              height: "140%",
              background: `linear-gradient(180deg, rgba(255,255,255,0.4), rgba(255,255,255,0.08) 60%, transparent)`,
              transform: "skewX(-6deg)",
              transformOrigin: "top center",
              animation: `p9-ray ${4 + i * 0.4}s ease-in-out infinite`,
              mixBlendMode: "screen",
              filter: "blur(3px)",
            }}
          />
        ))}
      </div>
      <div style={{ position: "absolute", inset: 0 }} aria-hidden>
        {causticsA.map((c, i) => (
          <div
            key={`a${i}`}
            style={{
              position: "absolute",
              left: c.l,
              top: c.t,
              width: c.r,
              height: c.r,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${OCEAN.highlight}aa, ${OCEAN.highlight}00 70%)`,
              filter: "blur(2px)",
              mixBlendMode: "screen",
              animation: `p9-caustic-a ${3 + i * 0.4}s ease-in-out infinite`,
            }}
          />
        ))}
        {causticsB.map((c, i) => (
          <div
            key={`b${i}`}
            style={{
              position: "absolute",
              left: c.l,
              top: c.t,
              width: c.r,
              height: c.r,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${OCEAN.highlight}aa, ${OCEAN.highlight}00 70%)`,
              filter: "blur(2px)",
              mixBlendMode: "screen",
              animation: `p9-caustic-b ${3.5 + i * 0.4}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>
    </>
  );
}

// ─── Prototype 10 · Treasure chest glowing ──────────────────────────

function P10(): React.JSX.Element {
  const sparkles = [
    { l: "40%", t: "70%", delay: 0 },
    { l: "48%", t: "66%", delay: 0.8 },
    { l: "56%", t: "74%", delay: 1.4 },
    { l: "44%", t: "80%", delay: 2.1 },
    { l: "52%", t: "72%", delay: 2.8 },
  ];
  return (
    <>
      <svg
        viewBox="0 0 280 480"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        aria-hidden
      >
        <defs>
          <linearGradient id="p10-wood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6b3a1a" />
            <stop offset="1" stopColor="#2a1808" />
          </linearGradient>
          <radialGradient id="p10-gold" cx="0.5" cy="0.4">
            <stop offset="0" stopColor="#FFF4B4" />
            <stop offset="0.5" stopColor="#F4C64A" />
            <stop offset="1" stopColor="#8a5a10" />
          </radialGradient>
        </defs>
        {/* Glow halo under lid */}
        <ellipse
          cx="140"
          cy="330"
          rx="80"
          ry="30"
          fill="url(#p10-gold)"
          opacity="0.6"
          style={{ animation: "p10-glow 2.5s ease-in-out infinite" }}
        />
        {/* Chest body */}
        <rect x="76" y="340" width="128" height="80" rx="4" fill="url(#p10-wood)" />
        {/* Chest lid (open, tilted back) */}
        <g transform="translate(140 334) rotate(-26)" transform-origin="0 0">
          <rect x="-64" y="-30" width="128" height="40" rx="20" fill="url(#p10-wood)" />
          <rect x="-20" y="-12" width="40" height="8" rx="2" fill="#1a0d04" />
        </g>
        {/* Gold interior */}
        <ellipse cx="140" cy="344" rx="54" ry="12" fill="url(#p10-gold)" />
        {/* Coin stack hints */}
        <circle cx="118" cy="348" r="7" fill="url(#p10-gold)" />
        <circle cx="140" cy="352" r="8" fill="url(#p10-gold)" />
        <circle cx="162" cy="348" r="7" fill="url(#p10-gold)" />
        {/* Iron bands */}
        <rect x="76" y="366" width="128" height="4" fill="#1a0d04" />
        <rect x="76" y="400" width="128" height="4" fill="#1a0d04" />
        {/* Lock */}
        <rect x="130" y="378" width="20" height="16" rx="2" fill="#5a3a20" />
        <circle cx="140" cy="384" r="2" fill="#F4C64A" />
      </svg>
      {/* Sparkles */}
      <div aria-hidden style={{ position: "absolute", inset: 0 }}>
        {sparkles.map((s, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              left: s.l,
              top: s.t,
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: `radial-gradient(circle, #FFF4B4, transparent 70%)`,
              filter: "blur(1px)",
              animation: `p10-sparkle 2.4s ease-out ${s.delay}s infinite`,
            }}
          />
        ))}
      </div>
    </>
  );
}

// ─── Grid ───────────────────────────────────────────────────────────

export function OceanAnimationPrototypes(): React.JSX.Element {
  return (
    <>
      <style>{KF}</style>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 24,
        }}
      >
        <PrototypeTile
          num={1}
          name="Chain + Anchor"
          description="Chain hangs from the surface, anchor swings gently at the end. Universal reuse: pirate, salvage, cargo, nautical history worlds."
        >
          <P1 />
        </PrototypeTile>
        <PrototypeTile
          num={2}
          name="Scuba Diver"
          description="Diver descends into frame with slow fin kick and rising bubble trail. Reusable as a human-figure ambient family · snowboarder, climber, parachute variants."
        >
          <P2 />
        </PrototypeTile>
        <PrototypeTile
          num={3}
          name="Boat on Surface"
          description="Silhouette sails across the top edge with a wake trail. Reusable surface-vehicle motion · also fits trucks on highways, trains across hills."
        >
          <P3 />
        </PrototypeTile>
        <PrototypeTile
          num={4}
          name="Fish School"
          description="V-formation drift across the stage with synchronised tail flicks. Reusable formation-flock pattern · birds, bats, drones, krill, meteor-swarms."
        >
          <P4 />
        </PrototypeTile>
        <PrototypeTile
          num={5}
          name="Shark Hits Glass + Crack"
          description="Shark charges from the right, impacts the centre, screen cracks spider across then fades, shark retreats. Signature premium reaction · one of the strongest moments in the set."
        >
          <P5 />
        </PrototypeTile>
        <PrototypeTile
          num={6}
          name="Jellyfish Rising"
          description="Translucent bell pulses and drifts upward with trailing tentacles. Reusable soft-floater · reusable for sky-lanterns, fireflies, snow-sprites."
        >
          <P6 />
        </PrototypeTile>
        <PrototypeTile
          num={7}
          name="Whale Passing"
          description="Large whale silhouette crosses horizontally with tail wag and blowhole spout. Signature cinematic creature-pass · reusable for dragons, zeppelins, trains."
        >
          <P7 />
        </PrototypeTile>
        <PrototypeTile
          num={8}
          name="Octopus with Tentacles"
          description="Resting octopus with eight independently-animated tentacles. Hardest to reuse elsewhere · very ocean-specific but visually distinctive."
        >
          <P8 />
        </PrototypeTile>
        <PrototypeTile
          num={9}
          name="Light Rays + Caustics"
          description="Volumetric god-rays from above + dancing caustic patches on the seabed. Already partially in the engine · this is the richer production-grade version."
        >
          <P9 />
        </PrototypeTile>
        <PrototypeTile
          num={10}
          name="Treasure Chest Glowing"
          description="Chest at the bottom with pulsing gold interior and occasional sparkles. Reusable as a 'reward object' pattern · reusable for cakes, trophies, awards."
        >
          <P10 />
        </PrototypeTile>
      </div>
    </>
  );
}
