// src/components/nex-native/HauntedHotelAtmosphere.tsx
//
// Shared Haunted Hotel theme chrome · 60-second cinematic one-shot.
//
// Timeline (per full page load):
//   0 –  56s · normal flicker + haloes + staggered spark bursts
//               (8 iterations of the 7-second ghost-energy cycle)
//   56 – 57s · brief silence · flicker frozen at full brightness
//   57 – 58s · ONE BIG LIGHT FLASH + final cascading spark burst
//   58 – 60s · the whole animated scene fades to black,
//               revealing the lights-dead photograph underneath
//   60s +    · hotel permanently dark · no further animation
//
// Pure CSS · server component · deterministic (no SSR mismatch).
// Users refresh the page to replay the sequence.

import * as React from "react";

const BG_IMAGE_URL = "/nex-native/chat/depth-cards-bg.png";
// Lights-dead final state · founder-provided photograph of the same
// hotel scene with every lamp extinguished. Shown underneath the
// animated sequence and revealed at t=60s when the wrapper fades.
const DEAD_IMAGE_URL = "/nex-native/chat/haunted-hotel-dark.png";

interface SparkCfg {
  offsetX: number;
  delay: number;
  duration: number;
  drift25: number;
  drift55: number;
  drift80: number;
  drift100: number;
  size: number;
}

// LEFT light · 26 normal sparks across three flicker-dim bursts.
const LEFT_SPARK_CONFIGS: SparkCfg[] = [
  // Wave A · dim ~2.24s
  { offsetX: -5, delay: 2.15, duration: 7.0, drift25: 1,  drift55: -1, drift80: 1,  drift100: 0,  size: 3 },
  { offsetX: 2,  delay: 2.22, duration: 7.0, drift25: -1, drift55: 1,  drift80: -1, drift100: 1,  size: 2 },
  { offsetX: -2, delay: 2.30, duration: 7.0, drift25: 0,  drift55: 2,  drift80: 1,  drift100: 0,  size: 4 },
  { offsetX: 4,  delay: 2.38, duration: 7.0, drift25: -1, drift55: 0,  drift80: 2,  drift100: -1, size: 2 },
  { offsetX: -4, delay: 2.46, duration: 7.0, drift25: 2,  drift55: -1, drift80: 0,  drift100: 1,  size: 3 },
  { offsetX: 1,  delay: 2.54, duration: 7.0, drift25: 0,  drift55: 1,  drift80: -1, drift100: 0,  size: 3 },
  { offsetX: 3,  delay: 2.65, duration: 7.0, drift25: -2, drift55: 0,  drift80: 1,  drift100: -1, size: 2 },
  { offsetX: -3, delay: 2.78, duration: 7.0, drift25: 1,  drift55: 2,  drift80: 0,  drift100: 1,  size: 3 },
  // Wave B · dim ~4.41s
  { offsetX: -3, delay: 4.30, duration: 7.0, drift25: 1,  drift55: 0,  drift80: 1,  drift100: 0,  size: 2 },
  { offsetX: 2,  delay: 4.37, duration: 7.0, drift25: -1, drift55: 1,  drift80: -1, drift100: 1,  size: 3 },
  { offsetX: -1, delay: 4.44, duration: 7.0, drift25: 0,  drift55: 2,  drift80: 1,  drift100: 0,  size: 2 },
  { offsetX: 4,  delay: 4.52, duration: 7.0, drift25: -2, drift55: 0,  drift80: 2,  drift100: -1, size: 4 },
  { offsetX: -4, delay: 4.60, duration: 7.0, drift25: 1,  drift55: -1, drift80: 0,  drift100: 1,  size: 3 },
  { offsetX: 1,  delay: 4.68, duration: 7.0, drift25: 0,  drift55: 1,  drift80: -1, drift100: 0,  size: 3 },
  { offsetX: 3,  delay: 4.78, duration: 7.0, drift25: -1, drift55: 0,  drift80: 1,  drift100: -1, size: 2 },
  { offsetX: -2, delay: 4.90, duration: 7.0, drift25: 1,  drift55: 2,  drift80: 0,  drift100: 1,  size: 3 },
  // Wave C · dim ~5.81s · biggest burst
  { offsetX: -4, delay: 5.70, duration: 7.0, drift25: 2,  drift55: -1, drift80: 1,  drift100: 2,  size: 3 },
  { offsetX: 2,  delay: 5.76, duration: 7.0, drift25: -2, drift55: 0,  drift80: -1, drift100: 1,  size: 4 },
  { offsetX: -2, delay: 5.82, duration: 7.0, drift25: 0,  drift55: 1,  drift80: 2,  drift100: 0,  size: 2 },
  { offsetX: 5,  delay: 5.88, duration: 7.0, drift25: 1,  drift55: -2, drift80: 0,  drift100: 1,  size: 3 },
  { offsetX: -5, delay: 5.94, duration: 7.0, drift25: -1, drift55: 0,  drift80: 2,  drift100: -1, size: 2 },
  { offsetX: 0,  delay: 6.02, duration: 7.0, drift25: 1,  drift55: 1,  drift80: -1, drift100: 0,  size: 4 },
  { offsetX: 3,  delay: 6.10, duration: 7.0, drift25: -2, drift55: -1, drift80: 1,  drift100: 2,  size: 3 },
  { offsetX: -3, delay: 6.20, duration: 7.0, drift25: 0,  drift55: 2,  drift80: 0,  drift100: -1, size: 2 },
  { offsetX: 4,  delay: 6.32, duration: 7.0, drift25: 1,  drift55: -1, drift80: 2,  drift100: 0,  size: 3 },
  { offsetX: -1, delay: 6.45, duration: 7.0, drift25: -1, drift55: 1,  drift80: -1, drift100: 1,  size: 3 },
];

