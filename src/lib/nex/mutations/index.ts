// NEX Mutations · barrel (Philip 2026-08-14 · Phase 16 extended).

// Registry (imported for side-effect · registers the 5 initial kinds)
import "./registry";

export { registerMutation, getMutation, listMutationKinds } from "./registry";
export { interpret } from "./interpreter";
export { proposeMutation, applyProposedMutation } from "./engine";
export type { ProposeResult, ApplyResult, ApplyOptions } from "./engine";
export { auditEntriesForBusiness, findAuditEntry, markUndone, _resetAuditForTest } from "./audit";
export { _resetProposalsForTest } from "./proposal-store";
export { proposeUndo } from "./undo";
export type { UndoProposeResult } from "./undo";
export { proposeBatch, applyBatch, getBatch, splitInstruction, _resetBatchesForTest } from "./batch";
export type { ProposeBatchResult, ApplyBatchResult } from "./batch";
export type { MutationProposal, PreparedProposal, MutationAuditEntry, MutationRegistration, ValidationResult, PreparedBatch } from "./types";
