"use client";

// src/app/nex-native/chat/_ambient-motion.tsx
//
// Ambient theme motion · sealed 2026-09-27.
// -----------------------------------------
// Cinematic motion layer painted over the theme wallpaper:
//   · crows flying across the screen every 1.5–5 min · flocks of
//     1–4, weighted toward 1 · random direction + arc + size
//   · small twinkling stars fade in / out at random positions
//
// Sits under the message bubbles (z-index 1, wallpaper is 0), over
// the wallpaper scrim. Pointer-events: none · never blocks
// scrolling, tapping bubbles, or the composer.
//
// Motion research applied:
//   · crow wing beat ~2.5–3 Hz → 320–440ms per cycle
//   · 3-frame cel animation (wings-up / wings-mid / wings-down)
//     for a real "motion picture" read rather than continuous
//     rotation — the human eye reads clean silhouette swaps as
//     more bird-like than tweened rotation
//   · flight path has 4 bezier waypoints (side-to-side + soft arc)
//     so crows drift as they cross, never a straight line
//   · slight banking (±2° rotate) at path corners for realism
//   · body bob synced to wing beat (2px vertical wobble)
//   · far wing rendered at 0.75 opacity so the silhouette reads
//     as "3/4 view" rather than a flat cross
//
// Accessibility · respects prefers-reduced-motion by rendering
// nothing. Also pauses when the tab is hidden (visibilityState).
//
// Only rendered when the shell has a wallpaperUrl · unthemed chats
// stay quiet (per Founder direction "we are only working per theme").

import * as React from "react";

const CROW_INTERVAL_MIN_MS = 90_000; // 1.5 min
const CROW_INTERVAL_MAX_MS = 300_000; // 5 min
const CROW_FIRST_DELAY_MIN_MS = 30_000; // first flock 30 s after mount
const CROW_FIRST_DELAY_MAX_MS = 90_000;
const TWINKLE_INTERVAL_MIN_MS = 1_800;
const TWINKLE_INTERVAL_MAX_MS = 4_200;

interface Crow {
  id: string;
  direction: "ltr" | "rtl";
  startY: number; // % of surface (0–70 · never lower to avoid composer overlap)
  size: number; // px width of svg
  duration: number; // ms across screen
  delay: number; // ms after flock spawn
  arc: "low" | "high" | "flat"; // path variation baked into keyframes
  flapMs: number; // wing-beat cycle
}

