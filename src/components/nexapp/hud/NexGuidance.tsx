// NEX PRECISION GUIDANCE BEAM · reusable system.
//
// Doctrine (Philip 2026-08-26): the eye can look · listen · speak · and when
// necessary POINT. A thin optical guidance beam travels from the pupil to a
// registered UI target, briefly illuminating it. Used sparingly to teach the
// interface or guide the user to something NEX just mentioned.
//
// Architecture:
//   - NexGuidanceProvider     · owns the target registry + active-beam state
//   - useGuidanceTarget(id)   · hook · returns a ref to attach to an element
//   - useGuidance()           · hook · exposes fireBeam(targetId, options)
//   - NexGuidanceBeamOverlay  · fixed full-viewport SVG · renders active beam
//
// Design constraints:
//   · Beam origin = pupil rect centre (registered as target id "pupil")
//   · Beam terminus = target rect centre from live getBoundingClientRect()
//   · Recalculates on window resize
//   · pointer-events: none · never blocks user clicks
//   · Thin core (1.5px) + soft glow · not a weapon laser
//   · Target pulse on arrival · fades in ~1000ms total
//   · Concurrent beams supported (rarely useful · but the architecture allows)

"use client";

import React, {
  createContext, useCallback, useContext, useEffect,
  useLayoutEffect, useMemo, useRef, useState,
} from "react";

// ── PUBLIC TYPES ───────────────────────────────────────────────────────────

export type GuidanceTargetId =
  | "pupil"
  | "voice-button" | "composer-input" | "send-button"
  | "rail-profile" | "rail-favorites" | "rail-history" | "rail-services" | "rail-food"
  | "header-search" | "header-alerts" | "header-menu"
  | "context-card"
  | "workspace"
  | "food-card-first"
  | (string & {}); // allow other custom ids (e.g. dynamic "restaurant-card-{id}")

interface FireBeamOptions {
  /** Milliseconds the beam is visible before fade-out. Default 900. */
  dwellMs?: number;
  /** Delay before beam fires (arming phase · lets eye go RED first).
   *  Default 1000 (Philip 2026-08-28: "eye ball turns same 1 second before
   *  she activates the line"). During this window the eye flashes neon red
   *  via the flashRed prop while the laser charges. */
  fireDelayMs?: number;
  /** Optional origin target id. Default "pupil". */
  from?: GuidanceTargetId;
  /** When false, skip the 5-second burn/smoke effect at impact target.
   *  Default true (existing behavior). Butterfly cinematic passes false
   *  so the laser CONNECTS without harming the butterfly (Philip 2026-08-28). */
  spawnBurn?: boolean;
}

interface ActiveBeam {
  id:           number;
  from:         GuidanceTargetId;
  to:           GuidanceTargetId;
  phase:        "arming" | "firing" | "fading";
  createdAt:    number;
  dwellMs:      number;
  spawnBurn:    boolean;
}

interface GuidanceApi {
  registerTarget:   (id: GuidanceTargetId, el: HTMLElement | null) => void;
  fireBeam:         (to: GuidanceTargetId, opts?: FireBeamOptions) => void;
  cancelBeams:      () => void;
  /** Read-only · beam overlay subscribes to this to render. */
  activeBeams:      ActiveBeam[];
  /** Read-only · target registry · beam overlay reads rects from these. */
  targets:          Map<GuidanceTargetId, HTMLElement>;
}

const GuidanceContext = createContext<GuidanceApi | null>(null);

// ── PROVIDER ───────────────────────────────────────────────────────────────

export function NexGuidanceProvider({ children }: { children: React.ReactNode }) {
  const targetsRef = useRef<Map<GuidanceTargetId, HTMLElement>>(new Map());
  const [activeBeams, setActiveBeams] = useState<ActiveBeam[]>([]);
  const nextIdRef = useRef(1);

  const registerTarget = useCallback((id: GuidanceTargetId, el: HTMLElement | null) => {
    if (el) targetsRef.current.set(id, el);
    else    targetsRef.current.delete(id);
  }, []);

  const fireBeam = useCallback((to: GuidanceTargetId, opts: FireBeamOptions = {}) => {
    const dwellMs     = opts.dwellMs     ?? 900;
    const fireDelayMs = opts.fireDelayMs ?? 1000;
    const from        = opts.from        ?? "pupil";
    const spawnBurn   = opts.spawnBurn   ?? true;
    const id          = nextIdRef.current++;
    const createdAt   = Date.now();

    // Phase 1 · arming (pupil settling · beam not yet visible).
    setActiveBeams((cur) => [...cur, { id, from, to, phase: "arming", createdAt, dwellMs, spawnBurn }]);

    // Phase 2 · firing (beam visible).
    setTimeout(() => {
      setActiveBeams((cur) => cur.map((b) => b.id === id ? { ...b, phase: "firing" } : b));
    }, fireDelayMs);

    // Phase 3 · fading.
    setTimeout(() => {
      setActiveBeams((cur) => cur.map((b) => b.id === id ? { ...b, phase: "fading" } : b));
    }, fireDelayMs + dwellMs);

    // Phase 4 · remove.
    setTimeout(() => {
      setActiveBeams((cur) => cur.filter((b) => b.id !== id));
    }, fireDelayMs + dwellMs + 250);
  }, []);

  const cancelBeams = useCallback(() => setActiveBeams([]), []);

  const api = useMemo<GuidanceApi>(() => ({
    registerTarget,
    fireBeam,
    cancelBeams,
    activeBeams,
    targets: targetsRef.current,
  }), [registerTarget, fireBeam, cancelBeams, activeBeams]);

  return (
    <GuidanceContext.Provider value={api}>
      {children}
    </GuidanceContext.Provider>
  );
}

