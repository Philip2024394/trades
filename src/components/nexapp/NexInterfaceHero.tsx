// src/components/nexapp/NexInterfaceHero.tsx · Philip 2026-08-29.
//
// Reusable "living NEX interface" background. Static ImageKit hero as
// master + CSS/SVG animation overlays in the same cyan palette. Used by:
//   · /nexapp/interface-sample     (preview route)
//   · NexRoomDrawer / Discover room (when activated)
//
// Entrance sequence (Philip 2026-08-29 · "cool way to bring the change in"):
//   t=0     · dark curtain visible · everything at opacity 0
//   t=100ms · scan line begins traversal top → bottom (over 900ms)
//   t=100ms · interface content begins fade + slight scale-up 0.96 → 1
//   t=1200ms · scan line exits · interface at full opacity
//   t=1200ms+ · all ambient animations continue indefinitely
//
// Ambient overlays (unchanged from interface-sample preview):
//   · globe scan-arc, aura pulse, orbital rings CW+CCW, energy beam,
//     holographic disc scan + pulse rings, vertical data streams, status
//     blinks, target-lock conic sweep
//
// prefers-reduced-motion disables the entrance + all ambient animations.

"use client";

import React from "react";

// Philip 2026-08-29 v3 · new hero · man casting holographic globe with
// gloved hands. Image is dark brushed metal + bright cyan holographic
// accents. Overlays revert to cyan family to match the image (was orange
// while previous globe image was on screen).
const HERO_URL =
  "https://ik.imagekit.io/ctlxgvqcm/ChatGPT%20Image%20Aug%2029,%202026,%2010_59_35%20AM.png";

// Overlay coordinates · % of the hero envelope · measured against this
// specific image (portrait · character centre · globe below hands).
// Hand positions nudged 2026-08-29 v4 · Philip · +8px right, −25px up
// on both hands so overlays align with the visible holographic rings.
const GLOBE      = { cx: "50%", cy: "56%", r: "20%" };
const HAND_LEFT  = { cx: "calc(23% + 8px)", cy: "calc(46% - 25px)", r: "11%" };  // viewer's left · character's RIGHT hand
const HAND_RIGHT = { cx: "calc(66% + 8px)", cy: "calc(32% - 25px)", r: "11%" };  // viewer's right · character's LEFT hand
const STATUS = [
  { top: "6%",  left: "8%"  },
  { top: "6%",  left: "88%" },
  { top: "94%", left: "50%" },
];

// Cyan palette · matches the image's holographic glow.
//   primary   = #4ac9ff   → main cyan
//   highlight = #a3e2ff   → bright cyan
const CYAN = {
  primary:    "rgba(74, 201, 255, 1)",
  primary35:  "rgba(74, 201, 255, 0.35)",
  primary10:  "rgba(74, 201, 255, 0.10)",
  highlight:  "rgba(163, 226, 255, 1)",
  highlight60:"rgba(163, 226, 255, 0.60)",
  highlight25:"rgba(163, 226, 255, 0.25)",
  deep35:     "rgba(0, 136, 204, 0.35)",
} as const;

export interface NexInterfaceHeroProps {
  /**
   * When true (default), plays the "power-on" entrance animation once on
   * mount. When false, the interface is visible immediately without any
   * entrance sequence · useful when the parent already handles the
   * reveal choreography.
   */
  animateEntrance?: boolean;
  /**
   * Horizontal shift in px applied to the composed layer (image +
   * overlays together). Default 0 · use e.g. −15 to nudge the whole
   * composition left.
   */
  shiftXpx?: number;
}

