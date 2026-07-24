// Industry intelligence — market-level signals.
//
// EVIDENCE OR SILENCE: this engine reads real observation data (query
// counts, market snapshots) and returns "no signal detected yet" if
// nothing is measurable. It never fabricates "roofing enquiries up
// 24%" without a source.
//
// Callers pass in `observations` — a small structured feed. The engine
// derives signals from that. When the feed is empty we return [] and
// the advisor mentions the gap honestly.

import { evidenceFor, type IndustrySignal, type IndustrySignalKind } from "./types";

export type IndustryObservation = {
  kind:          IndustrySignalKind;
  headline:      string;
  change_pct?:   number | null;
  window_days:   number;
  /** Where the observation came from — kept so the evidence trail is
   *  faithful. Example: "net.market_signals" or "mp.searches_by_trade". */
  source_table:  string;
  reason:        string;
};

export type DetectIndustrySignalsInput = {
  observations?: IndustryObservation[];
};

/** Threshold — swings below this are noise, not signal. */
const MIN_CHANGE_PCT = 10;

export function detectIndustrySignals(input: DetectIndustrySignalsInput): IndustrySignal[] {
  const obs = input.observations ?? [];
  if (obs.length === 0) return [];

  const out: IndustrySignal[] = [];
  for (const o of obs) {
    // Filter noise — only surface meaningful movements.
    if (typeof o.change_pct === "number" && Math.abs(o.change_pct) < MIN_CHANGE_PCT) continue;
    out.push({
      kind:        o.kind,
      headline:    o.headline,
      change_pct:  o.change_pct ?? null,
      window_days: o.window_days,
      reason:      o.reason,
      evidence:    evidenceFor(`bos.industry from ${o.source_table}`, [o.source_table])
    });
  }
  // Biggest movement first.
  out.sort((a, b) => Math.abs(b.change_pct ?? 0) - Math.abs(a.change_pct ?? 0));
  return out;
}

/** Convenience formatter — one line per signal. */
export function formatIndustrySignal(s: IndustrySignal): string {
  const arrow = s.change_pct === null ? "" : s.change_pct > 0 ? " ↑" : " ↓";
  const pct   = s.change_pct === null ? "" : ` (${s.change_pct > 0 ? "+" : ""}${s.change_pct.toFixed(0)}%)`;
  return `${s.headline}${arrow}${pct} · ${s.window_days}-day window`;
}
