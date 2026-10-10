// src/lib/nex/product-lifecycle/index.ts
//
// UWI · Wave 8.C · Public API for product-lifecycle substrate.
// Founder-authorised programme (Rule 5o.T · capability → NEX Product doctrine).

export * from "./types";
export {
  findVacuousGates,
  assertProductCandidateGates,
  assertProductCandidateReadiness,
} from "./candidate-validator";
export {
  ProductCandidateStore,
  ProductLifecycleLog,
  InvalidProductStatusTransitionError,
  type ProductCandidateCreateInput,
} from "./candidate-store";
export {
  bridgeOpportunityToProductCandidate,
  type OpportunityToCandidateInput,
  type BridgeOptions,
  type OpportunityToCandidateOutcome,
} from "./opportunity-to-candidate-bridge";
export {
  ProductLifecycleEventRouter,
  mapProductEventToTriggerKind,
  type ProductLifecycleEventRouterConfig,
  type ProductLifecycleAuditEntry,
  type ProductLifecycleDeadLetterEntry,
  type RouterOutcome,
} from "./event-router";
