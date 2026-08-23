// NEX identity button · the visual heartbeat of the app.
//
// Four animation states per Philip's 2026-08-21 spec §11:
//   · idle      : almost static · tiny ambient glow · waveform resting
//   · listening : energetic ring pulse · waveform reacting fast
//   · thinking  : gentle waveform + slow ring pulse
//   · speaking  : ORGANIC, wavy, semi-random 7-bar equaliser + fast pulse
//
// Animation V2 (Philip 2026-08-21): "never mechanically identical from
// one response to the next." Achieved by:
//   1. Per-mount random SEED that shifts each bar's speaking-state
//      animation duration by ±12% and delay by ±80ms. Different every
//      time the component mounts (new page load / new session).
//   2. Seven bars, each with its OWN duration + delay — the compound
//      period is measured in hours, so no viewer sees a repeat.
//   3. State transitions eased over 400ms so idle→speaking glides.
// Pure CSS: no JS tick, no repaint cost. Respects prefers-reduced-motion.

"use client";

import { useEffect, useRef } from "react";
import { NEX } from "@/lib/nexapp/tokens";
import type { NexState } from "./NexAppHome";

// Animation V2 · per-session bar-timing randomisation via CSS custom
// properties. Baseline timings live in the CSS (server + client render
// identical HTML — no hydration mismatch). After mount, a useEffect
// generates a random seed and sets --nex-b{N}-dur / --nex-b{N}-delay
// on the button element; the CSS then uses var(--nex-b{N}-dur) so the
// speaking wave picks up the jittered values with zero style-hash drift.
//
// IMPORTANT: never interpolate Math.random() output directly into the
// <style jsx> block. styled-jsx hashes the CSS text — different content
// on server vs client → hydration mismatch. Values that vary per session
// MUST flow through CSS custom properties set after hydration.

