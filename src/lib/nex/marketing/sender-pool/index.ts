// src/lib/nex/marketing/sender-pool/index.ts
//
// NEX Managed Email Marketing · Stage 2 · Sender Pool public API
// Founder-authorised programme (three-lane operating doctrine 2026-09-21).

export * from "./types";
export {
  assertValidHealthTransition,
  deriveHealth,
  DEFAULT_HEALTH_THRESHOLDS,
  type DeriveHealthInputs,
  type DerivedHealth,
} from "./health";
export {
  currentWindowStart,
  loadCapacity,
  consumeCapacity,
  refundCapacity,
  assertNoLimitEvasion,
  type CapacityConsumeResult,
} from "./capacity";
export {
  selectSender,
  rankSender,
} from "./selection";
export {
  createSender,
  loadSenderById,
  loadCandidatesForLane,
  setAuthenticationState,
  setVerificationState,
  setHealthState,
  setCapacity,
  attributeSend,
  appendAudit,
  loadAuditHistory,
  tickHealthDerivation,
  type CreateSenderInput,
} from "./repository";
