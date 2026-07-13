// Brand tokens — the canonical colour set for Thenetworkers.
//
// One source of truth. Every new component reads from here rather
// than re-defining locally-scoped hex constants. This is what stops
// the amber / yellow drift that showed up when the builder + warehouse
// were first shipped.
//
// If a colour lands here, it lands in the design token registry too
// (platform/design/tokens) — that registry is the runtime brain that
// generates CSS custom properties. This file is the compile-time
// helper for React inline styles.

/** Primary brand accent — Thenetworkers's amber-yellow. Used in Yard,
 *  Studio, Xrated profile cards, marketing cards, everywhere. */
export const BRAND_YELLOW = "#FFB300";

/** Deep black — surfaces, sidebars, dark headers. */
export const BRAND_BLACK = "#0A0A0A";

/** Secondary amber — hover states, warnings, second-priority accents. */
export const BRAND_AMBER = "#F59E0B";

/** Green — success, in-stock, live indicators. */
export const BRAND_GREEN = "#10B981";

/** Dark green for CTAs — Philip explicitly dislikes light green for
 *  buttons. Any "install", "confirm", "send", "enquire", or success
 *  CTA in the platform should use `BRAND_GREEN_DARK` (green-800).
 *  `BRAND_GREEN` above stays reserved for in-stock / live indicators. */
export const BRAND_GREEN_DARK = "#166534";

/** Red — errors, out-of-stock. */
export const BRAND_RED = "#DC2626";

/** Blue — informational surfaces. */
export const BRAND_BLUE = "#3B82F6";

/** WhatsApp brand green — reserved for the WhatsApp CTA specifically. */
export const WHATSAPP_GREEN = "#25D366";

/** Ink (default text). */
export const BRAND_INK = "#0F172A";

/** Muted ink (secondary text). */
export const BRAND_MUTED = "#64748B";

/** Surface (default page background). */
export const BRAND_SURFACE = "#F8FAFC";

/** Card surface. */
export const BRAND_CARD = "#FFFFFF";

/** Border. */
export const BRAND_BORDER = "#E2E8F0";

/** Convenience export as a namespace object. */
export const BRAND = {
  yellow: BRAND_YELLOW,
  black: BRAND_BLACK,
  amber: BRAND_AMBER,
  green: BRAND_GREEN,
  greenDark: BRAND_GREEN_DARK,
  red: BRAND_RED,
  blue: BRAND_BLUE,
  whatsappGreen: WHATSAPP_GREEN,
  ink: BRAND_INK,
  muted: BRAND_MUTED,
  surface: BRAND_SURFACE,
  card: BRAND_CARD,
  border: BRAND_BORDER
} as const;