export function NexInterfaceHero({
  animateEntrance = true,
  shiftXpx = 0,
}: NexInterfaceHeroProps) {
  return (
    <div style={{
      position: "absolute",
      inset: 0,
      overflow: "hidden",
      background: "#020306",
    }}>
      {/* Composition shift wrapper · image + overlays move together */}
      <div style={{
        position: "absolute",
        inset: 0,
        transform: shiftXpx !== 0 ? `translateX(${shiftXpx}px)` : undefined,
      }}>
        {/* Layer 0 · static hero. Entrance uses opacity+scale on this
            container so the raster itself is never animated. */}
        <div className={animateEntrance ? "nex-hero-enter" : undefined} style={{
          position: "absolute", inset: 0,
        }}>
          <img
            src={HERO_URL}
            alt=""
            aria-hidden
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover", objectPosition: "center",
              userSelect: "none",
            }}
          />

          {/* Layer 1 · animation overlays · pointer-events:none */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>

            {/* ── GLOBE · high-contrast mobile graphics · Philip 2026-08-29 v3 ──
                Stronger strokes + brighter gradients + counter-rotating
                twin scan arcs + brighter aura. Sized for phone-first: on
                a 400px viewport the globe is ~140px diameter; strokes
                need to be visible at that scale. */}
            <svg
              viewBox="0 0 200 200"
              preserveAspectRatio="xMidYMid meet"
              style={{
                position: "absolute",
                left: `calc(${GLOBE.cx} - ${GLOBE.r})`,
                top:  `calc(${GLOBE.cy} - ${GLOBE.r})`,
                width:  `calc(${GLOBE.r} * 2)`,
                height: `calc(${GLOBE.r} * 2)`,
                filter: "drop-shadow(0 0 8px rgba(74, 201, 255, 0.55))",
              }}
              aria-hidden
            >
              <defs>
                {/* Bright forward scan · saturated */}
                <linearGradient id="nexHeroCyanScan" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%"   stopColor="rgba(74, 201, 255, 0)" />
                  <stop offset="40%"  stopColor={CYAN.primary35} />
                  <stop offset="80%"  stopColor={CYAN.primary} />
                  <stop offset="100%" stopColor={CYAN.highlight} />
                </linearGradient>
                {/* Second inner scan · counter-rotating · high-contrast white-cyan */}
                <linearGradient id="nexHeroCyanScan2" x1="1" y1="0" x2="0" y2="0">
                  <stop offset="0%"   stopColor="rgba(163, 226, 255, 0)" />
                  <stop offset="60%"  stopColor={CYAN.highlight60} />
                  <stop offset="100%" stopColor="#ffffff" />
                </linearGradient>
                <radialGradient id="nexHeroCyanAura" cx="50%" cy="50%" r="50%">
                  <stop offset="55%"  stopColor="rgba(74, 201, 255, 0)" />
                  <stop offset="82%"  stopColor="rgba(74, 201, 255, 0.35)" />
                  <stop offset="100%" stopColor="rgba(74, 201, 255, 0)" />
                </radialGradient>
              </defs>
              {/* Aura pulse · brighter than v1 · reads on mobile */}
              <circle cx="100" cy="100" r="98" fill="url(#nexHeroCyanAura)" className="nex-anim-pulse" />
              {/* Outer scan arc · thick, saturated, clockwise · MOBILE-STRONG */}
              <g className="nex-anim-globe">
                <circle cx="100" cy="100" r="94" fill="none" stroke={CYAN.primary35} strokeWidth="1.2" />
                <path
                  d="M 100 6 A 94 94 0 0 1 194 100"
                  fill="none" stroke="url(#nexHeroCyanScan)"
                  strokeWidth="3.5" strokeLinecap="round"
                />
                {/* Bright leading dot on the scan arc */}
                <circle cx="194" cy="100" r="4" fill={CYAN.highlight}
                        filter="drop-shadow(0 0 6px rgba(163, 226, 255, 0.95))" />
              </g>
              {/* Inner counter-rotating scan · white-tip for contrast */}
              <g className="nex-anim-ring-ccw">
                <circle cx="100" cy="100" r="80" fill="none" stroke={CYAN.primary10} strokeWidth="0.8" />
                <path
                  d="M 100 20 A 80 80 0 0 0 20 100"
                  fill="none" stroke="url(#nexHeroCyanScan2)"
                  strokeWidth="2.5" strokeLinecap="round"
                />
                <circle cx="20" cy="100" r="3" fill="#ffffff"
                        filter="drop-shadow(0 0 4px rgba(255,255,255,0.95))" />
              </g>
            </svg>

            {/* Orbital rings · two independent rotations · brighter nodes */}
            <svg
              viewBox="0 0 200 200"
              preserveAspectRatio="xMidYMid meet"
              style={{
                position: "absolute",
                left: `calc(${GLOBE.cx} - ${GLOBE.r} * 1.7)`,
                top:  `calc(${GLOBE.cy} - ${GLOBE.r} * 1.7)`,
                width:  `calc(${GLOBE.r} * 3.4)`,
                height: `calc(${GLOBE.r} * 3.4)`,
              }}
              aria-hidden
            >
              <g className="nex-anim-ring-cw">
                <circle cx="100" cy="100" r="92" fill="none"
                        stroke={CYAN.primary35} strokeWidth="1" strokeDasharray="3 6" />
                {/* Two nodes on this orbit for stronger presence */}
                <circle cx="192" cy="100" r="3.5" fill={CYAN.highlight}
                        filter="drop-shadow(0 0 5px rgba(163, 226, 255, 0.9))" />
                <circle cx="8"   cy="100" r="2.5" fill={CYAN.primary}
                        filter="drop-shadow(0 0 4px rgba(74, 201, 255, 0.85))" />
              </g>
              <g className="nex-anim-ring-ccw">
                <circle cx="100" cy="100" r="80" fill="none"
                        stroke={CYAN.highlight25} strokeWidth="0.8" strokeDasharray="2 5" />
                <circle cx="180" cy="100" r="3" fill={CYAN.primary}
                        filter="drop-shadow(0 0 4px rgba(74, 201, 255, 0.85))" />
              </g>
            </svg>

            {/* ── HAND GESTURE RINGS · Philip 2026-08-29 v2 ──────────────
                Two energy rings around the character's gloved hands with
                counter-rotating scan arcs · thicker strokes for mobile
                visibility · bright leading dots · pulse ring aura. Reads
                as "casting/summoning" the globe between his hands.
                Left hand ring at (25%, 42%), right hand ring at (68%, 33%). */}
            {[HAND_LEFT, HAND_RIGHT].map((hand, i) => (
              <svg
                key={`hand-${i}`}
                viewBox="0 0 200 200"
                preserveAspectRatio="xMidYMid meet"
                style={{
                  position: "absolute",
                  left: `calc(${hand.cx} - ${hand.r})`,
                  top:  `calc(${hand.cy} - ${hand.r})`,
                  width:  `calc(${hand.r} * 2)`,
                  height: `calc(${hand.r} * 2)`,
                  filter: "drop-shadow(0 0 6px rgba(74, 201, 255, 0.55))",
                }}
                aria-hidden
              >
                <defs>
                  <linearGradient id={`nexHeroHandScan-${i}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%"   stopColor="rgba(74, 201, 255, 0)" />
                    <stop offset="50%"  stopColor={CYAN.primary35} />
                    <stop offset="90%"  stopColor={CYAN.primary} />
                    <stop offset="100%" stopColor={CYAN.highlight} />
                  </linearGradient>
                  <radialGradient id={`nexHeroHandAura-${i}`} cx="50%" cy="50%" r="50%">
                    <stop offset="55%"  stopColor="rgba(74, 201, 255, 0)" />
                    <stop offset="85%"  stopColor="rgba(163, 226, 255, 0.30)" />
                    <stop offset="100%" stopColor="rgba(163, 226, 255, 0)" />
                  </radialGradient>
                </defs>
                {/* Aura pulse behind the hand ring · warm energy build */}
                <circle cx="100" cy="100" r="96" fill={`url(#nexHeroHandAura-${i})`}
                        className={i === 0 ? "nex-anim-hand-pulse-a" : "nex-anim-hand-pulse-b"} />
                {/* Outer dashed guide ring · steady */}
                <circle cx="100" cy="100" r="90" fill="none"
                        stroke={CYAN.primary35} strokeWidth="1"
                        strokeDasharray="3 5" />
                {/* Scan arc · counter-rotates between hands · MOBILE-STRONG stroke */}
                <g className={i === 0 ? "nex-anim-hand-cw" : "nex-anim-hand-ccw"}>
                  <path
                    d="M 100 10 A 90 90 0 0 1 190 100"
                    fill="none" stroke={`url(#nexHeroHandScan-${i})`}
                    strokeWidth="2.6" strokeLinecap="round"
                  />
                  <circle cx="190" cy="100" r="3.5" fill={CYAN.highlight}
                          filter="drop-shadow(0 0 5px rgba(163, 226, 255, 0.95))" />
                </g>
                {/* Small inner energy sparks · orbit slightly faster */}
                <g className={i === 0 ? "nex-anim-ring-cw" : "nex-anim-ring-ccw"}>
                  <circle cx="100" cy="30" r="2" fill={CYAN.highlight}
                          filter="drop-shadow(0 0 3px rgba(163, 226, 255, 0.85))" />
                  <circle cx="170" cy="100" r="1.6" fill={CYAN.primary}
                          filter="drop-shadow(0 0 3px rgba(74, 201, 255, 0.85))" />
                  <circle cx="100" cy="170" r="1.6" fill={CYAN.primary} />
                </g>
              </svg>
            ))}

            {/* Status dots · staggered blinks */}
            {STATUS.map((p, i) => (
              <div
                key={i}
                className="nex-anim-blink"
                style={{
                  position: "absolute",
                  top: p.top, left: p.left,
                  width: 6, height: 6,
                  borderRadius: "50%",
                  background: CYAN.highlight,
                  boxShadow: `0 0 8px ${CYAN.primary}`,
                  animationDelay: `${i * 1.4}s`,
                }}
              />
            ))}

            {/* Target-lock conic sweep · centred on globe */}
            <div
              className="nex-anim-scan"
              style={{
                position: "absolute",
                left: `calc(${GLOBE.cx} - ${GLOBE.r} * 2)`,
                top:  `calc(${GLOBE.cy} - ${GLOBE.r} * 2)`,
                width:  `calc(${GLOBE.r} * 4)`,
                height: `calc(${GLOBE.r} * 4)`,
                borderRadius: "50%",
                background:
                  "conic-gradient(from 0deg, rgba(249, 115, 22, 0) 0deg, rgba(249, 115, 22, 0.14) 12deg, rgba(249, 115, 22, 0) 60deg)",
                mixBlendMode: "screen",
                opacity: 0.7,
              }}
            />
          </div>
        </div>

        {/* Entrance scan-line · sweeps top → bottom once on mount, then
            removed from the render tree by animation-fill-mode:forwards +
            opacity 0. Renders above the interface but under any drawer
            controls (drawer controls own their z-index inside the caller). */}
        {animateEntrance && (
          <div className="nex-hero-scanline" aria-hidden />
        )}
      </div>

      {/* Component-scoped styles. Ambient animation classes are kept
          local to this file so the interface hero can be dropped
          anywhere without global CSS side-effects. */}
      <style jsx>{`
        @keyframes nex-hero-scan {
          0%   { transform: translateY(-8%); opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { transform: translateY(108%); opacity: 0; }
        }
        @keyframes nex-hero-enter {
          from { opacity: 0; transform: scale(0.96); filter: blur(6px); }
          to   { opacity: 1; transform: scale(1);    filter: blur(0);   }
        }
        .nex-hero-scanline {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg,
            rgba(249, 115, 22, 0) 0%,
            rgba(254, 215, 170, 0.9) 50%,
            rgba(249, 115, 22, 0) 100%);
          box-shadow: 0 0 12px rgba(254, 215, 170, 0.7);
          animation: nex-hero-scan 1100ms cubic-bezier(0.35, 0, 0.25, 1) 100ms forwards;
          pointer-events: none;
        }
        .nex-hero-enter {
          animation: nex-hero-enter 900ms cubic-bezier(0.25, 0, 0.2, 1) 100ms both;
        }
      `}</style>

      {/* Ambient animation classes · global so they can be reused if the
          hero is ever composed into a larger layout. Slow, restrained,
          premium. prefers-reduced-motion disables everything. */}
      <style jsx global>{`
        @keyframes nex-globe-spin      { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }
        @keyframes nex-globe-pulse     { 0%,100% { opacity: 0.45; transform: scale(1); }   50% { opacity: 0.85; transform: scale(1.03); } }
        @keyframes nex-ring-cw         { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }
        @keyframes nex-ring-ccw        { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        @keyframes nex-hand-cw         { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }
        @keyframes nex-hand-ccw        { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        @keyframes nex-hand-pulse-a    { 0%,100% { opacity: 0.35; transform: scale(1); }   50% { opacity: 0.85; transform: scale(1.06); } }
        @keyframes nex-hand-pulse-b    { 0%,100% { opacity: 0.30; transform: scale(1); }   50% { opacity: 0.80; transform: scale(1.06); } }
        @keyframes nex-blink           { 0%,90%,100% { opacity: 0.45; }      50% { opacity: 1; } }
        @keyframes nex-scan            { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }

        .nex-anim-globe           { transform-origin: 100px 100px; animation: nex-globe-spin 60s linear infinite; }
        .nex-anim-pulse           { transform-origin: 100px 100px; animation: nex-globe-pulse 6s ease-in-out infinite; }
        .nex-anim-ring-cw         { transform-origin: 100px 100px; animation: nex-ring-cw 90s linear infinite; }
        .nex-anim-ring-ccw        { transform-origin: 100px 100px; animation: nex-ring-ccw 70s linear infinite; }
        .nex-anim-hand-cw         { transform-origin: 100px 100px; animation: nex-hand-cw 22s linear infinite; }
        .nex-anim-hand-ccw        { transform-origin: 100px 100px; animation: nex-hand-ccw 28s linear infinite; }
        .nex-anim-hand-pulse-a    { transform-origin: 100px 100px; animation: nex-hand-pulse-a 3.2s ease-in-out infinite; }
        .nex-anim-hand-pulse-b    { transform-origin: 100px 100px; animation: nex-hand-pulse-b 4.1s ease-in-out infinite; }
        .nex-anim-blink           { animation: nex-blink 4s ease-in-out infinite; }
        .nex-anim-scan            { transform-origin: 50% 50%; animation: nex-scan 25s linear infinite; }

        @media (prefers-reduced-motion: reduce) {
          .nex-anim-globe, .nex-anim-pulse,
          .nex-anim-ring-cw, .nex-anim-ring-ccw,
          .nex-anim-hand-cw, .nex-anim-hand-ccw,
          .nex-anim-hand-pulse-a, .nex-anim-hand-pulse-b,
          .nex-anim-blink,
          .nex-anim-scan,
          .nex-hero-scanline,
          .nex-hero-enter {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
