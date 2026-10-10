// src/lib/nex/failure-governance/index.ts
//
// UWI · Wave 6 · Failure + governance public API.
// Founder-authorised programme.

export * from "./types";
export {
  classifyDurabilityFailure,
  makeDurabilityFailureEvent,
  classifyResearchFailure,
  makeResearchFailureEvent,
  type DurabilityFailureSignal,
  type ResearchFailureSignal,
} from "./failure-classifiers";
export {
  InMemoryFailureSink,
  TypedFailureEmitter,
  type FailureSink,
} from "./failure-emitter";
export {
  requiresHumanAuthority,
  canonicalPayload,
  signHumanAuthorityDecision,
  verifyHumanAuthorityDecision,
  assertHumanAuthority,
} from "./human-authority-gate";