// RIGHT light · 10 sparks in TWO bursts offset ~1s from the left side.
// Right stays silent during left's Wave B so the viewer sees the right
// occasionally skip while the left bursts.
const RIGHT_SPARK_CONFIGS: SparkCfg[] = [
  { offsetX: -3, delay: 3.15, duration: 7.0, drift25: 1,  drift55: -1, drift80: 1,  drift100: 0,  size: 3 },
  { offsetX: 2,  delay: 3.22, duration: 7.0, drift25: -1, drift55: 1,  drift80: -1, drift100: 1,  size: 2 },
  { offsetX: -1, delay: 3.30, duration: 7.0, drift25: 0,  drift55: 2,  drift80: 1,  drift100: 0,  size: 3 },
  { offsetX: 3,  delay: 3.38, duration: 7.0, drift25: -2, drift55: 0,  drift80: 2,  drift100: -1, size: 2 },
  { offsetX: -2, delay: 3.46, duration: 7.0, drift25: 1,  drift55: -1, drift80: 0,  drift100: 1,  size: 3 },
  { offsetX: 2,  delay: 6.45, duration: 7.0, drift25: 0,  drift55: 1,  drift80: -1, drift100: 0,  size: 3 },
  { offsetX: -3, delay: 6.52, duration: 7.0, drift25: 1,  drift55: 0,  drift80: 1,  drift100: 1,  size: 2 },
  { offsetX: 1,  delay: 6.60, duration: 7.0, drift25: -1, drift55: 1,  drift80: -1, drift100: 0,  size: 4 },
  { offsetX: 3,  delay: 6.68, duration: 7.0, drift25: 0,  drift55: -1, drift80: 2,  drift100: -1, size: 2 },
  { offsetX: -1, delay: 6.76, duration: 7.0, drift25: 1,  drift55: 2,  drift80: 0,  drift100: 1,  size: 3 },
];