interface Twinkle {
  id: string;
  x: number; // %
  y: number; // %
  size: number; // px
  duration: number; // ms
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/** Weighted flock size · matches how real crows travel in ambient
 *  observation · 60% solo · 25% pair · 12% trio · 3% quartet. */
function pickFlockSize(): number {
  const r = Math.random();
  if (r < 0.6) return 1;
  if (r < 0.85) return 2;
  if (r < 0.97) return 3;
  return 4;
}

export function AmbientMotion() {
  const [crows, setCrows] = React.useState<Crow[]>([]);
  const [twinkles, setTwinkles] = React.useState<Twinkle[]>([]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaReduce.matches) return;

    let alive = true;
    let flockTimeout: ReturnType<typeof setTimeout> | null = null;
    let twinkleTimeout: ReturnType<typeof setTimeout> | null = null;

    const spawnFlock = () => {
      if (!alive) return;
      // Skip while tab is hidden · save battery + so users don't
      // miss the whole crossing on background tabs.
      if (document.visibilityState !== "visible") return;
      const count = pickFlockSize();
      const dir: "ltr" | "rtl" = Math.random() > 0.5 ? "ltr" : "rtl";
      const baseY = rand(8, 55); // upper half of the surface
      const now = Date.now();
      const flock: Crow[] = [];
      for (let i = 0; i < count; i++) {
        flock.push({
          id: `c-${now}-${i}-${Math.random().toString(36).slice(2, 7)}`,
          direction: dir,
          startY: baseY + rand(-3, 3), // stagger vertical
          size: rand(34, 62),
          duration: rand(6_000, 9_500),
          delay: i === 0 ? 0 : i * rand(260, 620),
          arc: (["low", "high", "flat"] as const)[randInt(0, 2)],
          flapMs: rand(320, 440),
        });
      }
      setCrows((prev) => [...prev, ...flock]);
      const maxLife =
        Math.max(...flock.map((c) => c.duration + c.delay)) + 400;
      setTimeout(() => {
        if (!alive) return;
        setCrows((prev) => prev.filter((p) => !flock.some((n) => n.id === p.id)));
      }, maxLife);
    };

    const scheduleNextFlock = (min: number, max: number) => {
      if (!alive) return;
      const inMs = rand(min, max);
      flockTimeout = setTimeout(() => {
        spawnFlock();
        scheduleNextFlock(CROW_INTERVAL_MIN_MS, CROW_INTERVAL_MAX_MS);
      }, inMs);
    };

    // Preview mode · pass ?nex_preview_ambient=1 to spawn the first
    // flock in 2 s and then keep normal intervals. Skips the usual
    // 30–90 s wait so live-testing is instant.
    const previewMode =
      new URLSearchParams(window.location.search).get("nex_preview_ambient") ===
      "1";
    if (previewMode) {
      scheduleNextFlock(1_500, 2_500);
    } else {
      scheduleNextFlock(CROW_FIRST_DELAY_MIN_MS, CROW_FIRST_DELAY_MAX_MS);
    }

    const spawnTwinkle = () => {
      if (!alive) return;
      if (document.visibilityState !== "visible") {
        // Skip · but keep scheduling so it comes back on unhide.
        twinkleTimeout = setTimeout(
          spawnTwinkle,
          rand(TWINKLE_INTERVAL_MIN_MS, TWINKLE_INTERVAL_MAX_MS),
        );
        return;
      }
      const t: Twinkle = {
        id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        x: rand(4, 96),
        y: rand(4, 78),
        size: rand(1.5, 3.5),
        duration: rand(1_200, 2_400),
      };
      setTwinkles((prev) => [...prev.slice(-14), t]);
      setTimeout(() => {
        if (!alive) return;
        setTwinkles((prev) => prev.filter((p) => p.id !== t.id));
      }, t.duration + 200);
      twinkleTimeout = setTimeout(
        spawnTwinkle,
        rand(TWINKLE_INTERVAL_MIN_MS, TWINKLE_INTERVAL_MAX_MS),
      );
    };
    twinkleTimeout = setTimeout(spawnTwinkle, rand(2_000, 5_000));

    return () => {
      alive = false;
      if (flockTimeout) clearTimeout(flockTimeout);
      if (twinkleTimeout) clearTimeout(twinkleTimeout);
    };
  }, []);

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 1,
      }}
    >
      <style>{`
        /* Flight paths · four waypoints so the crow drifts sideways
           as it crosses, never a flat straight line. Direction is
           carried on the wrapper transform (scaleX ±1). Bezier via
           cubic-bezier ease. */
        @keyframes nex-crow-fly-lr-low {
          0%   { transform: translate(-140px, 0px)     rotate(-1deg); }
          30%  { transform: translate(30vw, -6px)      rotate(1deg); }
          55%  { transform: translate(55vw, -14px)     rotate(-1deg); }
          80%  { transform: translate(80vw, -4px)      rotate(2deg); }
          100% { transform: translate(calc(100vw + 80px), 4px) rotate(0deg); }
        }
        @keyframes nex-crow-fly-lr-high {
          0%   { transform: translate(-140px, 8px)     rotate(1deg); }
          35%  { transform: translate(38vw, -18px)     rotate(-2deg); }
          65%  { transform: translate(68vw, -22px)     rotate(1deg); }
          100% { transform: translate(calc(100vw + 80px), -2px) rotate(-1deg); }
        }
        @keyframes nex-crow-fly-lr-flat {
          0%   { transform: translate(-140px, 0)       rotate(0deg); }
          50%  { transform: translate(50vw, -3px)      rotate(0deg); }
          100% { transform: translate(calc(100vw + 80px), -4px) rotate(0deg); }
        }
        @keyframes nex-crow-fly-rtl-low {
          0%   { transform: translate(calc(100vw + 80px), 0px) scaleX(-1) rotate(1deg); }
          30%  { transform: translate(70vw, -6px)      scaleX(-1) rotate(-1deg); }
          55%  { transform: translate(45vw, -14px)     scaleX(-1) rotate(1deg); }
          80%  { transform: translate(20vw, -4px)      scaleX(-1) rotate(-2deg); }
          100% { transform: translate(-140px, 4px)     scaleX(-1) rotate(0deg); }
        }
        @keyframes nex-crow-fly-rtl-high {
          0%   { transform: translate(calc(100vw + 80px), 8px) scaleX(-1) rotate(-1deg); }
          35%  { transform: translate(62vw, -18px)     scaleX(-1) rotate(2deg); }
          65%  { transform: translate(32vw, -22px)     scaleX(-1) rotate(-1deg); }
          100% { transform: translate(-140px, -2px)    scaleX(-1) rotate(1deg); }
        }
        @keyframes nex-crow-fly-rtl-flat {
          0%   { transform: translate(calc(100vw + 80px), 0) scaleX(-1) rotate(0deg); }
          100% { transform: translate(-140px, -4px)    scaleX(-1) rotate(0deg); }
        }

        /* Wing flap · 3-frame cel-style animation. Each of three
           SVG groups is visible only for ~33% of the cycle so the
           reader sees a discrete up → mid → down swap, which reads
           as bird motion more clearly than tweened rotation. */
        @keyframes nex-crow-wing-up {
          0%, 32%   { opacity: 1; }
          33%, 100% { opacity: 0; }
        }
        @keyframes nex-crow-wing-mid {
          0%, 32%   { opacity: 0; }
          33%, 65%  { opacity: 1; }
          66%, 100% { opacity: 0; }
        }
        @keyframes nex-crow-wing-down {
          0%, 65%   { opacity: 0; }
          66%, 100% { opacity: 1; }
        }
        /* Body bob · sync'd to wing beat so downstroke pushes body up */
        @keyframes nex-crow-body-bob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(1.5px); }
        }

        /* Twinkle · rise, hold, fall */
        @keyframes nex-twinkle {
          0%   { opacity: 0; transform: scale(0.3); }
          25%  { opacity: 0.85; transform: scale(1); }
          65%  { opacity: 0.85; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.6); }
        }
      `}</style>

      {crows.map((c) => (
        <CrowSprite key={c.id} crow={c} />
      ))}

      {twinkles.map((t) => (
        <div
          key={t.id}
          style={{
            position: "absolute",
            left: `${t.x}%`,
            top: `${t.y}%`,
            width: t.size,
            height: t.size,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.7) 30%, transparent 70%)",
            boxShadow:
              "0 0 4px rgba(255,255,255,0.5), 0 0 8px rgba(200,220,255,0.35)",
            animation: `nex-twinkle ${t.duration}ms ease-in-out both`,
            willChange: "opacity, transform",
          }}
        />
      ))}
    </div>
  );
}

