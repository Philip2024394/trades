// src/lib/nex/security-agent/index.ts
//
// HQ Security Agent · public API · Stage 1 · Phase D.3 core.
//
// Consumed by:
//   - /api/nex/hq-security/inspect (Stage 1 endpoint)
//   - CI + pre-commit hooks (Stage 2)
//   - Every NEX1 code proposal (Stage 4+ delegation loop)

export type {
  AgentIdentity,
  GrowthLedgerEntry,
  ProposedFileChange,
  SecurityDecision,
  SecurityInspectionRequest,
  SecurityRejection,
  SecurityRejectionCode,
} from "./types";

export { SecurityAgent, inspectChange } from "./security-agent";
export { loadRegistries, resolveCapabilityForPath } from "./registries";
export { inspectFileRegistry } from "./inspect-file-registry";
export { inspectDoctrines } from "./inspect-doctrines";
export { inspectAction } from "./inspect-action";
