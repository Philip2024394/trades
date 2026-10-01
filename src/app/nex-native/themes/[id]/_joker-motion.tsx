"use client";

// src/app/nex-native/themes/[id]/_joker-motion.tsx
//
// Joker theme · motion prototypes · sealed 2026-10-01.
// -----------------------------------------------------
// Ten distinct animation overlays for the founder to compare on top
// of the existing Joker chat theme. Each variant is a single fixed-
// position, pointer-events:none overlay that layers above the
// PortraitBloom wallpaper + bubbles but below any modal or picker.
//
// URL contract · the theme viewer maps `?motion=<variant>` to one of
// the ten switch arms below. Missing / unknown values render null so
// the plain Joker theme keeps showing.
//
// ── NEX MOTION PICTURE ANIMATION STANDARDS ─────────────────────────
// Every variant in this file must satisfy the following bar. This is
// the doctrine · deviations require Founder sign-off.
//
//  · GPU-only properties: animate transform + opacity + filter · never
//    top / left / width / height / margin. Compositor thread stays
//    smooth even under Fast Refresh + WebSocket reconnect churn.
//  · Max element count · 40 particles at any moment · anything more
//    trips low-end Android GPUs on scroll.
//  · Duration window · single-cycle loop between 3s and 14s · shorter
//    reads jittery, longer reads dead.
//  · Opacity ceiling · 0.9 · never fully opaque so bubble text stays
//    readable behind the effect.
//  · z-index · 3 (above wallpaper + mist, below composer + modals).
//  · Never intercept taps · every overlay uses pointer-events:none
//    on its root AND on every descendant that could catch a click.
//  · Deterministic seed · particle positions come from a numeric seed
//    so SSR + hydration render identical positions · no `Math.random()`
//    in the render body.
//  · Prefer accent hex · pull the theme's accent (Joker green #8FFF6E)
//    for tinted glows so the effect belongs to the theme's identity.
//  · Prefers-reduced-motion: for a prototype set we intentionally
//    keep the animation live · the sealed variant that wins will need
//    a @media (prefers-reduced-motion) killswitch before ship.
// ────────────────────────────────────────────────────────────────────

import * as React from "react";
import type { JokerMotionVariant } from "./_joker-motion-data";

// Re-export the type so existing client importers of this module keep
// working · the array + parser live in _joker-motion-data.ts so they
// can also be read from Server Components (page.tsx, motion/page.tsx).
export type { JokerMotionVariant } from "./_joker-motion-data";
export { parseJokerMotion, JOKER_MOTION_INDEX } from "./_joker-motion-data";

const JOKER_GREEN = "#8FFF6E";
const JOKER_GREEN_SOFT = "rgba(143,255,110,0.55)";

/** Deterministic pseudo-random · same seed → same values on SSR + client.
 *  Uses a Linear Congruential Generator so we never depend on Math.random
 *  during the render pass. Values are in [0, 1). */
function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const OVERLAY_STYLE_BASE: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  // Very high z-index so ambient motion (falling cards, sparks, bats,
  // rain, etc.) draws ON TOP of the emoji picker modal, side drawers,
  // and any nested stacking contexts inside the chat shell. Overlays
  // are pointer-events:none so they never block interaction below.
  zIndex: 9997,
  overflow: "hidden",
};

// Showcase pool · one line is picked at random per 24s cycle and
// revealed on the face of the center card. Curly apostrophes are
// intentional · keep punctuation + spacing exactly as the Founder
// pasted them.
const JOKER_SHOWCASE_MESSAGES = [
  "What’s meant for you will never pass you.",
  "What breaks you may reveal you.",
  "Not every smile means happiness.",
  "Chaos reveals what order conceals.",
  "Trust slowly. Watch quietly.",
  "Some masks become faces.",
  "The joke is always on time.",
  "What you fear may free you.",
  "Silence speaks when words lie.",
  "Everyone has a breaking point.",
  "Truth rarely knocks twice.",
  "A calm mind sees the chaos.",
  "Sometimes losing is the escape.",
  "The darkest roads teach the brightest lessons.",
  "People show you who they are. Believe them.",
  "Never chase what chooses to leave.",
  "What leaves was never truly yours.",
  "A little madness keeps life interesting.",
  "The world makes sense until people enter it.",
  "Smile. The story isn’t finished.",
] as const;

export function JokerMotionOverlay({
  variant,
}: {
  variant: JokerMotionVariant | null;
}): React.JSX.Element | null {
  if (!variant) return null;
  switch (variant) {
    case "rain":
      return <RainOverlay />;
    case "sparks":
      return <SparksOverlay />;
    case "bat":
      return <BatOverlay />;
    case "cards":
      return <CardsOverlay />;
    case "lightning":
      return <LightningOverlay />;
    case "bubbles":
      return <BubblesOverlay />;
    case "confetti":
      return <ConfettiOverlay />;
    case "smoke":
      return <SmokeOverlay />;
    case "embers":
      return <EmbersOverlay />;
    case "glitch":
      return <GlitchOverlay />;
  }
}

// ─── Rain ────────────────────────────────────────────────────────────
// Natural rain · translucent silver-blue drops · smaller streaks ·
// drops read as real rainfall rather than toxic drip. Founder-tuned
// 2026-10-01.
function RainOverlay(): React.JSX.Element {
  const rand = seededRand(101);
  const drops = Array.from({ length: 40 }, () => ({
    left: rand() * 100,
    dur: 0.7 + rand() * 0.6, // slightly faster · reads as real rain cadence
    delay: -rand() * 2,
    height: 14 + rand() * 20, // 14-34px · roughly half the previous size
    opacity: 0.3 + rand() * 0.35,
  }));
  // Natural rain palette · faint silvery-blue with a brighter leading
  // edge · reads over any wallpaper without tinting the scene green.
  const RAIN_HEAD = "rgba(215,230,245,0.85)";
  const RAIN_TAIL = "rgba(170,195,220,0.25)";
  return (
    <div aria-hidden style={OVERLAY_STYLE_BASE}>
      <style>{`
        @keyframes joker-rain-fall {
          0%   { transform: translate3d(0, -20vh, 0); opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: translate3d(0, 120vh, 0); opacity: 0; }
        }
      `}</style>
      {drops.map((d, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: 0,
            left: `${d.left}%`,
            width: 1,
            height: d.height,
            background: `linear-gradient(to bottom, transparent 0%, ${RAIN_TAIL} 55%, ${RAIN_HEAD} 100%)`,
            opacity: d.opacity,
            animation: `joker-rain-fall ${d.dur}s linear infinite`,
            animationDelay: `${d.delay}s`,
            willChange: "transform, opacity",
          }}
        />
      ))}
    </div>
  );
}

