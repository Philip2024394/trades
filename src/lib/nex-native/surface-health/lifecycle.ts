// src/lib/nex-native/surface-health/lifecycle.ts
//
// Lifecycle state machine for nex_surface_health_event per doctrine
// §7.1-7.3 (NEX Chat Surfaces × Visual Themes × HQ · 2026-10-03).
//
// Seven states · branching from `detected` into two outcomes · two
// terminal states (recovered · verified). Transitions outside the
// closed-set below are rejected both here (service boundary) and in
// the DB trigger (defense in depth).

export const LIFECYCLE_STATES = [
  "detected",
  "recovered",
  "fallback-active",
  "ongoing",
  "investigating",
  "fixed",
  "verified",
] as const;

export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

export const TERMINAL_STATES: ReadonlySet<LifecycleState> = new Set([
  "recovered",
  "verified",
]);

/** Non-terminal states — rows in any of these are part of an active
 *  incident window for their failure_signature. `recordFailure` dedups
 *  against this set; new occurrences bump occurrence_count on the
 *  existing row rather than inserting a new one. */
export const NON_TERMINAL_STATES: readonly LifecycleState[] = LIFECYCLE_STATES
  .filter((s) => !TERMINAL_STATES.has(s));

/** Closed set of legal (from → to) transitions. All other transitions
 *  raise an error at the service boundary and are rejected by the DB
 *  trigger. Matches doctrine §7.3 verbatim. */
export const LEGAL_TRANSITIONS: Readonly<
  Record<LifecycleState, readonly LifecycleState[]>
> = {
  detected: ["recovered", "fallback-active"],
  recovered: [], // terminal
  "fallback-active": ["ongoing", "investigating"],
  ongoing: ["investigating"],
  investigating: ["fixed"],
  fixed: ["verified"],
  verified: [], // terminal
};

export function isLifecycleState(v: unknown): v is LifecycleState {
  return (
    typeof v === "string" &&
    (LIFECYCLE_STATES as readonly string[]).includes(v)
  );
}

export function isTerminal(state: LifecycleState): boolean {
  return TERMINAL_STATES.has(state);
}

export function isLegalTransition(
  from: LifecycleState,
  to: LifecycleState,
): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}

/** The initial state after a failure is observed. recordFailure flips
 *  this to `recovered` or `fallback-active` atomically based on
 *  recovery_action — but the state_history captures the detected →
 *  outcome transition for audit. */
export const INITIAL_STATE: LifecycleState = "detected";

export interface StateHistoryEntry {
  from: LifecycleState | null; // null on initial insert
  to: LifecycleState;
  at: string; // ISO timestamp
  reason: string | null;
}
