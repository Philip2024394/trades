// Mobile UI Kit — spacing scale.
//
// 4px base unit. Every layout uses this scale — no inline numeric
// paddings. If you need a size that isn't on the scale, add it here.

export const SPACE = {
  none: 0,
  hair: 1,       // borders only
  xxs: 4,        // 4
  xs: 8,         // 8
  sm: 12,        // 12
  md: 16,        // 16 — default gap between components
  lg: 24,        // 24 — default section vertical padding on mobile
  xl: 32,        // 32
  "2xl": 48,     // 48
  "3xl": 64,     // 64 — desktop section padding
  "4xl": 96
} as const;

export type SpaceKey = keyof typeof SPACE;

/** Section vertical padding: py-12 mobile, py-16 desktop. */
export const SECTION_PAD_Y = "py-12 md:py-16";

/** Page horizontal padding: px-4 mobile, unchanged on desktop —
 *  cap width with max-w-* on the container. */
export const PAGE_PAD_X = "px-4";

/** Standard mobile touch-target minimum height (WCAG). */
export const TAP_TARGET_MIN = 44;
