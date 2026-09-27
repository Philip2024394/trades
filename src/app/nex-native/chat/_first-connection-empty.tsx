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
  color: string;
  size: number; // px
  duration: number; // ms
  delay: number; // ms
  rotation: number; // deg initial
  rotationEnd: number; // deg end
  shape: "square" | "circle" | "strip";
  /** Peak offset from origin · this is where the piece reaches at
   *  the top of its arc before gravity pulls it back down. */
  peakX: number; // px, positive right / negative left
  peakY: number; // px, always negative (upward)
  /** Final landing offset from origin · where it drifts to after
   *  gravity takes over. */
  fallX: number; // px
  fallY: number; // px, always positive (downward, off-screen)
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
    // Angle in the upper hemisphere · 180°..360° in trig terms
    // (roughly -30° to -150° from horizontal · a wedge shooting
    // upward and outward like a real popper).
    const angle = rand(Math.PI * 1.05, Math.PI * 1.95);
    const power = rand(60, 200); // outward reach at peak
    const peakX = Math.cos(angle) * power;
    const peakY = Math.sin(angle) * power; // negative because upper half
    // Gravity carries them past the peak · horizontal drift decays
    // (air resistance), vertical accelerates down.
    const fallX = peakX * rand(1.05, 1.4);
    const fallY = rand(220, 380); // drops well past the empty-state block
    pieces.push({
      id: `c-${i}-${Math.random().toString(36).slice(2, 6)}`,
      color: pick(CONFETTI_COLORS),
      size: rand(6, 12),
      duration: rand(1800, 3200),
      // Small stagger so the burst reads as an explosion rather
      // than a metronome · most pieces launch within 260 ms.
      delay: rand(0, 260),
      rotation: rand(0, 360),
      rotationEnd: rand(-540, 540),
      shape: pick(["square", "circle", "strip"] as const),
      peakX,
      peakY,
      fallX,
      fallY,
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
        /* Party-popper burst · pieces launch outward from the icon
           center, reach a peak, then gravity pulls them past it
           into a downward fall. Each piece carries its own peak +
           fall coordinates via CSS custom properties so 36 pieces
           share one keyframe rule. */
        @keyframes nex-confetti-burst {
          0%   { transform: translate(0, 0) rotate(var(--r-start));
                 opacity: 0; }
          10%  { opacity: 1; }
          38%  { transform: translate(var(--px), var(--py))
                            rotate(calc(var(--r-start) + var(--r-mid)));
                 opacity: 1; }
          100% { transform: translate(var(--fx), var(--fy))
                            rotate(var(--r-end));
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

      {/* Confetti layer · pieces originate at the icon center
          (~48px from top of the card, horizontally centered) and
          burst outward. Overflow visible so pieces can travel
          beyond the card bounds during the arc. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          overflow: "visible",
        }}
      >
        {pieces.map((p) => {
          const style: React.CSSProperties & { [key: string]: string } = {
            position: "absolute",
            top: 68, // matches the icon's vertical center inside the card
            left: "50%",
            marginLeft: -(p.size / 2),
            width: p.shape === "strip" ? p.size * 0.35 : p.size,
            height: p.shape === "strip" ? p.size * 1.4 : p.size,
            background: p.color,
            borderRadius: p.shape === "circle" ? "50%" : 2,
            animationName: "nex-confetti-burst",
            animationDuration: `${p.duration}ms`,
            // Ease-out on the arc · slows near the peak, then
            // accelerates into the fall via the keyframe curve.
            animationTimingFunction: "cubic-bezier(0.25, 0.6, 0.4, 1)",
            animationFillMode: "forwards",
            animationDelay: `${p.delay}ms`,
            boxShadow: `0 0 6px ${p.color}88`,
            "--r-start": `${p.rotation}deg`,
            "--r-mid": `${(p.rotationEnd - p.rotation) * 0.5}deg`,
            "--r-end": `${p.rotationEnd}deg`,
            "--px": `${p.peakX}px`,
            "--py": `${p.peakY}px`,
            "--fx": `${p.fallX}px`,
            "--fy": `${p.fallY}px`,
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
