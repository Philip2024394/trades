// NEX Mutations · propose + apply engine (Philip 2026-08-14).
//
// The generic + governed core. Knows NOTHING about specific mutation
// kinds — delegates to the registry.

import type { AppBlueprint } from "@/lib/app-builder/blueprint-schema";
import type { MutationProposal, PreparedProposal, MutationAuditEntry } from "./types";
import { getMutation } from "./registry";
import { storeProposal, consumeProposal, ttlMillis } from "./proposal-store";
import { recordAuditEntry, markUndone } from "./audit";

export type ProposeResult =
  | { ok: true; proposal: PreparedProposal }
  | { ok: false; error: string; resolution?: string };

export function proposeMutation(
  bp: AppBlueprint,
  businessSlug: string,
  proposal: MutationProposal
): ProposeResult {
  const reg = getMutation(proposal.kind);
  if (!reg) return { ok: false, error: `unknown mutation kind "${proposal.kind}"` };

  const validation = reg.validate(bp, proposal.selector, proposal.newValue);
  if (!validation.ok) return { ok: false, error: validation.error, resolution: validation.resolution };

  const before = reg.readCurrent(bp, proposal.selector);
  const after = proposal.newValue;
  const now = Date.now();
  const prepared: PreparedProposal = {
    proposalId: `prop_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    businessSlug,
    kind: proposal.kind,
    selector: proposal.selector,
    before,
    after,
    describe: reg.describe(before, after, proposal.selector),
    instructionText: proposal.instructionText,
    proposedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMillis()).toISOString(),
    requiresApproval: true
  };
  storeProposal(prepared);
  return { ok: true, proposal: prepared };
}

export type ApplyResult =
  | { ok: true; blueprint: AppBlueprint; audit: MutationAuditEntry }
  | { ok: false; error: string };

export type ApplyOptions = {
  /** Phase 16 · when set, marks this apply as an UNDO of the referenced mutation.
   *  The resulting audit entry gets `undoOfMutationId = <this>`, and the original
   *  audit entry gets `undoneByMutationId = <new mutation id>`. */
  undoOfMutationId?: string;
};

export function applyProposedMutation(
  bp: AppBlueprint,
  proposalId: string,
  ownerAccountId: string,
  opts: ApplyOptions = {}
): ApplyResult {
  const prepared = consumeProposal(proposalId);
  if (!prepared) return { ok: false, error: "proposal not found or expired · re-propose" };
  if (prepared.businessSlug !== "" && bp.id) { /* pass · slug-vs-blueprint sanity happens at route layer */ }

  const reg = getMutation(prepared.kind);
  if (!reg) return { ok: false, error: `unknown mutation kind "${prepared.kind}"` };

  // Re-validate at apply time · defence-in-depth (Blueprint may have changed since propose)
  const validation = reg.validate(bp, prepared.selector, prepared.after);
  if (!validation.ok) return { ok: false, error: `re-validation failed at apply time · ${validation.error}` };

  const mutationId = `mut_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const revisionBefore = bp.meta.revision;
  const applied = reg.apply(bp, prepared.selector, prepared.after, mutationId);
  const revisionAfter = applied.blueprint.meta.revision;

  const auditEntry: MutationAuditEntry = {
    mutationId,
    businessSlug: prepared.businessSlug,
    ownerAccountId,
    kind: prepared.kind,
    selector: prepared.selector,
    before: prepared.before,
    after: applied.after,
    instructionText: prepared.instructionText,
    proposalId: prepared.proposalId,
    blueprintRevisionBefore: revisionBefore,
    blueprintRevisionAfter: revisionAfter,
    at: new Date().toISOString(),
    undoOfMutationId: opts.undoOfMutationId
  };
  recordAuditEntry(auditEntry);

  // Link the original mutation as undone-by this one.
  if (opts.undoOfMutationId) {
    markUndone(prepared.businessSlug, opts.undoOfMutationId, mutationId);
  }

  return { ok: true, blueprint: applied.blueprint, audit: auditEntry };
}
