// NEX Butterfly Cinematic · Philip 2026-08-28 · first-arrival WOW moment.
//
// v3 iteration · Philip 2026-08-28:
//   · Monarch-inspired ORANGE butterfly (was flat white silhouette)
//     · Forewing + hindwing per side (real butterfly anatomy)
//     · Black wingtips + veins + white spots (realistic pattern)
//     · Orange base #ea580c reads clearly against black
//   · Slower wing flap (400ms · calm) with mild phase offset for realism
//   · Sinusoidal Y wobble on top of waypoint interp (butterflies bob as they fly)
//   · Body rotation follows direction of travel (atan2 of velocity)
//   · Flies INSIDE phone screen · behind frame chrome (z:8 via frameOverlaySlot)
//   · Beam CONNECTS · no burn/smoke (spawnBurn:false)
//   · Hovers 1s during beam so user sees she's OK

"use client";

import { useEffect, useRef, useState } from "react";
import { useGuidanceTarget } from "./hud/NexGuidance";
import type { OrbLookDirection } from "./NexVoiceOrb";

const SESSION_KEY = "nex-butterfly-cinematic-seen";

type Phase = "waiting" | "flight1" | "pause" | "flight2" | "hovering" | "exit" | "gone";

interface Waypoint {
  t: number;    // ms from phase start
  x: number;    // % of phone container width
  y: number;    // % of phone container height
}

const FLIGHT_1: Waypoint[] = [
  { t:    0, x: 82, y: 88 },
  { t: 1000, x: 76, y: 78 },
  { t: 1900, x: 68, y: 68 },
  { t: 2800, x: 60, y: 58 },
  { t: 3500, x: 55, y: 46 },
  { t: 4300, x: 48, y: 38 },
  { t: 5200, x: 40, y: 30 },
  { t: 6000, x: 46, y: 28 },
  { t: 6700, x: 36, y: 38 },
  { t: 7300, x: 22, y: 46 },
  { t: 7800, x:  6, y: 50 },
  { t: 8000, x: -8, y: 48 },
];

const FLIGHT_2: Waypoint[] = [
  { t:    0, x:  -8, y: 22 },
  { t: 1000, x:  10, y: 20 },
  { t: 1900, x:  22, y: 24 },
  { t: 2800, x:  36, y: 21 },
  { t: 3700, x:  50, y: 24 },
  { t: 4500, x:  62, y: 22 },
  { t: 5300, x:  72, y: 24 },
  { t: 6000, x:  82, y: 22 },
];

const EXIT: Waypoint[] = [
  { t:    0, x: 82, y: 22 },
  { t:  500, x: 92, y: 18 },
  { t: 1200, x: 115, y: 12 },
];

const PUPIL_SCHEDULE: Array<{ t: number; dir: OrbLookDirection | null }> = [
  { t:  1000, dir: "down-right" },
  { t:  3000, dir: "down" },
  { t:  5000, dir: "down-left" },
  { t:  7000, dir: "left" },
  { t:  8000, dir: "up-left" },
  { t:  9500, dir: null },
  { t: 15000, dir: "left" },
  { t: 16500, dir: "down-left" },
  { t: 18000, dir: "down" },
  { t: 19500, dir: "down-right" },
  { t: 21000, dir: "right" },
  { t: 23500, dir: null },
];

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

interface Props {
  onPupilDirection: (dir: OrbLookDirection | null) => void;
  onFireBeam: () => void;
  onCinematicActive: (active: boolean) => void;
}

