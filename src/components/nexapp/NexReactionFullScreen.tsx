// NEX full-screen reaction effect · fires ONCE when a milestone-flavour
// emoji is posted (celebration · birthday · anniversary). Auto-unmounts after
// its animation duration. Never gated to any bubble · covers the whole
// viewport for a beat and then dissolves.
//
// The parent (NexAppHome) mounts a fresh instance per event by keying it on a
// unique `eventId` (timestamp+random). Duration is set per effect; parent
// clears state after the same duration to unmount cleanly.

"use client";

import { useMemo } from "react";
import type { NexFullScreenEffect } from "@/lib/nexapp/nexEmojis";

const CONFETTI_COLORS = ["#F97316", "#F5F5F5", "#22D3EE", "#A855F7", "#facc15", "#ef4444"];
const HEART_COLOR = "#ff2d55";

export const FULL_SCREEN_DURATION_MS: Record<NexFullScreenEffect, number> = {
  confetti: 2600,
  fireworks: 2200,
  hearts: 3400,
};

export function NexReactionFullScreen({ effect }: { effect: NexFullScreenEffect }) {
  // Particle geometry pre-computed once per mount · no re-render churn.
  const confetti = useMemo(() =>
    effect === "confetti"
      ? Array.from({ length: 60 }, (_, i) => ({
          left: Math.random() * 100,
          delay: Math.random() * 0.6,
          rotate: Math.random() * 360,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        }))
      : [],
    [effect],
  );
  const fireworks = useMemo(() =>
    effect === "fireworks"
      ? Array.from({ length: 3 }, (_, burstIdx) => {
          const cx = 20 + Math.random() * 60;
          const cy = 20 + Math.random() * 40;
          const color = CONFETTI_COLORS[burstIdx % CONFETTI_COLORS.length];
          return {
            delay: burstIdx * 0.25,
            dots: Array.from({ length: 20 }, (_, p) => {
              const angle = (p / 20) * Math.PI * 2;
              const dist = 100 + Math.random() * 60;
              return {
                left: cx,
                top: cy,
                color,
                tx: Math.cos(angle) * dist,
                ty: Math.sin(angle) * dist,
              };
            }),
          };
        })
      : [],
    [effect],
  );
  const hearts = useMemo(() =>
    effect === "hearts"
      ? Array.from({ length: 20 }, () => ({
          left: Math.random() * 100,
          size: 20 + Math.random() * 22,
          delay: Math.random() * 1.2,
          duration: 2.4 + Math.random() * 1.4,
        }))
      : [],
    [effect],
  );

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9999,
        overflow: "hidden",
      }}
    >
      {effect === "confetti" && confetti.map((c, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: -40,
            left: `${c.left}%`,
            width: 8,
            height: 14,
            background: c.color,
            transform: `rotate(${c.rotate}deg)`,
            animation: `nex-fs-confetti 2.4s ease-in ${c.delay}s forwards`,
          }}
        />
      ))}
      {effect === "fireworks" && fireworks.map((burst, bi) => (
        <div key={bi} style={{ position: "absolute", inset: 0, animationDelay: `${burst.delay}s` }}>
          {burst.dots.map((d, di) => (
            <span
              key={di}
              style={{
                position: "absolute",
                left: `${d.left}vw`,
                top: `${d.top}vh`,
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: d.color,
                boxShadow: `0 0 8px ${d.color}`,
                ["--tx" as string]: `${d.tx}px`,
                ["--ty" as string]: `${d.ty}px`,
                animation: `nex-fs-fw 1.2s ease-out ${burst.delay}s forwards`,
              }}
            />
          ))}
        </div>
      ))}
      {effect === "hearts" && hearts.map((h, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            bottom: -40,
            left: `${h.left}%`,
            fontSize: h.size,
            color: HEART_COLOR,
            textShadow: `0 0 12px rgba(255,45,85,0.55)`,
            animation: `nex-fs-heart ${h.duration}s ease-in ${h.delay}s forwards`,
          }}
        >
          ♥
        </span>
      ))}
    </div>
  );
}