// ── HOOKS ──────────────────────────────────────────────────────────────────

/** Attach to any element that NEX may point at. Returns a ref callback. */
export function useGuidanceTarget(id: GuidanceTargetId) {
  const api = useContext(GuidanceContext);
  const ref = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    api?.registerTarget(id, ref.current);
    return () => api?.registerTarget(id, null);
  }, [api, id]);
  // Return a callback ref that also updates our internal ref.
  return useCallback((el: HTMLElement | null) => {
    ref.current = el;
    api?.registerTarget(id, el);
  }, [api, id]);
}

export function useGuidance(): GuidanceApi {
  const api = useContext(GuidanceContext);
  if (!api) throw new Error("useGuidance must be used inside NexGuidanceProvider");
  return api;
}

// ── OVERLAY · draws active beams ───────────────────────────────────────────

interface BeamLine {
  id:   number;
  x1:   number; y1: number;
  x2:   number; y2: number;
  phase: "arming" | "firing" | "fading";
}

// Burn/smoke effect that lingers at the target after the beam impacts.
// Philip 2026-08-28: "smoke rise from the end of the beam like burnt or
// effect at end of the beam like fire · 5 seconds."
interface BurnMark {
  id:        number;
  x:         number;
  y:         number;
  createdAt: number;
  particles: Array<{ dx: number; delay: number; duration: number; size: number }>;
}
const BURN_LIFETIME_MS = 5000;
const SMOKE_PARTICLE_COUNT = 10;

function generateBurnParticles(): BurnMark["particles"] {
  return Array.from({ length: SMOKE_PARTICLE_COUNT }).map(() => ({
    dx:       (Math.random() - 0.5) * 24,   // horizontal drift ±12px
    delay:    Math.random() * 2.5,          // stagger 0-2.5s
    duration: 1.8 + Math.random() * 1.6,    // 1.8-3.4s rise
    size:     2 + Math.random() * 3,        // 2-5px base radius
  }));
}