// Final-flash cascade sparks · fire ONCE at the end of the 60s cycle
// (t ≈ 57-58.5s). Larger, brighter, staggered 0-0.6s via animationDelay.
// animationIterationCount: 1, fill-mode: forwards so they stay dark
// after the one-shot.
interface FinalSparkCfg {
  offsetX: number;
  startDelay: number; // 0 .. 0.6s · staggers inside the final burst
  drift25: number;
  drift55: number;
  drift80: number;
  drift100: number;
  size: number;
}
const FINAL_SPARK_CONFIGS: FinalSparkCfg[] = [
  { offsetX: -6, startDelay: 0.00, drift25: 1,  drift55: -1, drift80: 1,  drift100: 0,  size: 4 },
  { offsetX: 3,  startDelay: 0.05, drift25: -1, drift55: 1,  drift80: -1, drift100: 1,  size: 3 },
  { offsetX: -3, startDelay: 0.10, drift25: 0,  drift55: 2,  drift80: 1,  drift100: 0,  size: 5 },
  { offsetX: 5,  startDelay: 0.15, drift25: -2, drift55: 0,  drift80: 2,  drift100: -1, size: 3 },
  { offsetX: -5, startDelay: 0.20, drift25: 2,  drift55: -1, drift80: 0,  drift100: 1,  size: 4 },
  { offsetX: 1,  startDelay: 0.25, drift25: 0,  drift55: 1,  drift80: -1, drift100: 0,  size: 3 },
  { offsetX: 4,  startDelay: 0.30, drift25: -2, drift55: 0,  drift80: 1,  drift100: -1, size: 5 },
  { offsetX: -4, startDelay: 0.35, drift25: 1,  drift55: 2,  drift80: 0,  drift100: 1,  size: 4 },
  { offsetX: 2,  startDelay: 0.42, drift25: -1, drift55: 0,  drift80: 1,  drift100: 0,  size: 3 },
  { offsetX: -2, startDelay: 0.50, drift25: 0,  drift55: 1,  drift80: -1, drift100: 1,  size: 5 },
  { offsetX: 3,  startDelay: 0.55, drift25: 1,  drift55: -1, drift80: 2,  drift100: 0,  size: 3 },
  { offsetX: -3, startDelay: 0.60, drift25: -1, drift55: 2,  drift80: 0,  drift100: 1,  size: 4 },
];

const LIGHT_POSITIONS: Array<{
  xPct: number;
  yPct: number;
  phase: number;
  sparkOffsetX?: number;
  sparks: SparkCfg[];
}> = [
  { xPct: 32, yPct: 20, phase: 0,   sparkOffsetX: -47, sparks: LEFT_SPARK_CONFIGS },
  { xPct: 68, yPct: 20, phase: 2.4, sparkOffsetX: 15,  sparks: RIGHT_SPARK_CONFIGS },
];

