"use client";

// src/app/nex-native/chat-standard/_surfaces/_ambient-layer.tsx
//
// Phase 2A.0 · Standard ambient animation layer.
//
// Pure visual · reads engine.ambientTreatment and renders every family
// that layer declared. Each family (bubbles-rising, light-rays, sparks,
// sparkles, stars, mist, heat-shimmer, leaves-falling, particles-up)
// has its own deterministic animation.
//
// Ambient is UNIVERSAL. Every surface mounts this at z-index 2 inside
// its own stacking context. Themes decide WHAT ambient looks like via
// personality + optional AmbientLayer override.

import * as React from "react";
import type { ResolvedEngine } from "../_engine/theme-engine";
import type { AmbientTreatment } from "../_engine/types";

export interface StandardAmbientLayerProps {
  engine: ResolvedEngine;
}

export function StandardAmbientLayer({
  engine,
}: StandardAmbientLayerProps): React.JSX.Element {
  const treatment = engine.ambientTreatment();
  return (
    <>
      <style>{AMBIENT_KEYFRAMES}</style>
      <div
        aria-hidden
        data-nex-se-ambient
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 2,
        }}
      >
        {treatment.families.map((family) => (
          <AmbientFamily key={family.kind} family={family} />
        ))}
      </div>
    </>
  );
}

function AmbientFamily({
  family,
}: {
  family: AmbientTreatment["families"][number];
}): React.JSX.Element | null {
  switch (family.kind) {
    case "bubbles-rising":
      return <BubblesRising {...family} />;
    case "light-rays":
      return <LightRays {...family} />;
    case "sparks":
      return <ParticlesRising {...family} tint="warm" />;
    case "sparkles":
      return <SparkleField {...family} />;
    case "stars":
      return <SparkleField {...family} />;
    case "mist":
      return <MistBand {...family} />;
    case "leaves-falling":
      return <LeavesFalling {...family} />;
    case "heat-shimmer":
      return <HeatShimmer {...family} />;
    case "particles-up":
      return <ParticlesRising {...family} tint="neutral" />;
    case "surface-caustics":
      return <SurfaceCaustics {...family} />;
    case "steam-rising":
      return <SteamRising {...family} />;
    case "warm-glow-pulse":
      return <WarmGlowPulse {...family} />;
    // Extension Batch 001 renderers (2026-10-05)
    case "sun-dapple":
      return <SunDapple {...family} />;
    case "pollen-float":
      return <PollenFloat {...family} />;
    case "neon-flicker":
      return <NeonFlicker {...family} />;
    case "rain-streak":
      return <RainStreak {...family} />;
    default:
      return null;
  }
}

// ─── Family renderers ───────────────────────────────────────────────

function seededRandomArray(seed: number, count: number): number[][] {
  let s = seed;
  const r = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: count }, () => [r(), r(), r(), r()]);
}