// Per-bar (duration_seconds, delay_ms) jittered from a baseline by ±12%
// dur and ±80ms delay. Called ONCE per mount in a useEffect.
function makeSpeakingSeed() {
  const jitter = (base: number, pct: number) => base + (Math.random() * 2 - 1) * base * pct;
  const jitterMs = (base: number, ms: number) => Math.round(base + (Math.random() * 2 - 1) * ms);
  return {
    b1: { dur: jitter(0.62, 0.12), delay: jitterMs(0,   80) },
    b2: { dur: jitter(0.78, 0.12), delay: jitterMs(70,  80) },
    b3: { dur: jitter(0.55, 0.12), delay: jitterMs(130, 80) },
    b4: { dur: jitter(0.71, 0.12), delay: jitterMs(210, 80) },
    b5: { dur: jitter(0.59, 0.12), delay: jitterMs(155, 80) },
    b6: { dur: jitter(0.83, 0.12), delay: jitterMs(95,  80) },
    b7: { dur: jitter(0.67, 0.12), delay: jitterMs(40,  80) },
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

  // Apply per-session bar jitter AFTER hydration. Server-rendered HTML
  // has no inline styles or random values; client sets CSS variables
  // on the button element post-mount. Zero styled-jsx hash drift.
  useEffect(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const s = makeSpeakingSeed();
    const bars = [s.b1, s.b2, s.b3, s.b4, s.b5, s.b6, s.b7];
    bars.forEach((b, i) => {
      btn.style.setProperty(`--nex-b${i + 1}-dur`, `${b.dur.toFixed(3)}s`);
      btn.style.setProperty(`--nex-b${i + 1}-delay`, `${b.delay}ms`);
    });
  }, []);

  return (
    <>
      <style jsx>{`
        @keyframes nex-ring-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 ${NEX.orangeGlowLo}; }
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
        @keyframes nex-wave-bar {
          0%, 100% { transform: scaleY(0.4); }
          50%      { transform: scaleY(1); }
        }
        /* Organic speaking wave · four-keyframe curve so peaks never
           align across bars with different durations. */
        @keyframes nex-wave-speak {
          0%   { transform: scaleY(0.30); }
          22%  { transform: scaleY(0.95); }
          41%  { transform: scaleY(0.55); }
          63%  { transform: scaleY(1.05); }
          84%  { transform: scaleY(0.42); }
          100% { transform: scaleY(0.30); }
        }
        @keyframes nex-dot {
          0%, 100% { opacity: 0.3; transform: translateY(0); }
          50%      { opacity: 1;   transform: translateY(-3px); }
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
        .wave {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 3px;
          height: 30px;
        }
        .wave span {
          display: block;
          width: 3px;
          border-radius: 2px;
          background: ${NEX.orange};
          transform-origin: 50% 50%;
          transform: scaleY(0.55);
          transition: transform 300ms ease;
        }
        /* Seven bars · symmetrical envelope. */
        .wave .b1 { height:  8px; }
        .wave .b2 { height: 14px; }
        .wave .b3 { height: 22px; }
        .wave .b4 { height: 30px; }
        .wave .b5 { height: 22px; }
        .wave .b6 { height: 14px; }
        .wave .b7 { height:  8px; }
        /* Idle / listening / thinking · single-shared duration is fine
           (crisp equaliser look). */
        .nex-btn.idle      .wave span { animation: nex-wave-bar 4.5s ease-in-out infinite; }
        .nex-btn.listening .wave span { animation: nex-wave-bar 0.65s ease-in-out infinite; }
        .nex-btn.thinking  .wave span { animation: nex-wave-bar 0.9s  ease-in-out infinite; }
        /* Speaking · Animation V2: each bar gets its OWN duration + delay
           via CSS custom properties set by the mount-time useEffect.
           Baseline (fallback) values in var(--x, DEFAULT) keep the
           server-rendered HTML working before hydration completes, so
           the CSS text is identical on server and client — no styled-jsx
           hash drift. Client-side effect overrides with a random seed
           post-mount; the viewer sees the jitter as soon as speak starts. */
        .nex-btn.speaking .wave .b1 { animation: nex-wave-speak var(--nex-b1-dur, 0.620s) ease-in-out infinite; animation-delay: var(--nex-b1-delay,   0ms); }
        .nex-btn.speaking .wave .b2 { animation: nex-wave-speak var(--nex-b2-dur, 0.780s) ease-in-out infinite; animation-delay: var(--nex-b2-delay,  70ms); }
        .nex-btn.speaking .wave .b3 { animation: nex-wave-speak var(--nex-b3-dur, 0.550s) ease-in-out infinite; animation-delay: var(--nex-b3-delay, 130ms); }
        .nex-btn.speaking .wave .b4 { animation: nex-wave-speak var(--nex-b4-dur, 0.710s) ease-in-out infinite; animation-delay: var(--nex-b4-delay, 210ms); }
        .nex-btn.speaking .wave .b5 { animation: nex-wave-speak var(--nex-b5-dur, 0.590s) ease-in-out infinite; animation-delay: var(--nex-b5-delay, 155ms); }
        .nex-btn.speaking .wave .b6 { animation: nex-wave-speak var(--nex-b6-dur, 0.830s) ease-in-out infinite; animation-delay: var(--nex-b6-delay,  95ms); }
        .nex-btn.speaking .wave .b7 { animation: nex-wave-speak var(--nex-b7-dur, 0.670s) ease-in-out infinite; animation-delay: var(--nex-b7-delay,  40ms); }
        /* Delays for the non-speaking states use the symmetric stagger. */
        .nex-btn.idle      .wave .b1,
        .nex-btn.listening .wave .b1,
        .nex-btn.thinking  .wave .b1 { animation-delay:   0ms; }
        .nex-btn.idle      .wave .b2,
        .nex-btn.listening .wave .b2,
        .nex-btn.thinking  .wave .b2 { animation-delay:  60ms; }
        .nex-btn.idle      .wave .b3,
        .nex-btn.listening .wave .b3,
        .nex-btn.thinking  .wave .b3 { animation-delay: 120ms; }
        .nex-btn.idle      .wave .b4,
        .nex-btn.listening .wave .b4,
        .nex-btn.thinking  .wave .b4 { animation-delay: 180ms; }
        .nex-btn.idle      .wave .b5,
        .nex-btn.listening .wave .b5,
        .nex-btn.thinking  .wave .b5 { animation-delay: 120ms; }
        .nex-btn.idle      .wave .b6,
        .nex-btn.listening .wave .b6,
        .nex-btn.thinking  .wave .b6 { animation-delay:  60ms; }
        .nex-btn.idle      .wave .b7,
        .nex-btn.listening .wave .b7,
        .nex-btn.thinking  .wave .b7 { animation-delay:   0ms; }
        @media (prefers-reduced-motion: reduce) {
          .nex-btn, .nex-btn.idle, .nex-btn.listening, .nex-btn.thinking, .nex-btn.speaking { animation: none !important; }
          .wave span { animation: none !important; }
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
        <div className="wave" aria-hidden>
          <span className="b1" />
          <span className="b2" />
          <span className="b3" />
          <span className="b4" />
          <span className="b5" />
          <span className="b6" />
          <span className="b7" />
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
