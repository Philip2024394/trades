// src/components/nex-native/family-safety/AgeTransitionCountdownChip.tsx
//
// NEX Family Safety · CC-3 · Age-transition countdown chip.
//
// Renders a compact countdown surface showing how many days remain
// until an in-custody minor turns 16. Tone shifts as the deadline
// nears:
//
//   · 30+ days               · neutral (grey)
//   · 1-30 days              · info (cyan · "notification window")
//   · 0 days (today / past)  · pending (amber · "transition due")
//   · after transfer         · active (green · "handover complete")
//
// Load-bearing anti-patterns:
//   · Do NOT render ANY account id or child display name.
//   · Do NOT compute dates on the client · the ISO transfer timestamp
//     is passed in from the server component.
//   · Do NOT alter the sealed palette for an edge-case theme.

import * as React from "react";
import { StatusChip } from "./StatusChip";
import type { StatusChipTone } from "./types";

export interface AgeTransitionCountdownChipProps {
  /** ISO 8601 timestamp for the sealed `auto_transfer_at` moment. */
  readonly autoTransferAt: string;
  /** ISO 8601 timestamp for the ISO moment to compare against. The
   *  SERVER passes `Date.now()` as ISO · this makes the chip
   *  deterministic in SSR and in test. */
  readonly nowIso: string;
  /** When present and non-null, the transition is already complete. */
  readonly transferredAt: string | null;
  readonly testId?: string;
}

function daysBetween(targetIso: string, nowIso: string): number {
  const t = new Date(targetIso).getTime();
  const n = new Date(nowIso).getTime();
  if (!Number.isFinite(t) || !Number.isFinite(n)) return 0;
  return Math.floor((t - n) / (1000 * 60 * 60 * 24));
}

export function AgeTransitionCountdownChip(
  props: AgeTransitionCountdownChipProps,
): React.JSX.Element {
  if (props.transferredAt) {
    return (
      <StatusChip
        tone="active"
        label="Handover complete"
        glyph="🎓"
        testId={props.testId ?? "nex-family-safety-age-transition-completed"}
      />
    );
  }

  const days = daysBetween(props.autoTransferAt, props.nowIso);
  let tone: StatusChipTone;
  let label: string;
  let glyph: string;

  if (days > 30) {
    tone = "neutral";
    label = `${days} days to 16`;
    glyph = "🗓️";
  } else if (days > 0) {
    tone = "info";
    label = `${days} day${days === 1 ? "" : "s"} to handover`;
    glyph = "⏳";
  } else if (days === 0) {
    tone = "pending";
    label = "Handover due today";
    glyph = "⏰";
  } else {
    tone = "pending";
    label = `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`;
    glyph = "⏰";
  }

  return (
    <StatusChip
      tone={tone}
      label={label}
      glyph={glyph}
      testId={props.testId ?? "nex-family-safety-age-transition-countdown"}
    />
  );
}
