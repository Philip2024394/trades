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
  /** Override pupil transition duration (ms) · default 380. Parent sets 1000
   *  during chat launch follow so the pupil takes 1s to track the message. */
  pupilTransitionMs?: number;
  /** When false, disable internal 700ms auto-return timer · parent controls
   *  when to set lookAt back to null. Used during chat launch follow so the
   *  pupil holds on the departing message before returning. */
  autoReturn?: boolean;
  /** When true, override the orb palette with a red variant · used the
   *  split-second before a guidance laser fires so the eye reads "arming."
   *  Philip 2026-08-28: "eye ball should turn red · then line appears." */
  flashRed?: boolean;
  /** When true, NEX grows tiny black duck legs and hops DOWN out of her
   *  circle housing (Philip 2026-08-28). Toggled by double-tap in the shell. */
  hopped?: boolean;
  /** When true, personality scheduler runs FAST (0.35-0.7s gaps instead of
   *  0.8-1.9s). Reads as "curious/nosy" · used during layout transitions
   *  (full-width mode cinematic · Philip 2026-08-28) so she actively watches
   *  everything change. Anti-repeat still applies · just tighter cadence. */
  hyperMode?: boolean;
  /** When true, orb progressively shrinks MORE (PERCH_SCALE) during float
   *  to the corner · 1200ms transition syncs with the perch translate in
   *  NexHudFrame so scale + position animate together. Philip 2026-08-28. */
  perched?: boolean;
}

interface Palette {
  core: string; glow: string; glowSoft: string;
  wave: string; particle: string; circuit: string; label: string;
}
// Palette · Philip 2026-08-29 · CYAN IDLE + ORANGE SPEAKING.
// She watches in cool cyan, warms up to orange when she talks. Sits well
// against the brushed-metal chat bg (dark neutral makes cyan pop) while
// preserving NEX's brand orange for engaged/action moments.
//   idle      · cyan   (was orange)
//   listening · bright cyan · brighter+whiter cyan reads as "more awake"
//   thinking  · purple (unchanged · unique state)
//   speaking  · orange (was cyan) · brand warm on engagement
//   error     · red    (unchanged)
const PALETTE: Record<NexVoiceState, Palette> = {
  idle:      { core: "#4ac9ff", glow: "rgba(74,201,255,0.55)",  glowSoft: "rgba(74,201,255,0.18)",  wave: "#38bdf8", particle: "#bae6fd", circuit: "rgba(74,201,255,0.45)",  label: "NEX · ready" },
  listening: { core: "#a3e2ff", glow: "rgba(74,201,255,0.90)",  glowSoft: "rgba(74,201,255,0.35)",  wave: "#7dd3fc", particle: "#e0f2fe", circuit: "rgba(74,201,255,0.75)",  label: "NEX · listening" },
  thinking:  { core: "#c084fc", glow: "rgba(168,85,247,0.80)",  glowSoft: "rgba(168,85,247,0.28)",  wave: "#a855f7", particle: "#e9d5ff", circuit: "rgba(168,85,247,0.65)",  label: "NEX · thinking" },
  speaking:  { core: "#fb923c", glow: "rgba(249,115,22,0.85)",  glowSoft: "rgba(249,115,22,0.30)",  wave: "#f97316", particle: "#fed7aa", circuit: "rgba(249,115,22,0.70)",  label: "NEX · speaking" },
  error:     { core: "#fb7185", glow: "rgba(244,63,94,0.55)",   glowSoft: "rgba(244,63,94,0.18)",   wave: "#f43f5e", particle: "#fecdd3", circuit: "rgba(244,63,94,0.35)",   label: "NEX · retry" },
};
// Guidance-arming DARK NEON RED palette (Philip 2026-08-28 · "beam must be
// red color DARK NEON"). Deep saturated red · reads as menacing laser
// charging · not the bright pink-red variant.
const RED_PALETTE: Palette = {
  core:     "#c40027",
  glow:     "rgba(196,0,39,1.00)",
  glowSoft: "rgba(196,0,39,0.55)",
  wave:     "#e02040",
  particle: "#ff8090",
  circuit:  "rgba(196,0,39,0.95)",
  label:    "NEX · guiding",
};