// ─── Welding Sparks ──────────────────────────────────────────────────
// Natural welding drops · sealed 2026-10-01 per founder direction.
// Hot orange sparks fall from the phone's TOP-RIGHT edge in an uneven
// rhythm (3 drops · pause · 1 drop · pause · 2 drops · pause · 3 drops
// · pause · 1 drop · repeat) so it reads like a real weld popping hot
// droplets, not a continuous spray. Each drop glows white-hot at the
// seam, cools to orange as it falls, snaps dark before it reaches
// mid-screen.
function SparksOverlay(): React.JSX.Element {
  const rand = seededRand(202);
  const CYCLE = 12; // seconds · one full burst sequence
  // [startAtSeconds, count] · uneven cadence modelled on a welder
  // laying a bead: short cluster, pause, single pop, pause, pair,
  // another cluster, lone drop, pause.
  const bursts: Array<[number, number]> = [
    [0.0, 3],
    [2.8, 1],
    [5.3, 2],
    [7.6, 3],
    [10.2, 1],
  ];
  const sparks: Array<{
    delay: number;
    left: number;
    size: number;
    xShift: number;
    yFall: number;
    hue: string;
  }> = [];
  for (const [startAt, count] of bursts) {
    for (let k = 0; k < count; k++) {
      sparks.push({
        // Each drop in a burst is offset by ~0.14-0.22s so they pop in
        // sequence rather than appearing simultaneously.
        delay: startAt + k * (0.14 + rand() * 0.08),
        // Spawn band on the TOP-RIGHT edge · 82-97% of width · each
        // drop originates from a slightly different point along the rim
        // so successive bursts aren't exactly stacked.
        left: 82 + rand() * 15,
        // Little pinpricks · 1.5-3.5px · the biggest drops read as
        // fat welding droplets, the smallest as sparks.
        size: 1.5 + rand() * 2,
        // Drops drift inward (leftward) as they fall · 2-12vw total
        // horizontal shift so the stream fans gently away from the
        // edge of the device.
        xShift: -(2 + rand() * 10),
        // Fall distance · 18-34vh so most drops die out before the
        // mid-screen, matching the way real molten droplets cool
        // and fade quickly.
        yFall: 18 + rand() * 16,
        // Palette · only the BRIGHT sparks · white-hot, warm white,
        // and a cool white tint so each drop reads like a crisp
        // sparkle (light hitting water) rather than a dim ember.
        hue: rand() > 0.55 ? "#FFFFFF" : rand() > 0.25 ? "#FFF8E0" : "#E6F2FF",
      });
    }
  }
  return (
    <div aria-hidden style={OVERLAY_STYLE_BASE}>
      <style>{`
        /* Burst drop · a drop is visible for only ~1.2s of the 12s
           cycle (10% of the keyframe) and invisible for the rest. The
           delay on each drop + the burst-group definition in JS places
           the visible windows in the 3-1-2-3-1 cadence. */
        @keyframes joker-spark-weld-drop {
          0%, 0.3%  { opacity: 0; transform: translate3d(0, 0, 0) scale(1.1); }
          0.6%      { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
          6%        { opacity: 0.9; transform: translate3d(calc(var(--jx-x, 0) * 0.5), 10vh, 0) scale(0.75); }
          10%       { opacity: 0; transform: translate3d(var(--jx-x, 0), var(--jx-y, 20vh), 0) scale(0.35); }
          100%      { opacity: 0; }
        }
        @keyframes joker-spark-weld-glow {
          0%,100% { filter: drop-shadow(0 0 2px currentColor); }
          50%     { filter: drop-shadow(0 0 7px currentColor); }
        }
      `}</style>
      {sparks.map((s, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: 0,
            left: `${s.left}%`,
            width: s.size,
            height: s.size,
            borderRadius: "50%",
            background: s.hue,
            color: s.hue,
            boxShadow: `0 0 ${s.size * 5}px ${s.hue}, 0 0 ${s.size * 12}px rgba(255, 255, 255, 0.55)`,
            animation: `joker-spark-weld-drop ${CYCLE}s cubic-bezier(0.4, 0.2, 0.6, 1) infinite, joker-spark-weld-glow ${CYCLE / 6}s ease-in-out infinite`,
            animationDelay: `${s.delay}s`,
            ["--jx-x" as string]: `${s.xShift}vw`,
            ["--jx-y" as string]: `${s.yFall}vh`,
            willChange: "transform, opacity",
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// ─── Flying Bat ──────────────────────────────────────────────────────
// Founder-provided bat pack PNG (bats-removebg-preview.png) ·
// emits from near the composer SEND BUTTON (bottom-right of the
// phone) and flies UP the screen in a slightly fanning column, like
// a startled flock bursting out of the inbox. Each bat has its own
// drift path, scale, rotation jitter, and timing so the flock never
// marches in formation. Founder-tuned 2026-10-01.
function BatOverlay(): React.JSX.Element {
  const rand = seededRand(404);
  // 14 bats spawn from a cluster near the send button (bottom-right)
  // then drift UP + LEFT across the screen in a slow glide ·
  // Founder-tuned 2026-10-01 · "slow down + fly left up randomly".
  // Each bat picks its own leftward reach so the flock fans out across
  // the top-left quadrant rather than marching in one lane.
  const bats = Array.from({ length: 14 }, (_, i) => {
    // Slow glide · 9-16s to clear the screen · roughly twice the
    // previous 4-7.5s so a bat lingers long enough to read.
    const dur = 9 + rand() * 7;
    // Wider stagger window to match the slower cycle · otherwise the
    // sky would feel sparse between bats.
    const delay = -(i * 1.0 + rand() * 1.4);
    // Spawn position · tight cluster around the send button.
    const spawnLeft = 76 + rand() * 16; // 76-92% of width
    const spawnBottomPx = 70 + rand() * 40;
    // Direction · ALWAYS leftward (negative x drift) · magnitude
    // varies so some bats veer sharply, others only slightly ·
    // range -8 to -55 vw so the flock fans out across the left side
    // of the screen rather than exits straight up.
    const xDrift = -(8 + rand() * 47);
    // Vertical reach · all bats clear the top but at different
    // speeds · more vertical for sharp-leftward bats so the whole
    // flock disperses to the upper-left corner.
    const yDrift = -(95 + rand() * 25); // -95 to -120 vh
    // Rotation jitter · slight back-and-forth tilt during flight · each
    // bat uses its own phase so the flock doesn't rock in sync.
    const rotPhase = rand();
    const scale = 0.3 + rand() * 0.35; // 0.3-0.65 · small bats
    return {
      dur,
      delay,
      spawnLeft,
      spawnBottomPx,
      xDrift,
      yDrift,
      rotPhase,
      scale,
    };
  });

  return (
    <div aria-hidden style={OVERLAY_STYLE_BASE}>
      <style>{`
        /* Rise · bat lifts from near the send button toward the UPPER
           LEFT of the screen · x drifts leftward (negative) while y
           climbs · each bat supplies its own target via --jx-x and
           --jx-y CSS variables so the flock fans across the left side
           instead of climbing in a column. */
        @keyframes joker-bat-rise {
          0%   { transform: translate3d(0, 0, 0) scale(0.9); opacity: 0; }
          8%   { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translate3d(var(--jx-x, 0), var(--jx-y, -115vh), 0) scale(1.05); opacity: 0; }
        }
        /* Wing flap · fast scaleY pulse on the bat sprite itself · PNG
           has wings baked into the artwork so we can't rotate each
           wing independently, but a quick vertical pulse reads as
           flapping-in-silhouette. */
        @keyframes joker-bat-flap {
          0%, 100% { transform: scaleY(1); }
          50%      { transform: scaleY(0.72); }
        }
        /* Yaw · slight left-right tilt as the bat climbs · each bat
           uses an animation-delay keyed off its own rotPhase so the
           flock looks organic, not synchronized. */
        @keyframes joker-bat-yaw {
          0%, 100% { transform: rotate(-6deg); }
          50%      { transform: rotate(6deg); }
        }
      `}</style>
      {bats.map((b, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: `${b.spawnLeft}%`,
            bottom: b.spawnBottomPx,
            width: 68 * b.scale,
            height: 44 * b.scale,
            animation: `joker-bat-rise ${b.dur}s cubic-bezier(0.22, 0.6, 0.4, 1) infinite`,
            animationDelay: `${b.delay}s`,
            ["--jx-x" as string]: `${b.xDrift}vw`,
            ["--jx-y" as string]: `${b.yDrift}vh`,
            willChange: "transform, opacity",
          } as React.CSSProperties}
        >
          {/* Yaw wrapper · gentle left-right tilt during the climb */}
          <span
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              animation: `joker-bat-yaw ${1.1 + b.rotPhase * 0.9}s ease-in-out infinite`,
              animationDelay: `${-b.rotPhase * 1.2}s`,
            }}
          >
            {/* Flap wrapper · fast vertical pulse · reads as wingbeat
                even though the PNG has wings baked in. */}
            <span
              style={{
                display: "block",
                width: "100%",
                height: "100%",
                animation: "joker-bat-flap 220ms ease-in-out infinite",
                backgroundImage: "url(/nex-themes/joker-bat.png)",
                backgroundSize: "contain",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.65))",
              }}
            />
          </span>
        </span>
      ))}
    </div>
  );
}

