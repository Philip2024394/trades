// src/lib/nex-agent/code-engine/capability-timeframe-extraction.ts
//
// NEX · Phase 6 · DD · General Timeframe Extraction · 2026-09-21.
// Founder-authorised.
//
// PURPOSE
//
//   Reusable timeframe interpretation layer, decoupled from the weather
//   handler. Any capability that cares about "when" can call this.
//
//   The Phase-6 audit showed that Phase-5's timeframe extraction was
//   tightly coupled to the weather RecallKind — `active_timeframe`
//   stayed null in every unseen turn that carried a timeframe phrase
//   ("tomorrow", "right now", "this weekend", "next week").
//
// ANTI-CHEATING
//
//   · One canonical table of timeframe surface forms → anchor+offset.
//   · Longest-match wins so "day after tomorrow" isn't consumed by
//     "tomorrow".
//   · Head-timeframe inheritance ONLY when the message carries no
//     explicit timeframe and a continuation shape ("what about", etc.)
//     is present.
//   · Returns null (honest) when no timeframe present and no
//     inheritable state.

import type { ActiveTimeframe } from "./capability-conversation-context";
import type { MeaningTimeframe } from "./capability-meaning-object";

// ── Public API ──────────────────────────────────────────────────────

export interface TimeframeExtractionInputs {
  readonly message: string;
  /** For continuation ("and tomorrow?" · "what about next week?") we may
   *  inherit or shift from the head's active_timeframe. */
  readonly head_timeframe: ActiveTimeframe | null;
}

export interface TimeframeExtraction {
  readonly timeframe: MeaningTimeframe | null;
  readonly matched_surface: string | null;
  readonly rationale: string;
}

// ── Table of timeframe patterns ─────────────────────────────────────
// Ordered from most-specific to least-specific · first match wins.

interface TimeframePattern {
  readonly re: RegExp;
  readonly anchor: MeaningTimeframe["anchor"];
  readonly offset_days: number;
}

const TIMEFRAME_PATTERNS: readonly TimeframePattern[] = [
  { re: /\bthe day after tomorrow\b/i,       anchor: "tomorrow",     offset_days: 1 },
  { re: /\bday after tomorrow\b/i,           anchor: "tomorrow",     offset_days: 1 },
  { re: /\bthe day after\b/i,                anchor: "tomorrow",     offset_days: 1 },
  { re: /\bday after\b/i,                    anchor: "tomorrow",     offset_days: 1 },
  { re: /\bnext weekend\b/i,                 anchor: "next_weekend", offset_days: 0 },
  { re: /\bthis weekend\b/i,                 anchor: "weekend",      offset_days: 0 },
  { re: /\bthe weekend\b/i,                  anchor: "weekend",      offset_days: 0 },
  { re: /\bthis week\b/i,                    anchor: "this_week",    offset_days: 0 },
  { re: /\bnext week\b/i,                    anchor: "next_week",    offset_days: 0 },
  { re: /\blast week\b/i,                    anchor: "last_week",    offset_days: 0 },
  { re: /\bthis month\b/i,                   anchor: "this_month",   offset_days: 0 },
  { re: /\bnext month\b/i,                   anchor: "next_month",   offset_days: 0 },
  { re: /\btomorrow\b/i,                     anchor: "tomorrow",     offset_days: 0 },
  { re: /\byesterday\b/i,                    anchor: "yesterday",    offset_days: 0 },
  { re: /\btonight\b/i,                      anchor: "night",        offset_days: 0 },
  { re: /\bthis morning\b/i,                 anchor: "morning",      offset_days: 0 },
  { re: /\bthis evening\b/i,                 anchor: "evening",      offset_days: 0 },
  { re: /\bright now\b/i,                    anchor: "today",        offset_days: 0 },
  { re: /\btoday\b/i,                        anchor: "today",        offset_days: 0 },
  { re: /\bnow\b/i,                          anchor: "today",        offset_days: 0 },
  { re: /\blater(?: on)?\b/i,                anchor: "later",        offset_days: 0 },
  { re: /\bsoon\b/i,                         anchor: "soon",         offset_days: 0 },
];

// Explicit ISO-ish date · YYYY-MM-DD or 2026-09-21
const ISO_DATE_RE = /\b(20[2-9]\d)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/;

// ── extractTimeframe ────────────────────────────────────────────────

export function extractTimeframe(inputs: TimeframeExtractionInputs): TimeframeExtraction {
  const msg = inputs.message;
  // 1 · Explicit ISO date
  const iso = ISO_DATE_RE.exec(msg);
  if (iso) {
    return {
      timeframe: { anchor: "date", offset_days: 0, explicit_date_iso: iso[0], surface: iso[0] },
      matched_surface: iso[0],
      rationale: `ISO date '${iso[0]}' matched`,
    };
  }
  // 2 · Canonical table (longest-specific first · pattern order enforces this)
  for (const p of TIMEFRAME_PATTERNS) {
    const m = p.re.exec(msg);
    if (m) {
      return {
        timeframe: { anchor: p.anchor, offset_days: p.offset_days, explicit_date_iso: null, surface: m[0] },
        matched_surface: m[0],
        rationale: `pattern '${p.re.source}' matched → anchor=${p.anchor} offset=${p.offset_days}`,
      };
    }
  }
  // 3 · Continuation inheritance ("and tomorrow?" already caught above · this
  //     handles "and there?" style continuations where the message has NO
  //     timeframe phrase but head has one).
  const isContinuation = /^\s*(?:and\s+)?(?:what|how)\s+about\b|^\s*there\b|^\s*would\s+you\b/i.test(msg);
  if (isContinuation && inputs.head_timeframe) {
    return {
      timeframe: {
        anchor: inputs.head_timeframe.anchor as any,
        offset_days: inputs.head_timeframe.offset_days,
        explicit_date_iso: null,
        surface: "(inherited)",
      },
      matched_surface: null,
      rationale: `no explicit timeframe · inheriting from head (${inputs.head_timeframe.anchor}+${inputs.head_timeframe.offset_days}d)`,
    };
  }
  // 4 · Honest null
  return { timeframe: null, matched_surface: null, rationale: "no timeframe surface found and no inheritable head state" };
}

// ── Trace emitter ───────────────────────────────────────────────────

export function emitTimeframeTrace(res: TimeframeExtraction): string {
  return `timeframe · ${res.timeframe ? `anchor=${res.timeframe.anchor} · offset=${res.timeframe.offset_days}d${res.timeframe.explicit_date_iso ? ` · iso=${res.timeframe.explicit_date_iso}` : ""} · surface='${res.timeframe.surface}'` : "null"}`;
}
