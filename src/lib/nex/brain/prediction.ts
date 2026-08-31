// src/lib/nex/brain/prediction.ts
//
// Stage 3.23 · Phase 16 · Prediction (Philip 2026-08-31).
//
// Anticipates the next likely user action or question given the
// current session state + this turn's outcome. Deterministic pattern
// match · no LLM · never claims certainty. Attached to BrainReply
// for observability; composer text unchanged (v1 observational).
//
// v1 discipline:
//   · Rules-based · reads slot state / goal / recent outcomes
//   · Returns 0-3 candidate predictions with confidence (low/med/high)
//   · `top` is the highest-confidence candidate (undefined when none)
//   · Never fabricates a hint the state doesn't support
//   · Bilingual not needed here (hints are internal metadata + optional
//     English display; the user's language stays whatever they used)

import type { AccommodationSlots } from "./accommodation-slots";
import type { Goal } from "./goal-tracking";

export type PredictionKind =
  | "narrow_area"
  | "narrow_budget"
  | "narrow_type"
  | "narrow_amenities"
  | "widen_search"
  | "compare"
  | "recommend"
  | "book_reference"
  | "contact_seller"
  | "next_related_task";

export type PredictionConfidence = "low" | "medium" | "high";

export type PredictedNext = {
  kind: PredictionKind;
  hint: string;
  exampleUtterance: string;
  confidence: PredictionConfidence;
  reason: string;
};

export type PredictionReport = {
  candidates: PredictedNext[];
  top?: PredictedNext;
  reason: string;
};

export type PredictInput = {
  intent: string;
  slots?: Readonly<AccommodationSlots>;
  goal?: Goal | null;
  hasResolvedReference?: boolean;
  realPropertiesMatched?: number;
  didExecuteAction?: boolean;
  didAmenityBoundary?: boolean;
  didPriceBoundary?: boolean;
  didComparison?: boolean;
  didRecommendation?: boolean;
};

// ─── Deterministic prediction rules ──────────────────────────────────

export function predictNext(input: PredictInput): PredictionReport {
  const candidates: PredictedNext[] = [];
  const slots = input.slots ?? {};
  const matched = input.realPropertiesMatched ?? 0;

  // Only produce accommodation-flavoured predictions when the current
  // intent is accommodation. Other verticals get an empty report v1.
  if (input.intent !== "accommodation") {
    return { candidates: [], reason: `intent=${input.intent} · no vertical-specific prediction v1` };
  }

  // Rule 1 · executed action → user is done with this thread, might
  // move to a related task. Low confidence · exposes an opportunity.
  if (input.didExecuteAction) {
    candidates.push({
      kind: "next_related_task",
      hint: "the user may switch to a related need (transport, food, another booking)",
      exampleUtterance: "How do I get there from the airport?",
      confidence: "low",
      reason: "action just executed · common follow-up is transportation/logistics",
    });
  }

  // Rule 2 · resolved reference + no action taken → book / contact next.
  if (input.hasResolvedReference && !input.didExecuteAction) {
    candidates.push({
      kind: "book_reference",
      hint: "the user may want to open the directory link or contact the property",
      exampleUtterance: "open the directory · book it",
      confidence: "medium",
      reason: "a specific business is currently referenced but no action has been executed",
    });
  }

  // Rule 3 · comparison shown but no recommendation yet → user often
  // asks "which is best" or picks one directly.
  if (input.didComparison && !input.didRecommendation) {
    candidates.push({
      kind: "recommend",
      hint: "the user may ask NEX to pick one from the compared set",
      exampleUtterance: "which is best?",
      confidence: "high",
      reason: "just showed a comparison · recommendation is the natural follow-up",
    });
  }

  // Rule 4 · recommendation shown → book / contact.
  if (input.didRecommendation && !input.hasResolvedReference) {
    candidates.push({
      kind: "book_reference",
      hint: "the user may want to act on the recommended pick",
      exampleUtterance: "book the top pick · open its directory page",
      confidence: "medium",
      reason: "recommendation delivered · natural next step is acting on the pick",
    });
  }

  // Rule 5 · multiple properties presented but no area filter → narrow_area
  // is high-value (haversine gives real ranking signal).
  if (matched >= 3 && slots.location && !slots.area) {
    candidates.push({
      kind: "narrow_area",
      hint: "the user may want to narrow by a specific neighbourhood",
      exampleUtterance: slots.location === "yogyakarta" ? "Near Malioboro" : "Near the centre",
      confidence: "high",
      reason: `${matched} properties matched · area filter would meaningfully narrow`,
    });
  }

  // Rule 6 · has area but no budget → narrow_budget.
  if (matched >= 2 && slots.area && !slots.budget) {
    candidates.push({
      kind: "narrow_budget",
      hint: "the user may want to narrow by budget",
      exampleUtterance: "Cheap · mid-range · upmarket",
      confidence: "medium",
      reason: "area filter applied but no budget preference · common next signal",
    });
  }

  // Rule 7 · no type slot but discovery in progress → narrow_type.
  if (matched >= 2 && !slots.type && slots.location) {
    candidates.push({
      kind: "narrow_type",
      hint: "the user may want to narrow by property type",
      exampleUtterance: "Just guesthouses · hotels only",
      confidence: "medium",
      reason: "location known but type unspecified",
    });
  }

  // Rule 8 · zero results after filters → widen_search.
  if (matched === 0 && (slots.type || slots.area || slots.budget)) {
    candidates.push({
      kind: "widen_search",
      hint: "the user may want to relax a filter to see more options",
      exampleUtterance: "Show me any type · widen the search",
      confidence: "high",
      reason: "current filters returned 0 matches · widening is the obvious recovery",
    });
  }

  // Rule 9 · amenity boundary hit → check property directly (external).
  if (input.didAmenityBoundary) {
    candidates.push({
      kind: "contact_seller",
      hint: "the user may want to check facilities with the property directly",
      exampleUtterance: "open the property page · what's the WhatsApp?",
      confidence: "medium",
      reason: "amenity data not in NEX corpus · external contact is the workaround",
    });
  }

  // Rule 10 · price boundary hit → likely same pattern as amenity.
  if (input.didPriceBoundary && candidates.every((c) => c.kind !== "contact_seller")) {
    candidates.push({
      kind: "contact_seller",
      hint: "the user may want to check pricing with the property directly",
      exampleUtterance: "how do I contact them?",
      confidence: "medium",
      reason: "price data not in NEX corpus · external contact is the workaround",
    });
  }

  // Rule 11 · lots of candidates + area filled but no compare/recommend → suggest compare.
  if (matched >= 2 && matched <= 5 && slots.area && !input.didComparison && !input.didRecommendation) {
    candidates.push({
      kind: "compare",
      hint: "the user may want to compare the top matches side by side",
      exampleUtterance: "compare the first and second",
      confidence: "medium",
      reason: `${matched} candidates in a narrow set · comparison is useful`,
    });
  }

  // Sort by confidence (high > medium > low), stable.
  const rank: Record<PredictionConfidence, number> = { high: 3, medium: 2, low: 1 };
  candidates.sort((a, b) => rank[b.confidence] - rank[a.confidence]);

  const trimmed = candidates.slice(0, 3);
  const top = trimmed[0];

  return {
    candidates: trimmed,
    top,
    reason: trimmed.length === 0
      ? "no strong signal · empty prediction"
      : `${trimmed.length} candidate${trimmed.length === 1 ? "" : "s"} · top=${top?.kind} (${top?.confidence})`,
  };
}
