// src/lib/nex/capability-graph/index.ts
//
// UWI · Wave 8.G.1 · Public API for capability graph substrate.
// Founder-authorised programme (Rule 5o.T · M18 vocabulary extension 8 → 9).

export * from "./types";
export {
  validateFunctionalPipelineEvidence,
  assertFunctionalPipelineEvidence,
  computeFunctionalPipelineDedupSignature,
  type EvidenceValidationVerdict,
} from "./functional-pipeline-validator";
export {
  CapabilityRelationshipStore,
  RelationshipLifecycleLog,
  InvalidRelationshipStatusTransitionError,
  DEFAULT_MAX_EMISSIONS_PER_CYCLE,
  type CreateFunctionalPipelineInput,
} from "./capability-relationship-store";
