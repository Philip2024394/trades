// Elevation scale — subtle shadows. No hard black shadows anywhere.
// Uses stacked shadows for depth, matching iOS + modern SaaS.

export const ELEVATION = {
  /** No shadow. */
  0: "shadow-none",
  /** Barely-there separation — dropdowns, chips. */
  1: "shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
  /** Cards resting on background. */
  2: "shadow-[0_1px_3px_rgba(15,23,42,0.05),0_1px_2px_rgba(15,23,42,0.03)]",
  /** Floating action bars, sticky nav below-fold. */
  3: "shadow-[0_4px_16px_rgba(15,23,42,0.06),0_2px_4px_rgba(15,23,42,0.04)]",
  /** Bottom sheet + drawer. */
  4: "shadow-[0_8px_32px_rgba(15,23,42,0.12),0_4px_12px_rgba(15,23,42,0.06)]",
  /** Modal / overlay. */
  5: "shadow-[0_16px_48px_rgba(15,23,42,0.18),0_8px_20px_rgba(15,23,42,0.08)]"
} as const;

export type ElevationLevel = keyof typeof ELEVATION;

/** Reversed shadow for elements that hover ABOVE content, like the
 *  bottom sticky action bar. */
export const ELEVATION_INVERTED = {
  3: "shadow-[0_-4px_20px_rgba(15,23,42,0.04)]",
  4: "shadow-[0_-8px_32px_rgba(15,23,42,0.08)]"
} as const;
