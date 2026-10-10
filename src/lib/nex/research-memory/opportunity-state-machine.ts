// src/lib/nex/research-memory/opportunity-state-machine.ts
//
// UWI · Wave 5 · M23 · Distinct absorbing states + typed transitions
// Founder-authorised programme.
//
// Founder-locked doctrine · CRII synthesis §3:
//   - SUPERSEDED · absorbing · strictly-better opportunity replaces it
//   - MERGED     · absorbing · absorbed into another opportunity
//   - PARKED     · reversible absorbing · waiting on external condition
//   - ARCHIVED   · absorbing · no longer of interest
//   - REJECTED   · absorbing · decided against
//
// These MUST NOT collapse into a single "ended" state. Each carries
// distinct semantic weight and drives different downstream behaviour.

import type { OpportunityStatus } from "./types";

/** All valid direct transitions. `to` must be reachable from `from`. */
const TRANSITIONS: ReadonlyArray<{ from: OpportunityStatus; to: OpportunityStatus }> = [
  // Forward lifecycle
  { from: "DISCOVERED", to: "EVIDENCE_GATHERING" },
  { from: "EVIDENCE_GATHERING", to: "VALIDATING" },
  { from: "VALIDATING", to: "ACTIVE" },
  { from: "ACTIVE", to: "MONITORING" },
  { from: "MONITORING", to: "ACTIVE" }, // re-activate on new evidence
  { from: "ACTIVE", to: "DECLINING" },
  { from: "MONITORING", to: "DECLINING" },
  { from: "DECLINING", to: "MONITORING" }, // recover
  { from: "DECLINING", to: "PARKED" },     // decay → park
  { from: "ACTIVE", to: "PROMOTED" },
  { from: "VALIDATING", to: "PROMOTED" },
  // Absorbing transitions (any active state → absorbing)
  { from: "DISCOVERED", to: "REJECTED" },
  { from: "EVIDENCE_GATHERING", to: "REJECTED" },
  { from: "VALIDATING", to: "REJECTED" },
  { from: "ACTIVE", to: "REJECTED" },
  { from: "MONITORING", to: "REJECTED" },
  { from: "DECLINING", to: "REJECTED" },
  { from: "DISCOVERED", to: "MERGED" },
  { from: "EVIDENCE_GATHERING", to: "MERGED" },
  { from: "VALIDATING", to: "MERGED" },
  { from: "ACTIVE", to: "MERGED" },
  { from: "MONITORING", to: "MERGED" },
  { from: "DECLINING", to: "MERGED" },
  { from: "DISCOVERED", to: "SUPERSEDED" },
  { from: "EVIDENCE_GATHERING", to: "SUPERSEDED" },
  { from: "VALIDATING", to: "SUPERSEDED" },
  { from: "ACTIVE", to: "SUPERSEDED" },
  { from: "MONITORING", to: "SUPERSEDED" },
  { from: "DECLINING", to: "SUPERSEDED" },
  { from: "ACTIVE", to: "PARKED" },
  { from: "MONITORING", to: "PARKED" },
  { from: "VALIDATING", to: "PARKED" },
  { from: "PARKED", to: "MONITORING" },      // wake from park
  { from: "PARKED", to: "ARCHIVED" },        // give up on parked
  { from: "DECLINING", to: "ARCHIVED" },
  { from: "REJECTED", to: "ARCHIVED" },      // formal archive after rejection
  { from: "MERGED", to: "ARCHIVED" },
  { from: "SUPERSEDED", to: "ARCHIVED" },
];

const TERMINAL_ABSORBING: ReadonlyArray<OpportunityStatus> = ["ARCHIVED"];
const SOFT_ABSORBING: ReadonlyArray<OpportunityStatus> = ["REJECTED", "MERGED", "SUPERSEDED", "PARKED", "PROMOTED"];

/** True if `to` is reachable from `from`. */
export function isValidTransition(from: OpportunityStatus, to: OpportunityStatus): boolean {
  if (from === to) return true; // idempotent same-state write is allowed
  return TRANSITIONS.some(t => t.from === from && t.to === to);
}

/** True if the state is soft-absorbing (may be resurrected via specific transition). */
export function isSoftAbsorbing(state: OpportunityStatus): boolean {
  return SOFT_ABSORBING.includes(state);
}

/** True if the state is terminal-absorbing (no further transitions). */
export function isTerminalAbsorbing(state: OpportunityStatus): boolean {
  return TERMINAL_ABSORBING.includes(state);
}

/** Assert-style guard. Throws if transition is invalid. */
export function assertValidTransition(from: OpportunityStatus, to: OpportunityStatus): void {
  if (!isValidTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}

export class InvalidTransitionError extends Error {
  constructor(public readonly from: OpportunityStatus, public readonly to: OpportunityStatus) {
    super(`Invalid opportunity state transition: ${from} → ${to}. Absorbing states MUST NOT collapse into single 'ended' state; check the state machine for the valid outbound edges.`);
    this.name = "InvalidTransitionError";
  }
}

/** Enumerate valid outbound transitions from a given state. */
export function outboundTransitions(from: OpportunityStatus): ReadonlyArray<OpportunityStatus> {
  return TRANSITIONS.filter(t => t.from === from).map(t => t.to);
}
