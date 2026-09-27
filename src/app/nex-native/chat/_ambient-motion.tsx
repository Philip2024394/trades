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
  arc?: "low" | "high" | "flat" | "wander" | "settle";
}

interface Twinkle {
  id: string;
  x: number; // %
  y: number; // %
  size: number; // px
  duration: number; // ms
  /** Peak opacity · dim stars are more common than bright ones so
   *  the sky has visual depth instead of every star burning equally. */
  brightness: number; // 0.35 .. 1
  /** Slight colour cast · mostly white, some cool-blue, some warm.
   *  Real starlight varies with stellar type. */
  tint: "white" | "cool" | "warm";
}

// ---------------------------------------------------------------------------
// Tunables · sealed 2026-09-27
// ---------------------------------------------------------------------------

const APPEARANCE_INTERVAL_MIN_MS = 180_000; // 3 min
const APPEARANCE_INTERVAL_MAX_MS = 480_000; // 8 min
const FIRST_APPEARANCE_MIN_MS = 45_000; // 45 s
const FIRST_APPEARANCE_MAX_MS = 120_000; // 2 min
// Twinkles · sealed 2026-09-27. Shorter cadence + burst mode so the
// sky feels alive with stars actively coming + going, matching the
// theme wallpaper's painted stars instead of feeling sparse.
const TWINKLE_INTERVAL_MIN_MS = 700;
const TWINKLE_INTERVAL_MAX_MS = 1_900;
const TWINKLE_BURST_CHANCE = 0.22; // 22% of spawns are bursts of 2–4 stars

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
  /** Optional soft-glow halo positioned over a moon (or other bright
   *  point-source) in the theme wallpaper · pulses gently to sell the
   *  "real moonlight" read. Coordinates are CSS values (%, px, etc)
   *  so themes can tune them per wallpaper composition. */
  moonGlow = null,
}: {
  ambientTint?: string;
  moonGlow?: {
    /** CSS left · e.g. "74%" or "280px" */
    x: string;
    /** CSS top */
    y: string;
    /** Halo diameter in px · the radial fades out inside this box */
    size: number;
    /** Core colour of the halo · pale cool white by default */
    color?: string;
  } | null;
} = {}) {
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
        // Distance bias · Founder direction 2026-09-27: "the crow
        // is a DISTANT environmental detail". Quadratic bias skews
        // toward the far end · most sightings are small silhouettes
        // in atmospheric haze, close fly-bys are the rare exception.
        //   sample²  · squared uniform → probability density high near 0
        //   remap    · from [0,1] to [0.05, 0.72] so 90% of sightings
        //              are depth ≤ 0.5 (small + hazy)
        const depth = 0.05 + Math.pow(Math.random(), 2) * 0.67;
        // Scale · dramatically smaller than the previous foreground
        // sizes. Even a "close" crow now caps around 68px so it
        // never dominates the reading zone.
        const scaleWidth =
          depth < 0.35
            ? rand(20, 32) // very distant · silhouette
            : depth < 0.55
              ? rand(30, 44) // mid-distance
              : rand(44, 68); // occasional closer pass
        flock.push({
          id: `crow-${now}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          clip:
            lowPerf || manifest.clips.length === 0
              ? null
              : pickClipForDepth(manifest.clips, depth),
          // Cluster crows over the upper 60% of the surface · never
          // where a message would sit. Distant crows drift toward
          // the top of the sky for stronger atmospheric read.
          startY: (groupBaseY + rand(-4, 4)) * (0.5 + depth * 0.5),
          startEdge: groupStartEdge,
          depth,
          scale: scaleWidth,
          // Playback rate variation is tiny · never enough to break
          // anatomy · matches Founder direction ("do not distort").
          playbackRate: rand(0.94, 1.06),
          delay: i === 0 ? 0 : i * rand(320, 900),
          // Vertical drift is much smaller now (bird is small on
          // screen · big drifts look wrong).
          drift: rand(-6, 6),
          ambientTint,
          // Atmospheric opacity fades harder for distant crows so
          // they read as silhouettes in haze, not as flat overlays.
          atmosphericOpacity: 0.38 + depth * 0.5, // 0.38..0.88
          // Distance blur is stronger at the far end · a distant
          // bird has no visible feather detail.
          atmosphericBlur: (1 - depth) * 2.8 + 0.15, // 0.15..2.95 px
          flapMs: rand(340, 460),
          arc: (["low", "high", "flat", "wander", "settle"] as const)[
            randInt(0, 4)
          ] as CrowAppearance["arc"],
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

    // Preview modes ·
    //   ?nex_preview_ambient=1     · first flock in 1.5–2.5s, then
    //                                normal rare cadence (3–8 min)
    //   ?nex_preview_ambient=fast  · continuous · every 5–15 s ·
    //                                for actively iterating on the
    //                                visual · never ship this to
    //                                real users (kills the rarity)
    const preview =
      new URLSearchParams(window.location.search).get("nex_preview_ambient");
    const scheduleFast = (min: number, max: number) => {
      if (!alive) return;
      appearanceT = setTimeout(() => {
        spawnAppearance();
        scheduleFast(5_000, 15_000);
      }, rand(min, max));
    };
    if (preview === "fast") {
      scheduleFast(800, 1_800);
    } else if (preview === "1") {
      scheduleNextAppearance(1_500, 2_500);
    } else {
      scheduleNextAppearance(FIRST_APPEARANCE_MIN_MS, FIRST_APPEARANCE_MAX_MS);
    }

    const makeTwinkle = (): Twinkle => {
      // Brightness · dim stars far more common than bright, so the
      // sky has depth. Pow bias skews toward the dim end.
      const brightness = 0.35 + Math.pow(Math.random(), 2) * 0.65;
      // Size correlates loosely with brightness · brighter stars
      // read as a touch larger.
      const size = 1.2 + brightness * 2.5;
      // Colour spread · 70% white, 18% cool-blue, 12% warm.
      const tint: Twinkle["tint"] =
        Math.random() < 0.7
          ? "white"
          : Math.random() < 0.6
            ? "cool"
            : "warm";
      return {
        id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        // Stars only in the sky zone above the mountain silhouettes
        // (upper ~28% of the surface for theme3.png). Below that is
        // the mountain / forest layer where painted stars don't
        // belong. Sealed 2026-09-27.
        x: rand(3, 97),
        y: rand(2, 28),
        size,
        // Duration correlates with brightness · dim stars flicker
        // briefly, bright stars linger through their fade.
        duration: 1_800 + brightness * 2_400 + rand(-300, 300),
        brightness,
        tint,
      };
    };

    const spawnTwinkle = () => {
      if (!alive) return;
      if (document.visibilityState !== "visible") {
        twinkleT = setTimeout(
          spawnTwinkle,
          rand(TWINKLE_INTERVAL_MIN_MS, TWINKLE_INTERVAL_MAX_MS),
        );
        return;
      }
      // Burst mode · occasionally 2–4 stars appear near-simultaneously
      // so the sky pulses with life rather than plodding through a
      // metronomic cadence.
      const burst = Math.random() < TWINKLE_BURST_CHANCE;
      const count = burst ? randInt(2, 4) : 1;
      const spawned: Twinkle[] = [];
      for (let i = 0; i < count; i++) spawned.push(makeTwinkle());
      setTwinkles((prev) => [...prev.slice(-(28 - spawned.length)), ...spawned]);
      spawned.forEach((t) => {
        setTimeout(() => {
          if (!alive) return;
          setTwinkles((prev) => prev.filter((p) => p.id !== t.id));
        }, t.duration + 200);
      });
      twinkleT = setTimeout(
        spawnTwinkle,
        rand(TWINKLE_INTERVAL_MIN_MS, TWINKLE_INTERVAL_MAX_MS),
      );
    };
    twinkleT = setTimeout(spawnTwinkle, rand(1_400, 3_200));

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

      {/* Moon halo · a soft breathing radial-gradient positioned
          over the moon in the theme wallpaper. Sits below crows
          (z-index 1 inside this container) so a passing crow still
          reads above the moonlight. */}
      {moonGlow && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: moonGlow.x,
            top: moonGlow.y,
            width: moonGlow.size,
            height: moonGlow.size,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            zIndex: 1,
            background: `radial-gradient(circle at 50% 50%, ${
              moonGlow.color ?? "rgba(220, 235, 255, 0.55)"
            } 0%, rgba(220, 235, 255, 0.22) 22%, rgba(200, 220, 250, 0.08) 45%, transparent 70%)`,
            filter: "blur(2px)",
            animation: "nex-moon-breathe 6.4s ease-in-out infinite",
            mixBlendMode: "screen",
          }}
        />
      )}

      {appearances.map((a) => (
        <CrowAppearanceSprite key={a.id} appearance={a} />
      ))}

      {twinkles.map((t) => {
        const core =
          t.tint === "cool"
            ? "rgba(210, 225, 255,"
            : t.tint === "warm"
              ? "rgba(255, 240, 220,"
              : "rgba(255, 255, 255,";
        const halo =
          t.tint === "cool"
            ? "rgba(160, 190, 240,"
            : t.tint === "warm"
              ? "rgba(240, 210, 170,"
              : "rgba(220, 230, 250,";
        const coreAlpha = 0.6 + t.brightness * 0.4; // 0.6..1
        const haloAlpha = 0.25 + t.brightness * 0.35; // 0.25..0.6
        return (
          <div
            key={t.id}
            style={{
              position: "absolute",
              left: `${t.x}%`,
              top: `${t.y}%`,
              width: t.size,
              height: t.size,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${core} ${coreAlpha}) 0%, ${core} ${
                coreAlpha * 0.7
              }) 30%, transparent 72%)`,
              boxShadow: `0 0 ${3 + t.brightness * 4}px ${halo} ${haloAlpha}), 0 0 ${
                6 + t.brightness * 8
              }px ${halo} ${haloAlpha * 0.55})`,
              // Longer ease keeps twinkles from popping · they
              // fade in slowly, hold, fade out slowly.
              animation: `nex-twinkle-soft ${t.duration}ms cubic-bezier(0.4, 0, 0.6, 1) both`,
              willChange: "opacity, transform",
            }}
          />
        );
      })}
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

  // Container translates across the screen · five arc variants per
  // direction (low, high, flat, wander, settle) so the trajectory
  // never plots as a clean A→B. Randomized per appearance so the
  // same path doesn't repeat.
  const arcVariants =
    startEdge === "left"
      ? ([
          "nex-crow-fly-lr-low",
          "nex-crow-fly-lr-high",
          "nex-crow-fly-lr-flat",
          "nex-crow-fly-lr-wander",
          "nex-crow-fly-lr-settle",
        ] as const)
      : ([
          "nex-crow-fly-rtl-low",
          "nex-crow-fly-rtl-high",
          "nex-crow-fly-rtl-flat",
          "nex-crow-fly-rtl-wander",
          "nex-crow-fly-rtl-settle",
        ] as const);
  const arcKey = arcVariants[Math.floor(Math.random() * arcVariants.length)]!;
  // Flight duration · distant crows take longer to cross the frame
  // because they move less angular distance per second (real-world
  // parallax). Video clips run at their native duration; SVG mode
  // varies with depth so far birds drift slowly, close birds cross
  // faster.
  const flightDurationMs = clip
    ? clip.duration_ms / playbackRate
    : (1 - depth) * 6_000 + 10_000 + rand(-1_500, 1_500);
  // → depth 0.1 (very far) ≈ 15.4s ± 1.5s   very slow drift
  // → depth 0.5 (mid)      ≈ 13.0s ± 1.5s
  // → depth 0.7 (closer)   ≈ 11.8s ± 1.5s   still leisurely

  return (
    <div
      style={{
        position: "absolute",
        top: `calc(${startY}% + ${drift * 0.5}px)`,
        left: 0,
        width,
        height,
        animationName: arcKey,
        animationDuration: `${flightDurationMs}ms`,
        animationTimingFunction: "cubic-bezier(0.4, 0, 0.6, 1)",
        animationFillMode: "both",
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
        <SvgCrowFallback
          flapMs={appearance.flapMs ?? 380}
          ambientTint={ambientTint}
          depth={depth}
        />
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
// SVG fallback · distant environmental crow · sealed 2026-09-27
// ---------------------------------------------------------------------------
//
// JS-driven wing state rather than a fixed CSS opacity cycle so
// each crow gets its own flap → glide → correction rhythm. The
// sequence is randomized per crow so the same beat pattern never
// repeats within a session. Structure:
//
//   flap flap flap flap  (3–5 wing beats · 320–440ms per beat)
//   glide                 (1.4–3.2s · wings held mid-extension)
//   flap flap flap        (variable count again)
//   ...
//
// A single beat is 4 frames: up → mid → down → mid. The mid frame
// during a glide reads as "wings held out" which is close enough
// to a real gliding silhouette at this small scale (< 70px). Frame
// values are computed once per crow and captured in a ref so the
// timing loop stays cheap.

type WingFrame = "up" | "mid" | "down" | "glide";

interface RhythmStep {
  frame: WingFrame;
  dur: number;
}

function buildFlightRhythm(flapMs: number): RhythmStep[] {
  const frameMs = flapMs / 4; // 4 frames per beat
  const steps: RhythmStep[] = [];
  // Total rhythm loop: 2–3 flap bursts separated by glides. Each
  // burst is 3–5 beats. Randomized so no crow shares a cadence.
  const bursts = randInt(2, 3);
  for (let b = 0; b < bursts; b++) {
    const beats = randInt(3, 5);
    for (let i = 0; i < beats; i++) {
      steps.push({ frame: "up", dur: frameMs });
      steps.push({ frame: "mid", dur: frameMs });
      steps.push({ frame: "down", dur: frameMs });
      steps.push({ frame: "mid", dur: frameMs });
    }
    // Glide period · longer glides after longer flap bursts so the
    // rhythm feels breathed rather than metronomic.
    steps.push({
      frame: "glide",
      dur: rand(1_400, 3_200),
    });
  }
  return steps;
}

function SvgCrowFallback({
  flapMs,
  ambientTint,
  depth,
}: {
  flapMs: number;
  ambientTint: string;
  depth: number;
}) {
  const [frame, setFrame] = React.useState<WingFrame>("glide");
  const rhythmRef = React.useRef<RhythmStep[]>(buildFlightRhythm(flapMs));

  React.useEffect(() => {
    let alive = true;
    let idx = randInt(0, rhythmRef.current.length - 1); // random entry
    let t: ReturnType<typeof setTimeout> | null = null;
    const advance = () => {
      if (!alive) return;
      const step = rhythmRef.current[idx]!;
      setFrame(step.frame);
      idx = (idx + 1) % rhythmRef.current.length;
      // Rebuild the rhythm at the start of each loop so the next
      // pass has different beat counts + glide lengths.
      if (idx === 0) rhythmRef.current = buildFlightRhythm(flapMs);
      t = setTimeout(advance, step.dur);
    };
    advance();
    return () => {
      alive = false;
      if (t) clearTimeout(t);
    };
  }, [flapMs]);

  // Fill · never pure black. Softer edges + reduced contrast for
  // atmospheric distance · a bird 300m away doesn't render as
  // #000. Very distant crows fade toward the ambient tint.
  const contrast = 0.55 + depth * 0.4; // 0.55..0.95
  const FILL = `rgba(14, 14, 18, ${contrast})`;
  const WING_FAR = `rgba(14, 14, 18, ${contrast * 0.78})`;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        // Soft edge shadow blends the silhouette into the wallpaper
        // instead of showing hard vector edges.
        filter: "drop-shadow(0 0 0.7px rgba(0,0,0,0.35))",
      }}
    >
      <svg
        viewBox="-30 -15 60 30"
        width="100%"
        height="100%"
        style={{ overflow: "visible", display: "block" }}
      >
        {/* Body · slightly slimmer for a corvid silhouette read.
            Head + beak + tail are always visible regardless of frame. */}
        <ellipse cx="0" cy="0" rx="9.5" ry="2.8" fill={FILL} />
        <circle cx="9.5" cy="-1" r="2.9" fill={FILL} />
        <path d="M12.5 -1 L18.5 -1.5 L12.5 0.5 Z" fill={FILL} />
        <path d="M-9.5 0 L-17 -2 L-19 0 L-17 2 Z" fill={FILL} />

        {/* Wing frames · opacity swap on the React-driven `frame`.
            Held glide silhouette is added as a fourth state so the
            crow can pause its flap and actually glide, not just
            hold a mid-flap pose. */}
        {frame === "up" && (
          <g fill={FILL}>
            <path d="M-3 -1 L-14 -13 L-8 -6 Z" />
            <path d="M3 -1 L14 -13 L8 -6 Z" fill={WING_FAR} />
          </g>
        )}
        {frame === "mid" && (
          <g fill={FILL}>
            <path d="M-3 -0.5 L-17 -3 L-11 0 Z" />
            <path d="M3 -0.5 L17 -3 L11 0 Z" fill={WING_FAR} />
          </g>
        )}
        {frame === "down" && (
          <g fill={FILL}>
            <path d="M-3 0 L-16 6 L-9 3 Z" />
            <path d="M3 0 L16 6 L9 3 Z" fill={WING_FAR} />
          </g>
        )}
        {frame === "glide" && (
          /* Wings held extended · slightly cambered · subtle upward
             tip lift reads as gliding rather than dead-hold. */
          <g fill={FILL}>
            <path d="M-2 -0.5 L-18 -2 L-13 0.5 Z" />
            <path d="M2 -0.5 L18 -2 L13 0.5 Z" fill={WING_FAR} />
          </g>
        )}
      </svg>
      {/* Ambient tint · multiplied over the silhouette so it blends
          with the wallpaper's dominant colour · stronger for more
          distant crows so they recede into the atmosphere. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: ambientTint,
          mixBlendMode: "multiply",
          opacity: 0.6 - depth * 0.35, // more tint when far
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Keyframes · shared between video sprites + SVG fallback so the
// flight-path randomness stays consistent regardless of what's playing.
// ---------------------------------------------------------------------------

const ambientCss = `
  /* Flight paths · restrained rotations (±1° max) so bank/turn reads
     as a real bird correcting course, not a UI wiggle. Each path has
     6+ waypoints of subtle irregularity — small rises, drops, and
     heading changes — so the trajectory never plots as a clean line.
     Five arc variants per direction so the same path doesn't repeat
     within a session. */
  @keyframes nex-crow-fly-lr-low {
    0%   { transform: translate(-160px, 0px)   rotate(-0.4deg); }
    18%  { transform: translate(18vw, -3px)    rotate(0.3deg); }
    36%  { transform: translate(36vw, -7px)    rotate(-0.5deg); }
    58%  { transform: translate(58vw, -12px)   rotate(0.7deg); }
    76%  { transform: translate(76vw, -6px)    rotate(-0.3deg); }
    100% { transform: translate(calc(100vw + 100px), 2px)  rotate(0deg); }
  }
  @keyframes nex-crow-fly-lr-high {
    0%   { transform: translate(-160px, 6px)   rotate(0.5deg); }
    22%  { transform: translate(22vw, -6px)    rotate(-0.6deg); }
    42%  { transform: translate(42vw, -18px)   rotate(0.4deg); }
    64%  { transform: translate(64vw, -22px)   rotate(-0.3deg); }
    86%  { transform: translate(86vw, -14px)   rotate(0.6deg); }
    100% { transform: translate(calc(100vw + 100px), -4px) rotate(-0.2deg); }
  }
  @keyframes nex-crow-fly-lr-flat {
    0%   { transform: translate(-160px, 0)     rotate(0deg); }
    30%  { transform: translate(30vw, -2px)    rotate(-0.2deg); }
    55%  { transform: translate(55vw, -5px)    rotate(0.3deg); }
    80%  { transform: translate(80vw, -3px)    rotate(-0.2deg); }
    100% { transform: translate(calc(100vw + 100px), -4px) rotate(0deg); }
  }
  /* Wander · the crow drifts diagonally, corrects, drifts back ·
     the trajectory reads as "navigating open air" not "crossing". */
  @keyframes nex-crow-fly-lr-wander {
    0%   { transform: translate(-160px, 0)     rotate(0.3deg); }
    14%  { transform: translate(14vw, -4px)    rotate(-0.4deg); }
    28%  { transform: translate(30vw, -14px)   rotate(0.6deg); }
    46%  { transform: translate(48vw, -9px)    rotate(-0.7deg); }
    62%  { transform: translate(62vw, -16px)   rotate(0.5deg); }
    80%  { transform: translate(80vw, -10px)   rotate(-0.4deg); }
    100% { transform: translate(calc(100vw + 100px), -6px) rotate(0.2deg); }
  }
  /* Settle · descending gradually · reads as a bird dropping toward
     a perch just off screen. */
  @keyframes nex-crow-fly-lr-settle {
    0%   { transform: translate(-160px, -18px) rotate(-0.6deg); }
    30%  { transform: translate(30vw, -10px)   rotate(0.4deg); }
    60%  { transform: translate(60vw, -2px)    rotate(-0.3deg); }
    88%  { transform: translate(88vw, 6px)     rotate(0.5deg); }
    100% { transform: translate(calc(100vw + 100px), 10px) rotate(0deg); }
  }
  @keyframes nex-crow-fly-rtl-low {
    0%   { transform: translate(calc(100vw + 100px), 0px) scaleX(-1) rotate(0.4deg); }
    18%  { transform: translate(82vw, -3px)    scaleX(-1) rotate(-0.3deg); }
    36%  { transform: translate(64vw, -7px)    scaleX(-1) rotate(0.5deg); }
    58%  { transform: translate(42vw, -12px)   scaleX(-1) rotate(-0.7deg); }
    76%  { transform: translate(24vw, -6px)    scaleX(-1) rotate(0.3deg); }
    100% { transform: translate(-160px, 2px)   scaleX(-1) rotate(0deg); }
  }
  @keyframes nex-crow-fly-rtl-high {
    0%   { transform: translate(calc(100vw + 100px), 6px) scaleX(-1) rotate(-0.5deg); }
    22%  { transform: translate(78vw, -6px)    scaleX(-1) rotate(0.6deg); }
    42%  { transform: translate(58vw, -18px)   scaleX(-1) rotate(-0.4deg); }
    64%  { transform: translate(36vw, -22px)   scaleX(-1) rotate(0.3deg); }
    86%  { transform: translate(14vw, -14px)   scaleX(-1) rotate(-0.6deg); }
    100% { transform: translate(-160px, -4px)  scaleX(-1) rotate(0.2deg); }
  }
  @keyframes nex-crow-fly-rtl-flat {
    0%   { transform: translate(calc(100vw + 100px), 0) scaleX(-1) rotate(0deg); }
    30%  { transform: translate(70vw, -2px)    scaleX(-1) rotate(0.2deg); }
    55%  { transform: translate(45vw, -5px)    scaleX(-1) rotate(-0.3deg); }
    80%  { transform: translate(20vw, -3px)    scaleX(-1) rotate(0.2deg); }
    100% { transform: translate(-160px, -4px)  scaleX(-1) rotate(0deg); }
  }
  @keyframes nex-crow-fly-rtl-wander {
    0%   { transform: translate(calc(100vw + 100px), 0) scaleX(-1) rotate(-0.3deg); }
    14%  { transform: translate(86vw, -4px)    scaleX(-1) rotate(0.4deg); }
    28%  { transform: translate(70vw, -14px)   scaleX(-1) rotate(-0.6deg); }
    46%  { transform: translate(52vw, -9px)    scaleX(-1) rotate(0.7deg); }
    62%  { transform: translate(38vw, -16px)   scaleX(-1) rotate(-0.5deg); }
    80%  { transform: translate(20vw, -10px)   scaleX(-1) rotate(0.4deg); }
    100% { transform: translate(-160px, -6px)  scaleX(-1) rotate(-0.2deg); }
  }
  @keyframes nex-crow-fly-rtl-settle {
    0%   { transform: translate(calc(100vw + 100px), -18px) scaleX(-1) rotate(0.6deg); }
    30%  { transform: translate(70vw, -10px)   scaleX(-1) rotate(-0.4deg); }
    60%  { transform: translate(40vw, -2px)    scaleX(-1) rotate(0.3deg); }
    88%  { transform: translate(12vw, 6px)     scaleX(-1) rotate(-0.5deg); }
    100% { transform: translate(-160px, 10px)  scaleX(-1) rotate(0deg); }
  }
  @keyframes nex-twinkle {
    0%   { opacity: 0; transform: scale(0.3); }
    25%  { opacity: 0.85; transform: scale(1); }
    65%  { opacity: 0.85; transform: scale(1); }
    100% { opacity: 0; transform: scale(0.6); }
  }
  /* Softer twinkle · slower rise, held hold, slower fall. The
     alpha ramp goes further than nex-twinkle so bright stars
     linger, dim ones flicker briefly. */
  @keyframes nex-twinkle-soft {
    0%   { opacity: 0; transform: scale(0.35); }
    18%  { opacity: 1; transform: scale(1); }
    72%  { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(0.7); }
  }
  /* Moon breathe · very subtle opacity + scale oscillation so the
     moon looks like it's radiating warmth into the sky rather than
     sitting as a flat painted disc. Deliberately slow (6.4s cycle)
     so it never becomes noticeable UI motion. */
  @keyframes nex-moon-breathe {
    0%, 100% { opacity: 0.78; transform: translate(-50%, -50%) scale(1); }
    50%      { opacity: 1;    transform: translate(-50%, -50%) scale(1.06); }
  }
`;
