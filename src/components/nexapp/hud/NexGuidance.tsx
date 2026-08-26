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
  /** Delay before beam fires (lets pupil settle first). Default 380. */
  fireDelayMs?: number;
  /** Optional origin target id. Default "pupil". */
  from?: GuidanceTargetId;
}

interface ActiveBeam {
  id:           number;
  from:         GuidanceTargetId;
  to:           GuidanceTargetId;
  phase:        "arming" | "firing" | "fading";
  createdAt:    number;
  dwellMs:      number;
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
    const fireDelayMs = opts.fireDelayMs ?? 380;
    const from        = opts.from        ?? "pupil";
    const id          = nextIdRef.current++;
    const createdAt   = Date.now();

    // Phase 1 · arming (pupil settling · beam not yet visible).
    setActiveBeams((cur) => [...cur, { id, from, to, phase: "arming", createdAt, dwellMs }]);

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

export function NexGuidanceBeamOverlay() {
  const api = useContext(GuidanceContext);
  const [lines, setLines] = useState<BeamLine[]>([]);
  const rafRef = useRef<number | null>(null);

  // rAF loop · recomputes beam endpoints from live DOM every frame while a
  // beam is active. Handles window resize / layout shifts / orb pupil drift
  // without any extra listeners.
  useEffect(() => {
    if (!api) return;
    const tick = () => {
      const next: BeamLine[] = [];
      for (const beam of api.activeBeams) {
        const fromEl = api.targets.get(beam.from);
        const toEl   = api.targets.get(beam.to);
        if (!fromEl || !toEl) continue;
        const a = fromEl.getBoundingClientRect();
        const b = toEl.getBoundingClientRect();
        next.push({
          id:  beam.id,
          x1:  a.left + a.width / 2,
          y1:  a.top  + a.height / 2,
          x2:  b.left + b.width / 2,
          y2:  b.top  + b.height / 2,
          phase: beam.phase,
        });
      }
      setLines(next);
      if (api.activeBeams.length > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    if (api.activeBeams.length > 0) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      setLines([]);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [api, api?.activeBeams]);

  if (!api || lines.length === 0) return null;

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
              stroke="#ef4444" strokeWidth="4" strokeLinecap="round"
              opacity={beamOpacity * 0.35}
              filter="url(#nex-beam-glow)"
              style={{ transition: "opacity 220ms ease" }}
            />
            {/* Bright core line · hot white centre for laser feel */}
            <line
              x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
              stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round"
              opacity={beamOpacity}
              style={{ transition: "opacity 220ms ease" }}
            />
            {/* Target impact glow */}
            <circle
              cx={line.x2} cy={line.y2}
              r={targetRadius}
              fill="none"
              stroke="#ef4444"
              strokeWidth="1.5"
              opacity={targetOpacity}
              style={{ transition: "r 300ms ease-out, opacity 300ms ease-out" }}
            />
            <circle
              cx={line.x2} cy={line.y2}
              r={targetRadius * 0.55}
              fill="#ef4444"
              opacity={targetOpacity * 0.5}
              style={{ transition: "r 300ms ease-out, opacity 300ms ease-out" }}
            />
            {/* Pupil origin flash */}
            <circle
              cx={line.x1} cy={line.y1}
              r={firing ? 3 : 0}
              fill="#ffffff"
              opacity={firing ? 0.9 : 0}
              style={{ transition: "r 220ms ease, opacity 220ms ease" }}
            />
          </g>
        );
      })}
    </svg>
  );
}