interface Timing {
  coreBreath: string; ringSpin: string; segmentTravel: string;
  particleOrbit: string; circuitFlash: string; waveformScale: number;
}
// Philip 2026-08-29 · timings boosted for mobile visibility.
// Idle state was too subtle on small screens · sped up + amplified so
// the orb reads clearly "alive" on a 390×844 viewport. Speaking already
// active enough · left near-original.
const TIMING: Record<NexVoiceState, Timing> = {
  idle:      { coreBreath: "3.2s", ringSpin: "22s", segmentTravel: "6s",   particleOrbit: "14s", circuitFlash: "4.5s", waveformScale: 0.95 },
  listening: { coreBreath: "1.4s", ringSpin: "14s", segmentTravel: "3s",   particleOrbit: "7s",  circuitFlash: "2.4s", waveformScale: 1.6 },
  thinking:  { coreBreath: "2.0s", ringSpin: "8s",  segmentTravel: "2.6s", particleOrbit: "5s",  circuitFlash: "2.2s", waveformScale: 1.1 },
  speaking:  { coreBreath: "0.95s",ringSpin: "10s", segmentTravel: "2.2s", particleOrbit: "6s",  circuitFlash: "1.4s", waveformScale: 2.0 },
  error:     { coreBreath: "2.6s", ringSpin: "36s", segmentTravel: "10s",  particleOrbit: "18s", circuitFlash: "7s",   waveformScale: 0.7 },
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

// Philip 2026-08-29 · particle sizes + opacities bumped ~30% so orbiting
// dots read clearly on mobile (390-wide) · previous values were tuned
// for desktop preview.
const PARTICLES = [
  { radiusPct: 34, sizePct: 4.2, phase:   0, opacity: 1.0 },
  { radiusPct: 40, sizePct: 3.2, phase:  70, opacity: 0.9 },
  { radiusPct: 32, sizePct: 2.8, phase: 140, opacity: 0.95 },
  { radiusPct: 42, sizePct: 3.4, phase: 200, opacity: 0.9 },
  { radiusPct: 36, sizePct: 2.6, phase: 260, opacity: 0.85 },
  { radiusPct: 44, sizePct: 3.0, phase: 320, opacity: 0.9 },
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
  finalPos, palette, className, transitionMs, pulseScale,
}: {
  finalPos: { x: number; y: number };
  palette: Palette;
  className: string;
  transitionMs: number;
  pulseScale: number;
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
        transform: `translate(-50%, -50%) scale(${pulseScale})`,
        transition: `top ${transitionMs}ms cubic-bezier(0.34, 1.56, 0.64, 1), left ${transitionMs}ms cubic-bezier(0.34, 1.56, 0.64, 1), transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
        width: "10%", height: "10%",
        borderRadius: "50%",
        background: `radial-gradient(circle at 40% 35%, #ffffff 0%, ${palette.particle} 30%, ${palette.core} 70%, transparent 100%)`,
        boxShadow: `0 0 16px ${palette.glow}, 0 0 32px ${palette.glowSoft}`,
        pointerEvents: "none",
      }}
    />
  );
}

// Short jump distance (Philip 2026-08-28 · "jump must be short"). She hops
// down just below her circle housing then shrinks · her halo stays with her.
const HOP_DISTANCE_PX = 55;
// How much she shrinks when hopped down · her outer glow/ring stay
// proportionally around her (Philip 2026-08-28 · "circle around her becomes
// smaller in size but still floating around her"). Bumped 0.55 → 0.75 per
// Philip: "increase her size more when she jumps down."
const HOP_SCALE = 0.75;
// PERCH_SCALE was 0.5 (progressive shrink · Philip felt she got too small).
// Philip 2026-08-28 revised: "your original when jump down and she floating
// to corner was correct size for her" · locking PERCH_SCALE = HOP_SCALE so
// she keeps her hopped size all the way through the float + perch. The
// halo/glow scale stays consistent from jump through arrival.
const PERCH_SCALE = 0.75;

