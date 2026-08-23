// NEX home · reactive orange particle field · RADIAL CLOUD (2026-08-23).
//
// Refactored from the previous perspective grid ("floor of dots") that made
// the field feel like a rectangular orange sheet at the bottom of the screen.
// This version renders a RADIAL CLOUD around a focal point (the NEX voice
// orb position, bottom-centre). Density and opacity fall off exponentially
// with distance from the focal point, so the field dissolves naturally into
// the black background — no visible rectangular boundary, no obvious grid
// pattern, no solid orange sheet.
//
// Refinement doctrine (project_nex_ui_refinement_over_redesign_2026_08_23):
//   · This is a REFINEMENT of the existing particle system, not a redesign.
//   · Preserves: 4-state reactivity (idle/listening/thinking/speaking) ·
//     NEX orange colour · Page Visibility pause · reduced-motion respect ·
//     smooth state transitions · per-mount seeded randomness.
//   · Changes: geometry (grid → radial cloud) · visual footprint (rectangle → soft fade).
//
// Four states drive the field's energy:
//   · idle      : quiet breathing · dim · sparse activity around the orb
//   · listening : attentive · brighter · nearby dots respond
//   · thinking  : deliberate cadence · medium activity
//   · speaking  : full energy · strong central bump · outward propagation
//
// Uses canvas + requestAnimationFrame · DPI-aware · pauses when tab hidden.
// Respects prefers-reduced-motion via a single static frame.

"use client";

import { useEffect, useRef } from "react";
import type { NexState } from "./NexAppHome";

// ─── Energy profiles per NEX state ──────────────────────────

type EnergyProfile = {
  brightness: number;   // 0..1 · global opacity multiplier
  breathAmp: number;    // 0..1 · per-particle breathing amplitude
  bumpGain: number;     // 0..1 · speaking/listening pulse gain
  bumpFreq: number;     // Hz-ish · rate of pulse oscillation
};

// bumpGain values · staged refinement 2026-08-23:
//   Iteration A (85→50 speaking): pulse felt like a visualiser, dialled down.
//   Iteration B (50→72 speaking): Philip: "when nex talking they flashing more
//     fresh" · bumped back up for a livelier, more atmospheric flash — still
//     tighter than the original visualiser feel via the radial attenuation.
// Listening/thinking follow the same "fresh but restrained" spirit.
const PROFILES: Record<NexState, EnergyProfile> = {
  idle:      { brightness: 0.55, breathAmp: 0.25, bumpGain: 0.04, bumpFreq: 0.5 },
  listening: { brightness: 0.80, breathAmp: 0.35, bumpGain: 0.45, bumpFreq: 1.6 },
  thinking:  { brightness: 0.70, breathAmp: 0.30, bumpGain: 0.30, bumpFreq: 1.0 },
  speaking:  { brightness: 0.95, breathAmp: 0.42, bumpGain: 0.72, bumpFreq: 2.0 },
};

// Smooth interpolation between profiles so state changes glide rather than snap.
const PROFILE_LERP_TAU = 0.35;

function lerpProfile(from: EnergyProfile, to: EnergyProfile, alpha: number): EnergyProfile {
  const a = Math.max(0, Math.min(1, alpha));
  return {
    brightness: from.brightness + (to.brightness - from.brightness) * a,
    breathAmp:  from.breathAmp  + (to.breathAmp  - from.breathAmp)  * a,
    bumpGain:   from.bumpGain   + (to.bumpGain   - from.bumpGain)   * a,
    bumpFreq:   from.bumpFreq   + (to.bumpFreq   - from.bumpFreq)   * a,
  };
}

// ─── Particle · a single dot in the cloud ─────────────────────

interface Particle {
  /** World-space position · (0, 0) is the focal point.
   *  Radial distance can exceed 1 for particles that drift beyond the strong zone. */
  x: number;
  y: number;
  /** Base radial distance at seed time · cached for the falloff computation
   *  (recomputed rather than re-sqrt'd every frame). */
  radius: number;
  /** Pixel radius of the drawn circle (varies per-particle for depth). */
  size: number;
  /** Base opacity multiplier (0..1) — varies per-particle so field feels irregular. */
  opacityBase: number;
  /** Phase offset for this particle's breathing so no two breathe together. */
  phaseOffset: number;
  /** Per-particle frequency multiplier so the cloud never mechanically repeats. */
  freqA: number;
  /** Slight per-frame drift so particles feel alive, not fixed. */
  driftAmp: number;
  driftFreq: number;
  driftPhase: number;
}

