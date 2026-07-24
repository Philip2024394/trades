// Nex Brain Runtime Substrate — public barrel.
//
// Feature-flagged OFF by default (NEX_BRAIN_RUNTIME_ENABLED).
// Substrate is testable and importable independent of the flag; the
// flag only gates the /api/brain/* endpoints and the Phase 24 catalog
// hook that ROUTES to the Brain.

export { nexBrainRuntimeEnabled } from "./_flag";

export {
  loadBrain,
  brainRegistry
} from "./_loader";
export {
  BrainBootError,
  type LoadedBrain,
  type BrainPack,
  type BootAuditError
} from "./_types";

export {
  retrieveFromBrain,
  retrieveFromBrains,
  DomainSeparationError,
  type RetrievalResult,
  type RetrievalHit,
  type RetrievalOptions,
  type RetrievalStatus
} from "./_router";

export {
  computeConfidence,
  isInsufficient,
  INSUFFICIENT_CONFIDENCE_THRESHOLD,
  type ConfidenceInputs,
  type ConfidenceResult
} from "./_confidence";

export {
  analyseImageWithBrain,
  estimateWithBrain,
  type BrainVisionInput,
  type BrainVisionResult,
  type BrainEstimateInput,
  type BrainEstimateResult,
  type BrainEstimateLine
} from "./_integrations";

export { withBrain } from "./_catalog_hook";

export * from "./_schema";
