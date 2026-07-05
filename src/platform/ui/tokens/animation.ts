// Animation tokens — durations + easings.
//
// Consistent motion feels premium. Every interactive element uses
// one of these three durations.

export const DURATION = {
  /** Instant feedback — hover states, colour transitions. */
  fast: 120,
  /** Standard — element enters/exits, sheet opens. */
  base: 200,
  /** Long — page transitions, morph animations. */
  slow: 320
} as const;

export const EASE = {
  /** Standard — most transitions. */
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  /** Enter — element appearing. */
  enter: "cubic-bezier(0, 0, 0.2, 1)",
  /** Exit — element leaving. */
  exit: "cubic-bezier(0.4, 0, 1, 1)"
} as const;

/** Tailwind-friendly transition classes. */
export const TRANSITION = {
  fast: "transition-all duration-[120ms] ease-out",
  base: "transition-all duration-[200ms] ease-out",
  slow: "transition-all duration-[320ms] ease-out"
} as const;