/** Number of particles in the cloud · dense enough to feel like an environment,
 *  sparse enough to render at 60fps on the 8GB Victus machine. */
const PARTICLE_COUNT = 320;

/** Radial-density power · higher = more centrally concentrated.
 *  1.0 = uniform disk · 1.5 = mildly central · 2.5 = strongly central.
 *  2026-08-23 · bumped 1.6 → 2.0 per Philip "more compact area in center of the
 *  brand hero" · tighter concentration at the focal point. */
const RADIAL_POWER = 2.0;

/** Radial-opacity falloff exponent · higher = faster dissolve into black.
 *  2026-08-23 · bumped 1.7 → 2.3 · outer particles fade faster · cloud reads
 *  as a compact hero-centred halo rather than a wider ambient wash. */
const RADIAL_FALLOFF = 2.3;

/** Seed a radial cloud of particles centred on (0, 0) in world space.
 *  Uses the provided pseudo-random source so it can be seeded per mount. */
function seedCloud(count: number, rng: () => number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    // Uniform angle around the focal point
    const angle = rng() * Math.PI * 2;
    // Radial distance biased toward centre via power distribution.
    // 2026-08-23 · max radius 1.35 → 1.05 · tighter cloud, no outer stragglers.
    const radius = Math.pow(rng(), RADIAL_POWER) * 1.05;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    particles.push({
      x, y,
      radius,
      size: 0.6 + rng() * 1.8,        // 0.6..2.4 px · irregular sizes for depth
      opacityBase: 0.20 + rng() * 0.55, // 0.20..0.75 · irregular brightness
      phaseOffset: rng() * Math.PI * 2,
      freqA: 0.5 + rng() * 1.1,         // 0.5..1.6
      // driftAmp base bumped 0.008 → 0.011 (2026-08-23 · Philip mobile screenshot).
      // Result: per-particle wander ~35% more visible on mobile · calm frequency
      // unchanged so motion stays atmospheric, not distracting.
      driftAmp: 0.011 + rng() * 0.014,
      driftFreq: 0.3 + rng() * 0.5,
      driftPhase: rng() * Math.PI * 2,
    });
  }
  return particles;
}

