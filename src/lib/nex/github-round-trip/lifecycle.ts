// src/lib/nex/github-round-trip/lifecycle.ts
//
// Stage 8 · PR lifecycle event ordering + validation. Pure functions so
// tests don't need GitHub. Real GH calls are wired at Stage 8 review boundary.

import type { PrLifecycleEvent, RoundTripState } from "./types";

/**
 * Legal PR lifecycle transitions. Every state records into `events[]` ·
 * never mutated. Illegal transitions rejected.
 */
const LEGAL_NEXT: Readonly<Record<PrLifecycleEvent["kind"], readonly PrLifecycleEvent["kind"][]>> = {
  opened: ["converted_to_ready", "closed"],
  converted_to_ready: ["review_requested", "changes_requested", "approved", "closed"],
  review_requested: ["changes_requested", "approved", "closed"],
  changes_requested: ["review_requested", "approved", "closed"],
  approved: ["merged", "closed"],
  merged: [],
  closed: [],
};

export function isLegalPrTransition(
  from: PrLifecycleEvent["kind"] | null,
  to: PrLifecycleEvent["kind"],
): boolean {
  if (from === null) return to === "opened";
  return LEGAL_NEXT[from].includes(to);
}

export function currentPrKind(state: RoundTripState): PrLifecycleEvent["kind"] | null {
  const last = state.events[state.events.length - 1];
  return last?.kind ?? null;
}

export function appendPrEvent(
  state: RoundTripState,
  event: PrLifecycleEvent,
): { readonly ok: true; readonly next: RoundTripState } | { readonly ok: false; readonly reason: string } {
  const from = currentPrKind(state);
  if (!isLegalPrTransition(from, event.kind)) {
    return { ok: false, reason: `Illegal PR transition ${from} → ${event.kind}` };
  }
  return {
    ok: true,
    next: { ...state, events: [...state.events, event] },
  };
}
