// src/app/nex-native/chat-standard/_engine/motion-library.ts
//
// Phase 2A.0 · Animation personality → concrete motion token tables.
//
// This file is the operational heart of "themes behave differently,
// not just look different". Every surface asks the engine for its
// motion; the engine looks up the theme's personality in these tables.
//
// Each personality defines six motion slots:
//   bubbleEntrance · bubbleIdle · bubbleReaction · ambientKind ·
//   composerFocus · buttonPress
//
// New personalities add a row. New surfaces add a column. Themes stay
// authored at the vocabulary level — they say "drift", the engine
// translates.

import type { AnimationPersonality } from "./types";

export interface PersonalityMotion {
  bubbleEntrance: string; // CSS animation name
  bubbleEntranceKeyframes: string; // the @keyframes block
  bubbleIdle: string | null;
  bubbleIdleKeyframes: string | null;
  bubbleReaction: string | null;
  bubbleReactionKeyframes: string | null;
  ambientFamily: Array<
    | "particles-up"
    | "bubbles-rising"
    | "light-rays"
    | "sparks"
    | "heat-shimmer"
    | "sparkles"
    | "mist"
    | "leaves-falling"
    | "stars"
    | "surface-caustics"
    // NEW general families · steam-rising (warm wisps drifting
    // upward, slightly amber-tinted) + warm-glow-pulse (soft radial
    // glow spots slowly breathing · evokes candlelight, warm lamp,
    // cosy fireplace, coffee shop evening). Both are theme-neutral;
    // any package picks them.
    | "steam-rising"
    | "warm-glow-pulse"
  >;
  composerFocusKeyframes: string | null;
}

// Shared idle breathing used by multiple personalities · scoped to
// per-personality rules below.
const SHIMMER_KF = `
@keyframes nex-se-shimmer {
  0%, 100% { filter: brightness(1) saturate(1); }
  50%      { filter: brightness(1.08) saturate(1.08); }
}`;

const WOBBLE_KF = `
@keyframes nex-se-wobble {
  0%, 100% { transform: rotate(0deg); }
  25%      { transform: rotate(0.4deg); }
  75%      { transform: rotate(-0.4deg); }
}`;

const DRIFT_IN_KF = `
@keyframes nex-se-drift-in {
  0%   { transform: translate3d(0, 12px, 0) scale(0.96); opacity: 0; filter: blur(2px); }
  40%  { opacity: 1; filter: blur(0); }
  70%  { transform: translate3d(-1.5px, -2px, 0) scale(1.01); }
  100% { transform: translate3d(0, 0, 0) scale(1); opacity: 1; filter: blur(0); }
}`;

const RIPPLE_REACT_KF = `
@keyframes nex-se-ripple-react {
  0%   { box-shadow: 0 0 0 0 var(--nex-se-glow, rgba(130,210,255,0.55)); }
  60%  { box-shadow: 0 0 0 18px rgba(130,210,255,0); }
  100% { box-shadow: 0 0 0 0 rgba(130,210,255,0); }
}`;

const POP_KF = `
@keyframes nex-se-pop {
  0%   { transform: scale(0.7); opacity: 0; }
  60%  { transform: scale(1.08); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}`;

const SPRINKLE_KF = `
@keyframes nex-se-sprinkle-burst {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.06); box-shadow: 0 0 0 10px var(--nex-se-glow, rgba(255,200,120,0.35)); }
  100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,200,120,0); }
}`;

const FLICKER_KF = `
@keyframes nex-se-flicker-in {
  0%   { opacity: 0; filter: brightness(1.6); }
  25%  { opacity: 1; filter: brightness(1.3); }
  40%  { opacity: 0.7; }
  55%  { opacity: 1; filter: brightness(1.15); }
  100% { opacity: 1; filter: brightness(1); }
}`;

const FADE_IN_KF = `
@keyframes nex-se-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}`;

const SWAY_KF = `
@keyframes nex-se-sway-in {
  0%   { transform: translate(-14px, -8px) rotate(-6deg); opacity: 0; }
  60%  { transform: translate(0, 0) rotate(1.5deg); opacity: 1; }
  100% { transform: translate(0, 0) rotate(0); }
}`;

const ORBIT_IN_KF = `
@keyframes nex-se-orbit-in {
  0%   { transform: rotate(-120deg) translateX(60px) rotate(120deg); opacity: 0; }
  100% { transform: rotate(0) translateX(0) rotate(0); opacity: 1; }
}`;

const SLIDE_IN_KF = `
@keyframes nex-se-slide-in {
  from { transform: translateX(40px); opacity: 0; }
  to   { transform: translateX(0); opacity: 1; }
}`;

