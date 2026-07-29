// src/lib/nex/brains/_expert_filter.ts
//
// Phase 1 · Terminology Intelligence Mode · expert filter (Philip 2026-07-29)
// ─────────────────────────────────────────────────────────────────────────
// Runs after the tier scorer. Given tiered candidates + the intent kind,
// returns only the candidates a professional would actually include when
// answering THIS specific question.
//
// Design rule (Philip 2026-07-29):
//   The filter must consider question intent + term relationship + user
//   goal — not only keyword matching. Tier assignment is intent-relative
//   (handled in _evidence_tiering.ts); this file consumes those tiers
//   and applies intent-specific keep/drop rules.
//
// Terminology intent rule:
//   • KEEP every Tier 1 hit (usually 1-3 · these are direct definitions)
//   • KEEP the best Tier 2 hit only if the answer would otherwise be
//     thin (adds purpose / common mistakes)
//   • DROP every Tier 3 hit (background · related · distracting)
//   • Cap terminology context at 2 hits total to keep the answer tight
//
// Non-terminology intents pass through unchanged in Phase 1.
//
// Failure mode handled: if NO Tier 1 hits survive filtering, the filter
// returns an empty kept list plus a flag. The composer treats this as
// "insufficient direct evidence" and returns an honest "need more
// information" response rather than composing an answer from context
// that does not directly define the queried term.

import type { TieredCandidate } from "./_evidence_tiering";
import type { ScorerIntentKind } from "./_evidence_tiering";

export type FilterResult = {
  kept:               TieredCandidate[];
  dropped:            TieredCandidate[];
  reason:             string;
  insufficient_t1:    boolean;   // true when terminology filter kept 0 T1 hits
};

// Cap on total candidates for terminology answers. Two is enough to
// carry Definition + Purpose without inviting the LLM to over-answer.
const TERMINOLOGY_MAX_KEPT = 2;

export function filterForIntent(
  candidates: TieredCandidate[],
  intentKind: ScorerIntentKind,
): FilterResult {
  if (intentKind !== "terminology_lookup") {
    return {
      kept:            candidates,
      dropped:         [],
      reason:          "non-terminology intent · Phase 1 pass-through",
      insufficient_t1: false,
    };
  }

  const t1 = candidates.filter((c) => c.tier === 1);
  const t2 = candidates.filter((c) => c.tier === 2);
  const t3 = candidates.filter((c) => c.tier === 3);

  const kept: TieredCandidate[] = [];
  const dropped: TieredCandidate[] = [];

  // Keep every T1 first
  for (const c of t1) {
    if (kept.length < TERMINOLOGY_MAX_KEPT) kept.push(c);
    else dropped.push(c);
  }

  // Then top-up with the single best T2 if space remains
  if (kept.length < TERMINOLOGY_MAX_KEPT && t2.length > 0) {
    kept.push(t2[0]);
    for (const c of t2.slice(1)) dropped.push(c);
  } else {
    for (const c of t2) dropped.push(c);
  }

  // Every T3 is dropped for terminology intent
  for (const c of t3) dropped.push(c);

  const insufficient_t1 = t1.length === 0;
  const reason = insufficient_t1
    ? `terminology filter · NO Tier 1 hits found · composer will honestly return "need more information" rather than compose from ${t2.length} T2 + ${t3.length} T3`
    : `terminology filter · kept ${kept.filter((c) => c.tier === 1).length} T1 + ${kept.filter((c) => c.tier === 2).length} T2 · dropped ${dropped.length} (${t2.length - Math.min(t2.length, Math.max(0, TERMINOLOGY_MAX_KEPT - t1.length))} T2 + ${t3.length} T3)`;

  return { kept, dropped, reason, insufficient_t1 };
}
