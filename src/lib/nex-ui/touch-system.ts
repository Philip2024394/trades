// NEX Touch System · design tokens · Philip 2026-09-02.
//
// Centralised animation timing / easing / scale / touch-target constants
// so every interactive control in the NEX shell feels the same. Replaces
// scattered 140/160/180/220ms values, `scale(1.04)` / `scale(1.06)`
// inconsistencies, and mixed cubic-bezier easings.
//
// Rules:
//   · Press-down feedback fires INSTANTLY (short 90ms transition)
//   · Release settles slower (180ms) for a satisfying "return"
//   · Hover feedback (desktop only) uses the same scale as press-in
//   · All values pure primitives · no framework dependencies
//   · Consumers apply via inline style or via <TouchButton> primitive
//
// Companion files:
//   src/lib/nex-ui/useLongPress.ts     · hold-to-act hook
//   src/lib/nex-ui/usePressFeedback.ts · onPointerDown/Up state hook
//   src/components/nexapp/primitives/TouchButton.tsx · wired-up button

// ─── Timing tokens (ms) ────────────────────────────────────────────────
export const NEX_TIMING = Object.freeze({
  /** Press-in: how fast the compression feedback appears · fast so it
   *  feels tied to the finger, not delayed. */
  pressIn:  90,
  /** Press-out: release-back-to-rest transition · slightly slower so the
   *  release feels satisfying rather than snappy. */
  pressOut: 180,
  /** Hover-in: desktop-only hover transitions (secondary priority). */
  hoverIn:  140,
  /** Page-level transitions (surface swap · overlay fade). */
  page:     260,
  /** Slow surface reveal (e.g. mascot stage entry). */
  reveal:   400,
} as const);

// ─── Easing tokens (CSS timing-function values) ────────────────────────
export const NEX_EASE = Object.freeze({
  /** Press-in: quick out from rest · use with pressIn duration. */
  press:   "cubic-bezier(0.32, 0, 0.67, 0)",
  /** Release: settle back with slight decel · use with pressOut. */
  release: "cubic-bezier(0.33, 1, 0.68, 1)",
  /** General settle: overlays, panels, page-level moves. */
  settle:  "cubic-bezier(0.2, 0.7, 0.2, 1)",
} as const);

// ─── Scale tokens (transform: scale() values) ──────────────────────────
export const NEX_SCALE = Object.freeze({
  /** Rest state · no transform (inline style may omit). */
  rest:     1,
  /** Press-down: how much the button compresses under a finger.
   *  0.96 is subtle-but-noticeable · matches iOS/Android native feel. */
  press:    0.96,
  /** Hover elevation (desktop only) · same scale as press but going UP
   *  so hover reads as "raised toward you" and press reads as "pushed in". */
  hover:    1.04,
  /** Emphasis: cards you want to feel more responsive (friend cards etc). */
  emphasis: 1.06,
} as const);

// ─── Touch-target guidance ─────────────────────────────────────────────
/** WCAG 2.5.5 (AAA) + Apple/Google minimum · 44 CSS px. `<TouchButton>`
 *  enforces this via invisible hit-padding when a visual size is smaller. */
export const NEX_TOUCH_TARGET_MIN = 44 as const;

// ─── Composed CSS transition strings (convenience) ─────────────────────
/** Standard press-in transition · use for press-down state changes. */
export const NEX_TRANSITION_PRESS = `transform ${NEX_TIMING.pressIn}ms ${NEX_EASE.press}` as const;
/** Standard release transition · use for return-to-rest state changes. */
export const NEX_TRANSITION_RELEASE = `transform ${NEX_TIMING.pressOut}ms ${NEX_EASE.release}` as const;
/** Combined press + release transition (single string · applied at rest ·
 *  browser picks appropriate duration based on the direction of change). */
export const NEX_TRANSITION_BOTH = `transform ${NEX_TIMING.pressOut}ms ${NEX_EASE.release}` as const;
