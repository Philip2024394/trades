// Motion runtime — real CSS keyframes for every MotionPreset.
//
// One string map, keyed by preset id. Consumers inject the ones a
// button actually uses via a scoped <style> tag so browsers can share
// keyframe rules across every instance of the same preset (browsers
// dedupe by name automatically).
//
// Every preset:
//   • has an ENTER animation (called on state ENTRY only, one-shot),
//     OR a LOOPING animation (called while state is active).
//   • is safe under `prefers-reduced-motion` — the consumer swaps the
//     preset out to "none" at that level.
//
// Adding a preset:
//   1. Add its keyframes here + timing + fillMode.
//   2. Add its name to MotionPreset in ../types.ts (already done for v1).

import type { MotionPreset } from "../types";

export type KeyframeSpec = {
  /** Named keyframe rule — must be unique across the module. */
  animationName: string;
  /** Body of the @keyframes rule (without the wrapper). */
  keyframes: string;
  /** CSS `animation` shorthand tail — duration, easing, iteration,
   *  fillMode. Example: `240ms cubic-bezier(0.4, 0, 0.2, 1) forwards`. */
  animation: string;
  /** True if this preset should loop while its state is active
   *  (spinner, pulse, breathe). False = one-shot on state entry. */
  loop: boolean;
  /** Optional prefix — for lift, shrink and other transform-only
   *  presets we let the state override do the work (theme adapter
   *  produces `transform: scale(0.98)` for pressed states). This flag
   *  tells the runtime "no keyframe needed — the state transition
   *  handles it via `transition: transform`". */
  handledByStateTransition?: boolean;
};

// ─── Registry ────────────────────────────────────────────────