export function NexGuidanceBeamOverlay() {
  const api = useContext(GuidanceContext);
  const [lines, setLines] = useState<BeamLine[]>([]);
  const [burns, setBurns] = useState<BurnMark[]>([]);
  const spawnedBurnsRef = useRef<Set<number>>(new Set());
  const rafRef = useRef<number | null>(null);
  const nextBurnIdRef = useRef(1);

  // rAF loop · recomputes beam endpoints from live DOM every frame while a
  // beam is active. Handles window resize / layout shifts / orb pupil drift
  // without any extra listeners.
  useEffect(() => {
    if (!api) return;
    const tick = () => {
      const next: BeamLine[] = [];
      const newBurns: BurnMark[] = [];
      for (const beam of api.activeBeams) {
        const fromEl = api.targets.get(beam.from);
        const toEl   = api.targets.get(beam.to);
        if (!fromEl || !toEl) continue;
        const a = fromEl.getBoundingClientRect();
        const b = toEl.getBoundingClientRect();
        const x2 = b.left + b.width / 2;
        const y2 = b.top  + b.height / 2;
        next.push({
          id:  beam.id,
          x1:  a.left + a.width / 2,
          y1:  a.top  + a.height / 2,
          x2, y2,
          phase: beam.phase,
        });
        // Spawn a burn mark ONCE per beam when it enters firing phase ·
        // this is the moment the laser "hits" the target. Skipped when
        // beam.spawnBurn is false (butterfly cinematic · beam CONNECTS
        // without harming · Philip 2026-08-28).
        if (beam.phase === "firing" && beam.spawnBurn && !spawnedBurnsRef.current.has(beam.id)) {
          spawnedBurnsRef.current.add(beam.id);
          newBurns.push({
            id:        nextBurnIdRef.current++,
            x: x2, y: y2,
            createdAt: Date.now(),
            particles: generateBurnParticles(),
          });
        }
      }
      setLines(next);
      if (newBurns.length > 0) {
        setBurns((prev) => [...prev, ...newBurns]);
        // Auto-remove each burn after BURN_LIFETIME_MS
        newBurns.forEach((burn) => {
          setTimeout(() => {
            setBurns((prev) => prev.filter((b) => b.id !== burn.id));
          }, BURN_LIFETIME_MS);
        });
      }
      if (api.activeBeams.length > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    if (api.activeBeams.length > 0) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      setLines([]);
      // Reset spawn tracking when no beams active so a new beam spawns cleanly
      spawnedBurnsRef.current.clear();
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [api, api?.activeBeams]);

  // Render if there's an active beam OR a lingering burn mark
  if (!api || (lines.length === 0 && burns.length === 0)) return null;

  return (
    <svg
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 60,
      }}
    >
      <defs>
        <filter id="nex-beam-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="soft" />
          <feMerge>
            <feMergeNode in="soft" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* CSS keyframes for smoke rise + fire flicker · scoped to the overlay. */}
      <defs>
        <style>{`
          @keyframes nex-smoke-rise {
            0%   { transform: translate(0, 0)    scale(0.6); opacity: 0;    }
            15%  { opacity: 0.55; }
            100% { transform: translate(var(--dx, 0), -70px) scale(2.2);    opacity: 0; }
          }
          @keyframes nex-fire-flicker {
            0%, 100% { opacity: 0.9; transform: scale(1);    }
            50%      { opacity: 0.6; transform: scale(1.18); }
          }
          @keyframes nex-ember-pulse {
            0%, 100% { opacity: 0.75; }
            50%      { opacity: 1;    }
          }
          @keyframes nex-burn-fade {
            0%,  55% { opacity: 1; }
            100%     { opacity: 0; }
          }
        `}</style>
      </defs>

      {/* Burn / smoke effect · lingers 5s at each beam-impact target ·
          whole group fades out over its lifetime via nex-burn-fade keyframe */}
      {burns.map((burn) => {
        return (
          <g
            key={`burn-${burn.id}`}
            style={{ animation: `nex-burn-fade ${BURN_LIFETIME_MS}ms linear forwards` }}
          >
            {/* Outer scorch glow · slow flicker · reads as embers */}
            <circle
              cx={burn.x} cy={burn.y} r={16}
              fill="#c40027" opacity={0.35}
              filter="url(#nex-beam-glow)"
              style={{
                transformOrigin: `${burn.x}px ${burn.y}px`,
                animation: "nex-fire-flicker 0.42s ease-in-out infinite",
              }}
            />
            {/* Hot core ember */}
            <circle
              cx={burn.x} cy={burn.y} r={5}
              fill="#ff8830" opacity={0.85}
              style={{
                transformOrigin: `${burn.x}px ${burn.y}px`,
                animation: "nex-ember-pulse 0.7s ease-in-out infinite",
              }}
            />
            {/* Smoke particles · rise UP with random drift · fade + expand */}
            {burn.particles.map((p, i) => (
              <circle
                key={i}
                cx={burn.x} cy={burn.y} r={p.size}
                fill="#4a4a4a" opacity={0}
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "center",
                  ["--dx" as string]: `${p.dx}px`,
                  animation: `nex-smoke-rise ${p.duration}s ease-out ${p.delay}s infinite`,
                }}
              />
            ))}
          </g>
        );
      })}

      {lines.map((line) => {
        const arming = line.phase === "arming";
        const firing = line.phase === "firing";
        const fading = line.phase === "fading";
        const beamOpacity  = arming ? 0    : firing ? 1    : 0;
        const targetRadius = arming ? 0    : firing ? 14   : 22;
        const targetOpacity= arming ? 0    : firing ? 0.6  : 0;
        return (
          <g key={line.id} style={{ transition: "opacity 200ms ease" }}>
            {/* Outer glow */}
            <line
              x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
              stroke="#c40027" strokeWidth="4" strokeLinecap="round"
              opacity={beamOpacity * 0.35}
              filter="url(#nex-beam-glow)"
              style={{ transition: "opacity 220ms ease" }}
            />
            {/* Bright core line · neon red (Philip 2026-08-28 · line was
                white, wants full neon red laser · no white centre). */}
            <line
              x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
              stroke="#c40027" strokeWidth="1.5" strokeLinecap="round"
              opacity={beamOpacity}
              style={{ transition: "opacity 220ms ease" }}
            />
            {/* Target impact glow */}
            <circle
              cx={line.x2} cy={line.y2}
              r={targetRadius}
              fill="none"
              stroke="#c40027"
              strokeWidth="1.5"
              opacity={targetOpacity}
              style={{ transition: "r 300ms ease-out, opacity 300ms ease-out" }}
            />
            <circle
              cx={line.x2} cy={line.y2}
              r={targetRadius * 0.55}
              fill="#c40027"
              opacity={targetOpacity * 0.5}
              style={{ transition: "r 300ms ease-out, opacity 300ms ease-out" }}
            />
            {/* Pupil origin flash · neon red · matches full laser palette */}
            <circle
              cx={line.x1} cy={line.y1}
              r={firing ? 3 : 0}
              fill="#c40027"
              opacity={firing ? 0.9 : 0}
              style={{ transition: "r 220ms ease, opacity 220ms ease" }}
            />
          </g>
        );
      })}
    </svg>
  );
}