const CREEP_IN_KF = `
@keyframes nex-se-creep-in {
  0%   { opacity: 0; transform: translateY(6px) skewX(-1deg); filter: blur(3px); }
  70%  { opacity: 0.75; filter: blur(0.5px); }
  100% { opacity: 1; transform: translateY(0) skewX(0); filter: blur(0); }
}`;

const GLITCH_IN_KF = `
@keyframes nex-se-glitch-in {
  0%   { opacity: 0; transform: translateX(-6px); filter: hue-rotate(0deg); }
  20%  { opacity: 1; transform: translateX(2px); filter: hue-rotate(90deg) saturate(1.4); }
  35%  { transform: translateX(-1px); filter: hue-rotate(-30deg); }
  55%  { transform: translateX(0); filter: none; }
  100% { opacity: 1; }
}`;

// Warm theme family · gentle lift with a warm filter, like heat rising
// off a cup. Lands softly, no bounce, no overshoot.
const WARM_RISE_IN_KF = `
@keyframes nex-se-warm-rise-in {
  0%   { opacity: 0; transform: translate3d(0, 10px, 0); filter: brightness(1.15) saturate(1.1); }
  60%  { opacity: 1; filter: brightness(1.05) saturate(1.05); }
  100% { opacity: 1; transform: translate3d(0, 0, 0); filter: brightness(1) saturate(1); }
}`;

// Idle breath for warm materials · slower than drift's shimmer and
// warmer in character. Reads like a drink catching afternoon light.
const WARM_PULSE_KF = `
@keyframes nex-se-warm-pulse {
  0%, 100% { filter: brightness(1) saturate(1); }
  50%      { filter: brightness(1.08) saturate(1.12); }
}`;

// Reaction for warm themes · expand a warm glow outward then settle.
const WARM_GLOW_REACT_KF = `
@keyframes nex-se-warm-glow-react {
  0%   { box-shadow: 0 0 0 0 var(--nex-se-glow, rgba(230,170,80,0.65)); }
  60%  { box-shadow: 0 0 0 20px rgba(230,170,80,0); }
  100% { box-shadow: 0 0 0 0 rgba(230,170,80,0); }
}`;

// Warm container breath · a general calm pulse for warm-material
// containers (ceramic / warm-liquid / parchment composers · warm card
// chrome · any surface that wants to feel like it's holding warmth
// rather than catching light like water does). Slow brightness breath
// with a tiny vertical lift that reads as warmth rising through the
// surface. Universal · any theme using these materials picks it up.
const WARM_CONTAINER_BREATH_KF = `
@keyframes nex-se-warm-container-breath {
  0%, 100% {
    filter: brightness(1) saturate(1);
    transform: translateY(0);
  }
  50% {
    filter: brightness(1.1) saturate(1.14);
    transform: translateY(-0.5px);
  }
}`;

// Warm-liquid inner surface drift · a slow horizontal shift of the
// top crema band so the surface feels like liquid gently moving in the
// vessel. Explicitly NOT water refraction · a far subtler lateral
// shift, no caustic sparkle. Universal · any warm-liquid material.
const WARM_LIQUID_SURFACE_KF = `
@keyframes nex-se-warm-liquid-surface {
  0%, 100% {
    background-position: 0% 0%;
    opacity: 0.65;
  }
  50% {
    background-position: 12% 0%;
    opacity: 0.85;
  }
}`;

// Steam rising · wisps lift and sway laterally while fading. Used by
// the ambient layer's "steam-rising" family. Universal keyframe.
const STEAM_RISING_KF = `
@keyframes nex-se-steam-rising {
  0%   { transform: translate3d(0, 20px, 0) scale(0.7); opacity: 0; }
  20%  { opacity: 1; }
  70%  { transform: translate3d(var(--nex-se-x, 0px), -90vh, 0) scale(1.6); opacity: 0.5; }
  100% { transform: translate3d(calc(var(--nex-se-x, 0px) * 1.4), -130vh, 0) scale(2); opacity: 0; }
}`;

// Warm-glow pulse · soft radial glow spots breathe at varied cadences.
// Used by the ambient "warm-glow-pulse" family · evokes candles,
// lamps, warm hanging lights behind the scene.
const WARM_GLOW_PULSE_KF = `
@keyframes nex-se-warm-glow-pulse {
  0%, 100% { opacity: 0.18; transform: scale(0.95); }
  50%      { opacity: 0.6;  transform: scale(1.15); }
}`;