const MAP: Record<MotionPreset, KeyframeSpec> = {
  none: {
    animationName: "xrated-btn-none",
    keyframes: "0% { }  100% { }",
    animation: "0s linear",
    loop: false,
    handledByStateTransition: true
  },
  // Movement handled by state transitions on `transform`. We still
  // register them here so the audit is complete and reduced-motion
  // downgrade can produce a valid "none" equivalent.
  grow: {
    animationName: "xrated-btn-grow",
    keyframes: `0% { transform: scale(1); } 100% { transform: scale(1.05); }`,
    animation: "180ms cubic-bezier(0.4, 0, 0.2, 1) forwards",
    loop: false,
    handledByStateTransition: true
  },
  shrink: {
    animationName: "xrated-btn-shrink",
    keyframes: `0% { transform: scale(1); } 100% { transform: scale(0.98); }`,
    animation: "120ms cubic-bezier(0.4, 0, 0.2, 1) forwards",
    loop: false,
    handledByStateTransition: true
  },
  lift: {
    animationName: "xrated-btn-lift",
    keyframes: `0% { transform: translateY(0); } 100% { transform: translateY(-1px); }`,
    animation: "180ms cubic-bezier(0.4, 0, 0.2, 1) forwards",
    loop: false,
    handledByStateTransition: true
  },
  slide: {
    animationName: "xrated-btn-slide",
    keyframes: `0% { transform: translateX(0); } 100% { transform: translateX(2px); }`,
    animation: "180ms cubic-bezier(0.4, 0, 0.2, 1) forwards",
    loop: false,
    handledByStateTransition: true
  },
  push: {
    animationName: "xrated-btn-push",
    keyframes: `0% { transform: translateY(0); } 100% { transform: translateY(1px); }`,
    animation: "80ms cubic-bezier(0.4, 0, 0.2, 1) forwards",
    loop: false,
    handledByStateTransition: true
  },
  // Real keyframe animations — the runtime injects these.
  fade: {
    animationName: "xrated-btn-fade",
    keyframes: `0% { opacity: 0; } 100% { opacity: 1; }`,
    animation: "220ms ease-out forwards",
    loop: false
  },
  magnetic: {
    animationName: "xrated-btn-magnetic",
    keyframes: `0% { transform: translate(0,0); } 50% { transform: translate(2px,-2px); } 100% { transform: translate(0,0); }`,
    animation: "420ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
    loop: false
  },
  ripple: {
    animationName: "xrated-btn-ripple",
    keyframes: `0% { box-shadow: 0 0 0 0 rgba(0,0,0,0.35); } 100% { box-shadow: 0 0 0 12px rgba(0,0,0,0); }`,
    animation: "500ms ease-out forwards",
    loop: false
  },
  pulse: {
    animationName: "xrated-btn-pulse",
    keyframes: `0%, 100% { transform: scale(1); } 50% { transform: scale(1.03); }`,
    animation: "1400ms ease-in-out infinite",
    loop: true
  },
  bounce: {
    animationName: "xrated-btn-bounce",
    keyframes: `0% { transform: translateY(0); } 20% { transform: translateY(-3px); } 40% { transform: translateY(0); } 60% { transform: translateY(-2px); } 80% { transform: translateY(0); }`,
    animation: "600ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
    loop: false
  },
  glow: {
    animationName: "xrated-btn-glow",
    keyframes: `0% { box-shadow: 0 0 0 0 currentColor; } 100% { box-shadow: 0 0 0 4px rgba(255,179,0,0.35); }`,
    animation: "240ms ease-out forwards",
    loop: false
  },
  rotate: {
    animationName: "xrated-btn-rotate",
    keyframes: `0% { transform: rotate(0deg); } 100% { transform: rotate(3deg); }`,
    animation: "180ms cubic-bezier(0.4, 0, 0.2, 1) forwards",
    loop: false
  },
  flip: {
    animationName: "xrated-btn-flip",
    keyframes: `0% { transform: rotateY(0); } 50% { transform: rotateY(180deg); } 100% { transform: rotateY(360deg); }`,
    animation: "600ms cubic-bezier(0.4, 0, 0.2, 1) forwards",
    loop: false
  },
  stretch: {
    animationName: "xrated-btn-stretch",
    keyframes: `0% { transform: scaleX(1); } 50% { transform: scaleX(1.05); } 100% { transform: scaleX(1); }`,
    animation: "260ms cubic-bezier(0.4, 0, 0.2, 1) forwards",
    loop: false
  },
  border_draw: {
    animationName: "xrated-btn-border-draw",
    keyframes: `0% { background-size: 0 100%; } 100% { background-size: 100% 100%; }`,
    animation: "260ms ease-out forwards",
    loop: false
  },
  underline_grow: {
    animationName: "xrated-btn-underline-grow",
    keyframes: `0% { text-underline-offset: 6px; } 100% { text-underline-offset: 3px; }`,
    animation: "180ms ease-out forwards",
    loop: false
  },
  icon_slide: {
    animationName: "xrated-btn-icon-slide",
    keyframes: `0% { transform: translateX(0); } 100% { transform: translateX(2px); }`,
    animation: "180ms cubic-bezier(0.4, 0, 0.2, 1) forwards",
    loop: false
  },
  arrow_reveal: {
    animationName: "xrated-btn-arrow-reveal",
    keyframes: `0% { transform: translateX(0); opacity: 0.6; } 100% { transform: translateX(3px); opacity: 1; }`,
    animation: "200ms cubic-bezier(0.4, 0, 0.2, 1) forwards",
    loop: false
  },
  liquid_fill: {
    animationName: "xrated-btn-liquid-fill",
    keyframes: `0% { background-position: 0 100%; } 100% { background-position: 0 0; }`,
    animation: "480ms cubic-bezier(0.4, 0, 0.2, 1) forwards",
    loop: false
  },
  wave: {
    animationName: "xrated-btn-wave",
    keyframes: `0%, 100% { transform: translateY(0); } 25% { transform: translateY(-1.5px); } 75% { transform: translateY(1.5px); }`,
    animation: "1400ms ease-in-out infinite",
    loop: true
  },
  spotlight: {
    animationName: "xrated-btn-spotlight",
    keyframes: `0% { background-position: 0% 50%; } 100% { background-position: 100% 50%; }`,
    animation: "1200ms linear infinite",
    loop: true
  },
  morph: {
    animationName: "xrated-btn-morph",
    keyframes: `0% { border-radius: 12px; } 50% { border-radius: 999px; } 100% { border-radius: 12px; }`,
    animation: "600ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
    loop: false
  },
  gradient_shift: {
    animationName: "xrated-btn-gradient-shift",
    keyframes: `0% { background-position: 0% 50%; } 100% { background-position: 100% 50%; }`,
    animation: "3000ms ease-in-out infinite alternate",
    loop: true
  },
  mouse_follow: {
    animationName: "xrated-btn-mouse-follow",
    // Real mouse-follow needs JS. Provide a gentle idle wiggle so
    // presets that request this get some visible motion even without
    // the follow-runtime.
    keyframes: `0%, 100% { transform: translate(0,0); } 33% { transform: translate(1px,-1px); } 66% { transform: translate(-1px,1px); }`,
    animation: "2400ms ease-in-out infinite",
    loop: true
  },
  // ─── State stitchers ──────────────────────────
  spinner: {
    animationName: "xrated-btn-spinner",
    keyframes: `0% { transform: rotate(0); } 100% { transform: rotate(360deg); }`,
    animation: "600ms linear infinite",
    loop: true
  },
  dots: {
    animationName: "xrated-btn-dots",
    keyframes: `0%, 20% { opacity: 0.2; } 50% { opacity: 1; } 80%, 100% { opacity: 0.2; }`,
    animation: "900ms ease-in-out infinite",
    loop: true
  },
  progress_ring: {
    animationName: "xrated-btn-progress-ring",
    keyframes: `0% { stroke-dashoffset: 100; } 100% { stroke-dashoffset: 0; }`,
    animation: "1200ms ease-out forwards",
    loop: false
  },
  checkmark_morph: {
    animationName: "xrated-btn-checkmark-morph",
    keyframes: `0% { transform: scale(0.9); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); opacity: 1; }`,
    animation: "360ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
    loop: false
  },
  shake: {
    animationName: "xrated-btn-shake",
    keyframes: `0%, 100% { transform: translateX(0); } 20% { transform: translateX(-4px); } 40% { transform: translateX(4px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(3px); }`,
    animation: "420ms cubic-bezier(0.36, 0.07, 0.19, 0.97) forwards",
    loop: false
  },
  spring: {
    animationName: "xrated-btn-spring",
    keyframes: `0% { transform: scale(1); } 30% { transform: scale(0.94); } 60% { transform: scale(1.04); } 100% { transform: scale(1); }`,
    animation: "460ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
    loop: false
  }
};

