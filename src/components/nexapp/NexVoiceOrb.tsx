// NEX HEADER INTELLIGENCE CORE · v2 (eye behaviour + dramatic speaking).
// Philip 2026-08-26.
//
// EYE behaviour:
//   · Pupil is the "eye" · translates to look toward activity
//   · Composer focus → looks DOWN · rail tap → looks RIGHT · header tap → UP
//   · Returns to centre after ~700ms with natural drift, never locked
//   · Natural micro-saccades every 3-5s in random subtle directions
//   · Occasional idle glance UP/UP-LEFT (thinking pose · random)
//
// SPEAKING (WOW moment):
//   · Core dramatically pulses to voice amplitude (simulated envelope)
//   · Vocal ribbon curves undulate across the eye
//   · Peak events trigger coordinated bloom (core + ring + burst)
//   · Waveform bars react beyond idle amplitude

"use client";

import React, { useEffect, useRef, useState } from "react";
import type { NexVoiceState } from "@/lib/nex-voice";
import { useGuidanceTarget } from "./hud/NexGuidance";

export type OrbLookDirection =
  | "center"
  | "up" | "down" | "left" | "right"
  | "up-left" | "up-right" | "down-left" | "down-right";

interface Props {
  nexState: NexVoiceState;
  onTap?: () => void;
  size?: string;
  /** Direction the eye should look · auto-returns to centre after ~700ms. */
  lookAt?: OrbLookDirection | null;
}

interface Palette {
  core: string; glow: string; glowSoft: string;
  wave: string; particle: string; circuit: string; label: string;
}
const PALETTE: Record<NexVoiceState, Palette> = {
  idle:      { core: "#fb923c", glow: "rgba(249,115,22,0.55)", glowSoft: "rgba(249,115,22,0.18)", wave: "#f97316", particle: "#fed7aa", circuit: "rgba(249,115,22,0.45)", label: "NEX · ready" },
  listening: { core: "#fbbf24", glow: "rgba(249,115,22,0.90)", glowSoft: "rgba(249,115,22,0.35)", wave: "#fdba74", particle: "#ffedd5", circuit: "rgba(249,115,22,0.75)", label: "NEX · listening" },
  thinking:  { core: "#c084fc", glow: "rgba(168,85,247,0.80)", glowSoft: "rgba(168,85,247,0.28)", wave: "#a855f7", particle: "#e9d5ff", circuit: "rgba(168,85,247,0.65)", label: "NEX · thinking" },
  speaking:  { core: "#67e8f9", glow: "rgba(34,211,238,0.85)", glowSoft: "rgba(34,211,238,0.30)", wave: "#22d3ee", particle: "#cffafe", circuit: "rgba(34,211,238,0.70)", label: "NEX · speaking" },
  error:     { core: "#fb7185", glow: "rgba(244,63,94,0.55)",  glowSoft: "rgba(244,63,94,0.18)",  wave: "#f43f5e", particle: "#fecdd3", circuit: "rgba(244,63,94,0.35)",  label: "NEX · retry" },
};

interface Timing {
  coreBreath: string; ringSpin: string; segmentTravel: string;
  particleOrbit: string; circuitFlash: string; waveformScale: number;
}
const TIMING: Record<NexVoiceState, Timing> = {
  idle:      { coreBreath: "5.5s", ringSpin: "38s", segmentTravel: "9s",   particleOrbit: "22s", circuitFlash: "7s",   waveformScale: 0.6 },
  listening: { coreBreath: "1.8s", ringSpin: "20s", segmentTravel: "4s",   particleOrbit: "10s", circuitFlash: "3.5s", waveformScale: 1.4 },
  thinking:  { coreBreath: "2.4s", ringSpin: "9s",  segmentTravel: "3s",   particleOrbit: "6s",  circuitFlash: "2.5s", waveformScale: 0.9 },
  speaking:  { coreBreath: "1.1s", ringSpin: "12s", segmentTravel: "2.6s", particleOrbit: "7s",  circuitFlash: "1.6s", waveformScale: 1.8 },
  error:     { coreBreath: "3.5s", ringSpin: "50s", segmentTravel: "14s",  particleOrbit: "26s", circuitFlash: "10s",  waveformScale: 0.5 },
};

