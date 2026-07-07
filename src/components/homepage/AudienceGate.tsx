// AudienceGate — vertical before/after slider mechanic.
//
// Two panels layered at full viewport height:
//   • Trades panel: bottom layer, always rendered full-size
//   • Homeowner panel: top layer, full-size, clipped from the top so
//     only the bottom portion is visible
//
// The handle is a horizontal bar spanning the full width at the clip
// line. Drag it up → clip line rises → more Trades revealed. Drag it
// down → clip line falls → more Sarah revealed. Handle follows finger
// directly. No auto-complete, no snap-back. Stays wherever released.
//
// Keyboard: ↑ jumps to Trades fully revealed. ↓ jumps to Sarah fully
// revealed. Home/End same.
//
// Reduced-motion: two stacked full-viewport panels, no drag.

"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";
import Link from "next/link";
import {
  ChevronUp,
  ChevronDown,
  ArrowRight,
  Hammer,
  Home,
  GripHorizontal
} from "lucide-react";

// Position semantics:
//   0   = Sarah fully clipped away → only Trades visible
//   50  = 50/50 split
//   100 = Sarah fully revealed → only Sarah visible
const INITIAL_POSITION = 50;

export function AudienceGate() {
  const [position, setPosition] = useState(INITIAL_POSITION);
  const [isDragging, setIsDragging] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const containerRef = useRef<HTMLElement | null>(null);

  // Detect reduced motion once on mount + subscribe to changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const animateTo = useCallback((target: number) => {
    setTransitioning(true);
    setPosition(target);
    // Match CSS transition duration below (500ms)
    setTimeout(() => setTransitioning(false), 550);
  }, []);

  // Keyboard controls — one keystroke = full commit
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowUp" || e.key === "Home") {
        e.preventDefault();
        animateTo(0);
      } else if (e.key === "ArrowDown" || e.key === "End") {
        e.preventDefault();
        animateTo(100);
      } else if (e.key === "Escape") {
        e.preventDefault();
        animateTo(INITIAL_POSITION);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [animateTo]);

  // Compute new position from a pointer's Y coordinate
  const positionFromClientY = useCallback((clientY: number) => {
    const el = containerRef.current;
    if (!el) return position;
    const rect = el.getBoundingClientRect();
    const relative = ((clientY - rect.top) / rect.height) * 100;
    return Math.max(0, Math.min(100, relative));
  }, [position]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    setTransitioning(false);
    setPosition(positionFromClientY(e.clientY));
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPosition(positionFromClientY(e.clientY));
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  // Reduced-motion fallback — two stacked full-viewport panels
  if (reduceMotion) {
    return (
      <section
        aria-label="Choose your side"
        className="relative flex min-h-screen w-full flex-col"
      >
        <TradesPanel fullBleed />
        <HomeownerPanel fullBleed />
      </section>
    );
  }

  const transitionStyle = transitioning
    ? "500ms cubic-bezier(0.22, 1, 0.36, 1)"
    : "0ms";

  return (
    <section
      ref={(el) => {
        containerRef.current = el;
      }}
      aria-label="Choose your side — trades or homeowners"
      className="relative h-[100svh] min-h-[600px] w-full overflow-hidden bg-neutral-900"
      style={{ touchAction: "none" }}
    >
      {/* BOTTOM LAYER — Trades (always full-size, always visible where
          the top layer is clipped away) */}
      <div className="absolute inset-0">
        <TradesPanel />
      </div>

      {/* TOP LAYER — Homeowner (Sarah) clipped from the top.
          clip-path: inset(top right bottom left) — cutting the top
          (100 - position)% of the panel away reveals the Trades layer
          above the handle. */}
      <div
        className="absolute inset-0"
        style={{
          clipPath: `inset(${100 - position}% 0 0 0)`,
          transition: `clip-path ${transitionStyle}`
        }}
      >
        <HomeownerPanel />
      </div>

      {/* HANDLE — horizontal bar spanning the viewport width at the
          clip line. Draggable directly (finger tracks). */}
      <div
        role="slider"
        aria-orientation="vertical"
        aria-label="Drag up for trades, down for homeowners"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position)}
        tabIndex={0}
        className="absolute inset-x-0 z-20 flex cursor-ns-resize items-center justify-center"
        style={{
          top: `${position}%`,
          transform: "translateY(-50%)",
          height: 64,
          transition: `top ${transitionStyle}`,
          touchAction: "none"
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Full-width divider line */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-white"
          style={{ boxShadow: "0 0 24px rgba(255,255,255,0.4)" }}
        />

        {/* Centered handle pill */}
        <div
          className={`relative z-10 flex items-center gap-2 rounded-full border border-white/30 bg-white px-4 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.35)] md:px-5 md:py-3 ${
            isDragging ? "scale-105" : ""
          }`}
          style={{ transition: "transform 200ms ease" }}
        >
          <ChevronUp
            className="h-4 w-4 text-neutral-900"
            strokeWidth={3}
            aria-hidden
          />
          <GripHorizontal
            className="h-4 w-4 text-neutral-500"
            aria-hidden
          />
          <ChevronDown
            className="h-4 w-4 text-neutral-900"
            strokeWidth={3}
            aria-hidden
          />
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   TRADES PANEL — bottom layer, content anchored top
   ───────────────────────────────────────────────────────────── */

function TradesPanel({ fullBleed }: { fullBleed?: boolean }) {
  return (
    <div
      className={`relative flex h-full w-full flex-col justify-start overflow-hidden bg-black ${
        fullBleed ? "min-h-screen" : ""
      }`}
    >
      {/* Hero image — full width, natural height, anchored to the top
          of the panel. Fades into the black background at the bottom. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://ik.imagekit.io/9mrgsv2rp/Untitledsdsaaass.png?updatedAt=1783422461728"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 block h-auto w-full select-none"
        style={{
          maskImage:
            "linear-gradient(to bottom, #000 75%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, #000 75%, transparent 100%)"
        }}
      />

      <div className="relative z-10 px-6 pt-12 md:px-16 md:pt-20">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold uppercase tracking-wider text-amber-200 backdrop-blur">
          <Hammer className="h-3.5 w-3.5" aria-hidden />
          For trades
        </div>
        <h2 className="mt-6 max-w-2xl text-[42px] font-bold leading-[1.05] tracking-tight text-white md:text-[68px]">
          Trade For Project.
        </h2>
        <p className="mt-4 max-w-xl text-[15px] leading-[1.55] text-white/70 md:text-[16px]">
          Get discovered. Build your Notebook. Grow your reputation.
        </p>
        <div className="mt-8">
          <Link
            href="/join"
            className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-amber-400 px-6 text-[15px] font-bold text-neutral-900 transition hover:bg-amber-300"
          >
            Join as a Trade
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <p className="mt-3 text-[13px] text-white/60">
            Free forever · Companies House verified · 3-minute setup
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   HOMEOWNER PANEL — top layer, content anchored bottom
   ───────────────────────────────────────────────────────────── */

function HomeownerPanel({ fullBleed }: { fullBleed?: boolean }) {
  return (
    <div
      className={`relative flex h-full w-full flex-col justify-end overflow-hidden bg-black ${
        fullBleed ? "min-h-screen" : ""
      }`}
    >
      {/* Hero image — full width, natural height, anchored to the
          BOTTOM of the panel. Fades into the black background at the
          top so the slider divider always sits on black. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://ik.imagekit.io/9mrgsv2rp/sasdasdwqw.png?updatedAt=1783421076161"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 block h-auto w-full select-none"
        style={{
          maskImage:
            "linear-gradient(to top, #000 75%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to top, #000 75%, transparent 100%)"
        }}
      />

      <div className="relative z-10 px-6 pb-12 md:px-16 md:pb-20">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur">
          <Home className="h-3.5 w-3.5" aria-hidden />
          For homeowners
        </div>
        <h2 className="mt-6 max-w-2xl text-[42px] font-bold leading-[1.05] tracking-tight text-white md:text-[68px]">
          Project For Trade.
        </h2>
        <p className="mt-4 max-w-xl text-[15px] leading-[1.55] text-white/70 md:text-[16px]">
          Post your project. Match with trusted trades. Keep it forever.
        </p>
        <div className="mt-8">
          <Link
            href="/project"
            className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-white px-6 text-[15px] font-bold text-neutral-900 transition hover:bg-neutral-100"
          >
            Submit Your Project
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <p className="mt-3 text-[13px] text-white/60">
            Free forever · No card required · Your record moves with your home
          </p>
        </div>
      </div>
    </div>
  );
}