// ─── Public API ────────────────────────────────────────────

/** Return the keyframe spec for a preset. Never null — unknown presets
 *  fall back to `none` (no-op). */
export function specFor(preset: MotionPreset): KeyframeSpec {
  return MAP[preset] ?? MAP.none;
}

/** Build the full `<style>` body for a set of preset ids. Idempotent —
 *  duplicates dedupe by animationName so multiple buttons on a page
 *  share the same keyframe rule. */
export function keyframesCssFor(presets: MotionPreset[]): string {
  const seen = new Set<string>();
  const chunks: string[] = [];
  for (const p of presets) {
    const spec = specFor(p);
    if (seen.has(spec.animationName)) continue;
    seen.add(spec.animationName);
    if (spec.handledByStateTransition) continue;
    chunks.push(`@keyframes ${spec.animationName} { ${spec.keyframes} }`);
  }
  return chunks.join(" ");
}

/** All preset ids that appear on a MotionSpec — used by the runtime
 *  to pre-inject the keyframes for a button. */
export function presetsUsedIn(spec: {
  entrance?: MotionPreset;
  hover?: MotionPreset;
  focus?: MotionPreset;
  press?: MotionPreset;
  loading?: MotionPreset;
  success?: MotionPreset;
  error?: MotionPreset;
  idle?: MotionPreset;
}): MotionPreset[] {
  const keys: (keyof typeof spec)[] = [
    "entrance", "hover", "focus", "press", "loading", "success", "error", "idle"
  ];
  const out: MotionPreset[] = [];
  for (const k of keys) {
    const v = spec[k];
    if (v && v !== "none") out.push(v);
  }
  return out;
}
