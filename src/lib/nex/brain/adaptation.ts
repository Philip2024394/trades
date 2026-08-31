// src/lib/nex/brain/adaptation.ts
//
// Stage 3.25 · Phase 18 · Adaptation (Philip 2026-08-31).
//
// Closes the second loop: Learning writes ledger entries → Adaptation
// reads them → future behavior adjusts. Reads recent Learning entries
// per conversation, detects repeat-signal patterns, produces an
// AdaptationReport with concrete suggested adjustments.
//
// v1 discipline:
//   · Deterministic pattern reader · no LLM
//   · Reads per-conversation ledger via recentLearningForConversation
//   · Detects 4 pattern kinds v1: repeated_gap_scope · frequent_corrections ·
//     recurring_reflection_failure · persistent_low_confidence
//   · Observational v1 · attaches signals to response for future
//     composer to consume (v2 would rewrite reply)
//   · Never fabricates a pattern the ledger doesn't support
//   · Bounded thresholds prevent noise (min 2-3 occurrences)

import { recentLearningForConversation, type LearningEntry } from "./learning";

export type AdaptationKind =
  | "repeated_gap_scope"           // same gap scope hit N+ times · surface acknowledgement
  | "frequent_corrections"         // slot corrections ≥N · confirm changes more clearly
  | "recurring_reflection_failure" // same reflection check failed N+ times · needs pattern extension
  | "persistent_low_confidence";   // N+ low-confidence turns · re-anchor grounding

export type AdaptationSignal = {
  kind: AdaptationKind;
  scope?: string;
  occurrenceCount: number;
  suggestedAdjustment: string;
  reason: string;
};

export type AdaptationReport = {
  signals: AdaptationSignal[];
  hasSignals: boolean;
  summary: string;
};

export type AdaptationInput = {
  conversationId?: string;
  /** Max ledger entries to consider · default 20 (recent window). */
  windowSize?: number;
};

// Thresholds · deliberately conservative to avoid noise.
const THRESH_GAP_SCOPE = 2;
const THRESH_CORRECTIONS = 2;
const THRESH_REFLECTION_FAILURE = 2;
const THRESH_LOW_CONFIDENCE = 3;

/**
 * Read the Learning ledger for this conversation and produce
 * adaptation signals for any repeat-patterns worth surfacing.
 */
export function detectAdaptations(input: AdaptationInput): AdaptationReport {
  const cid = input.conversationId;
  if (!cid) {
    return { signals: [], hasSignals: false, summary: "no conversation · no adaptation" };
  }

  const entries: LearningEntry[] = recentLearningForConversation(cid, input.windowSize ?? 20);
  const signals: AdaptationSignal[] = [];

  // ─── Pattern 1: repeated gap scope ────────────────────────────────
  const gapByScope: Record<string, number> = {};
  for (const e of entries) {
    if (e.kind === "insight_gap_detected" && e.scope) {
      gapByScope[e.scope] = (gapByScope[e.scope] ?? 0) + 1;
    }
  }
  for (const [scope, count] of Object.entries(gapByScope)) {
    if (count >= THRESH_GAP_SCOPE) {
      signals.push({
        kind: "repeated_gap_scope",
        scope,
        occurrenceCount: count,
        suggestedAdjustment: `future replies for ${scope}-adjacent asks should acknowledge the known data gap upfront rather than re-explaining every time`,
        reason: `user hit ${scope} gap ${count} times in this conversation`,
      });
    }
  }

  // ─── Pattern 2: frequent slot corrections ─────────────────────────
  const correctionCount = entries.filter((e) => e.kind === "slot_correction_observed").length;
  if (correctionCount >= THRESH_CORRECTIONS) {
    signals.push({
      kind: "frequent_corrections",
      occurrenceCount: correctionCount,
      suggestedAdjustment: "confirm slot changes more explicitly and echo the current search state after each correction",
      reason: `${correctionCount} slot corrections in this conversation · user may want clearer state confirmation`,
    });
  }

  // ─── Pattern 3: recurring reflection failure ─────────────────────
  const reflectionFailures = entries.filter((e) => e.kind === "reflection_failure");
  const failuresByScope: Record<string, number> = {};
  for (const e of reflectionFailures) {
    const key = e.scope ?? "unknown";
    failuresByScope[key] = (failuresByScope[key] ?? 0) + 1;
  }
  for (const [scope, count] of Object.entries(failuresByScope)) {
    if (count >= THRESH_REFLECTION_FAILURE) {
      signals.push({
        kind: "recurring_reflection_failure",
        scope,
        occurrenceCount: count,
        suggestedAdjustment: `reflection pattern for ${scope} may need extension · investigate what the composer is producing that trips the check`,
        reason: `${count} reflection failures in scope ${scope} · pattern drift detected`,
      });
    }
  }

  // ─── Pattern 4: persistent low confidence ─────────────────────────
  const lowConfidenceCount = entries.filter((e) => e.kind === "confidence_low").length;
  if (lowConfidenceCount >= THRESH_LOW_CONFIDENCE) {
    signals.push({
      kind: "persistent_low_confidence",
      occurrenceCount: lowConfidenceCount,
      suggestedAdjustment: "conversation lacks grounding · surface knowledge fetch or ask user to clarify goal to re-anchor",
      reason: `${lowConfidenceCount} low-confidence turns in this conversation`,
    });
  }

  return {
    signals,
    hasSignals: signals.length > 0,
    summary: signals.length === 0
      ? "no adaptation patterns · behavior unchanged"
      : `${signals.length} pattern${signals.length === 1 ? "" : "s"} detected · ${signals.map((s) => s.kind).join(", ")}`,
  };
}
