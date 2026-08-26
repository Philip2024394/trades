// NEX Grenade Animation · signature Tier-4 consumable cinematic (F3 · 2026-08-25).
//
// Fires AFTER the server confirms the deletion. Never runs speculatively.
// See docs/nex-actions/grenade-animation-spec.md for the choreography spec.
//
// The animation is a purely visual layer over the deleted bubble's location.
// It never touches state · never calls APIs · never decides ownership. The
// parent (NexAppHome) passes the bounding rect of the target bubble and the
// history line text; this component plays the 4-second sequence and calls
// `onComplete` when the smoke dissipates. Parent then removes the bubble
// from state and inserts the persistent history-line row.

"use client";

import { useEffect, useMemo, useRef } from "react";
import { NEX } from "@/lib/nexapp/tokens";

export type GrenadeRect = { top: number; left: number; width: number; height: number };

const FRAG_COLORS = ["#F97316", "#F5F5F5", "#facc15", "#ef4444"];

export function NexGrenadeAnimation({
  rect,
  mascotUrl,
  onComplete,
  reducedMotion = false,
}: {
  rect: GrenadeRect;
  mascotUrl: string;
  onComplete: () => void;
  reducedMotion?: boolean;
}) {
  const doneRef = useRef(false);

  // Pre-compute fragment geometry once so the animation is deterministic
  // per event · 8 shards emitted from bubble center.
  const fragments = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const dist = 60 + Math.random() * 30;
        return {
          tx: Math.cos(angle) * dist,
          ty: Math.sin(angle) * dist,
          rot: (Math.random() - 0.5) * 360,
          color: FRAG_COLORS[i % FRAG_COLORS.length],
          delay: Math.random() * 60,
        };
      }),
    [],
  );

  // Smoke puffs (6) rising from the burst location.
  const smoke = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        left: 10 + Math.random() * 80,
        delay: i * 60,
        drift: (Math.random() - 0.5) * 40,
      })),
    [],
  );

  useEffect(() => {
    const total = reducedMotion ? 400 : 4000;
    const t = window.setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      onComplete();
    }, total);
    return () => window.clearTimeout(t);
  }, [onComplete, reducedMotion]);

  const bubbleCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

  if (reducedMotion) {
    // Reduced-motion path · fade the bubble area out, no explosion.
    return (
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          background: "#000",
          borderRadius: 16,
          pointerEvents: "none",
          zIndex: 100,
          animation: "nex-grenade-rm-fade 400ms ease-out forwards",
        }}
      >
        <style>{`
          @keyframes nex-grenade-rm-fade { to { opacity: 0; } }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <style>{grenadeCss}</style>

      {/* Frame 1-2 · grenade entry + landing + bubble shake */}
      <div
        aria-hidden
        className="nex-grenade-target"
        style={{
          position: "fixed",
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          pointerEvents: "none",
          zIndex: 100,
          transformOrigin: "center center",
        }}
      >
        {/* Bubble ghost · matches the actual bubble visually · we animate this,
            not the real bubble, so React state doesn't need to fight the
            animation. The parent hides the real bubble as soon as this mounts. */}
        <div className="nex-grenade-bubble-ghost" />
        {/* Grenade mascot lands here · then fuse burns · then explosion */}
        <img
          src={mascotUrl}
          alt=""
          draggable={false}
          className="nex-grenade-mascot"
        />
        {/* Fuse sparks · Frame 3 */}
        <div className="nex-grenade-fuse" aria-hidden>
          {Array.from({ length: 12 }, (_, i) => (
            <span
              key={i}
              className="nex-grenade-spark"
              style={{
                left: `${45 + Math.random() * 10}%`,
                animationDelay: `${900 + i * 100}ms`,
              }}
            />
          ))}
        </div>
        {/* Fragments · Frame 4 */}
        {fragments.map((f, i) => (
          <span
            key={i}
            className="nex-grenade-fragment"
            style={{
              left: rect.width / 2,
              top: rect.height / 2,
              background: f.color,
              boxShadow: `0 0 4px ${f.color}`,
              ["--tx" as string]: `${f.tx}px`,
              ["--ty" as string]: `${f.ty}px`,
              ["--rot" as string]: `${f.rot}deg`,
              animationDelay: `${2400 + f.delay}ms`,
            }}
          />
        ))}
      </div>

      {/* Frame 4 · flash */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: bubbleCenter.y - 80,
          left: bubbleCenter.x - 80,
          width: 160,
          height: 160,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,240,200,0.6) 0%, rgba(249,115,22,0.35) 50%, transparent 100%)",
          pointerEvents: "none",
          zIndex: 99,
          opacity: 0,
          animation: "nex-grenade-flash 250ms ease-out 2400ms forwards",
        }}
      />

      {/* Frame 5 · smoke drift */}
      <div aria-hidden style={{ position: "fixed", top: bubbleCenter.y - 20, left: bubbleCenter.x - 60, width: 120, pointerEvents: "none", zIndex: 98 }}>
        {smoke.map((s, i) => (
          <span
            key={i}
            className="nex-grenade-smoke"
            style={{
              left: `${s.left}%`,
              ["--drift" as string]: `${s.drift}px`,
              animationDelay: `${2800 + s.delay}ms`,
            }}
          />
        ))}
      </div>
    </>
  );
}

const grenadeCss = `
  /* Bubble ghost · match the real bubble treatment */
  .nex-grenade-bubble-ghost {
    position: absolute; inset: 0;
    background: #000; border: 1px solid rgba(255,255,255,0.10);
    border-radius: 16px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.55);
    animation:
      nex-grenade-bubble-shake 400ms ease-in-out 500ms 2,
      nex-grenade-bubble-swell  200ms ease-in    2400ms forwards,
      nex-grenade-bubble-burst  100ms ease-out    2600ms forwards;
  }
  @keyframes nex-grenade-bubble-shake {
    0%,100% { transform: translateX(0) scale(1); }
    25%     { transform: translateX(-3px) scale(1.02, 0.98); }
    75%     { transform: translateX(3px)  scale(0.98, 1.02); }
  }
  @keyframes nex-grenade-bubble-swell {
    0%   { transform: scale(1); }
    100% { transform: scale(1.15); filter: brightness(1.6); }
  }
  @keyframes nex-grenade-bubble-burst {
    0%   { transform: scale(1.15); opacity: 1; filter: brightness(1.6); }
    100% { transform: scale(1.35); opacity: 0; filter: brightness(2.4); }
  }

  /* Grenade mascot · enters top-right · lands on bubble · disappears at burst */
  .nex-grenade-mascot {
    position: absolute; width: 42%; max-width: 60px; aspect-ratio: 1/1; object-fit: contain;
    top: -10%; left: 100%;
    filter: drop-shadow(0 4px 10px rgba(0,0,0,0.6));
    animation:
      nex-grenade-enter    500ms cubic-bezier(0.4, 0, 0.2, 1) forwards,
      nex-grenade-fadeout  200ms ease-out 2400ms forwards;
  }
  @keyframes nex-grenade-enter {
    0%   { transform: translate(60px, -60px) rotate(45deg) scale(0.6); opacity: 0; }
    75%  { transform: translate(-20%, 20%) rotate(-10deg) scale(1.1); opacity: 1; }
    100% { transform: translate(-70%, 30%) rotate(-5deg) scale(1); opacity: 1; }
  }
  @keyframes nex-grenade-fadeout {
    to { opacity: 0; transform: translate(-70%, 30%) scale(1.4); }
  }

  /* Fuse sparks · Frame 3 · rising warm particles */
  .nex-grenade-fuse { position: absolute; inset: 0; pointer-events: none; }
  .nex-grenade-spark {
    position: absolute; top: 20%; width: 3px; height: 3px; border-radius: 50%;
    background: #ffb27a; box-shadow: 0 0 4px #F97316;
    opacity: 0;
    animation: nex-grenade-spark 600ms ease-out forwards;
  }
  @keyframes nex-grenade-spark {
    0%   { opacity: 0; transform: translateY(0) scale(1); }
    30%  { opacity: 1; }
    100% { opacity: 0; transform: translateY(-30px) translateX(calc(var(--sx, 0) * 1px)) scale(0.4); }
  }

  /* Explosion flash */
  @keyframes nex-grenade-flash {
    0%   { opacity: 0; transform: scale(0.6); }
    40%  { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(1.4); }
  }

  /* Fragments · fly outward + rotate + fade */
  .nex-grenade-fragment {
    position: absolute; width: 6px; height: 10px;
    transform-origin: center;
    opacity: 0;
    animation: nex-grenade-fragment 800ms ease-out forwards;
  }
  @keyframes nex-grenade-fragment {
    0%   { opacity: 0; transform: translate(0,0) rotate(0); }
    20%  { opacity: 1; }
    100% { opacity: 0; transform: translate(var(--tx), var(--ty)) rotate(var(--rot)); }
  }

  /* Smoke puffs · rise and drift */
  .nex-grenade-smoke {
    position: absolute; bottom: 0; width: 30px; height: 30px; border-radius: 50%;
    background: radial-gradient(circle, rgba(200,200,200,0.55) 0%, rgba(150,150,150,0) 70%);
    opacity: 0;
    animation: nex-grenade-smoke 1200ms ease-out forwards;
  }
  @keyframes nex-grenade-smoke {
    0%   { opacity: 0; transform: translate(0, 0) scale(0.4); }
    30%  { opacity: 0.9; }
    100% { opacity: 0; transform: translate(var(--drift), -70px) scale(1.6); }
  }

  @media (prefers-reduced-motion: reduce) {
    .nex-grenade-mascot,
    .nex-grenade-bubble-ghost,
    .nex-grenade-spark,
    .nex-grenade-fragment,
    .nex-grenade-smoke { animation: none !important; }
  }
`;
