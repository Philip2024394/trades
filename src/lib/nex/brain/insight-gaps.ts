// src/lib/nex/brain/insight-gaps.ts
//
// Stage 3.8 · Bridge from Brain Insight to the workforce's GapRegistry
// (Philip 2026-08-31). Insight detects "the user wants something we
// structurally can't answer" (facility filtering, price, quietness,
// etc.); this module records that as a knowledge gap so the workforce
// can prioritise acquiring the missing capability.
//
// One insight → one observation. Duplicate observations bump the
// existing gap's frequency (the GapRegistry deduplicates by hashed
// normalised query), so a hundred users asking "hotel with pool" all
// contribute to the same gap's priority.
//
// v1 is best-effort · never breaks the chat if the registry write
// fails. The registry itself is atomic tmp+rename so partial writes
// don't corrupt state.

import { GapRegistry } from "@/lib/nex/indonesia/gaps/gap-registry";
import type { InsightDecision } from "./insight";

let SINGLETON: GapRegistry | null = null;

function registry(): GapRegistry {
  if (!SINGLETON) SINGLETON = new GapRegistry();
  return SINGLETON;
}

/** Test-only · inject an in-memory registry for isolation. */
export function _setInsightGapRegistryForTests(next: GapRegistry | null): void {
  SINGLETON = next;
}

/** Record an Insight-detected learning gap. No-op when the decision
 *  isn't a learning_gap. Never throws — a failed registry write
 *  logs and returns. */
export function recordInsightGap(
  decision: InsightDecision,
  ctx: { userMarket?: "ID" | "UK" | "US"; intent: string },
): void {
  if (decision.reason !== "learning_gap" || !decision.learningGap) return;
  try {
    registry().observe({
      intent: ctx.intent,
      rawQuery: decision.learningGap.query,
      reason: "requires_service",
      scope: decision.learningGap.scope,
      suggestedWalkers: [], // to be populated once acquisition walkers land for these gaps
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[insight-gaps] failed to record gap:", err instanceof Error ? err.message : String(err));
  }
}
