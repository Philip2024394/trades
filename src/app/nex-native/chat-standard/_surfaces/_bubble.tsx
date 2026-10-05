"use client";

// src/app/nex-native/chat-standard/_surfaces/_bubble.tsx
//
// Phase 2A.0 · Standard bubble surface.
//
// Reads EVERY visual decision from engine.bubbleTreatment. Never reads
// theme.id, wallpaper_config, or hex colours directly. Theme personality
// drives entrance / idle / reaction animations.

import * as React from "react";
import type { ResolvedEngine } from "../_engine/theme-engine";

export interface StandardBubbleProps {
  engine: ResolvedEngine;
  mine: boolean;
  /** When true, triggers the per-reaction animation (ripple for Ocean,
   *  sprinkle-burst for Cakes, etc). */
  reacting?: boolean;
  children: React.ReactNode;
  /** Enable the per-personality idle animation (shimmer / wobble / etc).
   *  Off by default to keep the gallery calm; on in the live-feel preview. */
  idle?: boolean;
}

export function StandardBubble({
  engine,
  mine,
  reacting,
  children,
  idle = true,
}: StandardBubbleProps): React.JSX.Element {
  const t = engine.bubbleTreatment({ mine, isReacting: reacting });
  const [showTrail, setShowTrail] = React.useState(false);

  // Fire the rising-bubble trail once on mount for `mine` bubbles when
  // the effect is enabled. Six ascending bubbles at varied sizes +
  // staggered delays make a convincing underwater send signal. The
  // keyframe comes from the engine's stylesheet (nex-se-bubble-trail)
  // so any theme that enables bubbleTrailOnSend inherits the behaviour.
  React.useEffect(() => {
    if (mine && t.effects.bubbleTrailOnSend) {
      setShowTrail(true);
      const id = window.setTimeout(() => setShowTrail(false), 2600);
      return () => window.clearTimeout(id);
    }
  }, [mine, t.effects.bubbleTrailOnSend]);

  const animations: string[] = [];
  if (t.motion.entrance) animations.push(`${t.motion.entrance} 420ms ease-out both`);
  if (idle && t.motion.idle)
    animations.push(`${t.motion.idle} 6s ease-in-out infinite`);
  if (t.motion.reaction && reacting)
    animations.push(`${t.motion.reaction} 700ms ease-out`);

  return (
    <div
      data-nex-se-bubble={mine ? "mine" : "peer"}
      style={{
        position: "relative",
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "72%",
        padding: t.geometry.padding,
        borderRadius: t.geometry.borderRadius,
        background: t.material.background,
        backdropFilter: t.material.backdropFilter,
        WebkitBackdropFilter: t.material.backdropFilter,
        border: t.material.border,
        boxShadow: t.material.boxShadow,
        color: t.typography.color,
        textShadow: t.typography.textShadow,
        fontWeight: t.typography.fontWeight,
        fontSize: 14,
        animation: animations.join(", "),
        // UNIVERSAL RULE · sealed 2026-10-05 · chat text MUST fit
        // inside its bubble on every theme. Long unbroken strings
        // (URLs, product names) wrap at any point rather than
        // extending the bubble past its max-width. preserve-newlines
        // via pre-wrap so paragraph intent is kept.
        wordBreak: "break-word",
        overflowWrap: "anywhere",
        whiteSpace: "pre-wrap",
        minWidth: 0,
      }}
    >
      {t.innerLightOverlay && (
        <span aria-hidden style={t.innerLightOverlay} />
      )}
      <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
      {showTrail && <StandardBubbleTrail engine={engine} />}
    </div>
  );
}

function StandardBubbleTrail({
  engine,
}: {
  engine: ResolvedEngine;
}): React.JSX.Element {
  const highlight = engine.colours.highlight;
  const primary = engine.colours.primary;
  // Six bubbles, varied size + lateral drift, slightly transparent
  // highlight gradient so each reads as a real droplet. Keyframe
  // nex-se-bubble-trail is defined in the engine's shared stylesheet.
  const trail = [
    { right: 4, size: 11, dur: 1900, delay: 0 },
    { right: 12, size: 7, dur: 2100, delay: 120 },
    { right: 20, size: 9, dur: 2000, delay: 260 },
    { right: 28, size: 6, dur: 2200, delay: 420 },
    { right: 38, size: 5, dur: 1800, delay: 580 },
    { right: 46, size: 4, dur: 2300, delay: 740 },
  ];
  return (
    <>
      {trail.map((b, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            position: "absolute",
            right: b.right,
            bottom: -2,
            width: b.size,
            height: b.size,
            borderRadius: "50%",
            background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9), ${highlight} 55%, ${primary})`,
            boxShadow: `inset 0 1px 2px rgba(255,255,255,0.6), 0 0 ${b.size * 1.5}px ${highlight}`,
            opacity: 0,
            animation: `nex-se-bubble-trail ${b.dur}ms ease-out ${b.delay}ms`,
          }}
        />
      ))}
    </>
  );
}
