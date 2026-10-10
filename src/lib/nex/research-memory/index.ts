// src/lib/nex/research-memory/index.ts
//
// UWI · Wave 5 · Research-memory public API.
// Founder-authorised programme.

export * from "./types";
export {
  assessFalsifiability,
  assertFalsifiable,
  NotFalsifiableError,
} from "./falsifiability";
export {
  isValidTransition,
  isSoftAbsorbing,
  isTerminalAbsorbing,
  assertValidTransition,
  outboundTransitions,
  InvalidTransitionError,
} from "./opportunity-state-machine";
export {
  evaluateCadence,
  scheduleNextReview,
  scheduleExponentialDecayReview,
  type CadenceState,
  type CadenceDecision,
} from "./cadence-scheduler";
export {
  LifecycleHistoryLog,
  makeEvent,
} from "./lifecycle-history";
export {
  OpportunityStore,
  type OpportunityCreateInput,
} from "./opportunity-store";
