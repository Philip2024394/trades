// src/components/nex-native/family-safety/StatusChip.tsx
//
// NEX Family Safety · reusable status chip · authored 2026-10-10.
// ---------------------------------------------------------------
// Renders a semantic chip for Family Safety states:
//   · pending      · amber     · "awaiting confirmation"
//   · active       · green     · "healthy / confirmed"
//   · revoked      · red muted · "ended by one party"
//   · expired      · dim grey  · "timed out · 72h+"
//   · suspended    · orange    · "paused · reserved Phase 2"
//   · info / neutral           · neutral chrome
//
// Load-bearing anti-patterns:
//   · Do NOT re-tone (e.g. make "pending" green). Tone semantics are
//     the test anchor. If a new state is needed, add it to
//     `StatusChipTone` in `types.ts` FIRST.
//   · Do NOT accept a free-form `background` prop. The chip is a
//     closed palette.

import * as React from "react";
import { FAMILY_SAFETY_PALETTE } from "./_palette";
import type { StatusChipProps, StatusChipTone } from "./types";

interface ToneStyle {
  readonly background: string;
  readonly border: string;
  readonly color: string;
  readonly dot: string;
}

const TONE_STYLES: Readonly<Record<StatusChipTone, ToneStyle>> = {
  neutral: {
    background: FAMILY_SAFETY_PALETTE.surfaceHi,
    border: FAMILY_SAFETY_PALETTE.divider,
    color: FAMILY_SAFETY_PALETTE.textPrimary,
    dot: FAMILY_SAFETY_PALETTE.textDim,
  },
  info: {
    background: FAMILY_SAFETY_PALETTE.cyanMuted,
    border: FAMILY_SAFETY_PALETTE.cyanBorder,
    color: FAMILY_SAFETY_PALETTE.textPrimary,
    dot: FAMILY_SAFETY_PALETTE.cyan,
  },
  pending: {
    background: FAMILY_SAFETY_PALETTE.amberMuted,
    border: FAMILY_SAFETY_PALETTE.amberBorder,
    color: FAMILY_SAFETY_PALETTE.textPrimary,
    dot: FAMILY_SAFETY_PALETTE.amber,
  },
  active: {
    background: FAMILY_SAFETY_PALETTE.familyGreenMuted,
    border: FAMILY_SAFETY_PALETTE.familyGreenBorder,
    color: FAMILY_SAFETY_PALETTE.textPrimary,
    dot: FAMILY_SAFETY_PALETTE.familyGreen,
  },
  revoked: {
    background: FAMILY_SAFETY_PALETTE.emergencyMuted,
    border: FAMILY_SAFETY_PALETTE.emergencyBorder,
    color: FAMILY_SAFETY_PALETTE.textPrimary,
    dot: FAMILY_SAFETY_PALETTE.emergency,
  },
  expired: {
    background: FAMILY_SAFETY_PALETTE.surfaceMuted,
    border: FAMILY_SAFETY_PALETTE.divider,
    color: FAMILY_SAFETY_PALETTE.textDim,
    dot: FAMILY_SAFETY_PALETTE.textDim,
  },
  suspended: {
    background: FAMILY_SAFETY_PALETTE.orangeMuted,
    border: `rgba(255, 114, 0, 0.45)`,
    color: FAMILY_SAFETY_PALETTE.textPrimary,
    dot: FAMILY_SAFETY_PALETTE.orange,
  },
};

export function StatusChip({
  tone,
  label,
  glyph,
  testId,
}: StatusChipProps): React.JSX.Element {
  const s = TONE_STYLES[tone];
  return (
    <span
      role="status"
      aria-label={`status ${label}`}
      data-nex-family-safety-status-chip="true"
      data-nex-family-safety-status-chip-tone={tone}
      data-testid={testId ?? `nex-family-safety-status-chip-${tone}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: s.color,
        background: s.background,
        border: `1px solid ${s.border}`,
        borderRadius: 999,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: s.dot,
          boxShadow: `0 0 0 2px ${s.background}`,
        }}
      />
      {glyph ? <span aria-hidden>{glyph}</span> : null}
      {label}
    </span>
  );
}
