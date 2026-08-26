// NEX Aurora Dots · gentle "constellation is breathing" ambient life layer.
// 2026-08-24 · Philip greenlit "Aurora dots · twinkle" option:
//   · 18 fixed-position warm dots (orange @ low alpha)
//   · each dot has its own 5-9 s breathe cycle, phase-shifted so the
//     constellation never syncs (never reads as a canned loop)
//   · sub-pixel size (1-2 px) · 30-70 % opacity range
//   · runs at 60 fps · <1 % CPU · no distraction
//   · mounted BETWEEN artwork (z:1) and content (z:2) so it feels like the
//     constellation lives IN the ambient layer, not on top of the UI
//
// Architecture mirrors OrangeParticleField:
//   · canvas + requestAnimationFrame
//   · DPI-aware sizing
//   · pauses when document.hidden (saves power on backgrounded tabs)
//   · prefers-reduced-motion → single static frame, no animation
//   · per-mount seeded RNG so two sessions never twinkle identically

"use client";

import { useEffect, useRef } from "react";

// 18 dots per the doctrine · dense enough to feel like a constellation,
// sparse enough that no two ever crowd each other.
const DOT_COUNT = 18;

// 2026-08-24 · Philip · orange core + RED halo. Cream dots read too white
// against the artwork. NEX orange (249,115,22) core carries the brand,
// deep red (220,38,38) halo bleeds heat around each light so it reads as
// glowing embers, not white specks.
const DOT_R = 249;
const DOT_G = 115;
const DOT_B = 22;
const HALO_R = 220;
const HALO_G = 38;
const HALO_B = 38;

interface AuroraDot {
  /** Normalised x position in [0, 1] · multiplied by canvas width per resize. */
  nx: number;
  /** Normalised y position in [0, 1]. */
  ny: number;
  /** Pixel radius of the drawn circle · 1-2 px range per doctrine. */
  size: number;
  /** Phase offset (radians) · guarantees no two dots start at the same
   *  point in their breathe cycle. */
  phase: number;
  /** Radians per second · derived from a 5-9 s cycle (2π / period). */
  omega: number;
  /** Peak opacity for this dot · random within [0.30, 0.70]. */
  peakOpacity: number;
  /** Trough opacity for this dot · random within [0, 0.15] · so some dots
   *  actually go dark for a beat, others just dip. */
  troughOpacity: number;
}

/** Seed a constellation. Position picks avoid the edges by 4 % on each side
 *  so no dot ever gets clipped against the container. */
function seedConstellation(rng: () => number): AuroraDot[] {
  const dots: AuroraDot[] = [];
  for (let i = 0; i < DOT_COUNT; i++) {
    // Cycle period 5-9 s → omega = 2π / period
    const periodSec = 5 + rng() * 4;
    dots.push({
      nx: 0.04 + rng() * 0.92,
      ny: 0.04 + rng() * 0.92,
      // 2026-08-24 · bumped 1-2 px → 2-4 px so dots are actually visible.
      size: 2 + rng() * 2,
      phase: rng() * Math.PI * 2,
      omega: (Math.PI * 2) / periodSec,
      // 2026-08-24 · peak bumped 0.30-0.70 → 0.65-0.95 · trough bumped
      // 0.00-0.15 → 0.10-0.30 so dots never fully vanish but still visibly
      // dim between beats · combined with the halo glow (drawFrame below)
      // this reads as clear twinkling life.
      peakOpacity: 0.65 + rng() * 0.30,
      troughOpacity: 0.10 + rng() * 0.20,
    });
  }
  return dots;
}

export function NexAuroraDots() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Per-mount seed · fresh constellation every mount (page reload / route
  // change) so two sessions never breathe identically.
  const seedRef = useRef(mulberry32(Math.floor(Math.random() * 0xffffffff)));
  const dotsRef = useRef<AuroraDot[] | null>(null);
  if (dotsRef.current === null) {
    dotsRef.current = seedConstellation(seedRef.current);
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

    const dots = dotsRef.current!;

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
      ctx.clearRect(0, 0, width, height);
      for (const d of dots) {
        // Per-dot breath: opacity oscillates between troughOpacity and
        // peakOpacity via a sine wave phase-shifted by d.phase.
        // sin() → -1..1 · normalise to 0..1 for the interp.
        const breath = (Math.sin(tSec * d.omega + d.phase) + 1) * 0.5;
        const opacity = d.troughOpacity + (d.peakOpacity - d.troughOpacity) * breath;
        if (opacity < 0.02) continue;

        const sx = d.nx * width;
        const sy = d.ny * height;

        // Warm halo · radial gradient behind the core so each dot reads as
        // a tiny light source rather than a coloured pixel. Radius = 4× core
        // so the halo bleeds gently into the surrounding artwork.
        const haloR = d.size * 4;
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, haloR);
        grad.addColorStop(0,   `rgba(${HALO_R}, ${HALO_G}, ${HALO_B}, ${(opacity * 0.55).toFixed(3)})`);
        grad.addColorStop(0.5, `rgba(${HALO_R}, ${HALO_G}, ${HALO_B}, ${(opacity * 0.20).toFixed(3)})`);
        grad.addColorStop(1,   `rgba(${HALO_R}, ${HALO_G}, ${HALO_B}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sx, sy, haloR, 0, Math.PI * 2);
        ctx.fill();

        // Bright cream core · sits on top of the halo · this is what actually
        // reads as a "point of light" · same warm-cream family as the ember.
        ctx.fillStyle = `rgba(${DOT_R}, ${DOT_G}, ${DOT_B}, ${opacity.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, d.size, 0, Math.PI * 2);
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
      // Static frame · mid-breath so every dot shows at ~50 % of its peak.
      drawFrame(Math.PI / (2 * (dots[0]?.omega ?? 1)));
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
      data-testid="nex-aurora-dots"
      aria-hidden
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
