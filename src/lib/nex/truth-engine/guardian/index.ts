// src/lib/nex/truth-engine/guardian/index.ts
//
// Truth Engine Guardian · Stage 1a sub-step 1a.5 · public API surface.
//
// Founder-authorised sub-step 1a.5 · 2026-09-11.
// Doctrine: Guardian is a deterministic gate.
//
// Guardian is PURE. No database imports. No filesystem imports. No
// network imports. Persistence lives elsewhere and only after Guardian
// ACCEPTS.

export type {
  GuardianAction,
  GuardianConfig,
  GuardianDecision,
  GuardianInspectionRequest,
  GuardianRejection,
  GuardianRejectionCode,
} from "./types";

export {
  Guardian,
  createGuardian,
  createStage1aGuardian,
  createStage1aGuardianWithAllowlist,
  isAccepted,
} from "./guardian";

export {
  inspectEnvelopeStructure,
  inspectRuleVerdicts,
  inspectAggregate,
} from "./inspect-envelope";

export { inspectAction } from "./inspect-action";