export function HauntedHotelAtmosphere(): React.ReactElement {
  return (
    <>
      <style>{`
        /* ── Normal 7s cycle · runs 8 times (= 56s) then freezes ── */
        @keyframes hh-light-flicker {
          0%, 29%, 100%           { opacity: 1; }
          30%                     { opacity: 0.75; }
          31%                     { opacity: 1; }
          32%                     { opacity: 0.15; }
          33%                     { opacity: 0.95; }
          34%                     { opacity: 0.4; }
          35%                     { opacity: 1; }
          60%                     { opacity: 0.9; }
          61%                     { opacity: 1; }
          62%, 64%                { opacity: 0.5; }
          63%                     { opacity: 0.08; }
          65%                     { opacity: 0.85; }
          66%                     { opacity: 1; }
          82%                     { opacity: 1; }
          83%                     { opacity: 0.3; }
          84%                     { opacity: 1; }
        }
        @keyframes hh-light-halo {
          0%, 29%, 100%           { opacity: 0.9; filter: blur(14px); }
          30%, 34%, 60%, 64%, 82% { opacity: 0.45; filter: blur(22px); }
          32%, 63%, 83%           { opacity: 0.1; filter: blur(28px); }
        }
        @keyframes hh-spark-burst-fall {
          0%   { opacity: 0; transform: translate(0, 0) scale(1); background: #fffbe6; box-shadow: 0 0 8px #fffbe6, 0 0 14px rgba(255,220,120,0.9); }
          1%   { opacity: 1; }
          4%   { transform: translate(var(--hh-drift-25, 0px), 50px) scale(0.95); background: #ffe28a; box-shadow: 0 0 7px #ffe28a, 0 0 12px rgba(255,180,80,0.85); }
          8%   { transform: translate(var(--hh-drift-55, 0px), 130px) scale(0.75); background: #ffb348; box-shadow: 0 0 5px #ffb348, 0 0 10px rgba(255,120,30,0.7); opacity: 0.9; }
          11%  { transform: translate(var(--hh-drift-80, 0px), 220px) scale(0.5); background: #ff6a1a; box-shadow: 0 0 3px #ff6a1a; opacity: 0.4; }
          14%  { transform: translate(var(--hh-drift-100, 0px), 310px) scale(0.25); background: #7a1a0a; opacity: 0; }
          100% { opacity: 0; transform: translate(0, 0) scale(1); }
        }

        /* ── 60s outro sequence · fades the whole animated layer out
             and reveals the lights-dead photograph underneath. One
             iteration · fill-mode forwards so the final dark state
             persists. ── */
        @keyframes hh-atmosphere-fadeout {
          0%, 96.67% { opacity: 1; filter: none; }
          97%        { opacity: 0.95; filter: brightness(0.9); }
          98%        { opacity: 0.6;  filter: brightness(0.5); }
          99%        { opacity: 0.25; filter: brightness(0.15); }
          100%       { opacity: 0;    filter: brightness(0); }
        }
        /* One big final light flash at ~57-58.5s of the 60s cycle. */
        @keyframes hh-final-flash {
          0%, 94%   { opacity: 0; transform: scale(1); }
          94.5%     { opacity: 0; transform: scale(1); }
          95%       { opacity: 0.4; transform: scale(1.05); }
          95.5%     { opacity: 0.85; transform: scale(1.12); }
          96%       { opacity: 1; transform: scale(1.18); }
          96.5%     { opacity: 0.75; transform: scale(1.14); }
          97%       { opacity: 0.4; transform: scale(1.08); }
          97.5%     { opacity: 0.15; transform: scale(1.02); }
          98%, 100% { opacity: 0; transform: scale(1); }
        }
        /* Final spark cascade · fires once at ~57-58s · staggered via
           per-element animation-delay. 2.4s duration = fast fall; one
           iteration · fill-mode forwards keeps sparks dark after. */
        @keyframes hh-final-spark-fall {
          0%   { opacity: 0; transform: translate(0, 0) scale(1); background: #fffbe6; box-shadow: 0 0 10px #fffbe6, 0 0 22px rgba(255,230,140,0.95); }
          2%   { opacity: 1; }
          15%  { transform: translate(var(--hh-drift-25, 0px), 70px) scale(1.0); background: #ffe28a; box-shadow: 0 0 9px #ffe28a, 0 0 18px rgba(255,180,80,0.9); }
          40%  { transform: translate(var(--hh-drift-55, 0px), 170px) scale(0.8); background: #ffb348; box-shadow: 0 0 6px #ffb348, 0 0 14px rgba(255,120,30,0.75); opacity: 0.9; }
          65%  { transform: translate(var(--hh-drift-80, 0px), 260px) scale(0.5); background: #ff6a1a; box-shadow: 0 0 4px #ff6a1a; opacity: 0.5; }
          85%  { transform: translate(var(--hh-drift-100, 0px), 340px) scale(0.3); background: #7a1a0a; opacity: 0; }
          100% { opacity: 0; transform: translate(var(--hh-drift-100, 0px), 340px) scale(0.3); }
        }
      `}</style>

      {/* Root · fixed · the whole thing sits under the chat content. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          overflow: "hidden",
        }}
      >
        {/* Dead layer · hotel3 photo · always visible underneath · the
            animated sequence fades out at t=60s to reveal this. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${DEAD_IMAGE_URL})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />

        {/* Animated sequence wrapper · fades out at 58-60s via a one-
            shot 60s animation. After t=60s the wrapper is at opacity 0
            and everything inside is invisible, letting the dead layer
            above show through. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            animationName: "hh-atmosphere-fadeout",
            animationDuration: "60s",
            animationTimingFunction: "linear",
            animationIterationCount: 1,
            animationFillMode: "forwards",
            willChange: "opacity, filter",
          }}
        >
          {/* Lights-on photo · opacity flickers · 8 iterations of 7s */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${BG_IMAGE_URL})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              animationName: "hh-light-flicker",
              animationDuration: "7s",
              animationIterationCount: 8,
              animationTimingFunction: "steps(1)",
              animationFillMode: "forwards",
              willChange: "opacity",
            }}
          />

          {/* Light haloes · one per lamp */}
          {LIGHT_POSITIONS.map((pos, i) => (
            <div
              key={`halo-${i}`}
              style={{
                position: "absolute",
                left: `${pos.xPct}%`,
                top: `${pos.yPct}%`,
                width: 160,
                height: 160,
                marginLeft: -80,
                marginTop: -80,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(255,235,180,0.75) 0%, rgba(255,200,120,0.35) 35%, rgba(255,170,70,0) 70%)",
                animationName: "hh-light-halo",
                animationDuration: "7s",
                animationIterationCount: 8,
                animationTimingFunction: "steps(1)",
                animationDelay: `${pos.phase}s`,
                animationFillMode: "forwards",
                mixBlendMode: "screen",
                willChange: "opacity, filter",
              }}
            />
          ))}

          {/* Normal sparks · per-light staggered bursts · 8 iterations */}
          {LIGHT_POSITIONS.map((pos, i) =>
            pos.sparks.map((s, j) => (
              <div
                key={`spark-${i}-${j}`}
                style={
                  {
                    position: "absolute",
                    left: `calc(${pos.xPct}% + ${s.offsetX + (pos.sparkOffsetX ?? 0)}px)`,
                    top: `calc(${pos.yPct}% + 80px)`,
                    width: s.size,
                    height: s.size,
                    marginLeft: -s.size / 2,
                    borderRadius: "50%",
                    animationName: "hh-spark-burst-fall",
                    animationDuration: `${s.duration}s`,
                    animationTimingFunction: "linear",
                    animationIterationCount: 8,
                    animationFillMode: "both",
                    animationDelay: `${s.delay}s`,
                    mixBlendMode: "screen",
                    willChange: "transform, opacity, background",
                    "--hh-drift-25": `${s.drift25}px`,
                    "--hh-drift-55": `${s.drift55}px`,
                    "--hh-drift-80": `${s.drift80}px`,
                    "--hh-drift-100": `${s.drift100}px`,
                  } as React.CSSProperties
                }
              />
            )),
          )}

          {/* Final flash · one bright bloom at each lamp at ~57-58s */}
          {LIGHT_POSITIONS.map((pos, i) => (
            <div
              key={`final-flash-${i}`}
              style={{
                position: "absolute",
                left: `${pos.xPct}%`,
                top: `${pos.yPct}%`,
                width: 420,
                height: 420,
                marginLeft: -210,
                marginTop: -210,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(255,255,245,1) 0%, rgba(255,230,180,0.75) 25%, rgba(255,200,120,0.3) 55%, rgba(255,170,70,0) 80%)",
                animationName: "hh-final-flash",
                animationDuration: "60s",
                animationTimingFunction: "linear",
                animationIterationCount: 1,
                animationFillMode: "forwards",
                mixBlendMode: "screen",
                willChange: "opacity, transform",
              }}
            />
          ))}

          {/* Final spark cascade · one-shot burst from each lamp at
              ~57-58.5s. 2.4s duration · fires once · staggered via
              animation-delay (57.0 + startDelay). */}
          {LIGHT_POSITIONS.map((pos, i) =>
            FINAL_SPARK_CONFIGS.map((f, j) => (
              <div
                key={`final-spark-${i}-${j}`}
                style={
                  {
                    position: "absolute",
                    left: `calc(${pos.xPct}% + ${f.offsetX + (pos.sparkOffsetX ?? 0)}px)`,
                    top: `calc(${pos.yPct}% + 80px)`,
                    width: f.size,
                    height: f.size,
                    marginLeft: -f.size / 2,
                    borderRadius: "50%",
                    animationName: "hh-final-spark-fall",
                    animationDuration: "2.4s",
                    animationTimingFunction: "linear",
                    animationIterationCount: 1,
                    animationFillMode: "forwards",
                    animationDelay: `${57.0 + f.startDelay}s`,
                    mixBlendMode: "screen",
                    willChange: "transform, opacity, background",
                    "--hh-drift-25": `${f.drift25}px`,
                    "--hh-drift-55": `${f.drift55}px`,
                    "--hh-drift-80": `${f.drift80}px`,
                    "--hh-drift-100": `${f.drift100}px`,
                    opacity: 0,
                  } as React.CSSProperties
                }
              />
            )),
          )}
        </div>
      </div>
    </>
  );
}
