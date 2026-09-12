// src/lib/nex/live/spatial-gesture-detector.ts
//
// NEX Music/Video · Spatial gesture detector · Philip 2026-09-06
//
// Pure classifier for the four-direction spatial navigation model.
// Given a swipe (dx · dy · dt) returns the intended direction with a
// confidence + reason, or `NONE` when the input is a tap / too-short
// swipe / too-diagonal / too-slow.
//
// Purpose (Phase M · §16):
//   · Gestures must not accidentally trigger during a scroll, tap,
//     button press, volume slider drag, etc.
//   · Diagonal swipes resolve predictably — the dominant axis wins,
//     and diagonals close to 45° return NONE so the user can retry.
//   · Velocity + distance together decide intent — a slow finger drag
//     shouldn't page whole content sets.
//
// PURE FUNCTION MODULE. No I/O. No React. No DOM.

export type SpatialDirection = "LEFT" | "RIGHT" | "UP" | "DOWN" | "NONE";

export type SpatialGestureInput = {
  /** Horizontal displacement · positive = right */
  dx: number;
  /** Vertical displacement · positive = down */
  dy: number;
  /** Elapsed milliseconds between touchstart and touchend */
  dt_ms: number;
};

export type SpatialGestureDecision = {
  direction: SpatialDirection;
  /** 0..1 confidence · 1 = unambiguous · used by callers that may
   *  want to gate loud transitions to higher-confidence swipes. */
  confidence: number;
  /** Machine-readable reason for observability. */
  reason:
    | "clear_left"
    | "clear_right"
    | "clear_up"
    | "clear_down"
    | "too_short"
    | "too_slow"
    | "too_diagonal"
    | "tap";
};

// ── Thresholds ──────────────────────────────────────────────────
//
// These are conservative on purpose. A 40px+ swipe over ≤600ms with a
// clear dominant axis is our floor. Anything less falls back to NONE
// so it never fires accidentally during scroll/tap interactions.

const MIN_DISTANCE_PX = 40;         // shorter than this = tap or hold
const MIN_VELOCITY_PX_S = 120;      // slower than this = not a swipe
const MAX_DURATION_MS = 900;        // longer than this = drag intent
const DOMINANCE_RATIO = 1.5;        // axis wins by ≥1.5× the other · else too_diagonal

export function classifyGesture(input: SpatialGestureInput): SpatialGestureDecision {
  const { dx, dy, dt_ms } = input;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const totalDistance = Math.hypot(dx, dy);

  // Tap · barely any movement
  if (totalDistance < 10) {
    return { direction: "NONE", confidence: 0, reason: "tap" };
  }

  // Too short to be an intentional page-swipe
  if (totalDistance < MIN_DISTANCE_PX) {
    return { direction: "NONE", confidence: 0, reason: "too_short" };
  }

  // Duration guards
  if (dt_ms <= 0 || dt_ms > MAX_DURATION_MS) {
    return { direction: "NONE", confidence: 0, reason: "too_slow" };
  }

  // Velocity (pixels/second)
  const velocity = (totalDistance / dt_ms) * 1000;
  if (velocity < MIN_VELOCITY_PX_S) {
    return { direction: "NONE", confidence: 0, reason: "too_slow" };
  }

  // Diagonal check · dominant axis must lead by DOMINANCE_RATIO
  const horizontalDominant = absX >= absY * DOMINANCE_RATIO;
  const verticalDominant = absY >= absX * DOMINANCE_RATIO;
  if (!horizontalDominant && !verticalDominant) {
    return { direction: "NONE", confidence: 0, reason: "too_diagonal" };
  }

  // Confidence · combines distance overshoot + dominance clarity
  const distanceScore = Math.min(1, totalDistance / (MIN_DISTANCE_PX * 2.5));
  const dominance = horizontalDominant
    ? absX / Math.max(1, absY)
    : absY / Math.max(1, absX);
  const dominanceScore = Math.min(1, dominance / (DOMINANCE_RATIO * 2));
  const confidence = Math.max(0, Math.min(1, (distanceScore + dominanceScore) / 2));

  if (horizontalDominant) {
    return dx > 0
      ? { direction: "RIGHT", confidence, reason: "clear_right" }
      : { direction: "LEFT",  confidence, reason: "clear_left"  };
  }
  // verticalDominant
  return dy > 0
    ? { direction: "DOWN", confidence, reason: "clear_down" }
    : { direction: "UP",   confidence, reason: "clear_up"   };
}

// Convenience export · lets tests import the tuning constants without
// reaching into internals.
export const SPATIAL_GESTURE_CONFIG = {
  MIN_DISTANCE_PX,
  MIN_VELOCITY_PX_S,
  MAX_DURATION_MS,
  DOMINANCE_RATIO,
} as const;