export function OrangeParticleField({ nexState }: { nexState: NexState }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<NexState>(nexState);
  useEffect(() => {
    stateRef.current = nexState;
  }, [nexState]);

  // Per-mount seed so no two sessions animate identically.
  const seedRef = useRef({
    rng: mulberry32(Math.floor(Math.random() * 0xffffffff)),
    // Speaking bump timing · irregular smooth pulses
    bumpPhase: Math.random() * Math.PI * 2,
    bumpFreqShift: 0.85 + Math.random() * 0.3,
  });

  // Live-lerped profile so state changes glide instead of snap
  const liveProfileRef = useRef<EnergyProfile>(PROFILES[nexState] ?? PROFILES.idle);

  // Particle cloud (memoised via ref · seeded once at mount)
  const particlesRef = useRef<Particle[] | null>(null);
  if (particlesRef.current === null) {
    particlesRef.current = seedCloud(PARTICLE_COUNT, seedRef.current.rng);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;
    let raf = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let start = performance.now();
    let lastFrameSec = 0;

    const particles = particlesRef.current!;
    const seed = seedRef.current;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    const onVis = () => {
      if (document.hidden) {
        running = false;
        if (raf) cancelAnimationFrame(raf);
      } else if (!prefersReducedMotion) {
        running = true;
        start = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const drawFrame = (tSec: number) => {
      // Smooth profile transition
      const target = PROFILES[stateRef.current];
      const dt = Math.max(0, Math.min(0.1, tSec - lastFrameSec));
      lastFrameSec = tSec;
      const alpha = 1 - Math.exp(-dt / PROFILE_LERP_TAU);
      liveProfileRef.current = lerpProfile(liveProfileRef.current, target, alpha);
      const profile = liveProfileRef.current;

      // Focal point in screen coords · UPPER-CENTRE around the NEX brand hero.
      // 2026-08-23 refinements (staged):
      //   · Iteration A (0.88 → 0.28): moved from voice-orb to hero area.
      //   · Iteration B (0.28 → 0.20): "move up little" + "compact around hero".
      //   · Iteration C (0.20 → 0.10): Philip · "move them more to center of
      //     hero area" · focal now lands directly over the hero image itself
      //     (hero maxHeight 72 · header pad-top ~12 · hero centre ~48 px from
      //     viewport top ≈ 7-10% of a 667 px mobile viewport).
      const focalX = width * 0.5;
      const focalY = height * 0.10;

      // World-to-screen scale: world radius 1 spans ~55% of viewport width.
      // This keeps the cloud tightly around the orb rather than filling the screen.
      const scale = Math.max(width, height) * 0.55;

      // Speaking/listening/etc. "bump" energy · smooth non-repeating oscillator
      const bumpPhase = tSec * seed.bumpFreqShift * profile.bumpFreq * Math.PI * 2 + seed.bumpPhase;
      const b1 = Math.sin(bumpPhase);
      const b2 = Math.sin(bumpPhase * 0.41);
      const bumpEnergy = Math.max(0, b1 * 0.6 + b2 * 0.4) * profile.bumpGain;

      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        // Radial opacity falloff · particles beyond ~radius 1.5 become invisible.
        // This is what removes the rectangular-sheet appearance — the visible
        // field is naturally circular, and its edges are soft.
        const radialFalloff = Math.exp(-p.radius * RADIAL_FALLOFF);

        // Skip particles whose base opacity × falloff is already invisible
        if (radialFalloff < 0.02) continue;

        // 2026-08-23 · vertical asymmetric decay · INVERTED to match the new
        // upper focal point (Philip: "move the nex voice dots back to hero area").
        // Focal is now at the upper hero area · so particles BELOW the focal
        // (p.y > 0 in world space · deeper into the conversation zone) fade
        // rather than compete with the chat and results. Softer decay (0.9 vs
        // previous 1.4) so the transition from hero-cloud to chat-space is
        // gradual and atmospheric, not abrupt.
        const verticalDecay = p.y <= 0 ? 1.0 : Math.exp(-p.y * 0.9);
        if (verticalDecay < 0.03) continue;

        // Per-particle breathing · phase-shifted so no two synchronise
        const breath =
          Math.sin(tSec * p.freqA + p.phaseOffset) * profile.breathAmp + (1 - profile.breathAmp * 0.5);

        // Speaking bump amplifies near-focal particles more than distant ones.
        // 2026-08-23 refinements: radial attenuation 1.8 (kept, tight pulse
        // around the hero). Opacity boost from 0.6 → 0.85 per Philip "flashing
        // more fresh" — livelier speaking response without becoming a visualiser.
        const bumpContribution = bumpEnergy * Math.exp(-p.radius * 1.8);
        const opacity =
          p.opacityBase *
          radialFalloff *
          verticalDecay *
          profile.brightness *
          Math.max(0.15, breath) *
          (1 + bumpContribution * 0.85);

        if (opacity < 0.015) continue;

        // Tiny world-space drift · keeps the cloud alive
        const driftX = Math.sin(tSec * p.driftFreq + p.driftPhase) * p.driftAmp;
        const driftY = Math.cos(tSec * p.driftFreq * 0.7 + p.driftPhase) * p.driftAmp;

        const sx = focalX + (p.x + driftX) * scale;
        const sy = focalY + (p.y + driftY) * scale;

        // Skip particles that would draw outside the canvas
        if (sx < -4 || sx > width + 4 || sy < -4 || sy > height + 4) continue;

        // 2026-08-23 refinements: size growth from speaking pulse 0.20 → 0.32
        // per Philip "flashing more fresh" · particles pop slightly bigger on
        // beats · still restrained overall (was 0.35 originally, this sits
        // between the two extremes).
        const size = p.size * (1 + bumpContribution * 0.32);

        ctx.fillStyle = `rgba(249, 115, 22, ${opacity.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = (now: number) => {
      if (!running) return;
      const tSec = (now - start) / 1000;
      drawFrame(tSec);
      raf = requestAnimationFrame(loop);
    };

    if (prefersReducedMotion) {
      drawFrame(0);
    } else {
      raf = requestAnimationFrame(loop);
    }

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
      }}
      data-testid="orange-particle-field-radial"
    />
  );
}

// ─── PRNG · mulberry32 · deterministic small seed → good-enough randomness ─

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
