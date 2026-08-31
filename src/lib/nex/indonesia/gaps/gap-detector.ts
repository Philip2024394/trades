// GapDetector · turns a retrieval outcome into a KnowledgeGap
// observation (or nothing when the answer was good enough).
//
// Consumers wire this in at the moment they call retrieveKnowledge:
//
//   const hits = retrieveKnowledge(message, opts);
//   const gap = detectGap({ intent, rawQuery: message, hits });
//   if (gap) gapRegistry.observe(gap);
//
// The detector is intentionally conservative — a good hit list means
// no gap. Only produce a gap when the retrieval genuinely under-
// served the user. Otherwise the queue gets flooded with noise.

import type { KnowledgeHit } from "../knowledge";
import type { GapObservation } from "./types";

export type DetectorInput = {
  intent: string;
  rawQuery: string;
  hits: KnowledgeHit[];
  /** Optional geographic scope (e.g. from the intent's secondary Indonesia mention). */
  scope?: string;
  /** Optional walker suggestions from the caller (e.g. classify by domain). */
  suggestedWalkers?: string[];
  /** Minimum confidence a top hit must reach to be considered "good". */
  minConfidence?: number;
  /** Maximum staleness (0..1) a top hit may have. */
  maxStaleness?: number;
  /** Explicit signal from the caller that the query needs live data. */
  requiresLive?: boolean;
};

/** Returns a GapObservation when the retrieval was insufficient,
 *  else null. */
export function detectGap(input: DetectorInput): GapObservation | null {
  const minConf = input.minConfidence ?? 0.7;
  const maxStale = input.maxStaleness ?? 0.8;

  // Explicit live-data intent · no cache can answer it.
  if (input.requiresLive) {
    return {
      intent: input.intent,
      rawQuery: input.rawQuery,
      reason: "requires_live",
      scope: input.scope,
      suggestedWalkers: input.suggestedWalkers,
    };
  }

  // No hits at all.
  if (!input.hits || input.hits.length === 0) {
    return {
      intent: input.intent,
      rawQuery: input.rawQuery,
      reason: "no_hits",
      scope: input.scope,
      suggestedWalkers: input.suggestedWalkers,
    };
  }

  const top = input.hits[0]!;

  // Top hit below confidence threshold.
  if (top.confidence < minConf) {
    return {
      intent: input.intent,
      rawQuery: input.rawQuery,
      reason: "low_confidence",
      scope: input.scope,
      suggestedWalkers: input.suggestedWalkers,
    };
  }

  // Stale-only when every hit's freshness is below the max.
  // Best-effort: legacy KnowledgeRecord doesn't carry `staleness`
  // directly, but the RAG suffix already tells the LLM to defer to
  // tools for time-sensitive facts. This branch is future-facing
  // (once EntityRecord.freshness.staleness is populated).
  const allStale = input.hits.every((h) => {
    const anyH = h as unknown as { freshness?: { staleness?: number } };
    return anyH.freshness?.staleness !== undefined && anyH.freshness.staleness > maxStale;
  });
  if (allStale && input.hits.length > 0) {
    return {
      intent: input.intent,
      rawQuery: input.rawQuery,
      reason: "stale_only",
      scope: input.scope,
      suggestedWalkers: input.suggestedWalkers,
    };
  }

  return null;
}
