// NEX Connection Line + Running Light
//
// Implements the pinned `project_nex_identity_connection_line_2026_08_21`
// doctrine + Philip's 2026-08-21 refined spec:
//
//   · Feels like real physical energy travelling THROUGH the line —
//     NOT a dashed border, NOT a spinner, NOT a game effect.
//   · Bright leading point + soft orange glow + subtle fading trail.
//   · Organic acceleration/deceleration (cubic-bezier, not linear).
//   · Slight per-pulse variation in speed + intensity.
//   · Occasional subtle "line pulse" energy waves through the line
//     itself, independent of the ember.
//   · Direction reverses based on who is producing:
//        person-composing → PERSON → NEX     (RTL)
//        nex-generating   → NEX → PERSON     (LTR)
//   · 4-second decay tail after activity stops — component continues
//     running the light for 4s before naturally fading/settling to the
//     quiet line. This is managed INTERNALLY so parents just pass the
//     raw "active" signal without needing their own debounce.
//   · Respects prefers-reduced-motion: static faint line, no ember.
//
// The message-send split-second beat (ember completes + short beat →
// message appears LIVE) is coordinated at the parent level (NexAppHome)
// because it requires deferring the message-bubble append by a small
// interval after submit. This component only provides the visual layer.
//
// Prototype: /nex-lab/connection-line renders this component in
// isolation with controls to trigger each state for tuning.

"use client";

import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import { NEX } from "@/lib/nexapp/tokens";

export type NexConnectionActivity = "idle" | "person-composing" | "nex-generating";

// Stable baseline values used at server render + first client render.
// The CSS template MUST NOT contain Math.random() interpolations —
// server + client would compute different values → different styled-jsx
// hash → React hydration mismatch (fixed the same way as NexIdentityButton
// 2026-08-21). Per-session jitter is applied post-hydration via CSS
// custom properties set on the wrap element in a useEffect.
const BASE_DURATION_S = 1.6;
const BASE_PAUSE_S = 0.20;
const BASE_TRAIL_OFFSET_S = 0.26;
const BASE_LINE_PULSE_S = 3.8;
const BASE_CYCLE_S = BASE_DURATION_S + BASE_PAUSE_S;

// How long the running light continues AFTER activity stops before
// naturally fading to the quiet line (Philip 2026-08-21).
const DECAY_TAIL_MS = 4000;
// How long the final fade takes (portion of the tail).
const DECAY_FADE_MS = 900;

// Organic accel/decel for the ember traversal. Slight ease at both
// ends of the trip — not linear — so motion feels like physical energy
// moving through a medium rather than a UI slider.
const EMBER_EASING = "cubic-bezier(0.42, 0.05, 0.55, 0.98)";

