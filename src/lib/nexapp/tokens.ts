// NEX home experience · design tokens · self-contained.
//
// NEX has its own visual identity per doctrine ("NEX is NEX · not a
// chatbot · not a wrapper around another brand"). Its orange is a
// distinctive vibrant tone — different from the platform's amber/yellow
// (BRAND_YELLOW). Keeping tokens local to /nexapp so this palette
// evolves independently.
//
// Reference: the mobile mockup Philip supplied 2026-08-21.

export const NEX = {
  // Near-black canvas. Slightly warmer than pure #000 to sit better
  // with the orange particle field.
  bg:            "#050505",
  bgSurface:     "#0d0d0d",   // Cards, chat bubbles, nav pill
  bgSurfaceHi:   "#151515",   // Elevated (input field, active card)
  border:        "rgba(249, 115, 22, 0.28)",   // Subtle orange outline
  borderMuted:   "rgba(255, 255, 255, 0.06)",

  // NEX orange · the "energy" colour · used sparingly and deliberately.
  orange:        "#F97316",
  orangeSoft:    "#FB923C",
  orangeGlow:    "rgba(249, 115, 22, 0.55)",
  orangeGlowLo:  "rgba(249, 115, 22, 0.14)",

  text:          "#F5F5F5",
  textMuted:     "#9CA3AF",
  textFaint:     "#6B7280",

  green:         "#10B981",   // Open indicator only

  // Layout constants
  navHeight:     92,           // Bottom nav (excl. safe area)
  // 2026-08-23 · reduced 72 → 60 · orb was touching the input pill above the
  // pill during the speaking-state pulse + halo. Smaller diameter keeps the
  // orb distinctive without invading the input line. Cascades: NexIdentityButton
  // (width/height) + NexBottomNav (identity-slot wrapper width = identitySize + 20).
  identitySize:  60,
} as const;

// Timing tokens for the NEX identity animation.
export const NEX_MOTION = {
  idle:      { ringPulse: "6.5s", waveIdle: "4.5s" },
  thinking:  { ringPulse: "1.8s", waveActive: "0.9s" },
  speaking:  { ringPulse: "0.9s", waveActive: "0.5s" },
} as const;