// Pupil offset per look direction (as % of ORB WIDTH · applied via top/left
// on the pupil so translate stays a pure centering step · no compound
// transforms). MAX_RADIUS clamps any accumulated offset so the pupil can
// never leave the plasma cavity.
const MAX_RADIUS = 14; // % of orb width · single canonical constraint
const LOOK_OFFSET: Record<OrbLookDirection, { x: number; y: number }> = {
  "center":     { x:   0, y:   0 },
  "up":         { x:   0, y: -14 },
  "down":       { x:   0, y:  14 },
  "left":       { x: -14, y:   0 },
  "right":      { x:  14, y:   0 },
  "up-left":    { x: -10, y: -10 },
  "up-right":   { x:  10, y: -10 },
  "down-left":  { x: -10, y:  10 },
  "down-right": { x:  10, y:  10 },
};
// Occasional idle "glance" directions · softer than intentional looks.
const IDLE_GLANCES: OrbLookDirection[] = ["up-left", "up", "up-right", "right", "left"];

function clampRadius(x: number, y: number, max: number): { x: number; y: number } {
  const d = Math.sqrt(x * x + y * y);
  if (d <= max) return { x, y };
  const s = max / d;
  return { x: x * s, y: y * s };
}

const PARTICLES = [
  { radiusPct: 34, sizePct: 3.2, phase:   0, opacity: 0.9 },
  { radiusPct: 40, sizePct: 2.4, phase:  70, opacity: 0.7 },
  { radiusPct: 32, sizePct: 2.0, phase: 140, opacity: 0.8 },
  { radiusPct: 42, sizePct: 2.6, phase: 200, opacity: 0.75 },
  { radiusPct: 36, sizePct: 1.8, phase: 260, opacity: 0.65 },
  { radiusPct: 44, sizePct: 2.2, phase: 320, opacity: 0.7 },
];
const CIRCUITS = [
  { angleDeg:   0, lengthPct: 30, delay: "0s"   },
  { angleDeg:  45, lengthPct: 26, delay: "1.8s" },
  { angleDeg:  90, lengthPct: 32, delay: "3.4s" },
  { angleDeg: 135, lengthPct: 24, delay: "0.6s" },
  { angleDeg: 180, lengthPct: 28, delay: "2.7s" },
  { angleDeg: 225, lengthPct: 30, delay: "4.1s" },
  { angleDeg: 270, lengthPct: 26, delay: "1.2s" },
  { angleDeg: 315, lengthPct: 32, delay: "3.9s" },
];

// Pupil element extracted so it can register itself as a guidance target.
function PupilElement({
  finalPos, palette, className,
}: {
  finalPos: { x: number; y: number };
  palette: Palette;
  className: string;
}) {
  const attachPupil = useGuidanceTarget("pupil");
  return (
    <div
      ref={attachPupil as (el: HTMLDivElement | null) => void}
      aria-hidden
      className={className}
      style={{
        position: "absolute",
        top:  `calc(50% + ${finalPos.y}%)`,
        left: `calc(50% + ${finalPos.x}%)`,
        transform: "translate(-50%, -50%)",
        transition: "top 380ms cubic-bezier(0.34, 1.56, 0.64, 1), left 380ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        width: "10%", height: "10%",
        borderRadius: "50%",
        background: `radial-gradient(circle at 40% 35%, #ffffff 0%, ${palette.particle} 30%, ${palette.core} 70%, transparent 100%)`,
        boxShadow: `0 0 16px ${palette.glow}, 0 0 32px ${palette.glowSoft}`,
        pointerEvents: "none",
      }}
    />
  );
}