const FOCUS_PULSE_KF = `
@keyframes nex-se-focus-pulse {
  0%, 100% { box-shadow: 0 0 0 0 var(--nex-se-focus, rgba(0,175,255,0)); }
  50%      { box-shadow: 0 0 0 4px var(--nex-se-focus, rgba(0,175,255,0.35)); }
}`;

// Water-ambient shimmer · drift personality uses this on the composer
// so the input gently breathes like water catching light. Universal
// CSS · any theme using material: "water" picks it up.
// Shortened cycle so the shimmer is perceptible during actual use
// (3.4s · ~2 cycles during a 7s preview-open). Augmented with a tiny
// lateral translate so the shimmer "pulses laterally" like a surface
// ripple catching light.
const WATER_AMBIENT_SHIMMER_KF = `
@keyframes nex-se-water-ambient-shimmer {
  0%, 100% {
    filter: brightness(1) saturate(1);
    transform: translateX(0);
  }
  50% {
    filter: brightness(1.11) saturate(1.14);
    transform: translateX(1px);
  }
}`;

// Inner light drift · a radial-gradient highlight that slowly moves
// across the bubble so the surface feels liquid, not static. Used by
// the Bubble surface on an aria-hidden overlay layered inside the
// bubble. Cycle is slow (5.5s) so it never distracts from reading.
const WATER_INNER_DRIFT_KF = `
@keyframes nex-se-water-inner-drift {
  0%, 100% {
    background-position: 20% 15%;
    opacity: 0.55;
  }
  50% {
    background-position: 72% 55%;
    opacity: 0.75;
  }
}`;

// Shop-tile water-light pass · a subtle sheen that drifts across each
// product tile so items feel like they exist in the same ocean world.
// Universal · any shop treatment can trigger it.
const WATER_TILE_SHEEN_KF = `
@keyframes nex-se-water-tile-sheen {
  0%   { background-position: -140% 50%; opacity: 0; }
  25%  { opacity: 0.7; }
  50%  { background-position: 240% 50%; opacity: 0; }
  100% { background-position: 240% 50%; opacity: 0; }
}`;

// Surface caustic pulse · soft points of light that pulse at slightly
// different cadences, like reflected caustics dancing on surfaces
// underwater. Standalone keyframe used by the ambient "surface-caustics"
// family.
const SURFACE_CAUSTIC_KF = `
@keyframes nex-se-surface-caustic {
  0%, 100% { opacity: 0.08; transform: scale(0.9); }
  40%      { opacity: 0.55; transform: scale(1.15); }
  60%      { opacity: 0.5;  transform: scale(1.1); }
}`;

// Enhanced send-trail · rising bubble cluster that lingers briefly
// above the sender. Universal · the _bubble surface uses this when
// bubbleTrailOnSend is on in the package.
const BUBBLE_TRAIL_KF = `
@keyframes nex-se-bubble-trail {
  0%   { transform: translateY(0) scale(0.5); opacity: 0; }
  18%  { opacity: 0.95; }
  70%  { transform: translateY(-70px) scale(1.05); opacity: 0.65; }
  100% { transform: translateY(-105px) scale(1); opacity: 0; }
}`;