export const NexConnectionLine = memo(function NexConnectionLine({
  activity,
  /** Vertical anchor · -1 puts the wrap's top at the frame's border top
   *  edge (frame has a 1px border). Ember rides EXACTLY on the border
   *  pixel — Philip 2026-08-21. */
  topOffset = -1,
  /** Horizontal inset from each side · leaves room for the top corner buttons. */
  sideInset = 40,
}: {
  activity: NexConnectionActivity;
  topOffset?: number;
  sideInset?: number;
}) {
  // Per-mount jitter — slight variation across sessions so the light
  // never feels like a canned loop. Held in a ref so the CSS clock
  // never resets from state changes.
  // Per-session jitter values are POPULATED POST-HYDRATION via useEffect
  // below and applied as CSS custom properties on the wrap element.
  // Never interpolated into the styled-jsx template (would cause a
  // hydration mismatch — see comment on baseline constants above).
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // ── Internal "cooling-down" tail state ──────────────────────
  // Parent passes raw activity. This component keeps the light running
  // for DECAY_TAIL_MS after activity turns idle, then fades and settles.
  // `phase` decides what's rendered:
  //   "active" → full activity animation
  //   "decay"  → activity animation continues but a fade timer is running
  //   "idle"   → no ember, quiet line
  // `lastDirection` remembers the direction so decay continues drifting
  // the correct way even when parent's activity is already 'idle'.
  const [phase, setPhase] = useState<"active" | "decay" | "idle">(
    activity === "idle" ? "idle" : "active",
  );
  const [lastDirection, setLastDirection] = useState<"ltr" | "rtl">(
    activity === "nex-generating" ? "ltr" : "rtl",
  );
  const decayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Apply per-session jitter to the wrap element AFTER hydration.
  // Server + first client render both use the baseline values (no
  // random anywhere in the CSS template) — this effect runs only
  // on the client after hydration completes, so no mismatch.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const dur = BASE_DURATION_S - 0.2 + Math.random() * 0.4;        // 1.4–1.8s
    const pause = 0.10 + Math.random() * 0.15;                       // 0.10–0.25s
    const trailOffset = 0.22 + Math.random() * 0.08;                 // 0.22–0.30s
    const linePulse = 3.2 + Math.random() * 1.2;                     // 3.2–4.4s
    const cycle = dur + pause;
    el.style.setProperty("--nex-cl-cycle", `${cycle.toFixed(2)}s`);
    el.style.setProperty("--nex-cl-halo-delay", `-${trailOffset.toFixed(2)}s`);
    el.style.setProperty("--nex-cl-line-sweep", `${linePulse.toFixed(2)}s`);
  }, []);

  useEffect(() => {
    // Clear any pending decay when activity changes.
    if (decayTimerRef.current) {
      clearTimeout(decayTimerRef.current);
      decayTimerRef.current = null;
    }

    if (activity !== "idle") {
      // Active state — remember its direction and show it.
      setLastDirection(activity === "nex-generating" ? "ltr" : "rtl");
      setPhase("active");
      return;
    }

    // activity became idle. Start the 4s decay tail. During decay the
    // ember continues to run (in the lastDirection); the last DECAY_FADE_MS
    // gets an opacity fade via CSS class swap.
    setPhase("decay");
    decayTimerRef.current = setTimeout(() => {
      setPhase("idle");
    }, DECAY_TAIL_MS);

    return () => {
      if (decayTimerRef.current) {
        clearTimeout(decayTimerRef.current);
        decayTimerRef.current = null;
      }
    };
  }, [activity]);

  const showEmber = phase !== "idle";
  const emberDirection: "ltr" | "rtl" =
    activity === "nex-generating" ? "ltr" :
    activity === "person-composing" ? "rtl" :
    lastDirection;
  // Line brightness for the underlying overlay pulse.
  const lineIntense = phase === "active";

  return (
    <>
      <style jsx>{`
        /* Ember traversal · organic cubic-bezier so the motion feels
           physically real. QUICK fade-in (over 2% of cycle instead of
           6%) so the glow is visible immediately at the origin profile,
           especially important for short NEX replies. Keyframe percentages
           are FIXED (no random interpolation) so server + client render
           identical CSS — per-session variance comes from the animation
           DURATION only, via the --nex-cl-cycle CSS variable. */
        @keyframes nex-cl-ember-ltr {
          0%   { left: 0%;   opacity: 0; }
          2%   { left: 1%;   opacity: 1; }
          88%  { left: 99%;  opacity: 1; }
          93%  { left: 100%; opacity: 0; }
          100% { left: 100%; opacity: 0; }
        }
        @keyframes nex-cl-ember-rtl {
          0%   { left: 100%; opacity: 0; }
          2%   { left: 99%;  opacity: 1; }
          88%  { left: 1%;   opacity: 1; }
          93%  { left: 0%;   opacity: 0; }
          100% { left: 0%;   opacity: 0; }
        }
        /* Line pulse · slow low-brightness sweep along the entire line
           independent of the ember. Reads as background energy moving
           through the medium. */
        @keyframes nex-cl-line-sweep {
          0%   { background-position: -50% 0; }
          100% { background-position: 150% 0; }
        }
        /* (The nex-cl-ember-breathe keyframe was removed 2026-08-21 —
           the running-glow variant doesn't strobe/breathe, its softness
           already carries the alive feel without an extra layer.) */
        /* Decay fade · applied in the last ${DECAY_FADE_MS}ms of the
           4-second tail via a class swap. Ember opacity gently reduces
           and line brightness settles. */
        @keyframes nex-cl-decay-fade {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }

        .nex-cl-wrap {
          position: absolute;
          left: ${sideInset}px;
          right: ${sideInset}px;
          top: ${topOffset}px;
          height: 2px;
          pointer-events: none;
          z-index: 2;
          overflow: visible;
        }

        /* Base line overlay · quiet when idle. When active, a soft
           orange gradient tints the frame border with an additional
           moving sweep highlight. */
        .nex-cl-line {
          position: absolute;
          left: 0;
          right: 0;
          top: 50%;
          height: 1px;
          transform: translateY(-0.5px);
          background:
            linear-gradient(90deg,
              transparent 0%,
              rgba(249, 115, 22, ${lineIntense ? 0.30 : 0.08}) 15%,
              rgba(249, 115, 22, ${lineIntense ? 0.42 : 0.14}) 50%,
              rgba(249, 115, 22, ${lineIntense ? 0.30 : 0.08}) 85%,
              transparent 100%);
          transition: background 400ms ease;
        }
        /* A moving highlight sweep — extra layer over the base line,
           only visible when active. Different rate than the ember so
           the compound rhythm is organic. */
        .nex-cl-line-sweep {
          position: absolute;
          left: 0;
          right: 0;
          top: 50%;
          height: 1px;
          transform: translateY(-0.5px);
          background: linear-gradient(90deg,
            transparent 0%,
            transparent 35%,
            rgba(255, 200, 120, 0.55) 50%,
            transparent 65%,
            transparent 100%);
          background-size: 200% 100%;
          background-position: -50% 0;
          opacity: ${lineIntense ? 0.9 : 0};
          transition: opacity 500ms ease;
          animation: nex-cl-line-sweep var(--nex-cl-line-sweep, ${BASE_LINE_PULSE_S}s) linear infinite;
        }

        /* RUNNING GLOW (Philip 2026-08-21: "not light but running glow").
           A single soft-diffuse orange glow that FLOWS along the line
           rather than a discrete dot or a stream of particles. Reads
           as continuous energy through the medium — like watching
           plasma or LED-strip light travel along a wire. */
        .nex-cl-glow {
          position: absolute;
          top: 50%;
          /* Wide, soft, elongated · the glow spans a portion of the
             line at any given moment so the "flow" is felt, not just
             a point of light moving. */
          width: 90px;
          height: 12px;
          margin-left: -45px;
          margin-top: -6px;
          border-radius: 50%;
          pointer-events: none;
          filter: blur(3px);
          will-change: left, opacity;
        }
        /* Direction-aware soft gradient · brighter at the LEADING edge
           of the direction of travel, fading toward the trail. Very
           smooth falloff so there are no hard edges anywhere. */
        .nex-cl-glow.ltr {
          background: radial-gradient(ellipse 90px 12px at 68% 50%,
            rgba(255, 235, 195, 0.85) 0%,
            rgba(255, 175, 75,  0.70) 22%,
            rgba(249, 115, 22, 0.45) 48%,
            rgba(249, 115, 22, 0.15) 72%,
            rgba(249, 115, 22, 0)    100%);
          animation: nex-cl-ember-ltr var(--nex-cl-cycle, ${BASE_CYCLE_S}s) ${EMBER_EASING} infinite;
        }
        .nex-cl-glow.rtl {
          background: radial-gradient(ellipse 90px 12px at 32% 50%,
            rgba(255, 235, 195, 0.85) 0%,
            rgba(255, 175, 75,  0.70) 22%,
            rgba(249, 115, 22, 0.45) 48%,
            rgba(249, 115, 22, 0.15) 72%,
            rgba(249, 115, 22, 0)    100%);
          animation: nex-cl-ember-rtl var(--nex-cl-cycle, ${BASE_CYCLE_S}s) ${EMBER_EASING} infinite;
        }

        /* Secondary softer halo layer · same path, slightly delayed,
           much more diffuse. Adds depth to the glow — the leading
           bright core has a lingering warmth behind it. */
        .nex-cl-glow-halo {
          position: absolute;
          top: 50%;
          width: 140px;
          height: 20px;
          margin-left: -70px;
          margin-top: -10px;
          border-radius: 50%;
          pointer-events: none;
          filter: blur(6px);
          opacity: 0.55;
          will-change: left, opacity;
        }
        .nex-cl-glow-halo.ltr {
          background: radial-gradient(ellipse 140px 20px at 55% 50%,
            rgba(255, 165, 60, 0.55) 0%,
            rgba(249, 115, 22, 0.30) 40%,
            rgba(249, 115, 22, 0)    100%);
          animation: nex-cl-ember-ltr var(--nex-cl-cycle, ${BASE_CYCLE_S}s) ${EMBER_EASING} infinite;
          animation-delay: var(--nex-cl-halo-delay, -${(BASE_TRAIL_OFFSET_S * 0.4).toFixed(2)}s);
        }
        .nex-cl-glow-halo.rtl {
          background: radial-gradient(ellipse 140px 20px at 45% 50%,
            rgba(255, 165, 60, 0.55) 0%,
            rgba(249, 115, 22, 0.30) 40%,
            rgba(249, 115, 22, 0)    100%);
          animation: nex-cl-ember-rtl var(--nex-cl-cycle, ${BASE_CYCLE_S}s) ${EMBER_EASING} infinite;
          animation-delay: var(--nex-cl-halo-delay, -${(BASE_TRAIL_OFFSET_S * 0.4).toFixed(2)}s);
        }

        /* Decay-fade class applied during the last ${DECAY_FADE_MS}ms
           of the 4-second tail. Overrides the base opacity. */
        .nex-cl-decay-fade {
          animation-name: nex-cl-decay-fade !important;
          animation-duration: ${DECAY_FADE_MS}ms !important;
          animation-timing-function: ease-out !important;
          animation-fill-mode: forwards !important;
          animation-iteration-count: 1 !important;
        }

        @media (prefers-reduced-motion: reduce) {
          .nex-cl-glow, .nex-cl-glow-halo, .nex-cl-line-sweep {
            animation: none !important;
            opacity: 0 !important;
          }
        }
      `}</style>

      {phase === "decay" && (
        // Kicks off the fade class swap DECAY_FADE_MS before phase→idle.
        <DecayFadeStarter fadeDelayMs={DECAY_TAIL_MS - DECAY_FADE_MS} />
      )}

      <div ref={wrapRef} className="nex-cl-wrap" aria-hidden>
        <div className="nex-cl-line" />
        <div className="nex-cl-line-sweep" />
        {showEmber && (
          <>
            {/* Diffuse halo (behind flowing glow) + brighter core glow.
                Same path, halo slightly lagged — feels like the leading
                glow trails its own aura. */}
            <div className={`nex-cl-glow-halo ${emberDirection}`} />
            <div className={`nex-cl-glow ${emberDirection}`} />
          </>
        )}
      </div>
    </>
  );
});

/** During the decay tail, wait fadeDelayMs then trigger the fade-out
 *  class on the ember/echo/sweep by re-rendering with a data attribute
 *  the CSS keys off. Kept as a tiny sub-component so it doesn't touch
 *  the animation clock of the main component. */
function DecayFadeStarter({ fadeDelayMs }: { fadeDelayMs: number }) {
  const [faded, setFaded] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFaded(true), fadeDelayMs);
    return () => clearTimeout(t);
  }, [fadeDelayMs]);
  // The actual fade is achieved via a global style override that targets
  // sibling elements in the wrap. Keeping it declarative + simple.
  return faded ? (
    <style jsx global>{`
      .nex-cl-wrap .nex-cl-glow,
      .nex-cl-wrap .nex-cl-glow-halo,
      .nex-cl-wrap .nex-cl-line-sweep {
        opacity: 0 !important;
        transition: opacity ${DECAY_FADE_MS}ms ease-out !important;
      }
      .nex-cl-wrap .nex-cl-line {
        background: linear-gradient(90deg,
          transparent 0%,
          rgba(249, 115, 22, 0.08) 50%,
          transparent 100%) !important;
        transition: background ${DECAY_FADE_MS}ms ease-out !important;
      }
    `}</style>
  ) : null;
}
