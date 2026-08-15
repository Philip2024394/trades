// NEX Mutations · types (Philip 2026-08-14).

import type { AppBlueprint } from "@/lib/app-builder/blueprint-schema";

/** A structured, machine-checked description of a proposed change. */
export type MutationProposal = {
  kind: string;                          // matches a registry entry (e.g. "product.price")
  selector: Record<string, unknown>;     // how to find the target (e.g. { slug: "oak" })
  newValue: unknown;                     // proposed value
  instructionText?: string;              // owner's original words (for audit trail)
};

/** The complete proposal produced by the mutation engine after
 *  interpretation + validation. Ready for owner approval. */
export type PreparedProposal = {
  proposalId: string;
  businessSlug: string;
  kind: string;
  selector: Record<string, unknown>;
  before: unknown;
  after: unknown;
  describe: string;                      // human-readable "Current £4,995 → New £5,495"
  instructionText?: string;
  proposedAt: string;
  expiresAt: string;                     // proposals expire (dev: 5 min)
  requiresApproval: true;                // constitutional · always true in this phase
};

/** Audit entry recorded when a proposal is APPLIED.
 *
 *  Phase 16 additions (Philip 2026-08-14):
 *    - `undoOfMutationId`   set when THIS entry is an undo of an earlier one
 *    - `undoneByMutationId` set when a LATER undo entry reversed this one
 *  Together they express the mutation lifecycle:
 *    Applied              → { undoneByMutationId: undefined }
 *    Undone               → { undoneByMutationId: <the undo's id> }
 *    Applied (as an undo) → { undoOfMutationId: <the original id> }
 *  Never both fields on the same entry.
 */
export type MutationAuditEntry = {
  mutationId: string;
  businessSlug: string;
  ownerAccountId: string;
  kind: string;
  selector: Record<string, unknown>;
  before: unknown;
  after: unknown;
  instructionText?: string;
  proposalId: string;
  blueprintRevisionBefore: number;
  blueprintRevisionAfter: number;
  at: string;
  /** Phase 16 · this entry is an undo of the referenced mutation. */
  undoOfMutationId?: string;
  /** Phase 16 · this entry has been reversed by the referenced mutation. */
  undoneByMutationId?: string;
  /** Phase 17 · this entry was applied as part of a grouped batch. */
  batchId?: string;
};

/** A registered mutation type — declarative. */
export type MutationRegistration = {
  kind: string;
  /** Validate the selector + value against the current Blueprint.
   *  Return `{ok:false, error}` when the mutation cannot proceed. */
  validate: (bp: AppBlueprint, selector: Record<string, unknown>, newValue: unknown) => ValidationResult;
  /** Extract the current value for the selector · used for `before`. */
  readCurrent: (bp: AppBlueprint, selector: Record<string, unknown>) => unknown;
  /** Apply · returns NEW Blueprint (immutable pattern) + the `after` value. */
  apply: (bp: AppBlueprint, selector: Record<string, unknown>, newValue: unknown, mutationId: string) => { blueprint: AppBlueprint; after: unknown };
  /** Human-readable summary shown to the owner in the approval prompt. */
  describe: (before: unknown, after: unknown, selector: Record<string, unknown>) => string;
  /** Optional rule-based NL parser · returns a MutationProposal from a plain-English instruction. */
  parseInstruction?: (text: string) => MutationProposal | null;
};

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: string; resolution?: string };

// ============================================================================
// Phase 17 · batch types
// ============================================================================

export type PreparedBatch = {
  batchId: string;
  businessSlug: string;
  proposals: PreparedProposal[];
  /** Fragments the interpreter could not turn into a proposal.
   *  When present, the batch is CLARIFICATION_REQUIRED and cannot be applied. */
  unclearFragments: string[];
  proposedAt: string;
  expiresAt: string;
  requiresApproval: true;
  /** Grouped human-readable summary shown as the change plan. */
  planDescription: string;
};
