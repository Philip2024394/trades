// Corner radius scale.
//
// Mobile uses tighter radius; desktop uses larger. Cards should
// grow from `rounded-xl` on mobile to `rounded-2xl` on desktop
// for a more premium feel at larger sizes.

export const RADIUS = {
  none: 0,
  sm: 4,           // small chips
  md: 8,           // dense controls
  lg: 12,          // mobile cards
  xl: 16,          // mobile-to-desktop cards
  "2xl": 20,       // desktop cards
  "3xl": 28,       // hero sections
  full: 9999
} as const;

export type RadiusKey = keyof typeof RADIUS;

/** Card radius that scales: xl on mobile, 2xl on desktop. */
export const CARD_RADIUS = "rounded-xl md:rounded-2xl";

/** Chip / pill radius. */
export const CHIP_RADIUS = "rounded-full";
