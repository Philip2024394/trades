// src/components/nex-native/account-gate/LockedSettingsIcon.tsx
//
// NEX Settings Header · 3D-styled lock icon.
// -----------------------------------------------------------------------
// Sealed 2026-10-10.
//
// Replaces the gear icon in the shared NEX page header when the current
// viewer has NO `nex_account` row. Clicking the surrounding button
// opens the `CreateAccountPrompt` modal (handled by the parent).
//
// Visual language:
//   · Padlock shape · body + shackle · keyhole in the body.
//   · 3D feel via `<linearGradient>` on the body (lighter at top,
//     darker at the bottom) + a soft inner highlight + a darker
//     stroke outline offset (1,1) in a cloned background path.
//   · Shackle uses its own gradient (metal highlight) to echo the
//     body's depth cue.
//
// Why amber (not red):
//   The gate signals "create an account to unlock Settings", not
//   "forbidden". Red is reserved for the Emergency surface. Amber reads
//   as "gated / optional unlock" without alarming the user.
//
// Size:
//   Default 18 (matches the sibling gear/home/search icons · see
//   `src/app/nex-native/_page-header.tsx`). Caller may override.
//
// Accessibility:
//   · `role="img"` + an `aria-label` describing the state.
//   · The parent button is the actual interactive element; this SVG is
//     presentational within it.
//
// Performance:
//   · < 2 KB rendered.
//   · No external asset · no network fetch.
//   · Single `<svg>` element · gradient defs scoped to a stable id so
//     multiple instances on one page don't collide (`props.idPrefix`).

import * as React from "react";
import { ACCOUNT_GATE_PALETTE as P } from "./_palette";

export interface LockedSettingsIconProps {
  /** Pixel size · defaults to 18 to match sibling icons. */
  readonly size?: number;
  /** Optional stable prefix for gradient defs (SSR hydration safety). */
  readonly idPrefix?: string;
  /** Override the aria-label if the parent carries different wording. */
  readonly ariaLabel?: string;
}

export function LockedSettingsIcon({
  size = 18,
  idPrefix = "nex-settings-locked",
  ariaLabel = "Settings · account required",
}: LockedSettingsIconProps) {
  const bodyGrad = `${idPrefix}-body-grad`;
  const shackleGrad = `${idPrefix}-shackle-grad`;
  const highlightGrad = `${idPrefix}-highlight-grad`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={ariaLabel}
      data-testid="nex-settings-locked-icon"
      data-nex-account-gate-locked-icon
    >
      <defs>
        {/* 3D body gradient · amber top → deep orange bottom */}
        <linearGradient id={bodyGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={P.lockAmberTop} />
          <stop offset="55%" stopColor={P.lockAmberMid} />
          <stop offset="100%" stopColor={P.lockAmberBot} />
        </linearGradient>
        {/* Shackle gradient · metal highlight */}
        <linearGradient id={shackleGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={P.lockShackleHi} />
          <stop offset="100%" stopColor={P.lockShackle} />
        </linearGradient>
        {/* Soft highlight on the body for the 3D sheen */}
        <linearGradient id={highlightGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={P.lockHighlight} stopOpacity="0.9" />
          <stop offset="100%" stopColor={P.lockHighlight} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Depth shadow · a slightly offset dark silhouette behind the
          body gives a subtle 3D rise above the dark-navy header. */}
      <rect
        x="5.5"
        y="11.5"
        width="13"
        height="10"
        rx="2.2"
        ry="2.2"
        fill={P.lockShadow}
      />

      {/* Shackle · drawn below the body so the body visually "covers"
          its base, reinforcing depth. */}
      <path
        d="M8 11 V8 a4 4 0 0 1 8 0 v3"
        fill="none"
        stroke={`url(#${shackleGrad})`}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Shackle inner-highlight line (thin) · adds metal 3D cue. */}
      <path
        d="M8.8 10.8 V8 a3.2 3.2 0 0 1 6.4 0 v2.8"
        fill="none"
        stroke={P.lockHighlight}
        strokeOpacity="0.45"
        strokeWidth="0.6"
        strokeLinecap="round"
      />

      {/* Lock body · gradient-filled with a dark stroke outline. */}
      <rect
        x="5"
        y="11"
        width="13"
        height="10"
        rx="2.2"
        ry="2.2"
        fill={`url(#${bodyGrad})`}
        stroke={P.lockShadow}
        strokeWidth="0.6"
      />

      {/* Top highlight · narrower rounded rect producing the sheen. */}
      <rect
        x="5.8"
        y="11.5"
        width="11.4"
        height="3.5"
        rx="1.6"
        ry="1.6"
        fill={`url(#${highlightGrad})`}
      />

      {/* Keyhole · dark circle + teardrop stem */}
      <circle cx="11.5" cy="15.4" r="1.35" fill={P.lockKeyhole} />
      <rect
        x="10.95"
        y="15.4"
        width="1.1"
        height="3"
        rx="0.5"
        ry="0.5"
        fill={P.lockKeyhole}
      />
    </svg>
  );
}