// ─── Falling Cards ───────────────────────────────────────────────────
// Founder-provided playing-card PNG tumbles down · mixed cadence so
// SOME cards hover long enough to read the face (showcase cards spin
// at 10-16s per revolution) while others tumble faster for depth +
// chaos. 90% of cards layer BEHIND the chat bubbles (zIndex 1) · a
// small foreground pass (~15%) layers in FRONT (zIndex 10) to add
// parallax depth without crowding the conversation. Founder-tuned
// 2026-10-01.
function CardsOverlay(): React.JSX.Element {
  const rand = seededRand(303);
  const TOTAL = 14;
  const FG_COUNT = 2; // 2/14 ≈ 14% in front · the rest behind

  const cards = Array.from({ length: TOTAL }, (_, idx) => {
    // Spin profile · three bands so some cards are legible for
    // seconds at a time while others blur past · all speeds halved
    // 2026-10-01 for the slow-float cadence the founder asked for.
    //   showcase · 18-30s per revolution · very readable face · ~45%
    //   steady   · no continuous spin, gentle rock only · ~20%
    //   fast     · 5-10s per revolution · depth filler · ~35%
    const spinBand = rand();
    const isShowcase = spinBand < 0.45;
    const isSteady = !isShowcase && spinBand < 0.65;
    const rotSpeed = isSteady
      ? 0
      : isShowcase
        ? 18 + rand() * 12
        : 5 + rand() * 5;

    // Foreground slots · the FIRST FG_COUNT cards are drawn to the
    // front overlay (zIndex 10) · they feel closer to the viewer so
    // scale them a touch larger for parallax.
    const isForeground = idx < FG_COUNT;

    return {
      left: rand() * 100,
      // Slow float · 16-28s to traverse the screen · founder direction
      // 2026-10-01 "more slowly floating down the screen". Previously
      // 7-13s · roughly doubled so a card lingers long enough to read.
      dur: 16 + rand() * 12,
      // Larger negative delay window matches the longer cycle so the
      // sky never looks empty between cards · otherwise with the
      // slower fall we'd see gaps.
      delay: -rand() * 20,
      rotDir: rand() > 0.5 ? 1 : -1,
      rotSpeed,
      isSteady,
      isShowcase,
      isForeground,
      scale: isForeground
        ? 0.75 + rand() * 0.5 // 0.75-1.25 · bigger up close
        : isShowcase
          ? 0.6 + rand() * 0.45 // 0.6-1.05 · readable mid-range
          : 0.4 + rand() * 0.4, // 0.4-0.8 · small/far cards
      startAngle: Math.floor(rand() * 360),
      xShift: (rand() - 0.5) * 24,
    };
  });

  const renderCard = (c: (typeof cards)[number], i: number) => (
    <span
      key={i}
      style={{
        position: "absolute",
        top: 0,
        left: `${c.left}%`,
        width: 36 * c.scale,
        height: 48 * c.scale,
        animation: `joker-card-fall ${c.dur}s linear infinite`,
        animationDelay: `${c.delay}s`,
        ["--jx-x" as string]: `${c.xShift}vw`,
        willChange: "transform, opacity",
      } as React.CSSProperties}
    >
      {/* BASE tilt wrapper · every card enters at a different angle
          so no two look the same at any frame. */}
      <span
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          transform: `rotate(${c.startAngle}deg)`,
          transformOrigin: "center",
        }}
      >
        {/* Spin wrapper · either steady (gentle rock), slow showcase
            (readable face), or fast tumble. Steady cards use a
            different keyframe so the face stays visible. */}
        <span
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            animation: c.isSteady
              ? `joker-card-rock ${4 + Math.abs(c.xShift)}s ease-in-out infinite`
              : `joker-card-spin ${c.rotSpeed}s linear infinite`,
            animationDirection: c.rotDir > 0 ? "normal" : "reverse",
            transformOrigin: "center",
            backgroundImage: "url(/nex-themes/joker-card-front.png)",
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            filter: c.isForeground
              ? "drop-shadow(0 10px 16px rgba(0,0,0,0.65))"
              : "drop-shadow(0 6px 10px rgba(0,0,0,0.55))",
          }}
        />
      </span>
    </span>
  );

  const bgCards = cards.filter((c) => !c.isForeground);
  const fgCards = cards.filter((c) => c.isForeground);

  return (
    <>
      {/* Background pass · high z-index 9998 so cards float ABOVE any
          nested stacking context in the shell (modals, drawers,
          wallpaper filters) and visibly cover the emoji picker. */}
      <div aria-hidden style={{ ...OVERLAY_STYLE_BASE, zIndex: 9998 }}>
        <style>{`
          @keyframes joker-card-fall {
            0%   { transform: translate3d(0, -14vh, 0); opacity: 0; }
            10%  { opacity: 1; }
            100% { transform: translate3d(var(--jx-x, 0), 118vh, 0); opacity: 0.85; }
          }
          @keyframes joker-card-spin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }
          /* Steady cards · don't rotate · gentle rock -6..+6deg so the
             face is readable the whole way down. */
          @keyframes joker-card-rock {
            0%, 100% { transform: rotate(-6deg); }
            50%      { transform: rotate(6deg); }
          }
        `}</style>
        {bgCards.map((c, i) => renderCard(c, i))}
      </div>
      {/* Foreground pass · z-index 9999 · same stack as background but
          one step higher so the foreground cards reliably draw on top
          of the background cards (and above every chat-shell layer,
          including the emoji picker). */}
      {fgCards.length > 0 && (
        <div aria-hidden style={{ ...OVERLAY_STYLE_BASE, zIndex: 9999 }}>
          {fgCards.map((c, i) => renderCard(c, i + 1000))}
        </div>
      )}
      {/* Showcase pass · one chosen card peels out of the fall, swoops
          to center, flips face-up, holds for ~3s with a Joker aphorism
          floating below, then exits toward the lower-left. See
          ShowcaseCard for timing + message rotation. */}
      <ShowcaseCard />
    </>
  );
}

