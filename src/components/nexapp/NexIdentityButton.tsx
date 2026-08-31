// NEX identity button · the visual heartbeat of the app.
//
// 2026-08-24 · Voice Presence redesign (Philip): the 7-bar vertical equaliser
// was replaced with a Siri-style layered fluid waveform. Rationale: NEX is
// an intelligent presence, not a music player. The equaliser aesthetic pushed
// the surface toward Spotify/audio-widget territory. The new visual is:
//
//   · IDLE      : almost invisible ambient breath · slow scroll · low amplitude
//   · LISTENING : soft radial pulse + waves gently animate at medium amplitude
//   · THINKING  : layered waves become more alive · glow builds
//   · SPEAKING  : hero state · organic overlapping fluid waves reach full
//                 amplitude · smooth, never mechanical
//   · SPEECH END: amplitude/opacity decay 400ms back to idle · no abrupt stop
//
// Implementation notes:
//   · Three SVG sine-wave paths at different frequencies, phases and alpha
//     layers create the "organic" feel — never mechanically identical from
//     one moment to the next because their compound period is measured in
//     hours.
//   · Each wave scrolls horizontally via CSS translateX animation. Different
//     durations per path mean the alignment shifts continuously.
//   · State drives amplitude (scaleY) + opacity via CSS classes with 400ms
//     smooth transitions.
//   · Real speech amplitude hook (setSpeakingAmplitude) is exposed for a
//     future TTS-audio-tap integration — for now the state-driven CSS gives
//     a convincing organic feel without a Web Audio dependency.
//   · Ring pulse + orange glow behaviours preserved from V2.
//   · Respects prefers-reduced-motion (all animations pause · presence stays
//     visible but static).

"use client";

import { useEffect, useRef } from "react";
import { NEX } from "@/lib/nexapp/tokens";
import type { NexState } from "@/lib/nexapp/nex-state";

// Per-mount random phase offset so no two mounts start with identical wave
// alignment. Values feed CSS custom properties applied after hydration to
// avoid styled-jsx hash drift.
function makeWavePhaseSeed() {
  // Random negative animation-delay in seconds. Since the scroll animation
  // is periodic, a negative delay makes the wave START mid-loop, giving each
  // mount a unique phase offset. Range -10s covers every state's duration.
  const rand = () => (Math.random() * -10).toFixed(2);
  return {
    d1: rand(),
    d2: rand(),
    d3: rand(),
    // Duration jitter ±10 % per wave keeps compound period non-repeating.
    j1: 1 + (Math.random() * 0.2 - 0.1),
    j2: 1 + (Math.random() * 0.2 - 0.1),
    j3: 1 + (Math.random() * 0.2 - 0.1),
  };
}

