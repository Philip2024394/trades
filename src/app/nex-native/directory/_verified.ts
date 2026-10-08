// src/app/nex-native/directory/_verified.ts
//
// NEX Directory · Phase A · The visitor-facing "Verified" chip semantic.
//
// What this is
//   · The ONE authoritative predicate that decides whether a Directory
//     listing may surface a "Verified" chip to the visitor. Pure.
//     Deterministic. Centralised so the card, the detail page, and
//     any future surface share one definition.
//
// Why this is NOT driven by evidence-row presence
//   · `nex.business_evidence` is the provenance table. An evidence row
//     proves the canonical row went through the sealed ingestion
//     pipeline (candidate → validator → reviewer → approval → resolver
//     → write) with full integrity binding. It does NOT prove the
//     business itself has been verified.
//   · The sealed `lifecycle_state` enum already carries the correct
//     consumer-facing verification semantics:
//       VERIFIED        — the canonical row has been affirmatively
//                         verified by NEX.
//       OWNER_VERIFIED  — the owner has verified their listing.
//     All other lifecycle states (DISCOVERED, ENRICHED,
//     OWNER_CLAIMED, DORMANT, SUPERSEDED) explicitly represent
//     non-verified states.
//   · The audit identified the previous evidence-presence trigger as
//     a trust-affecting misstatement (an obviously-synthetic
//     DISCOVERED row carried a "Verified" chip merely because the
//     first-live-write orchestrator created a provenance row for it).
//
// What this is NOT
//   · Not a general lifecycle classifier. See classify-entity-type.ts
//     for the Phase B derivation of `classification`.
//   · Not a route decider. Phase C's destination resolver answers
//     routing.
//   · Not a provenance predicate. If a surface needs to signal
//     "we have a documented history for this row," that is a
//     separate concept and must not reuse the word "verified."

import type { LifecycleState } from "@/lib/nex-native/directory";

/** The sealed subset of lifecycle states that justify a visitor-facing
 *  "Verified" chip. Byte-stable with the predicate below. Exported so
 *  tests can lock the set independently of the predicate implementation. */
export const VERIFIED_LIFECYCLE_STATES: readonly LifecycleState[] = [
  "VERIFIED",
  "OWNER_VERIFIED",
] as const;

/** Pure · returns true iff the listing's lifecycle_state justifies
 *  showing the visitor-facing "Verified" chip. Any other input returns
 *  false (including the explicitly-non-verified states DISCOVERED,
 *  ENRICHED, OWNER_CLAIMED, DORMANT, SUPERSEDED). */
export function isVerifiedLifecycle(state: LifecycleState): boolean {
  return VERIFIED_LIFECYCLE_STATES.includes(state);
}