// ─── Falling Cards · showcase card ──────────────────────────────────
// A single card picked out of the swarm · follows a 24s cycle so
// there's a quiet gap between appearances rather than a constant
// spotlight. The cycle beats:
//
//   0.0s  invisible (just inside the top-right)
//   1.9s  landed at center, back facing viewer
//   3.4s  starts flipping
//   4.1s  face revealed, caption fades in
//   7.1s  caption fades out, exit begins
//   9.4s  off-screen lower-left
//  24.0s  cycle restarts with a new random message
//
// Longer than the sealed 3-14s single-cycle rule, but matches the
// Cards variant's existing 16-28s cadence (Founder tuning 2026-10-01
// "more slowly floating down the screen"). First cycle is delayed 6s
// so the ambient fall establishes itself before the first showcase.
// ─── Joker Wise Card · one-shot draw · sealed 2026-10-01 ────────────
// Mounted by the 3-dots controller when the user taps "Draw". Each
// mount shows exactly ONE wise card from the sealed JOKER_SHOWCASE_
// MESSAGES set, lives for ~10 seconds, then unmounts cleanly. The
// controller must mount this with a fresh `key` on every tap so the
// animation restarts from the beginning (same pattern as the Flying
// Bats on-send burst).
//
// Timing (10s total):
//   0.0 – 1.0s · swoop + fade in · card lands centred, text visible
//   1.0 – 7.0s · hold · 6-second reading window with the message
//   7.0 – 8.0s · fade out · card drifts off / scales down
//   8.0 – 10.0s · 2-second quiet tail · nothing on screen · then
//                 the parent clears the key so the overlay unmounts.
export function JokerWiseCardDraw(): React.JSX.Element {
  // Pick ONE message on mount · deterministic within this instance ·
  // the controller remounts (via key) each time the user taps Draw so
  // every draw gets its own fresh pick.
  const [message] = React.useState<string>(() => {
    const pool = JOKER_SHOWCASE_MESSAGES;
    return pool[Math.floor(Math.random() * pool.length)] ?? pool[0]!;
  });

  const CARD_W = 180;
  const CARD_H = 252;

  return (
    <div aria-hidden style={{ ...OVERLAY_STYLE_BASE, zIndex: 9999 }}>
      <style>{`
        /* 8-second visible phase (card on screen) · after that the
           outer wrapper is already at opacity 0 and the parent timer
           tears it down ~2s later. */
        @keyframes joker-wise-draw-swoop {
          0%   { transform: translate(-50%, -40%) scale(0.6) rotate(-14deg); opacity: 0; }
          8%   { opacity: 1; }
          12%  { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; }
          16%  { transform: translate(-50%, -51%) scale(1.02) rotate(0deg); opacity: 1; }
          20%  { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; }
          80%  { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; }
          90%  { transform: translate(-50%, -56%) scale(0.9) rotate(6deg); opacity: 0.5; }
          100% { transform: translate(-50%, -62%) scale(0.78) rotate(10deg); opacity: 0; }
        }
      `}</style>

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: CARD_W,
          height: CARD_H,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          willChange: "transform, opacity",
          // Total animation duration = 8s · swoop in (0-20%) + hold
          // 6s (20-80%) + fade out (80-100%). Fill-mode `both` keeps
          // the end-state (invisible) applied through the 2-second
          // parent-controlled tail before unmount.
          animation: "joker-wise-draw-swoop 8s cubic-bezier(.22,.6,.4,1) 1 both",
        }}
      >
        {/* Card artwork · reuses the sealed joker-card-front.png so
            the wise card wears the same chrome as the character
            reveal in the main cards variant. */}
        <div
          style={{
            width: CARD_W,
            height: CARD_H * 0.72,
            backgroundImage: "url(/nex-themes/joker-card-front.png)",
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            filter: "drop-shadow(0 20px 32px rgba(0,0,0,0.85))",
          }}
        />
        {/* Wise sentence · green glow pill below the card. */}
        <div
          style={{
            padding: "10px 16px",
            borderRadius: 14,
            background: "rgba(8,14,10,0.9)",
            color: JOKER_GREEN,
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1.35,
            textAlign: "center",
            maxWidth: 260,
            width: "max-content",
            border: `1px solid rgba(143,255,110,0.5)`,
            boxShadow:
              "0 8px 20px rgba(0,0,0,0.65), 0 0 24px rgba(143,255,110,0.3)",
            textShadow: "0 0 8px rgba(143,255,110,0.45)",
          }}
        >
          {message}
        </div>
      </div>
    </div>
  );
}

