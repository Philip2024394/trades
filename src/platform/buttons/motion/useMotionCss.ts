"use client";

// Motion runtime — turn a MotionSpec + current state into (a) the CSS
// keyframes to inject and (b) the `animation:` shorthand to apply.
//
// Reduced-motion contract:
//   • prefers-reduced-motion → all non-transition-based presets become
//     "none". State overrides for colour / shadow / opacity still fire
//     (merchant still sees hover feedback), motion goes silent.
//
// Consumers (button renderers):
//   const { animation, styleTag } = useMotionCss({ motion, state });
//   return <>
//     <span style={{ animation }} />
//     <style dangerouslySetInnerHTML={{ __html: styleTag }} />
//   </>;

import { useMemo } from "react";
import { usePrefersReducedMotion } from "../states/useButtonState";
import type { ButtonState, MotionSpec } from "../types";
import { keyframesCssFor, presetsUsedIn, specFor } from "./keyframes";

const STATE_TO_MOTION_KEY: Partial<Record<ButtonState, keyof MotionSpec>> = {
  hover: "hover",
  focus_visible: "focus",
  pressed: "press",
  loading: "loading",
  success: "success",
  error: "error"
  // default / active / visited / disabled: silent by design; idle handled
  // separately below.
};

export function useMotionCss({
  motion,
  state
}: {
  motion: MotionSpec;
  state: ButtonState;
}) {
  const reduced = usePrefersReducedMotion();
  return useMemo(() => {
    // Reduced-motion path — no keyframes, no `animation` shorthand.
    if (reduced) {
      return { animation: "none", styleTag: "" };
    }

    const stateKey = STATE_TO_MOTION_KEY[state];
    const activePreset = stateKey ? motion[stateKey] : undefined;
    // Idle is layered underneath — plays even at rest for the
    // buttons that opt into it (e.g. critical urgent CTAs).
    const idlePreset = motion.idle;

    const primary = activePreset && activePreset !== "none"
      ? specFor(activePreset)
      : idlePreset && idlePreset !== "none"
        ? specFor(idlePreset)
        : null;

    const animation = primary?.handledByStateTransition
      ? "none"
      : primary
        ? `${primary.animationName} ${primary.animation}`
        : "none";

    const styleTag = keyframesCssFor(presetsUsedIn(motion));
    return { animation, styleTag };
  }, [reduced, state, motion]);
}