export function NexVoiceOrb({ nexState, onTap, size = "100%", lookAt = null }: Props) {
  const p = PALETTE[nexState];
  const t = TIMING[nexState];
  const uid = React.useId().replace(/:/g, "");

  // ── EYE LOOK STATE ─────────────────────────────────────────────────────
  // Combines: (a) intentional look from prop · (b) natural micro-drift ·
  // (c) occasional idle glance. Merges into a final pupil offset (%).
  const [effectiveLook, setEffectiveLook] = useState<OrbLookDirection>("center");
  const [drift, setDrift] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Respond to explicit lookAt prop · hold for ~700ms · then return to centre.
  useEffect(() => {
    if (!lookAt || lookAt === "center") {
      setEffectiveLook("center");
      return;
    }
    setEffectiveLook(lookAt);
    if (returnTimer.current) clearTimeout(returnTimer.current);
    returnTimer.current = setTimeout(() => setEffectiveLook("center"), 700);
    return () => {
      if (returnTimer.current) clearTimeout(returnTimer.current);
    };
  }, [lookAt]);

  // Natural micro-drift + occasional idle glance when effective look is centre.
  useEffect(() => {
    if (effectiveLook !== "center") return;
    // Micro-drift oscillation via setInterval · slow, subtle.
    let cancelled = false;
    let idleGlanceTimer: ReturnType<typeof setTimeout> | null = null;

    const microDriftLoop = () => {
      if (cancelled) return;
      // Random small drift ±3px equivalent
      setDrift({
        x: (Math.random() - 0.5) * 6,
        y: (Math.random() - 0.5) * 6,
      });
      setTimeout(microDriftLoop, 1600 + Math.random() * 1600);
    };
    microDriftLoop();

    // Occasional idle glance every 4-8s · looks in a random natural direction ·
    // holds ~500ms · returns.
    const scheduleGlance = () => {
      if (cancelled) return;
      idleGlanceTimer = setTimeout(() => {
        if (cancelled) return;
        const dir = IDLE_GLANCES[Math.floor(Math.random() * IDLE_GLANCES.length)];
        setEffectiveLook(dir);
        setTimeout(() => {
          if (!cancelled) setEffectiveLook("center");
          scheduleGlance();
        }, 500 + Math.random() * 400);
      }, 4000 + Math.random() * 4000);
    };
    scheduleGlance();

    return () => {
      cancelled = true;
      if (idleGlanceTimer) clearTimeout(idleGlanceTimer);
    };
  }, [effectiveLook === "center"]);

  // ── CANONICAL PUPIL COORDINATE ────────────────────────────────────────
  // ONE final (x, y) in % of orb width. Applied via top/left offset so the
  // pupil's own transform stays pure translate(-50%, -50%) centering — no
  // stacked transforms · no fractional bias · always returns to exact 0,0
  // when at centre. Drift only applies when at centre; hard-off otherwise.
  const lookOffset = LOOK_OFFSET[effectiveLook];
  const isCentre   = effectiveLook === "center";
  const finalPos   = clampRadius(
    lookOffset.x + (isCentre ? drift.x : 0),
    lookOffset.y + (isCentre ? drift.y : 0),
    MAX_RADIUS,
  );

  return (
    <button
      type="button"
      aria-label={p.label}
      onClick={onTap}
      style={{
        appearance: "none",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        padding: 0,
        width: size,
        height: size,
        aspectRatio: "1 / 1",
        position: "relative",
        overflow: "visible",
      }}
    >
      {/* OUTER GLOW · slow breath · depth */}
      <div
        aria-hidden
        className={`nex-orb-outerglow-${uid}`}
        style={{
          position: "absolute", inset: "-45%", borderRadius: "50%",
          background: `radial-gradient(circle at center, ${p.glow} 0%, ${p.glowSoft} 35%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* OUTER RING · slow spin · nearly imperceptible in idle */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className={`nex-orb-outerring-${uid}`}
        style={{ position: "absolute", inset: "-4%", width: "108%", height: "108%" }}
      >
        <circle cx="50" cy="50" r="46" fill="none" stroke={p.wave} strokeWidth="0.5" opacity="0.55" />
        <circle cx="50" cy="50" r="46" fill="none" stroke={p.wave} strokeWidth="0.5" strokeDasharray="2 118" opacity="0.9" />
      </svg>

      {/* SEGMENT TRAVELLER */}
      <div
        aria-hidden
        className={`nex-orb-segment-${uid}`}
        style={{
          position: "absolute", inset: "-4%", borderRadius: "50%",
          background: `conic-gradient(from 0deg, transparent 0deg, transparent 340deg, ${p.wave} 350deg, ${p.core} 358deg, transparent 360deg)`,
          mask: "radial-gradient(circle at center, transparent 68%, black 70%, black 74%, transparent 76%)",
          WebkitMask: "radial-gradient(circle at center, transparent 68%, black 70%, black 74%, transparent 76%)",
        }}
      />

      {/* WAVEFORM RING · 24 radial bars */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        style={{ position: "absolute", inset: "8%", width: "84%", height: "84%" }}
      >
        {Array.from({ length: 24 }).map((_, i) => {
          const angle = (i / 24) * 360;
          return (
            <line
              key={i}
              x1="50" y1="8" x2="50" y2="14"
              stroke={p.wave} strokeWidth="1.6" strokeLinecap="round" opacity="0.85"
              transform={`rotate(${angle} 50 50)`}
              style={{
                transformOrigin: "50px 50px",
                animationName: `nex-orb-wavebar-${uid}`,
                animationDuration: t.coreBreath,
                animationTimingFunction: "ease-in-out",
                animationIterationCount: "infinite",
                animationDelay: `${(i * 0.06) % (parseFloat(t.coreBreath))}s`,
              }}
            />
          );
        })}
      </svg>

      {/* NEURAL CIRCUITS · faint flash */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      >
        {CIRCUITS.map((c, i) => {
          const rad = (c.angleDeg * Math.PI) / 180;
          const x1 = 50 + Math.cos(rad) * 20;
          const y1 = 50 + Math.sin(rad) * 20;
          const x2 = 50 + Math.cos(rad) * (20 + c.lengthPct * 0.5);
          const y2 = 50 + Math.sin(rad) * (20 + c.lengthPct * 0.5);
          return (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={p.circuit} strokeWidth="0.6" strokeLinecap="round" opacity="0.35"
              style={{
                animationName: `nex-orb-circuit-${uid}`,
                animationDuration: t.circuitFlash,
                animationTimingFunction: "ease-in-out",
                animationIterationCount: "infinite",
                animationDelay: c.delay,
              }}
            />
          );
        })}
      </svg>

      {/* ORBITING PARTICLES */}
      {PARTICLES.map((particle, i) => (
        <div
          key={i}
          aria-hidden
          className={`nex-orb-particle-${uid}`}
          style={{
            position: "absolute", inset: 0,
            transform: `rotate(${particle.phase}deg)`,
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: `${50 - particle.radiusPct}%`, left: "50%",
              width: `${particle.sizePct}%`, height: `${particle.sizePct}%`,
              borderRadius: "50%", background: p.particle,
              boxShadow: `0 0 6px ${p.glow}, 0 0 2px ${p.particle}`,
              transform: "translateX(-50%)", opacity: particle.opacity,
            }}
          />
        </div>
      ))}

      {/* ═══ SOUL OF NEX · living plasma consciousness ═══ */}

      {/* Dark cavity well */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: "30%", borderRadius: "50%",
          background: "radial-gradient(circle at 50% 50%, rgba(0,0,0,0.85) 0%, rgba(6,4,2,0.9) 55%, transparent 100%)",
          boxShadow: `inset 0 0 24px rgba(0,0,0,0.9), 0 0 24px ${p.glow}`,
        }}
      />

      {/* Plasma swirl A · CW */}
      <div
        aria-hidden
        className={`nex-orb-plasma-a-${uid}`}
        style={{
          position: "absolute", inset: "32%", borderRadius: "50%",
          background: `
            radial-gradient(circle at 30% 30%, ${p.particle} 0%, transparent 32%),
            radial-gradient(circle at 72% 62%, ${p.core}    0%, transparent 38%),
            radial-gradient(circle at 40% 78%, ${p.wave}    0%, transparent 30%)`,
          mixBlendMode: "screen", opacity: 0.9, filter: "blur(2px)", pointerEvents: "none",
        }}
      />

      {/* Plasma swirl B · CCW */}
      <div
        aria-hidden
        className={`nex-orb-plasma-b-${uid}`}
        style={{
          position: "absolute", inset: "32%", borderRadius: "50%",
          background: `
            radial-gradient(circle at 70% 32%, ${p.wave}     0%, transparent 34%),
            radial-gradient(circle at 26% 62%, ${p.particle} 0%, transparent 32%),
            radial-gradient(circle at 60% 82%, ${p.core}     0%, transparent 30%)`,
          mixBlendMode: "screen", opacity: 0.75, filter: "blur(2px)", pointerEvents: "none",
        }}
      />

      {/* Iris rings */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className={`nex-orb-iris-${uid}`}
        style={{ position: "absolute", inset: "30%", width: "40%", height: "40%", pointerEvents: "none" }}
      >
        {[20, 30, 40].map((r, i) => (
          <circle key={r} cx="50" cy="50" r={r} fill="none" stroke={p.particle} strokeWidth="0.6" opacity={0.25 - i * 0.06} />
        ))}
      </svg>

      {/* Vocal ribbons · only visible in speaking · undulating waves across the eye */}
      {nexState === "speaking" && (
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          style={{
            position: "absolute", inset: "32%", width: "36%", height: "36%",
            pointerEvents: "none", overflow: "visible",
          }}
        >
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M 5 50 Q 27 ${35 + i * 5}, 50 50 T 95 50`}
              fill="none"
              stroke={p.particle}
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity={0.5 - i * 0.1}
              style={{
                animationName: `nex-orb-ribbon-${uid}`,
                animationDuration: `${1.1 + i * 0.3}s`,
                animationTimingFunction: "ease-in-out",
                animationIterationCount: "infinite",
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </svg>
      )}

      {/* PUPIL · the eye · position via top/left (% of ORB) · transform
          is pure centering only · single canonical coordinate system.
          Registers itself as guidance target "pupil" · every beam emerges
          from this exact DOM element. */}
      <PupilElement
        finalPos={finalPos}
        palette={p}
        className={`nex-orb-pupil-${uid}`}
      />

      {/* Rim highlight · glass depth */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: "30%", borderRadius: "50%",
          background: "radial-gradient(circle at 30% 22%, rgba(255,255,255,0.55) 0%, transparent 15%)",
          pointerEvents: "none",
        }}
      />

      <style>{`
        .nex-orb-outerglow-${uid} { animation: nex-orb-outerglow-${uid} 7s ease-in-out infinite; }
        @keyframes nex-orb-outerglow-${uid} {
          0%, 100% { transform: scale(1);    opacity: 0.85; }
          50%      { transform: scale(1.10); opacity: 1;    }
        }
        .nex-orb-outerring-${uid} { animation: nex-orb-spin-${uid} ${t.ringSpin} linear infinite; }
        @keyframes nex-orb-spin-${uid} { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .nex-orb-segment-${uid}   { animation: nex-orb-segment-${uid} ${t.segmentTravel} linear infinite; }
        @keyframes nex-orb-segment-${uid} { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes nex-orb-wavebar-${uid} {
          0%, 100% { transform: scaleY(${(0.35 * t.waveformScale).toFixed(2)}); opacity: 0.55; }
          50%      { transform: scaleY(${(1.10 * t.waveformScale).toFixed(2)}); opacity: 1;    }
        }
        @keyframes nex-orb-circuit-${uid} {
          0%, 88%, 100% { opacity: 0.15; stroke-width: 0.6; }
          92%           { opacity: 1;    stroke-width: 1.1; }
        }
        .nex-orb-particle-${uid} { animation: nex-orb-particle-${uid} ${t.particleOrbit} linear infinite; }
        @keyframes nex-orb-particle-${uid} { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .nex-orb-plasma-a-${uid} { animation: nex-orb-plasma-cw-${uid}  calc(${t.coreBreath} * 4) linear infinite; }
        .nex-orb-plasma-b-${uid} { animation: nex-orb-plasma-ccw-${uid} calc(${t.coreBreath} * 6) linear infinite; }
        .nex-orb-iris-${uid}     { animation: nex-orb-plasma-cw-${uid}  calc(${t.coreBreath} * 12) linear infinite; }
        @keyframes nex-orb-plasma-cw-${uid}  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes nex-orb-plasma-ccw-${uid} { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
        /* Pupil breath layered on top of the look-translate. The transition
           above handles smooth movement; this keyframe adds size/brightness. */
        .nex-orb-pupil-${uid} {
          animation: nex-orb-pupil-${uid} ${t.coreBreath} ease-in-out infinite;
        }
        @keyframes nex-orb-pupil-${uid} {
          0%, 100% { filter: brightness(1);   }
          50%      { filter: brightness(1.4); }
        }
        /* Vocal ribbons · sinusoidal undulation across the eye */
        @keyframes nex-orb-ribbon-${uid} {
          0%, 100% { transform: translateY(0)    scaleY(0.9); opacity: 0.5; }
          25%      { transform: translateY(-4%)  scaleY(1.2); opacity: 0.85; }
          50%      { transform: translateY(4%)   scaleY(0.7); opacity: 0.6;  }
          75%      { transform: translateY(-2%)  scaleY(1.05); opacity: 0.9;  }
        }
        @media (prefers-reduced-motion: reduce) {
          .nex-orb-outerglow-${uid}, .nex-orb-outerring-${uid}, .nex-orb-segment-${uid},
          .nex-orb-particle-${uid}, .nex-orb-plasma-a-${uid}, .nex-orb-plasma-b-${uid},
          .nex-orb-iris-${uid}, .nex-orb-pupil-${uid} { animation: none; }
        }
      `}</style>
    </button>
  );
}