export function NexButterflyCinematic({
  onPupilDirection, onFireBeam, onCinematicActive,
}: Props) {
  const [phase, setPhase] = useState<Phase>("waiting");
  const [pos, setPos] = useState<{ x: number; y: number; rot: number }>({
    x: FLIGHT_1[0].x, y: FLIGHT_1[0].y, rot: 0,
  });
  const [visible, setVisible] = useState(false);
  const attachRef = useGuidanceTarget("butterfly");
  const rafRef = useRef<number | null>(null);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const startedRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    // ── Session gate DISABLED FOR DEV (Philip 2026-08-28) ───────────────
    if (typeof window === "undefined") return;
    if (startedRef.current) return;
    startedRef.current = true;
    // try {
    //   if (sessionStorage.getItem(SESSION_KEY) === "1") return;
    //   sessionStorage.setItem(SESSION_KEY, "1");
    // } catch { /* private mode */ }

    let cancelled = false;
    const push = (delay: number, fn: () => void) => {
      timersRef.current.push(setTimeout(() => { if (!cancelled) fn(); }, delay));
    };

    PUPIL_SCHEDULE.forEach((entry) => {
      push(entry.t, () => onPupilDirection(entry.dir));
    });

    push(1000, () => {
      setPhase("flight1");
      setVisible(true);
      runWaypoints(FLIGHT_1, () => {
        setPhase("pause");
        setVisible(false);
        lastPosRef.current = null;
      });
    });

    push(15000, () => {
      setPhase("flight2");
      setVisible(true);
      lastPosRef.current = null;
      runWaypoints(FLIGHT_2, () => {
        setPhase("hovering");
        onFireBeam();
        push(1300, () => {
          setPhase("exit");
          runWaypoints(EXIT, () => {
            setPhase("gone");
            setVisible(false);
          });
        });
      });
    });

    function runWaypoints(waypoints: Waypoint[], onComplete: () => void) {
      if (waypoints.length === 0) { onComplete(); return; }
      const startTime = performance.now();
      const totalDuration = waypoints[waypoints.length - 1].t;

      const step = () => {
        if (cancelled) return;
        const elapsed = performance.now() - startTime;
        if (elapsed >= totalDuration) {
          const last = waypoints[waypoints.length - 1];
          setPos({ x: last.x, y: last.y, rot: 0 });
          onComplete();
          return;
        }
        let i = 0;
        while (i < waypoints.length - 2 && waypoints[i + 1].t <= elapsed) i++;
        const a = waypoints[i];
        const b = waypoints[i + 1];
        const segT = (elapsed - a.t) / (b.t - a.t);
        const eased = smoothstep(Math.max(0, Math.min(1, segT)));

        // Base interpolated position (waypoint bezier-like path)
        const baseX = a.x + (b.x - a.x) * eased;
        const baseY = a.y + (b.y - a.y) * eased;

        // Sinusoidal Y wobble · butterflies bob as they flap (~2Hz)
        const wobbleY = Math.sin(elapsed / 260) * 0.9;
        const wobbleX = Math.cos(elapsed / 380) * 0.5;
        const finalX = baseX + wobbleX;
        const finalY = baseY + wobbleY;

        // Rotation follows direction of travel · body tilts into flight arc
        let rot = 0;
        if (lastPosRef.current) {
          const dx = finalX - lastPosRef.current.x;
          const dy = finalY - lastPosRef.current.y;
          if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
            // atan2 gives angle · we bank butterfly ~20% of travel angle for subtle tilt
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            // Clamp bank angle to ±25° · keep it subtle so wings still read
            rot = Math.max(-25, Math.min(25, angle * 0.25));
          }
        }
        lastPosRef.current = { x: finalX, y: finalY };

        setPos({ x: finalX, y: finalY, rot });
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    }

    return () => {
      cancelled = true;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      onCinematicActive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const isActive =
      phase === "flight1" || phase === "flight2" ||
      phase === "hovering" || phase === "exit";
    onCinematicActive(isActive);
  }, [phase, onCinematicActive]);

  return (
    <div
      ref={attachRef as (el: HTMLDivElement | null) => void}
      aria-hidden
      style={{
        position: "absolute",
        top:  `${pos.y}%`,
        left: `${pos.x}%`,
        transform: `translate(-50%, -50%) rotate(${pos.rot}deg)`,
        opacity: visible ? 1 : 0,
        transition: "opacity 300ms ease-out",
        pointerEvents: "none",
        willChange: "top, left, transform, opacity",
      }}
    >
      {/*
        MONARCH-INSPIRED BUTTERFLY · Philip 2026-08-28
        Real butterfly anatomy: 2 wings per side (forewing + hindwing)
        Colors: bright orange base, black wingtips + veins, white spots
        Body: dark segmented · antennae with knob tips
      */}
      <svg width="46" height="34" viewBox="0 0 46 34" style={{ overflow: "visible" }}>
        <defs>
          {/* Wing gradient · slight radial to give depth (bright centre → deeper edges) */}
          <radialGradient id="nex-wing-orange" cx="50%" cy="50%" r="65%">
            <stop offset="0%"  stopColor="#fb923c" />   {/* light orange centre */}
            <stop offset="60%" stopColor="#ea580c" />   {/* deep orange body   */}
            <stop offset="100%" stopColor="#9a3412" />  {/* darker outer rim   */}
          </radialGradient>
        </defs>

        {/* LEFT WING GROUP · forewing + hindwing flap together.
            transformOrigin at RIGHT edge of the wing's fill-box (where wing
            attaches to body) so scaleX collapses TOWARD body · not away. */}
        <g
          style={{
            transformOrigin: "100% 50%",
            transformBox: "fill-box",
            animation: visible ? "nex-butterfly-wing-l 400ms ease-in-out infinite" : "none",
          }}
        >
          {/* Left FOREWING (upper) · orange base */}
          <path
            d="M23 14 C 15 4, 5 2, 1 8 C 1 12, 4 15, 9 16 C 14 17, 20 17, 23 14 Z"
            fill="url(#nex-wing-orange)"
          />
          {/* Left forewing BLACK TIP · signature Monarch marking */}
          <path
            d="M9 2 C 4 4, 1 7, 1 10 C 3 9, 6 7, 9 5 Z"
            fill="#0a0a0a"
          />
          {/* Left forewing black rim (edge outline) */}
          <path
            d="M23 14 C 15 4, 5 2, 1 8"
            stroke="#0a0a0a"
            strokeWidth="0.9"
            fill="none"
            strokeLinecap="round"
          />
          {/* Left forewing veins radiating from body */}
          <line x1="23" y1="14" x2="4" y2="6" stroke="#0a0a0a" strokeWidth="0.4" opacity="0.7" />
          <line x1="23" y1="14" x2="7" y2="10" stroke="#0a0a0a" strokeWidth="0.4" opacity="0.7" />
          <line x1="23" y1="14" x2="11" y2="14" stroke="#0a0a0a" strokeWidth="0.4" opacity="0.7" />
          {/* Left forewing WHITE SPOTS · classic Monarch pattern */}
          <circle cx="4" cy="6" r="0.7" fill="#f5f5f5" />
          <circle cx="6.5" cy="8" r="0.5" fill="#f5f5f5" />

          {/* Left HINDWING (lower) · slightly darker orange */}
          <path
            d="M23 17 C 15 26, 8 27, 4 22 C 5 20, 9 19, 14 19 C 18 18, 22 18, 23 17 Z"
            fill="url(#nex-wing-orange)"
          />
          {/* Left hindwing black rim */}
          <path
            d="M23 17 C 15 26, 8 27, 4 22"
            stroke="#0a0a0a"
            strokeWidth="0.9"
            fill="none"
            strokeLinecap="round"
          />
          {/* Left hindwing veins */}
          <line x1="23" y1="17" x2="7" y2="24" stroke="#0a0a0a" strokeWidth="0.35" opacity="0.7" />
          <line x1="23" y1="17" x2="12" y2="24" stroke="#0a0a0a" strokeWidth="0.35" opacity="0.7" />
          <line x1="23" y1="17" x2="17" y2="22" stroke="#0a0a0a" strokeWidth="0.35" opacity="0.7" />
        </g>

        {/* RIGHT WING GROUP · mirror · origin at LEFT edge of its fill-box */}
        <g
          style={{
            transformOrigin: "0% 50%",
            transformBox: "fill-box",
            animation: visible ? "nex-butterfly-wing-r 400ms ease-in-out infinite" : "none",
          }}
        >
          {/* Right FOREWING */}
          <path
            d="M23 14 C 31 4, 41 2, 45 8 C 45 12, 42 15, 37 16 C 32 17, 26 17, 23 14 Z"
            fill="url(#nex-wing-orange)"
          />
          {/* Right forewing black tip */}
          <path
            d="M37 2 C 42 4, 45 7, 45 10 C 43 9, 40 7, 37 5 Z"
            fill="#0a0a0a"
          />
          <path
            d="M23 14 C 31 4, 41 2, 45 8"
            stroke="#0a0a0a"
            strokeWidth="0.9"
            fill="none"
            strokeLinecap="round"
          />
          <line x1="23" y1="14" x2="42" y2="6" stroke="#0a0a0a" strokeWidth="0.4" opacity="0.7" />
          <line x1="23" y1="14" x2="39" y2="10" stroke="#0a0a0a" strokeWidth="0.4" opacity="0.7" />
          <line x1="23" y1="14" x2="35" y2="14" stroke="#0a0a0a" strokeWidth="0.4" opacity="0.7" />
          <circle cx="42" cy="6" r="0.7" fill="#f5f5f5" />
          <circle cx="39.5" cy="8" r="0.5" fill="#f5f5f5" />

          {/* Right HINDWING */}
          <path
            d="M23 17 C 31 26, 38 27, 42 22 C 41 20, 37 19, 32 19 C 28 18, 24 18, 23 17 Z"
            fill="url(#nex-wing-orange)"
          />
          <path
            d="M23 17 C 31 26, 38 27, 42 22"
            stroke="#0a0a0a"
            strokeWidth="0.9"
            fill="none"
            strokeLinecap="round"
          />
          <line x1="23" y1="17" x2="39" y2="24" stroke="#0a0a0a" strokeWidth="0.35" opacity="0.7" />
          <line x1="23" y1="17" x2="34" y2="24" stroke="#0a0a0a" strokeWidth="0.35" opacity="0.7" />
          <line x1="23" y1="17" x2="29" y2="22" stroke="#0a0a0a" strokeWidth="0.35" opacity="0.7" />
        </g>

        {/* BODY · thin segmented dark ellipse · centre stays put during wing flap */}
        <ellipse cx="23" cy="16" rx="1.4" ry="8" fill="#1a1a1a" />
        {/* Body segments · three horizontal ticks for insect thorax detail */}
        <line x1="21.8" y1="12" x2="24.2" y2="12" stroke="#0a0a0a" strokeWidth="0.5" />
        <line x1="21.8" y1="16" x2="24.2" y2="16" stroke="#0a0a0a" strokeWidth="0.5" />
        <line x1="21.8" y1="20" x2="24.2" y2="20" stroke="#0a0a0a" strokeWidth="0.5" />
        {/* Head · small dark circle above body */}
        <circle cx="23" cy="9" r="1.3" fill="#0a0a0a" />

        {/* ANTENNAE · curved from head · KNOB tips (real butterfly antennae end in club) */}
        <path d="M22 8 Q 20 4, 18 2" stroke="#0a0a0a" strokeWidth="0.6" fill="none" strokeLinecap="round" />
        <circle cx="18" cy="2" r="0.7" fill="#0a0a0a" />
        <path d="M24 8 Q 26 4, 28 2" stroke="#0a0a0a" strokeWidth="0.6" fill="none" strokeLinecap="round" />
        <circle cx="28" cy="2" r="0.7" fill="#0a0a0a" />
      </svg>
      <style>{`
        @keyframes nex-butterfly-wing-l {
          0%, 100% { transform: scaleX(1);   }
          50%      { transform: scaleX(0.2); }
        }
        @keyframes nex-butterfly-wing-r {
          /* Right wing offset by 20ms of phase so wings feel independent · not mechanical */
          0%, 100% { transform: scaleX(1);   }
          50%      { transform: scaleX(0.2); }
        }
      `}</style>
    </div>
  );
}
