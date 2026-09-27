"use client";

// src/app/nex-native/chat/_ambient-motion.tsx
//
// NEX Living Visual Asset · sealed 2026-09-27.
// --------------------------------------------
// Orchestrates rare photorealistic crow appearances + ambient star
// twinkles over the theme wallpaper. Framed as a "living visual
// asset" per Founder direction — the goal is "wait, was that a
// real crow?", not a decorative UI animation.
//
// Architecture:
//   1. Photorealistic source clips (WebM VP9 alpha · MP4 HEVC alpha
//      fallback) drop into /public/nex-native/chat/crows/
//   2. manifest.json describes each clip · orchestrator loads it lazily
//   3. Runtime picks a clip + controlled random parameters (start
//      edge, height, depth, playback rate, delay) and plays it once,
//      then the crow disappears · no continuous looping
//   4. Depth 0..1 drives scale + blur + opacity + atmospheric tint
//      so distant crows recede into the ambient light instead of
//      reading as flat overlays
//   5. Empty manifest → SVG silhouette fallback so the surface is
//      never blank while the assets are being produced
//
// Rarity:
//   · appearances every 3–8 min (weighted toward the long end)
//   · 80% solo · 15% pair · 4% trio · 1% quartet
//   · first appearance 45–120 s after mount
//
// Performance:
//   · manifest fetched once on mount · clip preloaded per appearance
//   · prefers-reduced-motion → nothing renders
//   · hardwareConcurrency ≤ 2 OR deviceMemory ≤ 2 → SVG fallback only
//   · pauses spawning when tab is hidden (visibilityState)
//   · pointer-events: none · never blocks the chat surface
//
// Layer stack (z-index within the wallpaper container):
//   0  · wallpaper photograph
//   0  · legibility scrim
//   1  · [reserved · future background 3D decoration]
//   2  · ambient motion (this component) · crows + twinkles
//   3  · [reserved · future foreground 3D decoration for occlusion]
//   4+ · header, bubbles, composer (owned by shell)

import * as React from "react";

// ---------------------------------------------------------------------------
// Types + manifest
// ---------------------------------------------------------------------------

interface CrowClip {
  id: string;
  type: string; // "ltr-straight" | "ltr-diagonal-up" | … see README
  src: {
    webm?: string;
    mp4?: string;
  };
  duration_ms: number;
  aspect_ratio?: number; // width / height · optional metadata
  recommended_depth?: [number, number]; // 0..1 · optional
}

interface CrowManifest {
  clips: CrowClip[];
}

// A resolved crow appearance · what actually gets rendered.
interface CrowAppearance {
  id: string;
  clip: CrowClip | null; // null → SVG silhouette fallback
  // Random controlled parameters (per Founder direction · orchestration
  // layer randomness, never distorting the rendered asset itself):
  startY: number; // % top of surface (0..70)
  startEdge: "left" | "right"; // where it enters from
  depth: number; // 0..1 · 0 = very far, 1 = very close
  scale: number; // px width of container
  playbackRate: number; // 0.9..1.1 · never enough to hurt anatomy
  delay: number; // ms after appearance spawn
  drift: number; // -20..20 · vertical drift as % of surface
  ambientTint: string; // rgba() painted via mix-blend-mode
  atmosphericOpacity: number; // 0.5..1
  atmosphericBlur: number; // 0..2 px
  // For SVG fallback only:
  flapMs?: number;
  arc?: "low" | "high" | "flat";
}

interface Twinkle {
  id: string;
  x: number; // %
  y: number; // %
  size: number; // px
  duration: number; // ms
}

// ---------------------------------------------------------------------------
// Tunables · sealed 2026-09-27
// ---------------------------------------------------------------------------

const APPEARANCE_INTERVAL_MIN_MS = 180_000; // 3 min
const APPEARANCE_INTERVAL_MAX_MS = 480_000; // 8 min
const FIRST_APPEARANCE_MIN_MS = 45_000; // 45 s
const FIRST_APPEARANCE_MAX_MS = 120_000; // 2 min
const TWINKLE_INTERVAL_MIN_MS = 1_800;
const TWINKLE_INTERVAL_MAX_MS = 4_400;

const MANIFEST_URL = "/nex-native/chat/crows/manifest.json";

// ---------------------------------------------------------------------------
// Random helpers
// ---------------------------------------------------------------------------

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pickWeighted<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

/** 80/15/4/1 solo/pair/trio/quartet — matches ambient corvid sightings
 *  and per Founder direction favours the rare-solo moment. */
function pickFlockSize(): number {
  return pickWeighted([1, 2, 3, 4], [80, 15, 4, 1]);
}

/** Low-performance heuristic · uses only widely-available signals.
 *  Returns true when the device is under-powered enough that we
 *  should skip the video path and use the SVG fallback. */
function isLowPerfDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const hc = navigator.hardwareConcurrency ?? 8;
  const dm = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  if (hc <= 2) return true;
  if (typeof dm === "number" && dm <= 2) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export function AmbientMotion({
  /** Ambient tint painted over distant sprites via mix-blend-mode ·
   *  matches the wallpaper's dominant colour so the crow reads as part
   *  of the environment rather than a sticker. Defaults to a warm
   *  neutral · pass the theme accent when available. */
  ambientTint = "rgba(220, 180, 200, 0.35)",
}: { ambientTint?: string } = {}) {
  const [manifest, setManifest] = React.useState<CrowManifest | null>(null);
  const [appearances, setAppearances] = React.useState<CrowAppearance[]>([]);
  const [twinkles, setTwinkles] = React.useState<Twinkle[]>([]);
  const [lowPerf, setLowPerf] = React.useState(false);

  // Load the manifest once + detect low-perf class.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setLowPerf(isLowPerfDevice());
    let cancelled = false;
    fetch(MANIFEST_URL, { cache: "force-cache" })
      .then((r) => (r.ok ? r.json() : { clips: [] }))
      .then((m: CrowManifest) => {
        if (!cancelled) setManifest(m);
      })
      .catch(() => {
        if (!cancelled) setManifest({ clips: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Orchestrate crow appearances + twinkles once manifest is settled.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (manifest === null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let alive = true;
    let appearanceT: ReturnType<typeof setTimeout> | null = null;
    let twinkleT: ReturnType<typeof setTimeout> | null = null;

    const spawnAppearance = () => {
      if (!alive) return;
      if (document.visibilityState !== "visible") return;
      const count = pickFlockSize();
      const flock: CrowAppearance[] = [];
      const now = Date.now();
      const groupStartEdge: "left" | "right" =
        Math.random() > 0.5 ? "left" : "right";
      const groupBaseY = rand(8, 55);
      for (let i = 0; i < count; i++) {
        const depth = rand(0.35, 1); // never fully far · always visible
        // Depth drives visual atmospherics — bigger + sharper when
        // close, smaller + softer when far. These map to physical
        // properties, not warping the anatomy.
        const scaleWidth =
          depth < 0.55
            ? rand(80, 130) // far
            : depth < 0.8
              ? rand(140, 200) // mid
              : rand(210, 300); // close fly-by
        flock.push({
          id: `crow-${now}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          clip:
            lowPerf || manifest.clips.length === 0
              ? null
              : pickClipForDepth(manifest.clips, depth),
          startY: groupBaseY + rand(-4, 4),
          startEdge: groupStartEdge,
          depth,
          scale: scaleWidth,
          playbackRate: rand(0.92, 1.08),
          delay: i === 0 ? 0 : i * rand(280, 720),
          drift: rand(-16, 16),
          ambientTint,
          atmosphericOpacity: 0.55 + depth * 0.45, // 0.55..1
          atmosphericBlur: (1 - depth) * 1.8, // 0..1.8 px
          flapMs: rand(320, 440),
          arc: (["low", "high", "flat"] as const)[randInt(0, 2)],
        });
      }
      setAppearances((prev) => [...prev, ...flock]);
      // Cleanup after the longest clip in the flock finishes.
      const life = flock.reduce((acc, a) => {
        const dur = a.clip
          ? a.clip.duration_ms / a.playbackRate
          : rand(7_000, 10_000);
        return Math.max(acc, dur + a.delay);
      }, 0);
      setTimeout(() => {
        if (!alive) return;
        setAppearances((prev) =>
          prev.filter((p) => !flock.some((f) => f.id === p.id)),
        );
      }, life + 400);
    };

    const scheduleNextAppearance = (minMs: number, maxMs: number) => {
      if (!alive) return;
      appearanceT = setTimeout(() => {
        spawnAppearance();
        scheduleNextAppearance(
          APPEARANCE_INTERVAL_MIN_MS,
          APPEARANCE_INTERVAL_MAX_MS,
        );
      }, rand(minMs, maxMs));
    };

    // Preview mode · ?nex_preview_ambient=1 triggers a fast first
    // appearance so live-testing is instant.
    const previewMode =
      new URLSearchParams(window.location.search).get("nex_preview_ambient") ===
      "1";
    if (previewMode) {
      scheduleNextAppearance(1_500, 2_500);
    } else {
      scheduleNextAppearance(FIRST_APPEARANCE_MIN_MS, FIRST_APPEARANCE_MAX_MS);
    }

    const spawnTwinkle = () => {
      if (!alive) return;
      if (document.visibilityState !== "visible") {
        twinkleT = setTimeout(
          spawnTwinkle,
          rand(TWINKLE_INTERVAL_MIN_MS, TWINKLE_INTERVAL_MAX_MS),
        );
        return;
      }
      const t: Twinkle = {
        id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
      twinkleT = setTimeout(
        spawnTwinkle,
        rand(TWINKLE_INTERVAL_MIN_MS, TWINKLE_INTERVAL_MAX_MS),
      );
    };
    twinkleT = setTimeout(spawnTwinkle, rand(2_000, 5_000));

    return () => {
      alive = false;
      if (appearanceT) clearTimeout(appearanceT);
      if (twinkleT) clearTimeout(twinkleT);
    };
  }, [manifest, lowPerf, ambientTint]);

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 2,
      }}
    >
      <style>{ambientCss}</style>

      {appearances.map((a) => (
        <CrowAppearanceSprite key={a.id} appearance={a} />
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

/** Prefer clips whose `recommended_depth` range covers this depth ·
 *  otherwise fall back to any clip. Never fails to pick when the
 *  clip list is non-empty. */
function pickClipForDepth(clips: CrowClip[], depth: number): CrowClip {
  const eligible = clips.filter((c) => {
    if (!c.recommended_depth) return true;
    const [lo, hi] = c.recommended_depth;
    return depth >= lo && depth <= hi;
  });
  const pool = eligible.length > 0 ? eligible : clips;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

// ---------------------------------------------------------------------------
// Sprite rendering
// ---------------------------------------------------------------------------

function CrowAppearanceSprite({ appearance }: { appearance: CrowAppearance }) {
  const {
    clip,
    startY,
    startEdge,
    scale,
    playbackRate,
    delay,
    drift,
    ambientTint,
    atmosphericOpacity,
    atmosphericBlur,
    depth,
  } = appearance;
  // Aspect from clip metadata · fallback square-ish so SVG works too.
  const aspect = clip?.aspect_ratio ?? 1.55;
  const width = scale;
  const height = scale / aspect;

  // Container translates across the screen via the same keyframes we
  // built for the SVG fallback. Direction chosen at spawn.
  const arcKey =
    startEdge === "left"
      ? (["nex-crow-fly-lr-low", "nex-crow-fly-lr-high", "nex-crow-fly-lr-flat"] as const)[
          Math.floor(Math.random() * 3)
        ]
      : (["nex-crow-fly-rtl-low", "nex-crow-fly-rtl-high", "nex-crow-fly-rtl-flat"] as const)[
          Math.floor(Math.random() * 3)
        ];
  // Longer duration for closer crows (they cover more visual distance
  // proportionally), shorter for far. Also stretches with playback
  // rate so wing physics stay coherent.
  const flightDurationMs = clip
    ? clip.duration_ms / playbackRate
    : rand(6_000, 9_500);

  return (
    <div
      style={{
        position: "absolute",
        top: `calc(${startY}% + ${drift * 0.5}px)`,
        left: 0,
        width,
        height,
        animation: `${arcKey} ${flightDurationMs}ms cubic-bezier(0.4, 0, 0.6, 1) both`,
        animationDelay: `${delay}ms`,
        opacity: atmosphericOpacity,
        filter: atmosphericBlur > 0.05 ? `blur(${atmosphericBlur}px)` : "none",
        willChange: "transform, opacity, filter",
      }}
    >
      {clip ? (
        <VideoCrow
          src={clip.src}
          playbackRate={playbackRate}
          ambientTint={ambientTint}
          depth={depth}
        />
      ) : (
        <SvgCrowFallback flapMs={appearance.flapMs ?? 380} delay={delay} />
      )}
    </div>
  );
}

function VideoCrow({
  src,
  playbackRate,
  ambientTint,
  depth,
}: {
  src: CrowClip["src"];
  playbackRate: number;
  ambientTint: string;
  depth: number;
}) {
  const ref = React.useRef<HTMLVideoElement | null>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.playbackRate = playbackRate;
  }, [playbackRate]);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <video
        ref={ref}
        autoPlay
        muted
        playsInline
        preload="auto"
        // No loop · one clip = one flight = one disappearance. Rarity
        // is the whole point.
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
        }}
      >
        {src.webm && <source src={src.webm} type="video/webm" />}
        {src.mp4 && <source src={src.mp4} type="video/mp4" />}
      </video>
      {/* Atmospheric tint · softens the source into the theme's
          ambient colour so the crow reads as belonging to the same
          light as the wallpaper. Stronger for distant crows. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: ambientTint,
          mixBlendMode: "multiply",
          opacity: 1 - depth * 0.6, // less tint when close, more when far
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG fallback · low-perf mode + waiting for source clips
// ---------------------------------------------------------------------------

function SvgCrowFallback({
  flapMs,
  delay,
}: {
  flapMs: number;
  delay: number;
}) {
  const FILL = "#0b0b0b";
  return (
    <svg
      viewBox="-30 -15 60 30"
      width="100%"
      height="100%"
      style={{ overflow: "visible", display: "block" }}
    >
      <ellipse cx="0" cy="0" rx="10" ry="3" fill={FILL} />
      <circle cx="10" cy="-1" r="3" fill={FILL} />
      <path d="M13 -1 L19 -1.5 L13 0.5 Z" fill={FILL} />
      <path d="M-10 0 L-17 -2 L-19 0 L-17 2 Z" fill={FILL} />
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

// ---------------------------------------------------------------------------
// Keyframes · shared between video sprites + SVG fallback so the
// flight-path randomness stays consistent regardless of what's playing.
// ---------------------------------------------------------------------------

const ambientCss = `
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
  @keyframes nex-twinkle {
    0%   { opacity: 0; transform: scale(0.3); }
    25%  { opacity: 0.85; transform: scale(1); }
    65%  { opacity: 0.85; transform: scale(1); }
    100% { opacity: 0; transform: scale(0.6); }
  }
`;