function BubblesRising({
  color,
  density,
  speedSeconds,
  size,
}: AmbientTreatment["families"][number]): React.JSX.Element {
  // Depth parallax · three layers (far / mid / near) with different
  // size, blur, opacity and speed. Fakes depth-of-field so the ambient
  // layer feels like a 3D water column rather than a flat particle sheet.
  const perLayer = Math.max(4, Math.round(density / 3));
  const far = React.useMemo(
    () => seededRandomArray(515153, perLayer),
    [perLayer],
  );
  const mid = React.useMemo(
    () => seededRandomArray(626263, perLayer),
    [perLayer],
  );
  const near = React.useMemo(
    () => seededRandomArray(737373, perLayer),
    [perLayer],
  );
  const render = (
    arr: number[][],
    scale: number,
    speedMul: number,
    blurPx: number,
    alpha: number,
    keyPrefix: string,
  ) => {
    const layerSpeed = speedSeconds * speedMul;
    return arr.map(([l, d, sz, x], i) => {
      const dim = size * scale * (0.55 + sz * 1.1);
      return (
        <span
          key={`${keyPrefix}-${i}`}
          style={
            {
              position: "absolute",
              left: `${l * 100}%`,
              bottom: -dim,
              width: dim,
              height: dim,
              borderRadius: "50%",
              background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,${0.5 * alpha}), ${color})`,
              boxShadow: `inset 0 1px 2px rgba(255,255,255,${0.4 * alpha}), 0 0 ${dim * 0.4}px ${color}`,
              filter: `blur(${blurPx}px)`,
              opacity: alpha,
              animation: `nex-se-bubbles-rising ${layerSpeed}s linear infinite`,
              animationDelay: `-${d * layerSpeed}s`,
              ["--nex-se-x" as unknown as string]: `${(x - 0.5) * 24}px`,
            } as React.CSSProperties
          }
        />
      );
    });
  };
  return (
    <>
      {render(far, 0.55, 1.5, 1.2, 0.5, "far")}
      {render(mid, 0.85, 1.1, 0.6, 0.75, "mid")}
      {render(near, 1.2, 0.8, 0.1, 0.95, "near")}
    </>
  );
}

function LightRays({
  color,
  density,
  speedSeconds,
  size,
}: AmbientTreatment["families"][number]): React.JSX.Element {
  // Depth parallax · two layers (deep / surface). Deep rays are wide,
  // soft, slow; surface rays are narrower, brighter, faster. Reads as
  // sunlight filtering through moving water.
  const perLayer = Math.max(3, Math.round(density / 2));
  const deep = React.useMemo(
    () => seededRandomArray(727271, perLayer),
    [perLayer],
  );
  const surface = React.useMemo(
    () => seededRandomArray(838383, perLayer),
    [perLayer],
  );
  return (
    <>
      {deep.map(([l, d, sz, rot], i) => (
        <span
          key={`deep-${i}`}
          style={{
            position: "absolute",
            top: -size * 0.4,
            left: `${l * 100}%`,
            width: 70 + sz * 70,
            height: size * 1.4 + size * sz,
            background: `linear-gradient(180deg, ${color} 0%, transparent 85%)`,
            transformOrigin: "top center",
            transform: `rotate(${8 + rot * 10}deg)`,
            animation: `nex-se-light-rays ${speedSeconds * 1.4}s ease-in-out infinite alternate`,
            animationDelay: `-${d * speedSeconds * 1.4}s`,
            opacity: 0.55,
            filter: "blur(10px)",
            mixBlendMode: "screen",
          }}
        />
      ))}
      {surface.map(([l, d, sz, rot], i) => (
        <span
          key={`sur-${i}`}
          style={{
            position: "absolute",
            top: -size * 0.3,
            left: `${l * 100}%`,
            width: 30 + sz * 40,
            height: size + size * sz * 0.6,
            background: `linear-gradient(180deg, ${color} 0%, transparent 92%)`,
            transformOrigin: "top center",
            transform: `rotate(${10 + rot * 8}deg)`,
            animation: `nex-se-light-rays ${speedSeconds}s ease-in-out infinite alternate`,
            animationDelay: `-${d * speedSeconds}s`,
            opacity: 0.9,
            filter: "blur(2px)",
            mixBlendMode: "screen",
          }}
        />
      ))}
    </>
  );
}

function ParticlesRising({
  color,
  density,
  speedSeconds,
  size,
  tint,
}: AmbientTreatment["families"][number] & {
  tint: "warm" | "neutral";
}): React.JSX.Element {
  const particles = React.useMemo(
    () => seededRandomArray(314151, density),
    [density],
  );
  const _ = tint;
  return (
    <>
      {particles.map(([l, d, sz, x], i) => (
        <span
          key={i}
          style={
            {
              position: "absolute",
              left: `${l * 100}%`,
              bottom: -size,
              width: size * (0.7 + sz * 0.9),
              height: size * (0.7 + sz * 0.9),
              borderRadius: "50%",
              background: color,
              filter: "blur(0.4px)",
              opacity: 0.75,
              animation: `nex-se-bubbles-rising ${speedSeconds}s linear infinite`,
              animationDelay: `-${d * speedSeconds}s`,
              ["--nex-se-x" as unknown as string]: `${(x - 0.5) * 20}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </>
  );
}

function SparkleField({
  color,
  density,
  speedSeconds,
  size,
}: AmbientTreatment["families"][number]): React.JSX.Element {
  const stars = React.useMemo(
    () => seededRandomArray(919191, density),
    [density],
  );
  return (
    <>
      {stars.map(([l, t, sz, d], i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: `${l * 100}%`,
            top: `${t * 100}%`,
            width: size * (0.5 + sz),
            height: size * (0.5 + sz),
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 ${size * 2}px ${color}`,
            animation: `nex-se-sparkle ${speedSeconds}s ease-in-out infinite`,
            animationDelay: `-${d * speedSeconds * 2}s`,
          }}
        />
      ))}
    </>
  );
}

function MistBand({
  color,
  density,
  speedSeconds,
  size,
}: AmbientTreatment["families"][number]): React.JSX.Element {
  // Two bands · bottom rising band (classic mist) + a thin mid-depth
  // band that drifts laterally. Together they create believable
  // atmospheric depth that extends up the water column instead of
  // sitting only at the floor.
  const perBand = Math.max(4, Math.round(density / 2));
  const bottom = React.useMemo(
    () => seededRandomArray(733337, perBand),
    [perBand],
  );
  const mid = React.useMemo(
    () => seededRandomArray(848484, perBand),
    [perBand],
  );
  return (
    <>
      {bottom.map(([l, d, sz, x], i) => {
        const w = size * (0.6 + sz * 0.7);
        return (
          <span
            key={`b-${i}`}
            style={
              {
                position: "absolute",
                left: `${l * 100}%`,
                bottom: 0,
                width: w,
                height: w * 1.3,
                borderRadius: "50%",
                background: `radial-gradient(ellipse at 50% 90%, ${color} 0%, transparent 75%)`,
                filter: "blur(44px)",
                opacity: 0.6,
                animation: `nex-se-mist ${speedSeconds}s linear infinite`,
                animationDelay: `-${d * speedSeconds}s`,
                ["--nex-se-x" as unknown as string]: `${(x - 0.5) * 14}vw`,
              } as React.CSSProperties
            }
          />
        );
      })}
      {mid.map(([l, d, sz, x], i) => {
        const w = size * (0.5 + sz * 0.5);
        return (
          <span
            key={`m-${i}`}
            style={
              {
                position: "absolute",
                left: `${l * 100}%`,
                top: `${20 + sz * 30}%`,
                width: w,
                height: w * 0.9,
                borderRadius: "50%",
                background: `radial-gradient(ellipse at 50% 50%, ${color} 0%, transparent 75%)`,
                filter: "blur(60px)",
                opacity: 0.32,
                animation: `nex-se-mist-mid ${speedSeconds * 1.4}s ease-in-out infinite alternate`,
                animationDelay: `-${d * speedSeconds * 1.4}s`,
                ["--nex-se-x" as unknown as string]: `${(x - 0.5) * 10}vw`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </>
  );
}

function SteamRising({
  color,
  density,
  speedSeconds,
  size,
}: AmbientTreatment["families"][number]): React.JSX.Element {
  // Three-layer steam column · far small/soft, mid medium, near wide/
  // sharp. The wisps lift and sway laterally while fading. Collectively
  // they turn the stage into a warm atmosphere.
  const perLayer = Math.max(5, Math.round(density / 3));
  const far = React.useMemo(
    () => seededRandomArray(474747, perLayer),
    [perLayer],
  );
  const mid = React.useMemo(
    () => seededRandomArray(575757, perLayer),
    [perLayer],
  );
  const near = React.useMemo(
    () => seededRandomArray(686868, perLayer),
    [perLayer],
  );
  const render = (
    arr: number[][],
    scale: number,
    speedMul: number,
    blurPx: number,
    alpha: number,
    keyPrefix: string,
  ) => {
    const dur = speedSeconds * speedMul;
    return arr.map(([l, d, sz, x], i) => {
      const w = size * scale * (0.6 + sz * 1.1);
      return (
        <span
          key={`${keyPrefix}-${i}`}
          style={
            {
              position: "absolute",
              left: `${l * 100}%`,
              bottom: -w,
              width: w,
              height: w * 1.4,
              borderRadius: "50%",
              background: `radial-gradient(ellipse at 50% 65%, ${color} 0%, transparent 72%)`,
              filter: `blur(${blurPx}px)`,
              opacity: alpha,
              animation: `nex-se-steam-rising ${dur}s linear infinite`,
              animationDelay: `-${d * dur}s`,
              ["--nex-se-x" as unknown as string]: `${(x - 0.5) * 24}px`,
            } as React.CSSProperties
          }
        />
      );
    });
  };
  return (
    <>
      {render(far, 0.55, 1.55, 22, 0.28, "sf")}
      {render(mid, 0.9, 1.15, 14, 0.42, "sm")}
      {render(near, 1.3, 0.85, 8, 0.58, "sn")}
    </>
  );
}

function WarmGlowPulse({
  color,
  density,
  speedSeconds,
  size,
}: AmbientTreatment["families"][number]): React.JSX.Element {
  // Two-layer treatment · a background "lantern halo" field (soft, wide,
  // slow) + a foreground "hot core" field (smaller, sharper, slightly
  // faster) so the warm lighting reads as hanging lamps lit from
  // within a warm atmosphere, not flat radial washes. Universal · any
  // theme opting into warmth.
  const perLayer = Math.max(3, Math.round(density / 2));
  const halos = React.useMemo(
    () => seededRandomArray(898989, perLayer),
    [perLayer],
  );
  const cores = React.useMemo(
    () => seededRandomArray(747474, perLayer),
    [perLayer],
  );
  return (
    <>
      {halos.map(([l, t, sz, d], i) => (
        <span
          key={`halo-${i}`}
          style={{
            position: "absolute",
            left: `${l * 100}%`,
            top: `${t * 100}%`,
            width: size * (1.0 + sz * 1.2),
            height: size * (1.0 + sz * 1.2),
            borderRadius: "50%",
            background: `radial-gradient(circle, ${color} 0%, transparent 60%)`,
            filter: "blur(14px)",
            mixBlendMode: "screen",
            opacity: 0.9,
            animation: `nex-se-warm-glow-pulse ${speedSeconds + sz * 2}s ease-in-out infinite`,
            animationDelay: `-${d * speedSeconds * 2}s`,
          }}
        />
      ))}
      {cores.map(([l, t, sz, d], i) => (
        <span
          key={`core-${i}`}
          style={{
            position: "absolute",
            left: `${l * 100 + 2}%`,
            top: `${t * 100 + 2}%`,
            width: size * (0.5 + sz * 0.6),
            height: size * (0.5 + sz * 0.6),
            borderRadius: "50%",
            background: `radial-gradient(circle, ${color} 0%, ${color.replace(/,[\d.]+\)/, ",0.35)")} 35%, transparent 70%)`,
            filter: "blur(4px)",
            mixBlendMode: "screen",
            opacity: 1,
            animation: `nex-se-warm-glow-pulse ${speedSeconds * 0.85 + sz}s ease-in-out infinite`,
            animationDelay: `-${d * speedSeconds * 1.3}s`,
          }}
        />
      ))}
    </>
  );
}

// ─── Extension Batch 001 · Sun-dapple ───────────────────────────────
// Slow-moving semi-transparent light patches drifting across the stage ·
// evokes sunlight through swaying leaves. Universal · usable by any
// theme opting into sun-dapple ambient family.

function SunDapple({
  color,
  density,
  speedSeconds,
  size,
}: AmbientTreatment["families"][number]): React.JSX.Element {
  const patches = React.useMemo(
    () => seededRandomArray(272727, density),
    [density],
  );
  return (
    <>
      {patches.map(([l, t, sz, d], i) => {
        const dim = size * (0.75 + sz * 0.8);
        const dur = speedSeconds + d * 10;
        return (
          <span
            key={i}
            style={
              {
                position: "absolute",
                left: `${l * 100}%`,
                top: `${t * 100}%`,
                width: dim,
                height: dim * 0.8,
                borderRadius: "50%",
                background: `radial-gradient(ellipse at 50% 50%, ${color} 0%, transparent 65%)`,
                filter: "blur(20px)",
                mixBlendMode: "screen",
                animation: `nex-se-sun-dapple-drift ${dur}s ease-in-out infinite`,
                animationDelay: `-${d * dur}s`,
                ["--nex-se-dx" as unknown as string]: `${(l - 0.5) * 60}px`,
                ["--nex-se-dy" as unknown as string]: `${(t - 0.5) * 36}px`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </>
  );
}

// ─── Extension Batch 001 · Pollen-float ─────────────────────────────
// Soft tinted particles with slow lateral drift and gentle rise ·
// warmer and gentler than bubbles-rising. Universal.

function PollenFloat({
  color,
  density,
  speedSeconds,
  size,
}: AmbientTreatment["families"][number]): React.JSX.Element {
  const particles = React.useMemo(
    () => seededRandomArray(383838, density),
    [density],
  );
  return (
    <>
      {particles.map(([l, d, sz, x], i) => {
        const dim = size * (0.7 + sz * 1.1);
        return (
          <span
            key={i}
            style={
              {
                position: "absolute",
                left: `${l * 100}%`,
                bottom: -dim,
                width: dim,
                height: dim,
                borderRadius: "50%",
                background: `radial-gradient(circle at 35% 35%, ${color} 0%, transparent 70%)`,
                boxShadow: `0 0 ${dim * 2}px ${color}`,
                filter: "blur(0.4px)",
                opacity: 0.8,
                animation: `nex-se-pollen-float ${speedSeconds}s linear infinite`,
                animationDelay: `-${d * speedSeconds}s`,
                ["--nex-se-x" as unknown as string]: `${(x - 0.5) * 40}px`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </>
  );
}

// ─── Extension Batch 001 · Neon-flicker ─────────────────────────────
// Scattered sharp pulses with intermittent flicker · neon-tube signage
// against darkness. Points are placed deterministically; the keyframe
// is irregular so the overall field never settles into a predictable
// rhythm. Universal.

function NeonFlicker({
  color,
  density,
  speedSeconds,
  size,
}: AmbientTreatment["families"][number]): React.JSX.Element {
  const points = React.useMemo(
    () => seededRandomArray(464646, density),
    [density],
  );
  return (
    <>
      {points.map(([l, t, sz, d], i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: `${l * 100}%`,
            top: `${t * 100}%`,
            width: size * (0.8 + sz * 0.8),
            height: size * (0.8 + sz * 0.8),
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 ${size * 2}px ${color}, 0 0 ${size * 5}px ${color}`,
            mixBlendMode: "screen",
            animation: `nex-se-neon-flicker ${speedSeconds + d * 2}s ease-in-out infinite`,
            animationDelay: `-${d * speedSeconds * 2}s`,
          }}
        />
      ))}
    </>
  );
}

