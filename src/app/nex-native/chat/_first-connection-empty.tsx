"use client";

// src/app/nex-native/chat/_first-connection-empty.tsx
//
// First-connection empty state · sealed 2026-09-27.
// -------------------------------------------------
// Rendered inside the message scroll region when a peer conversation
// has zero messages. Replaces the old flat "Say hi to X" line with a
// celebratory moment:
//
//   · Confetti falling down the screen (36 pieces · staggered) ·
//     runs once for ~5s then stops · client-only via a mount effect
//   · Centered 🎉 celebration icon with a soft bounce entry
//   · Peer name headline + call-to-action copy · "Drop a hi and get
//     the conversation moving"
//
// The confetti overlay is `position: absolute; inset: 0` inside a
// relatively-positioned parent so it fills the empty-state card,
// not the whole viewport. Pointer-events: none so it never blocks
// the composer sitting below.

import * as React from "react";

interface ConfettiPiece {
  id: string;
  x: number; // % across the container
  color: string;
  size: number; // px
  duration: number; // ms
  delay: number; // ms
  rotation: number; // deg initial
  rotationEnd: number; // deg end
  shape: "square" | "circle" | "strip";
}

// NEX palette confetti · cyan / orange / white / warm pinks and greens.
const CONFETTI_COLORS = [
  "#00AFFF", // cyan
  "#FF7800", // orange
  "#F4F7FC", // white
  "#EC4899", // pink
  "#16D66B", // green
  "#F59E0B", // amber
  "#7EB6FF", // soft blue
];

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function makeConfettiBurst(count: number): ConfettiPiece[] {
  const pieces: ConfettiPiece[] = [];
  for (let i = 0; i < count; i++) {
    pieces.push({
      id: `c-${i}-${Math.random().toString(36).slice(2, 6)}`,
      x: rand(0, 100),
      color: pick(CONFETTI_COLORS),
      size: rand(6, 12),
      duration: rand(2600, 4400),
      delay: rand(0, 1800),
      rotation: rand(0, 360),
      rotationEnd: rand(-720, 720),
      shape: pick(["square", "circle", "strip"] as const),
    });
  }
  return pieces;
}

export function FirstConnectionEmpty({
  peerName,
  themeAccent,
}: {
  peerName: string;
  themeAccent?: string;
}) {
  const [pieces, setPieces] = React.useState<ConfettiPiece[]>([]);

  React.useEffect(() => {
    // Respect reduced motion · celebrations included.
    if (typeof window !== "undefined") {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    }
    setPieces(makeConfettiBurst(36));
    // Cleanup after the longest piece finishes falling · keeps
    // the DOM clean for anyone who leaves the empty state open.
    const t = setTimeout(() => setPieces([]), 6500);
    return () => clearTimeout(t);
  }, []);

  const accent = themeAccent ?? "#00AFFF";

  return (
    <div
      style={{
        position: "relative",
        alignSelf: "center",
        width: "100%",
        maxWidth: 320,
        padding: "48px 16px 32px",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes nex-confetti-fall {
          0%   { transform: translateY(-40px) rotate(var(--r-start));
                 opacity: 0; }
          8%   { opacity: 1; }
          100% { transform: translateY(min(80vh, 480px)) rotate(var(--r-end));
                 opacity: 0; }
        }
        @keyframes nex-celebration-in {
          0%   { transform: scale(0.4); opacity: 0; }
          55%  { transform: scale(1.14); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes nex-celebration-float {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-4px); }
        }
        @keyframes nex-cta-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Confetti layer · absolute over the empty-state block only */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        {pieces.map((p) => {
          const style: React.CSSProperties & { [key: string]: string } = {
            position: "absolute",
            top: 0,
            left: `${p.x}%`,
            width: p.shape === "strip" ? p.size * 0.35 : p.size,
            height: p.shape === "strip" ? p.size * 1.4 : p.size,
            background: p.color,
            borderRadius: p.shape === "circle" ? "50%" : 2,
            animationName: "nex-confetti-fall",
            animationDuration: `${p.duration}ms`,
            animationTimingFunction: "cubic-bezier(0.3, 0.7, 0.3, 1)",
            animationFillMode: "forwards",
            animationDelay: `${p.delay}ms`,
            boxShadow: `0 0 6px ${p.color}88`,
            "--r-start": `${p.rotation}deg`,
            "--r-end": `${p.rotationEnd}deg`,
          };
          return <div key={p.id} style={style} />;
        })}
      </div>

      {/* Celebration icon · soft bounce entry, gentle float loop */}
      <div
        style={{
          position: "relative",
          display: "flex",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 68,
            lineHeight: 1,
            animation:
              "nex-celebration-in 620ms cubic-bezier(.34,1.56,.64,1) both, nex-celebration-float 3.2s ease-in-out 620ms infinite",
            filter: `drop-shadow(0 0 22px ${accent}55) drop-shadow(0 4px 12px rgba(0,0,0,0.5))`,
          }}
          aria-hidden
        >
          🎉
        </div>
      </div>

      {/* Peer headline */}
      <div
        style={{
          position: "relative",
          textAlign: "center",
          color: "#F4F7FC",
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "-0.005em",
          marginBottom: 6,
          animation: "nex-cta-fade-in 480ms ease-out 260ms both",
        }}
      >
        You just connected with {peerName}
      </div>

      {/* Call to action */}
      <div
        style={{
          position: "relative",
          textAlign: "center",
          color: "#8BA9D1",
          fontSize: 13,
          lineHeight: 1.5,
          maxWidth: 260,
          margin: "0 auto",
          animation: "nex-cta-fade-in 480ms ease-out 420ms both",
        }}
      >
        Drop a{" "}
        <span
          style={{
            color: accent,
            fontWeight: 700,
            letterSpacing: "0.02em",
          }}
        >
          hi
        </span>{" "}
        and get the conversation moving
      </div>
    </div>
  );
}