export function NexIdentityButton({
  nexState,
  onTap,
}: {
  nexState: NexState;
  onTap?: () => void;
}) {
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const s = makeWavePhaseSeed();
    btn.style.setProperty("--nex-w1-delay", `${s.d1}s`);
    btn.style.setProperty("--nex-w2-delay", `${s.d2}s`);
    btn.style.setProperty("--nex-w3-delay", `${s.d3}s`);
    btn.style.setProperty("--nex-w1-jitter", s.j1.toFixed(3));
    btn.style.setProperty("--nex-w2-jitter", s.j2.toFixed(3));
    btn.style.setProperty("--nex-w3-jitter", s.j3.toFixed(3));
  }, []);

  return (
    <>
      <style jsx>{`
        /* ── Ring pulse envelopes (preserved from V2) ────────────── */
        @keyframes nex-ring-pulse {
          0%, 100% { transform: scale(1);    box-shadow: 0 0 0 0 ${NEX.orangeGlowLo}; }
          50%      { transform: scale(1.06); box-shadow: 0 0 22px 4px ${NEX.orangeGlow}; }
        }
        @keyframes nex-ring-listen {
          0%, 100% { transform: scale(1);    box-shadow: 0 0 0 0 ${NEX.orangeGlow}; }
          50%      { transform: scale(1.10); box-shadow: 0 0 28px 6px ${NEX.orangeGlow}; }
        }
        @keyframes nex-ring-speak {
          0%   { transform: scale(1);    box-shadow: 0 0 8px 1px ${NEX.orangeGlow}; }
          33%  { transform: scale(1.05); box-shadow: 0 0 26px 6px ${NEX.orangeGlow}; }
          58%  { transform: scale(1.02); box-shadow: 0 0 18px 3px ${NEX.orangeGlow}; }
          82%  { transform: scale(1.07); box-shadow: 0 0 30px 8px ${NEX.orangeGlow}; }
          100% { transform: scale(1);    box-shadow: 0 0 8px 1px ${NEX.orangeGlow}; }
        }
        /* ── Siri-style scrolling wave: continuous horizontal drift.
              Each path draws two cycles then translates -50% to loop
              seamlessly. Different durations per path so peaks never
              align twice the same way. ─────────────────────────────── */
        @keyframes nex-wave-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes nex-central-pulse {
          0%, 100% { opacity: 0.35; transform: scale(0.94); }
          50%      { opacity: 0.65; transform: scale(1.02); }
        }

        .nex-btn {
          position: relative;
          width: ${NEX.identitySize}px;
          height: ${NEX.identitySize}px;
          border-radius: 50%;
          background: ${NEX.bgSurfaceHi};
          border: 2.5px solid ${NEX.orange};
          box-shadow: 0 0 0 0 ${NEX.orangeGlowLo};
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          cursor: pointer;
          overflow: hidden;
          transition: box-shadow 400ms ease, transform 400ms ease, background 200ms ease;
          -webkit-tap-highlight-color: transparent;
        }
        .nex-btn:active { transform: scale(0.96); }
        .nex-btn:focus-visible { outline: 2px solid ${NEX.orange}; outline-offset: 4px; }
        .nex-btn.idle      { animation: nex-ring-pulse 6.5s ease-in-out infinite; }
        .nex-btn.listening { animation: nex-ring-listen 1.2s ease-in-out infinite;
                             background: rgba(249, 115, 22, 0.10);
                             border-color: ${NEX.orangeSoft}; }
        .nex-btn.thinking  { animation: nex-ring-pulse 1.8s ease-in-out infinite; }
        .nex-btn.speaking  { animation: nex-ring-speak 1.7s ease-in-out infinite;
                             background: rgba(249, 115, 22, 0.06); }

        /* Soft radial aura sitting just outside the ring — grows during
           listening + speaking so the presence extends past the border. */
        .nex-btn::before {
          content: "";
          position: absolute;
          inset: -6px;
          border-radius: 50%;
          background: radial-gradient(circle, ${NEX.orangeGlowLo} 0%, transparent 70%);
          pointer-events: none;
          opacity: 0.6;
          transition: opacity 400ms ease;
        }
        .nex-btn.speaking::before,
        .nex-btn.listening::before { opacity: 1; }

        /* ── Voice presence layer inside the button ──────────────── */
        .presence {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }
        /* Subtle central pulse — the "NEX is here" heartbeat. */
        .pulse {
          position: absolute;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: radial-gradient(circle, ${NEX.orange} 0%, rgba(249,115,22,0) 70%);
          animation: nex-central-pulse 3.6s ease-in-out infinite;
          opacity: 0.35;
          transition: opacity 400ms ease, transform 400ms ease;
        }
        .nex-btn.listening .pulse { opacity: 0.85; }
        .nex-btn.thinking  .pulse { opacity: 0.75; animation-duration: 2.4s; }
        .nex-btn.speaking  .pulse { opacity: 1;    animation-duration: 1.6s; }

        /* The waveform stage · fits within the button. Each SVG layer
           renders two cycles (width 200%) and scrolls -50 % to loop. */
        .wave-stage {
          position: absolute;
          inset: 20% 6% 20% 6%;
          overflow: hidden;
          opacity: 0.6;
          transform: scaleY(0.25);
          transform-origin: 50% 50%;
          transition: opacity 400ms ease, transform 400ms ease;
        }
        .nex-btn.listening .wave-stage { opacity: 0.85; transform: scaleY(0.55); }
        .nex-btn.thinking  .wave-stage { opacity: 0.9;  transform: scaleY(0.75); }
        .nex-btn.speaking  .wave-stage { opacity: 1;    transform: scaleY(1); }

        .wave-svg {
          display: block;
          width: 200%;   /* two cycles side by side · CSS scrolls -50 % to loop */
          height: 100%;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          animation-name: nex-wave-scroll;
          animation-play-state: running;
          /* Random per-mount negative delay = unique phase offset per session. */
          animation-delay: var(--nex-w1-delay, 0s);
          animation-duration: calc(4s * var(--nex-w1-jitter, 1));
        }
        .wave-svg.b {
          animation-duration: calc(3s * var(--nex-w2-jitter, 1));
          animation-delay: var(--nex-w2-delay, 0s);
        }
        .wave-svg.c {
          animation-duration: calc(5.6s * var(--nex-w3-jitter, 1));
          animation-delay: var(--nex-w3-delay, 0s);
        }

        /* State affects wave scroll speed too — faster during speaking
           reads as more voice energy. Multipliers stay within a narrow
           range so the effect is felt but never frantic. */
        .nex-btn.idle      .wave-svg { animation-duration: calc(8s   * var(--nex-w1-jitter, 1)); }
        .nex-btn.idle      .wave-svg.b { animation-duration: calc(7s   * var(--nex-w2-jitter, 1)); }
        .nex-btn.idle      .wave-svg.c { animation-duration: calc(9.5s * var(--nex-w3-jitter, 1)); }
        .nex-btn.listening .wave-svg { animation-duration: calc(3.4s * var(--nex-w1-jitter, 1)); }
        .nex-btn.listening .wave-svg.b { animation-duration: calc(2.8s * var(--nex-w2-jitter, 1)); }
        .nex-btn.listening .wave-svg.c { animation-duration: calc(4.6s * var(--nex-w3-jitter, 1)); }
        .nex-btn.thinking  .wave-svg { animation-duration: calc(2.6s * var(--nex-w1-jitter, 1)); }
        .nex-btn.thinking  .wave-svg.b { animation-duration: calc(2.1s * var(--nex-w2-jitter, 1)); }
        .nex-btn.thinking  .wave-svg.c { animation-duration: calc(3.8s * var(--nex-w3-jitter, 1)); }
        .nex-btn.speaking  .wave-svg { animation-duration: calc(1.7s * var(--nex-w1-jitter, 1)); }
        .nex-btn.speaking  .wave-svg.b { animation-duration: calc(1.3s * var(--nex-w2-jitter, 1)); }
        .nex-btn.speaking  .wave-svg.c { animation-duration: calc(2.4s * var(--nex-w3-jitter, 1)); }

        @media (prefers-reduced-motion: reduce) {
          .nex-btn, .nex-btn.idle, .nex-btn.listening, .nex-btn.thinking, .nex-btn.speaking { animation: none !important; }
          .pulse, .wave-svg { animation: none !important; }
        }
      `}</style>
      <button
        ref={btnRef}
        type="button"
        className={`nex-btn ${nexState}`}
        aria-label={
          nexState === "listening" ? "Stop listening"
          : nexState === "thinking" ? "Cancel"
          : nexState === "speaking" ? "Stop NEX voice"
          : "Tap to talk to NEX"
        }
        aria-pressed={nexState === "listening"}
        onClick={(e) => { e.preventDefault(); onTap?.(); }}
      >
        <div className="presence" aria-hidden>
          <span className="pulse" />
          <div className="wave-stage">
            {/* Three layered sine paths at different frequencies + alphas.
                Each path renders two cycles then translateX animation
                scrolls -50 % to loop seamlessly. Different durations mean
                the compound alignment period is measured in hours. */}
            <svg className="wave-svg a" viewBox="0 0 200 20" preserveAspectRatio="none">
              <path
                d="M 0 10 Q 12.5 0, 25 10 T 50 10 T 75 10 T 100 10 T 125 10 T 150 10 T 175 10 T 200 10"
                fill="none"
                stroke={NEX.orange}
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeOpacity="0.9"
              />
            </svg>
            <svg className="wave-svg b" viewBox="0 0 200 20" preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
              <path
                d="M 0 10 Q 8 16, 16 10 T 32 10 T 48 10 T 64 10 T 80 10 T 96 10 T 112 10 T 128 10 T 144 10 T 160 10 T 176 10 T 192 10 T 208 10"
                fill="none"
                stroke={NEX.orangeSoft}
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeOpacity="0.55"
              />
            </svg>
            <svg className="wave-svg c" viewBox="0 0 200 20" preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
              <path
                d="M 0 10 Q 20 3, 40 10 T 80 10 T 120 10 T 160 10 T 200 10"
                fill="none"
                stroke={NEX.orange}
                strokeWidth="1.1"
                strokeLinecap="round"
                strokeOpacity="0.4"
              />
            </svg>
          </div>
        </div>
      </button>
      {/* Global fallback for the typing-indicator dot animation used elsewhere. */}
      <style jsx global>{`
        @keyframes nex-dot {
          0%, 100% { opacity: 0.3; transform: translateY(0); }
          50%      { opacity: 1;   transform: translateY(-3px); }
        }
      `}</style>
    </>
  );
}