function ShowcaseCard(): React.JSX.Element {
  // Rotate messages between cycles · random pick, never repeat the
  // previous line twice in a row. SSR renders index 0 so hydration
  // is deterministic · the first swap fires at the 24s interval
  // boundary which lands squarely inside the invisible gap (no
  // mid-view text swap).
  const [messageIndex, setMessageIndex] = React.useState(0);
  React.useEffect(() => {
    const CYCLE_MS = 24_000;
    const timer = window.setInterval(() => {
      setMessageIndex((prev) => {
        if (JOKER_SHOWCASE_MESSAGES.length <= 1) return 0;
        let next = Math.floor(Math.random() * JOKER_SHOWCASE_MESSAGES.length);
        if (next === prev) next = (next + 1) % JOKER_SHOWCASE_MESSAGES.length;
        return next;
      });
    }, CYCLE_MS);
    return () => window.clearInterval(timer);
  }, []);

  const message =
    JOKER_SHOWCASE_MESSAGES[messageIndex] ?? JOKER_SHOWCASE_MESSAGES[0]!;

  const CARD_W = 150;
  const CARD_H = 210;

  return (
    <div aria-hidden style={{ ...OVERLAY_STYLE_BASE, zIndex: 10 }}>
      <style>{`
        /* Swoop · enter top-right, hold the character face for ~2.4s so
           the Joker is seen first, flip to the parchment back, hold the
           wise sentence + signature for ~6s so the reader has time to
           finish, then exit toward lower-left. 24s cycle total. */
        @keyframes joker-showcase-swoop {
          0%     { transform: translate3d(55vw, -32vh, 0) rotate(-14deg) scale(0.55); opacity: 0; }
          3%     { opacity: 1; }
          6%     { transform: translate3d(0, 0, 0) rotate(0deg) scale(1); opacity: 1; }
          16%    { transform: translate3d(0, 0, 0) rotate(0deg) scale(1); opacity: 1; }
          21%    { transform: translate3d(0, 0, 0) rotate(0deg) scale(1); opacity: 1; }
          46%    { transform: translate3d(0, 0, 0) rotate(0deg) scale(1); opacity: 1; }
          54%    { transform: translate3d(-55vw, 55vh, 0) rotate(22deg) scale(0.35); opacity: 0; }
          100%   { transform: translate3d(-55vw, 55vh, 0) rotate(22deg) scale(0.35); opacity: 0; }
        }
        /* Flip · character visible 6%–16% (~2.4s), flip transitions
           16%–21% (~1.2s), parchment + signature visible 21%–46% (~6s),
           then exit. Snap back to 0° at next cycle in the invisible gap. */
        @keyframes joker-showcase-flip {
          0%, 16%    { transform: rotateY(0deg); }
          21%, 100%  { transform: rotateY(180deg); }
        }
      `}</style>

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: CARD_W,
          height: CARD_H,
          marginLeft: -CARD_W / 2,
          marginTop: -CARD_H / 2,
          perspective: 900,
          opacity: 0,
          animation:
            "joker-showcase-swoop 24s cubic-bezier(0.22, 0.6, 0.4, 1) infinite",
          animationDelay: "6s",
          willChange: "transform, opacity",
        }}
      >
        {/* Flip wrapper · 3D rotateY mid-cycle so back → front */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            transformStyle: "preserve-3d",
            WebkitTransformStyle: "preserve-3d",
            animation: "joker-showcase-flip 24s linear infinite",
            animationDelay: "6s",
          }}
        >
          {/* First-visible FRONT · Joker character art · no transform
              so it is the face the viewer sees as the card lands. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              backgroundImage: "url(/nex-themes/joker-card-front.png)",
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              filter: "drop-shadow(0 18px 28px rgba(0,0,0,0.85))",
            }}
          />
          {/* Post-flip BACK · parchment joker-card.png + wise sentence +
              Joker signature. Pre-rotated 180° so the flip's second half
              brings it toward the viewer. Padding sized to the clean
              middle band of the parchment accounting for the letterbox
              (image is 439×569 inside a 150×210 card, so ~8px empty
              above and below the artwork) · 25% top/bottom + 15% sides
              keeps text safely inside the parchment's clean zone and
              clear of the corner "JOKER" marks. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: "rotateY(180deg)",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              backgroundImage: "url(/nex-themes/joker-card.png?v=3)",
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              filter: "drop-shadow(0 18px 28px rgba(0,0,0,0.85))",
              display: "grid",
              placeItems: "center",
              padding: "25% 15%",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                maxWidth: "100%",
              }}
            >
              <div
                style={{
                  color: "#1a1410",
                  fontSize: 11,
                  fontWeight: 600,
                  lineHeight: 1.25,
                  textAlign: "center",
                  letterSpacing: "0.005em",
                  fontFamily:
                    'Georgia, "Times New Roman", "DM Serif Display", serif',
                  textShadow: "0 1px 0 rgba(255,245,220,0.4)",
                  opacity: 0.9,
                }}
              >
                {message}
              </div>
              <div
                style={{
                  color: "#1a1410",
                  fontSize: 15,
                  fontStyle: "italic",
                  fontFamily:
                    '"Brush Script MT", "Lucida Handwriting", "Segoe Script", cursive',
                  opacity: 0.85,
                  letterSpacing: "0.03em",
                  textAlign: "center",
                  whiteSpace: "nowrap",
                }}
              >
                — Joker
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Lightning ───────────────────────────────────────────────────────
// Fork lightning · reference image sealed 2026-10-01. Tall, heavily
// forked bolts that span most of the screen · pure-white core · bright
// electric-blue outer glow · each strike fires with a full-screen blue
// flash. Two strike cells cycle in rotation so a new bolt forks across
// the sky every few seconds without ever showing two at once.
// Palette:
//   core     #FFFFFF (pure white)
//   branches #CFE8FF (pale electric blue)
//   glow     #4FA3FF → #B5D9FF (blue halo)
//   flash    rgba(180,220,255,0.85) → rgba(80,150,255,0.3)
// Build a jagged polyline from the top of a local 100×200 viewBox
// down to the chosen endY · segments + swing control jaggedness.
// Shared helper used by StrikeInstance; takes an explicit rand
// so each strike can seed its own randomised shape.
function makeBoltWaypoints(
  rand: () => number,
  startX: number,
  startY: number,
  endY: number,
  segments: number,
  swing: number,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [{ x: startX, y: startY }];
  const stepY = (endY - startY) / segments;
  let x = startX;
  for (let i = 1; i <= segments; i++) {
    const y = startY + stepY * i * (0.75 + rand() * 0.5);
    x = startX + (rand() - 0.5) * swing * 2;
    pts.push({ x, y: Math.min(endY, y) });
  }
  pts[pts.length - 1]!.y = endY;
  return pts;
}
function boltToPoints(pts: { x: number; y: number }[]): string {
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

// Scripted cadence in seconds since the overlay mounted. The founder
// wants a rare, non-annoying rhythm: a double-tap at the 1-minute
// mark, then one strike every few minutes, then random after 13min.
const LIGHTNING_SCHEDULE_S = [60, 70, 180, 360, 540, 720, 780] as const;
// After the scripted phase, strikes fire at a random interval inside
// this range (seconds) · minimum 90s between strikes so the user
// never feels nagged.
const LIGHTNING_RANDOM_MIN_S = 90;
const LIGHTNING_RANDOM_MAX_S = 240;
// One strike's visible animation lifetime · the DOM node unmounts
// shortly after this so the overlay stays empty between strikes.
const LIGHTNING_LIFE_MS = 1800;

function LightningOverlay(): React.JSX.Element {
  // Each strike is a fresh key-mounted <StrikeInstance> with its own
  // randomised bolt shape. Strikes list holds pending IDs; the
  // scheduler effect pushes new IDs at the configured times, each ID
  // auto-removed after LIGHTNING_LIFE_MS so the overlay returns to
  // empty between strikes.
  const [strikes, setStrikes] = React.useState<number[]>([]);

  React.useEffect(() => {
    let nextId = 1;
    const trigger = () => {
      const id = nextId++;
      setStrikes((prev) => [...prev, id]);
      window.setTimeout(() => {
        setStrikes((prev) => prev.filter((x) => x !== id));
      }, LIGHTNING_LIFE_MS);
    };

    const timers: number[] = [];
    // Scripted phase · one setTimeout per configured strike time.
    for (const sec of LIGHTNING_SCHEDULE_S) {
      timers.push(window.setTimeout(trigger, sec * 1000));
    }
    // Random phase · after the last scripted strike, a self-rescheduling
    // chain of setTimeouts fires strikes at random 90-240s intervals.
    let randomChainActive = true;
    const scheduleRandomStrike = () => {
      if (!randomChainActive) return;
      const delayS =
        LIGHTNING_RANDOM_MIN_S +
        Math.random() * (LIGHTNING_RANDOM_MAX_S - LIGHTNING_RANDOM_MIN_S);
      timers.push(
        window.setTimeout(() => {
          trigger();
          scheduleRandomStrike();
        }, delayS * 1000),
      );
    };
    timers.push(
      window.setTimeout(
        scheduleRandomStrike,
        LIGHTNING_SCHEDULE_S[LIGHTNING_SCHEDULE_S.length - 1]! * 1000,
      ),
    );

    return () => {
      randomChainActive = false;
      for (const t of timers) window.clearTimeout(t);
    };
  }, []);

  return (
    <div aria-hidden style={OVERLAY_STYLE_BASE}>
      <style>{`
        /* One-shot strike · plays exactly once per mount. Double-tap
           peak then held faint tail then gone. Shape is readable
           without annoying because this element unmounts right after. */
        @keyframes joker-lightning-fork-once {
          0%     { opacity: 0; }
          4%     { opacity: 1; }
          12%    { opacity: 0.55; }
          18%    { opacity: 1; }
          40%    { opacity: 0.72; }
          80%    { opacity: 0.3; }
          100%   { opacity: 0; }
        }
        /* One-shot full-screen flash · fires in sync with the bolt. */
        @keyframes joker-lightning-flash-once {
          0%     { opacity: 0; }
          4%     { opacity: 0.95; }
          12%    { opacity: 0.4; }
          18%    { opacity: 0.85; }
          30%    { opacity: 0.3; }
          55%    { opacity: 0.1; }
          100%   { opacity: 0; }
        }
      `}</style>
      {strikes.map((id) => (
        <StrikeInstance key={id} />
      ))}
    </div>
  );
}

// A single lightning strike · fully randomised on mount so no two
// strikes look alike. Plays its animation exactly once (fill-mode
// forwards + iteration-count 1) and relies on the parent to unmount
// it once the animation finishes.
function StrikeInstance(): React.JSX.Element {
  // Pre-compute geometry once per mount so every strike is a fresh
  // bolt. Math.random is fine here because the shape doesn't need to
  // be SSR-stable (overlay is client-only via the effect schedule).
  const geom = React.useMemo(() => {
    const rand = Math.random;
    const left = 50 + (rand() - 0.5) * 6;
    const topVh = 0;
    const lengthPx = 60;
    const widthPx = 100;
    const tilt = (rand() - 0.5) * 16;
    const trunk = makeBoltWaypoints(
      rand,
      50,
      0,
      200,
      7 + Math.floor(rand() * 3),
      14 + rand() * 8,
    );
    const branchCount = 3 + Math.floor(rand() * 3);
    const branches: { pts: string; sub?: string }[] = [];
    for (let b = 0; b < branchCount; b++) {
      const vIdx = 1 + Math.floor(rand() * Math.max(1, trunk.length - 2));
      const origin = trunk[vIdx]!;
      const direction = rand() > 0.5 ? 1 : -1;
      const reach = 14 + rand() * 18;
      const endY = Math.min(200, origin.y + 24 + rand() * 60);
      const brPts = makeBoltWaypoints(
        rand,
        origin.x,
        origin.y,
        endY,
        3 + Math.floor(rand() * 3),
        6 + rand() * 6,
      );
      brPts[brPts.length - 1]!.x = origin.x + direction * reach;
      let sub: string | undefined;
      if (rand() < 0.35 && brPts.length >= 3) {
        const subOriginIdx = 1 + Math.floor(rand() * (brPts.length - 2));
        const subOrigin = brPts[subOriginIdx]!;
        const subDir = rand() > 0.5 ? 1 : -1;
        const subPts = makeBoltWaypoints(
          rand,
          subOrigin.x,
          subOrigin.y,
          Math.min(200, subOrigin.y + 15 + rand() * 25),
          2 + Math.floor(rand() * 2),
          3 + rand() * 3,
        );
        subPts[subPts.length - 1]!.x =
          subOrigin.x + subDir * (6 + rand() * 10);
        sub = boltToPoints(subPts);
      }
      branches.push({ pts: boltToPoints(brPts), sub });
    }
    return {
      left,
      topVh,
      lengthPx,
      widthPx,
      tilt,
      trunkPts: boltToPoints(trunk),
      branches,
      stroke: 3,
    };
  }, []);
  const durS = LIGHTNING_LIFE_MS / 1000;
  return (
    <>
      {/* Full-screen flash · one-shot. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(220,235,255,0.95) 0%, rgba(170,205,255,0.75) 50%, rgba(140,185,255,0.5) 100%)",
          animation: `joker-lightning-flash-once ${durS}s linear 1 both`,
          mixBlendMode: "screen",
        }}
      />
      {/* Bolt SVG · one-shot. */}
      <svg
        aria-hidden
        viewBox="0 0 100 200"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          top: `${geom.topVh}vh`,
          left: `${geom.left}%`,
          width: geom.widthPx,
          height: geom.lengthPx,
          transformOrigin: "top center",
          transform: `translateX(-50%) rotate(${geom.tilt.toFixed(1)}deg)`,
          animation: `joker-lightning-fork-once ${durS}s linear 1 both`,
          filter:
            "drop-shadow(0 0 4px #FFFFFF) drop-shadow(0 0 10px #B5D9FF) drop-shadow(0 0 22px #4FA3FF)",
        }}
      >
        <polyline
          points={geom.trunkPts}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={geom.stroke}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {geom.branches.map((br, bi) => (
          <React.Fragment key={`b-${bi}`}>
            <polyline
              points={br.pts}
              fill="none"
              stroke="#CFE8FF"
              strokeWidth={geom.stroke * 0.6}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.95}
            />
            {br.sub && (
              <polyline
                points={br.sub}
                fill="none"
                stroke="#A8CFFF"
                strokeWidth={geom.stroke * 0.4}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={0.85}
              />
            )}
          </React.Fragment>
        ))}
      </svg>
    </>
  );
}

// ─── Toxic Bubbles ───────────────────────────────────────────────────
function BubblesOverlay(): React.JSX.Element {
  const rand = seededRand(404);
  const bubbles = Array.from({ length: 20 }, () => ({
    left: rand() * 100,
    dur: 5 + rand() * 5,
    delay: -rand() * 6,
    size: 8 + rand() * 22,
    opacity: 0.4 + rand() * 0.4,
    xShift: (rand() - 0.5) * 10,
  }));
  return (
    <div aria-hidden style={OVERLAY_STYLE_BASE}>
      <style>{`
        @keyframes joker-bubble-rise {
          0%   { transform: translate3d(0, 0, 0) scale(0.7); opacity: 0; }
          15%  { opacity: var(--jx-op, 0.6); }
          90%  { opacity: var(--jx-op, 0.6); }
          100% { transform: translate3d(var(--jx-x, 0), -110vh, 0) scale(1); opacity: 0; }
        }
      `}</style>
      {bubbles.map((b, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            bottom: 0,
            left: `${b.left}%`,
            width: b.size,
            height: b.size,
            borderRadius: "50%",
            background: `radial-gradient(circle at 30% 30%, rgba(220,255,200,0.9), ${JOKER_GREEN_SOFT} 60%, transparent 90%)`,
            border: `1px solid rgba(143,255,110,0.5)`,
            animation: `joker-bubble-rise ${b.dur}s ease-in infinite`,
            animationDelay: `${b.delay}s`,
            ["--jx-x" as string]: `${b.xShift}vw`,
            ["--jx-op" as string]: `${b.opacity}`,
            willChange: "transform, opacity",
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// ─── Confetti Chaos ──────────────────────────────────────────────────
function ConfettiOverlay(): React.JSX.Element {
  const rand = seededRand(505);
  const palette = ["#FF3B7A", "#FFD447", JOKER_GREEN, "#4AB8FF", "#B78BFF"];
  const bits = Array.from({ length: 32 }, () => ({
    left: rand() * 100,
    dur: 4 + rand() * 4,
    delay: -rand() * 6,
    color: palette[Math.floor(rand() * palette.length)]!,
    rotDir: rand() > 0.5 ? 1 : -1,
    rotSpeed: 0.3 + rand() * 0.5,
    w: 4 + rand() * 6,
    h: 8 + rand() * 8,
    xShift: (rand() - 0.5) * 30,
  }));
  return (
    <div aria-hidden style={OVERLAY_STYLE_BASE}>
      <style>{`
        @keyframes joker-confetti-fall {
          0%   { transform: translate3d(0, -10vh, 0); opacity: 0; }
          8%   { opacity: 1; }
          100% { transform: translate3d(var(--jx-x, 0), 115vh, 0); opacity: 0.9; }
        }
        @keyframes joker-confetti-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(720deg); }
        }
      `}</style>
      {bits.map((b, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: 0,
            left: `${b.left}%`,
            width: b.w,
            height: b.h,
            animation: `joker-confetti-fall ${b.dur}s linear infinite`,
            animationDelay: `${b.delay}s`,
            ["--jx-x" as string]: `${b.xShift}vw`,
            willChange: "transform, opacity",
          } as React.CSSProperties}
        >
          <span
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              background: b.color,
              animation: `joker-confetti-spin ${b.rotSpeed}s linear infinite`,
              animationDirection: b.rotDir > 0 ? "normal" : "reverse",
            }}
          />
        </span>
      ))}
    </div>
  );
}

// ─── Smoke Wisps ─────────────────────────────────────────────────────
function SmokeOverlay(): React.JSX.Element {
  const rand = seededRand(606);
  const wisps = Array.from({ length: 8 }, () => ({
    top: 10 + rand() * 70,
    dur: 12 + rand() * 6,
    delay: -rand() * 12,
    size: 240 + rand() * 200,
    opacity: 0.35 + rand() * 0.35,
    direction: rand() > 0.5 ? 1 : -1,
  }));
  return (
    <div aria-hidden style={OVERLAY_STYLE_BASE}>
      <style>{`
        @keyframes joker-smoke-drift {
          0%   { transform: translate3d(-40vw, 0, 0) scale(0.9); opacity: 0; }
          15%  { opacity: var(--jx-op, 0.5); }
          85%  { opacity: var(--jx-op, 0.5); }
          100% { transform: translate3d(140vw, 0, 0) scale(1.1); opacity: 0; }
        }
        @keyframes joker-smoke-drift-rev {
          0%   { transform: translate3d(140vw, 0, 0) scale(0.9); opacity: 0; }
          15%  { opacity: var(--jx-op, 0.5); }
          85%  { opacity: var(--jx-op, 0.5); }
          100% { transform: translate3d(-40vw, 0, 0) scale(1.1); opacity: 0; }
        }
      `}</style>
      {wisps.map((w, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: `${w.top}%`,
            left: 0,
            width: w.size,
            height: w.size / 2,
            borderRadius: "50%",
            background: `radial-gradient(ellipse at center, rgba(10,20,30,0.7), rgba(10,20,30,0.2) 45%, transparent 75%)`,
            filter: "blur(24px)",
            animation:
              `${w.direction > 0 ? "joker-smoke-drift" : "joker-smoke-drift-rev"} ${w.dur}s linear infinite`,
            animationDelay: `${w.delay}s`,
            ["--jx-op" as string]: `${w.opacity}`,
            willChange: "transform, opacity",
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// ─── Rising Embers ───────────────────────────────────────────────────
function EmbersOverlay(): React.JSX.Element {
  const rand = seededRand(707);
  const embers = Array.from({ length: 34 }, () => ({
    left: rand() * 100,
    dur: 4 + rand() * 5,
    delay: -rand() * 6,
    size: 2 + rand() * 3,
    xShift: (rand() - 0.5) * 8,
    hue: rand() > 0.6 ? "#FFB84A" : rand() > 0.3 ? "#FF7800" : JOKER_GREEN,
    twinkle: 0.5 + rand() * 0.9,
  }));
  return (
    <div aria-hidden style={OVERLAY_STYLE_BASE}>
      <style>{`
        @keyframes joker-ember-rise {
          0%   { transform: translate3d(0, 0, 0); opacity: 0; }
          10%  { opacity: 1; }
          80%  { opacity: 0.6; }
          100% { transform: translate3d(var(--jx-x, 0), -95vh, 0); opacity: 0; }
        }
        @keyframes joker-ember-flicker {
          0%, 100% { filter: drop-shadow(0 0 3px currentColor); }
          50%      { filter: drop-shadow(0 0 8px currentColor); }
        }
      `}</style>
      {embers.map((e, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            bottom: 0,
            left: `${e.left}%`,
            width: e.size,
            height: e.size,
            borderRadius: "50%",
            background: e.hue,
            color: e.hue,
            animation:
              `joker-ember-rise ${e.dur}s ease-in infinite, joker-ember-flicker ${e.twinkle}s ease-in-out infinite`,
            animationDelay: `${e.delay}s`,
            ["--jx-x" as string]: `${e.xShift}vw`,
            willChange: "transform, opacity",
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// ─── CRT Glitch · scan + Joker reveal · sealed 2026-10-01 ────────────
// 16s cycle (scan slowed per founder direction 2026-10-01):
//   0 – 8s   · green scanline sweeps top → footer (slower read)
//   8 – 13s  · scanjoker.png reveal takes over the viewport (5s hold)
//   13 – 16s · reveal fades · 3s rest before the next sweep
function GlitchOverlay(): React.JSX.Element {
  return (
    <div aria-hidden style={OVERLAY_STYLE_BASE}>
      <style>{`
        /* Scan sweep · now spans the first 8 of 16 seconds (0 – 50%)
           so the scanline reads as a deliberate pass over the chat,
           not a quick blip. Snaps off at the handoff for the reveal. */
        @keyframes joker-glitch-scan {
          0%     { transform: translateY(-15vh); opacity: 0; }
          3%     { opacity: 0.75; }
          47%    { transform: translateY(110vh); opacity: 0.75; }
          50%    { transform: translateY(110vh); opacity: 0; }
          100%   { transform: translateY(110vh); opacity: 0; }
        }
        /* RGB-shift burst · fires right as the scan hits the footer,
           bridging the scan → reveal transition with a hard CRT jolt. */
        @keyframes joker-glitch-shift {
          0%, 47%     { opacity: 0; transform: translate3d(0, 0, 0); }
          48%         { opacity: 1; transform: translate3d(-4px, 0, 0); }
          48.5%       { transform: translate3d(4px, 0, 0); }
          49%         { transform: translate3d(-2px, 0, 0); }
          50%         { opacity: 0; transform: translate3d(0, 0, 0); }
          100%        { opacity: 0; }
        }
        /* Persistent scanline grid · subtle breathing opacity so the
           CRT feel reads even when the scan isn't sweeping. */
        @keyframes joker-glitch-lines {
          0%, 100% { opacity: 0.08; }
          50%      { opacity: 0.18; }
        }
        /* Joker reveal · fades IN at the scan→reveal handoff (50% ≈
           8s), holds through 81% (≈ 13s · a 5-second window), then
           fades OUT by 87% (≈ 14s) leaving a ~2s rest before the
           next sweep. */
        @keyframes joker-glitch-reveal {
          0%, 47%    { opacity: 0; }
          50%        { opacity: 1; }
          81%        { opacity: 1; }
          87%, 100%  { opacity: 0; }
        }
      `}</style>

      {/* Persistent scanline grid · very subtle */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 3px)",
          animation: "joker-glitch-lines 4s ease-in-out infinite",
          mixBlendMode: "overlay",
        }}
      />

      {/* Joker reveal · full-viewport replacement background that
          takes over for 5s after the scan reaches the footer, then
          fades out leaving ~3s of rest before the next sweep.
          Positioned under the scan + shift so the scanline passes
          over the wallpaper BEFORE the reveal takes its place.
          `backgroundSize: auto 100%` guarantees the image displays
          at FULL HEIGHT (never cropped top/bottom) · the dark
          backdrop fills any side gaps on wider viewports. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "#020914",
          backgroundImage: "url(/nex-themes/joker-scan-reveal.png?v=3)",
          backgroundSize: "auto 100%",
          backgroundPosition: "center center",
          backgroundRepeat: "no-repeat",
          opacity: 0,
          animation: "joker-glitch-reveal 16s linear infinite",
        }}
      />

      {/* Reveal-phase atmosphere · same mist + particle treatment
          the shell paints over the theme-0 wallpaper · rendered on
          top of the reveal image so the two surfaces share the
          same green haze aesthetic. Keyed to the reveal keyframe
          so it only appears while the reveal is visible. */}
      <RevealAtmosphere />

      {/* Scan sweep · red scanline moves top → footer in the first
          8s of each 16s cycle, then stays hidden through the reveal
          and the rest phase. Red to match the red x-ray coat overlay
          in the reveal image. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 60,
          background:
            "linear-gradient(to bottom, transparent 0%, rgba(255,60,60,0.9) 50%, transparent 100%)",
          animation: "joker-glitch-scan 16s linear infinite",
          filter: "blur(4px) drop-shadow(0 0 10px rgba(255,40,40,0.6))",
        }}
      />

      {/* RGB-shift burst · fires at the scan→reveal handoff. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(255,0,80,0.15), transparent 20%, transparent 80%, rgba(0,180,255,0.15))",
          mixBlendMode: "screen",
          animation: "joker-glitch-shift 16s linear infinite",
        }}
      />
    </div>
  );
}

// ─── Reveal atmosphere · mist + particles layered over the reveal ──
// Matches theme-0's wallpaper_config (mistDrift + particleDrift) so
// the Joker reveal reads as the same world the wallpaper lives in.
// Opacity is driven by `joker-glitch-reveal` so the atmosphere only
// appears while the reveal image is visible (38.5%-85% of the 13s
// cycle), then fades out alongside it.
function RevealAtmosphere(): React.JSX.Element {
  // Deterministic layout so SSR + first client paint agree.
  const randMist = seededRand(812);
  const mists = Array.from({ length: 9 }, () => ({
    left: randMist() * 100,
    top: 20 + randMist() * 70,
    size: 140 + randMist() * 80, // 140-220px
    delay: -randMist() * 24,
    duration: 20 + randMist() * 10, // 20-30s
    drift: (randMist() - 0.5) * 60, // sideways drift vw
  }));
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        opacity: 0,
        animation: "joker-glitch-reveal 16s linear infinite",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes joker-reveal-mist {
          0%   { transform: translate3d(0, 0, 0) scale(0.9); opacity: 0; }
          15%  { opacity: 0.55; }
          85%  { opacity: 0.55; }
          100% { transform: translate3d(var(--mx, 0), -40px, 0) scale(1.15); opacity: 0; }
        }
      `}</style>
      {/* Mist blobs · large soft blurred green/white smoke that drifts
          sideways while fading away · matches theme-0 mistDrift. */}
      {mists.map((m, i) => (
        <span
          key={`mist-${i}`}
          style={{
            position: "absolute",
            top: `${m.top}%`,
            left: `${m.left}%`,
            width: m.size,
            height: m.size,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 50% 50%, rgba(190,240,205,0.55), rgba(190,240,205,0.2) 50%, transparent 75%)",
            filter: "blur(48px)",
            mixBlendMode: "screen",
            animation: `joker-reveal-mist ${m.duration}s ease-in-out infinite`,
            animationDelay: `${m.delay}s`,
            ["--mx" as string]: `${m.drift}vw`,
            willChange: "transform, opacity",
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// parseJokerMotion is re-exported from _joker-motion-data.ts at the
// top of this file · see import block.
