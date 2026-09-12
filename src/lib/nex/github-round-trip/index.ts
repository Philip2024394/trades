// src/lib/nex/github-round-trip/index.ts
//
// Stage 8 · public API. GitHub round-trip pure primitives.

export type {
  BranchDescriptor,
  PrDescriptor,
  PrLifecycleEvent,
  RoundTripState,
  BranchValidation,
} from "./types";

export { branchNameFor, parseBranchName, validateBranch } from "./branch-name";
export { buildPrTitle, buildPrBody } from "./pr-body";
export type { PrBodyInputs } from "./pr-body";
export { isLegalPrTransition, currentPrKind, appendPrEvent } from "./lifecycle";