function CrowSprite({ crow }: { crow: Crow }) {
  const w = crow.size;
  const h = crow.size * 0.5;
  return (
    <div
      style={{
        position: "absolute",
        top: `${crow.startY}%`,
        left: 0,
        width: w,
        height: h,
        animation: `nex-crow-fly-${crow.direction}-${crow.arc} ${crow.duration}ms cubic-bezier(0.4, 0, 0.6, 1) both`,
        animationDelay: `${crow.delay}ms`,
        willChange: "transform",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          animation: `nex-crow-body-bob ${crow.flapMs}ms ease-in-out infinite`,
          animationDelay: `${crow.delay}ms`,
        }}
      >
        <CrowSvg flapMs={crow.flapMs} delay={crow.delay} />
      </div>
    </div>
  );
}

/** Crow silhouette · body/head/beak/tail static · three wing
 *  positions swap via opacity keyframes for a cel-animation feel. */
function CrowSvg({ flapMs, delay }: { flapMs: number; delay: number }) {
  const FILL = "#0b0b0b";
  return (
    <svg
      viewBox="-30 -15 60 30"
      width="100%"
      height="100%"
      style={{ overflow: "visible", display: "block" }}
    >
      {/* Body */}
      <ellipse cx="0" cy="0" rx="10" ry="3" fill={FILL} />
      {/* Head */}
      <circle cx="10" cy="-1" r="3" fill={FILL} />
      {/* Beak */}
      <path d="M13 -1 L19 -1.5 L13 0.5 Z" fill={FILL} />
      {/* Tail */}
      <path d="M-10 0 L-17 -2 L-19 0 L-17 2 Z" fill={FILL} />
      {/* Legs · tucked under body in flight, very subtle */}
      <line
        x1="-2"
        y1="2.5"
        x2="-3"
        y2="4.5"
        stroke={FILL}
        strokeWidth="0.7"
      />
      <line
        x1="2"
        y1="2.5"
        x2="3"
        y2="4.5"
        stroke={FILL}
        strokeWidth="0.7"
      />

      {/* Wings-up · both wings swept high on upstroke */}
      <g
        fill={FILL}
        style={{
          animation: `nex-crow-wing-up ${flapMs}ms steps(1, end) infinite`,
          animationDelay: `${delay}ms`,
        }}
      >
        <path d="M-3 -1 L-14 -13 L-8 -6 Z" />
        <path d="M3 -1 L14 -13 L8 -6 Z" opacity="0.78" />
      </g>
      {/* Wings-mid · wings horizontal · the transition frame */}
      <g
        fill={FILL}
        style={{
          animation: `nex-crow-wing-mid ${flapMs}ms steps(1, end) infinite`,
          animationDelay: `${delay}ms`,
        }}
      >
        <path d="M-3 -0.5 L-17 -3 L-11 0 Z" />
        <path d="M3 -0.5 L17 -3 L11 0 Z" opacity="0.78" />
      </g>
      {/* Wings-down · wings spread low on downstroke */}
      <g
        fill={FILL}
        style={{
          animation: `nex-crow-wing-down ${flapMs}ms steps(1, end) infinite`,
          animationDelay: `${delay}ms`,
        }}
      >
        <path d="M-3 0 L-16 6 L-9 3 Z" />
        <path d="M3 0 L16 6 L9 3 Z" opacity="0.78" />
      </g>
    </svg>
  );
}