export function NexVoiceOrb({
  nexState, onTap, size = "100%", lookAt = null,
  pupilTransitionMs = 380, autoReturn = true, flashRed = false,
  hopped = false, hyperMode = false, perched = false,
}: Props) {
  // Final scale composed from both hopped + perched states.
  // Progressive shrinkage: normal (1) → hopped (0.75) → perched (0.5).
  const finalScale = perched ? PERCH_SCALE : hopped ? HOP_SCALE : 1;
  // Transition duration matches whichever phase is longer · during perch
  // float we want the 1200ms slow ease so scale + position glide together.
  const wrapperTransition = perched
    ? "transform 1200ms cubic-bezier(0.25, 0.46, 0.45, 0.94)"
    : "transform 550ms cubic-bezier(0.34, 1.56, 0.64, 1)";
  const p = flashRed ? RED_PALETTE : PALETTE[nexState];
  const t = TIMING[nexState];
  const uid = React.useId().replace(/:/g, "");

  // ── EYE LOOK STATE ─────────────────────────────────────────────────────
  const [effectiveLook, setEffectiveLook] = useState<OrbLookDirection>("center");
  const [drift, setDrift]         = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [pulseScale, setPulseScale] = useState(1);
  const returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Respond to explicit lookAt prop · auto-return after 700ms UNLESS the
  // parent has set autoReturn=false (chat launch follow · parent controls).
  useEffect(() => {
    if (!lookAt || lookAt === "center") {
      setEffectiveLook("center");
      return;
    }
    setEffectiveLook(lookAt);
    if (returnTimer.current) clearTimeout(returnTimer.current);
    if (autoReturn) {
      returnTimer.current = setTimeout(() => setEffectiveLook("center"), 700);
    }
    return () => {
      if (returnTimer.current) clearTimeout(returnTimer.current);
    };
  }, [lookAt, autoReturn]);

  // ── PERSONALITY SCHEDULER ──────────────────────────────────────────────
  // Philip 2026-08-28: "ball never stops moving for more than 2 seconds ·
  // must feel alive not programmed · no repeated motions within short window."
  //
  // Every 0.8-1.9s pick a random action from a weighted library. Anti-repeat
  // memory (last 4 action ids) so the pupil doesn't do the same thing twice
  // in a row. Runs only when the pupil is at centre AND we're not being
  // externally controlled (launch follow etc).
  useEffect(() => {
    if (effectiveLook !== "center" || !autoReturn) return;

    let cancelled = false;
    const recent: string[] = [];

    type Action = { id: string; weight: number; run: () => void };
    const actions: Action[] = [
      // Micro-drift · most common · subtle random offset within centre
      { id: "drift-a", weight: 3, run: () => setDrift({ x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 6 }) },
      { id: "drift-b", weight: 3, run: () => setDrift({ x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 4 }) },
      { id: "drift-c", weight: 2, run: () => setDrift({ x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 8 }) },
      // Pupil pulse · brief scale-up · reads as "spark" or blink of attention
      { id: "pulse-s", weight: 2, run: () => { setPulseScale(1.18); setTimeout(() => !cancelled && setPulseScale(1), 200); } },
      { id: "pulse-m", weight: 1, run: () => { setPulseScale(1.28); setTimeout(() => !cancelled && setPulseScale(1), 240); } },
      { id: "pulse-quick", weight: 1, run: () => { setPulseScale(1.12); setTimeout(() => !cancelled && setPulseScale(1), 140); } },
      // Directional glances · varied · anti-repeat prevents same direction back-to-back
      { id: "look-up-left",  weight: 1, run: () => scheduleGlance("up-left",  480 + Math.random() * 300) },
      { id: "look-up-right", weight: 1, run: () => scheduleGlance("up-right", 480 + Math.random() * 300) },
      { id: "look-up",       weight: 1, run: () => scheduleGlance("up",       500 + Math.random() * 400) },
      { id: "look-left",     weight: 1, run: () => scheduleGlance("left",     380 + Math.random() * 300) },
      { id: "look-right",    weight: 1, run: () => scheduleGlance("right",    380 + Math.random() * 300) },
      // Quick darts · very short glances · reads as "she noticed something"
      { id: "dart-ul", weight: 1, run: () => scheduleGlance("up-left",  180 + Math.random() * 80) },
      { id: "dart-ur", weight: 1, run: () => scheduleGlance("up-right", 180 + Math.random() * 80) },
    ];

    function scheduleGlance(dir: OrbLookDirection, holdMs: number) {
      setEffectiveLook(dir);
      setTimeout(() => { if (!cancelled) setEffectiveLook("center"); }, holdMs);
    }

    function pickAction(): Action {
      const available = actions.filter((a) => !recent.includes(a.id));
      const pool = available.length > 0 ? available : actions;
      const total = pool.reduce((s, a) => s + a.weight, 0);
      let r = Math.random() * total;
      for (const a of pool) {
        r -= a.weight;
        if (r <= 0) return a;
      }
      return pool[pool.length - 1];
    }

    function loop() {
      if (cancelled) return;
      // Hyper mode: 0.35-0.7s · Normal: 0.8-1.9s (max 2s gap rule).
      // Hyper reads as "she's actively watching everything happen."
      const gap = hyperMode
        ? 350 + Math.random() * 350
        : 800 + Math.random() * 1100;
      setTimeout(() => {
        if (cancelled) return;
        const action = pickAction();
        action.run();
        recent.unshift(action.id);
        if (recent.length > 4) recent.pop();
        loop();
      }, gap);
    }
    loop();

    return () => { cancelled = true; };
  }, [effectiveLook, autoReturn, hyperMode]);

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
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        aspectRatio: "1 / 1",
        // Outer wrapper · composes HOP (translate) + SHRINK (progressive scale)
        // in one transform. Scale drops further when perched (float to corner)
        // so she shrinks progressively as she approaches destination.
        transform: `translateY(${hopped ? HOP_DISTANCE_PX : 0}px) scale(${finalScale})`,
        transformOrigin: "center center",
        transition: wrapperTransition,
      }}
    >
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
        width: "100%",
        height: "100%",
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
        transitionMs={pupilTransitionMs}
        pulseScale={pulseScale}
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
    </div>
  );
}