// ─── Extension Batch 001 · Rain-streak ──────────────────────────────
// Thin vertical rain streaks · reads as noir / cinematic / monsoon.
// Density is high and lifetimes are short so the field looks like a
// steady curtain of rain. Universal.

function RainStreak({
  color,
  density,
  speedSeconds,
  size,
}: AmbientTreatment["families"][number]): React.JSX.Element {
  const streaks = React.useMemo(
    () => seededRandomArray(585858, density),
    [density],
  );
  return (
    <>
      {streaks.map(([l, d, sz, _rot], i) => {
        const h = 30 + sz * 60;
        const dur = speedSeconds * (0.7 + sz * 0.8);
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: `${l * 100}%`,
              top: -h,
              width: size,
              height: h,
              background: `linear-gradient(180deg, transparent 0%, ${color} 20%, ${color} 80%, transparent 100%)`,
              filter: `blur(${size * 0.3}px)`,
              transform: "rotate(8deg)",
              transformOrigin: "top center",
              animation: `nex-se-rain-streak ${dur}s linear infinite`,
              animationDelay: `-${d * dur}s`,
            }}
          />
        );
      })}
    </>
  );
}

function SurfaceCaustics({
  color,
  density,
  speedSeconds,
  size,
}: AmbientTreatment["families"][number]): React.JSX.Element {
  // Scattered soft points that pulse like reflected caustics dancing
  // on surfaces underwater. The field extends top-to-bottom so the
  // water column stays alive across the full stage, not just at the
  // conversation row.
  const points = React.useMemo(
    () => seededRandomArray(696969, density),
    [density],
  );
  return (
    <>
      {points.map(([l, t, sz, d], i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: `${l * 100}%`,
            top: `${t * 100}%`,
            width: size * (0.7 + sz * 1.4),
            height: size * (0.7 + sz * 1.4),
            borderRadius: "50%",
            background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
            filter: "blur(1.5px)",
            mixBlendMode: "screen",
            animation: `nex-se-surface-caustic ${speedSeconds + sz * 3}s ease-in-out infinite`,
            animationDelay: `-${d * speedSeconds * 2}s`,
          }}
        />
      ))}
    </>
  );
}