export const MOTION_TABLE: Record<AnimationPersonality, PersonalityMotion> = {
  drift: {
    bubbleEntrance: "nex-se-drift-in",
    bubbleEntranceKeyframes: DRIFT_IN_KF,
    bubbleIdle: "nex-se-shimmer",
    bubbleIdleKeyframes: SHIMMER_KF,
    bubbleReaction: "nex-se-ripple-react",
    bubbleReactionKeyframes: RIPPLE_REACT_KF,
    // bubbles-rising fills the water column vertically · light-rays
    // bring sun from the surface · surface-caustics scatter reflected
    // light so the field has motion EVERYWHERE, not just where messages
    // and products sit · mist adds depth haze at the extremes.
    ambientFamily: [
      "bubbles-rising",
      "light-rays",
      "surface-caustics",
      "mist",
    ],
    composerFocusKeyframes: FOCUS_PULSE_KF,
  },
  flicker: {
    bubbleEntrance: "nex-se-flicker-in",
    bubbleEntranceKeyframes: FLICKER_KF,
    bubbleIdle: "nex-se-shimmer",
    bubbleIdleKeyframes: SHIMMER_KF,
    bubbleReaction: "nex-se-sprinkle-burst",
    bubbleReactionKeyframes: SPRINKLE_KF,
    ambientFamily: ["sparks", "heat-shimmer"],
    composerFocusKeyframes: FOCUS_PULSE_KF,
  },
  sway: {
    bubbleEntrance: "nex-se-sway-in",
    bubbleEntranceKeyframes: SWAY_KF,
    bubbleIdle: null,
    bubbleIdleKeyframes: null,
    bubbleReaction: null,
    bubbleReactionKeyframes: null,
    ambientFamily: ["leaves-falling", "sparkles"],
    composerFocusKeyframes: FOCUS_PULSE_KF,
  },
  bounce: {
    bubbleEntrance: "nex-se-pop",
    bubbleEntranceKeyframes: POP_KF,
    bubbleIdle: "nex-se-wobble",
    bubbleIdleKeyframes: WOBBLE_KF,
    bubbleReaction: "nex-se-sprinkle-burst",
    bubbleReactionKeyframes: SPRINKLE_KF,
    ambientFamily: ["sparkles"],
    composerFocusKeyframes: FOCUS_PULSE_KF,
  },
  orbit: {
    bubbleEntrance: "nex-se-orbit-in",
    bubbleEntranceKeyframes: ORBIT_IN_KF,
    bubbleIdle: null,
    bubbleIdleKeyframes: null,
    bubbleReaction: null,
    bubbleReactionKeyframes: null,
    ambientFamily: ["stars", "sparkles"],
    composerFocusKeyframes: FOCUS_PULSE_KF,
  },
  creep: {
    bubbleEntrance: "nex-se-creep-in",
    bubbleEntranceKeyframes: CREEP_IN_KF,
    bubbleIdle: null,
    bubbleIdleKeyframes: null,
    bubbleReaction: null,
    bubbleReactionKeyframes: null,
    ambientFamily: ["mist"],
    composerFocusKeyframes: FOCUS_PULSE_KF,
  },
  slide: {
    bubbleEntrance: "nex-se-slide-in",
    bubbleEntranceKeyframes: SLIDE_IN_KF,
    bubbleIdle: null,
    bubbleIdleKeyframes: null,
    bubbleReaction: null,
    bubbleReactionKeyframes: null,
    ambientFamily: ["particles-up"],
    composerFocusKeyframes: FOCUS_PULSE_KF,
  },
  glitch: {
    bubbleEntrance: "nex-se-glitch-in",
    bubbleEntranceKeyframes: GLITCH_IN_KF,
    bubbleIdle: null,
    bubbleIdleKeyframes: null,
    bubbleReaction: null,
    bubbleReactionKeyframes: null,
    ambientFamily: ["sparkles"],
    composerFocusKeyframes: FOCUS_PULSE_KF,
  },
  warm: {
    bubbleEntrance: "nex-se-warm-rise-in",
    bubbleEntranceKeyframes: WARM_RISE_IN_KF,
    bubbleIdle: "nex-se-warm-pulse",
    bubbleIdleKeyframes: WARM_PULSE_KF,
    bubbleReaction: "nex-se-warm-glow-react",
    bubbleReactionKeyframes: WARM_GLOW_REACT_KF,
    // Steam up the column, warm-glow pulses as background hearth, and
    // sparkles for the suggestion of aroma particles catching light.
    ambientFamily: ["steam-rising", "warm-glow-pulse", "sparkles"],
    composerFocusKeyframes: FOCUS_PULSE_KF,
  },
};

export function keyframesFor(personality: AnimationPersonality): string {
  const row = MOTION_TABLE[personality];
  return [
    row.bubbleEntranceKeyframes,
    row.bubbleIdleKeyframes,
    row.bubbleReactionKeyframes,
    row.composerFocusKeyframes,
    WATER_AMBIENT_SHIMMER_KF,   // engine-universal · active when material="water"
    WATER_INNER_DRIFT_KF,       // engine-universal · bubble inner-light overlay
    WATER_TILE_SHEEN_KF,        // engine-universal · shop tiles water-light pass
    SURFACE_CAUSTIC_KF,         // engine-universal · ambient caustic pulse
    WARM_CONTAINER_BREATH_KF,   // engine-universal · ceramic / warm-liquid / parchment containers
    WARM_LIQUID_SURFACE_KF,     // engine-universal · warm-liquid inner surface drift
    STEAM_RISING_KF,            // engine-universal · ambient steam-rising family
    WARM_GLOW_PULSE_KF,         // engine-universal · ambient warm-glow-pulse family
    BUBBLE_TRAIL_KF,            // engine-universal · active when bubbleTrailOnSend
    FADE_IN_KF,                 // always available as fallback
  ]
    .filter(Boolean)
    .join("\n");
}

export const FALLBACK_FADE_IN = "nex-se-fade-in";