function LeavesFalling({
  color,
  density,
  speedSeconds,
  size,
}: AmbientTreatment["families"][number]): React.JSX.Element {
  const leaves = React.useMemo(
    () => seededRandomArray(424242, density),
    [density],
  );
  return (
    <>
      {leaves.map(([l, d, sz, rot], i) => (
        <span
          key={i}
          style={
            {
              position: "absolute",
              top: -size,
              left: `${l * 100}%`,
              width: size * (0.7 + sz),
              height: size * (0.4 + sz * 0.5),
              background: color,
              borderRadius: "50% 10% 50% 10%",
              transform: `rotate(${rot * 180}deg)`,
              animation: `nex-se-leaves ${speedSeconds}s linear infinite`,
              animationDelay: `-${d * speedSeconds}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </>
  );
}

function HeatShimmer({
  color,
  size,
  speedSeconds,
}: AmbientTreatment["families"][number]): React.JSX.Element {
  return (
    <span
      style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(ellipse at 50% 100%, ${color}, transparent 70%)`,
        filter: `blur(${Math.round(size / 10)}px)`,
        animation: `nex-se-heat ${speedSeconds}s ease-in-out infinite alternate`,
        pointerEvents: "none",
      }}
    />
  );
}

// ─── Keyframes (one block, scoped by name) ──────────────────────────

const AMBIENT_KEYFRAMES = `
@keyframes nex-se-bubbles-rising {
  0%   { transform: translate3d(0, 40px, 0); opacity: 0; }
  15%  { opacity: 1; }
  85%  { opacity: 0.6; }
  100% { transform: translate3d(var(--nex-se-x, 0px), -110vh, 0); opacity: 0; }
}
@keyframes nex-se-light-rays {
  0%, 100% { opacity: 0.55; transform: rotate(8deg) scaleY(0.95); }
  50%      { opacity: 0.9;  transform: rotate(12deg) scaleY(1.05); }
}
@keyframes nex-se-sparkle {
  0%, 100% { opacity: 0.15; transform: scale(0.85); }
  50%      { opacity: 1;    transform: scale(1.15); }
}
@keyframes nex-se-mist {
  0%   { transform: translate3d(0, 0, 0); opacity: 0; }
  20%  { opacity: 1; }
  80%  { opacity: 0.4; }
  100% { transform: translate3d(var(--nex-se-x, 0px), -110vh, 0); opacity: 0; }
}
@keyframes nex-se-mist-mid {
  0%, 100% { transform: translateX(0); opacity: 0.22; }
  50%      { transform: translateX(var(--nex-se-x, 0px)); opacity: 0.42; }
}
@keyframes nex-se-leaves {
  0%   { transform: translate3d(0, 0, 0) rotate(0); opacity: 0; }
  10%  { opacity: 1; }
  100% { transform: translate3d(60px, 110vh, 0) rotate(540deg); opacity: 0; }
}
@keyframes nex-se-heat {
  0%, 100% { opacity: 0.45; transform: scaleY(1); }
  50%      { opacity: 0.8;  transform: scaleY(1.08); }
}
`;
