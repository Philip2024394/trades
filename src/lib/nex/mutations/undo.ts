// NEX Mutations · undo (Philip 2026-08-14 · Phase 16).
//
// Undo is a governed mutation · same propose/approve/apply/audit path.
// This module builds an undo MutationProposal from an existing audit entry
// (setting `newValue = original.before`) and marks the lifecycle link
// after the resulting undo mutation is applied.

import type { AppBlueprint } from "@/lib/app-builder/blueprint-schema";
import type { MutationProposal } from "./types";
import { findAuditEntry } from "./audit";
import { proposeMutation, type ProposeResult } from "./engine";

export type BuildUndoResult =
  | { ok: true; proposal: ReturnType<typeof proposeMutation> }
  | { ok: false; error: string };

/** Build (and store) an undo proposal for a given prior mutation.
 *  Returns the same shape as proposeMutation · the proposal carries
 *  a `_undoOfMutationId` hint that apply-time can use to link the audit. */
export type UndoProposeResult =
  | { ok: true; proposeResult: Extract<ProposeResult, { ok: true }>; originalMutationId: string; currentValueDiffersFromOriginalAfter: boolean }
  | { ok: false; error: string; resolution?: string };

export function proposeUndo(
  bp: AppBlueprint,
  businessSlug: string,
  originalMutationId: string
): UndoProposeResult {
  const original = findAuditEntry(businessSlug, originalMutationId);
  if (!original) return { ok: false, error: `mutation "${originalMutationId}" not found in audit log` };
  if (original.undoneByMutationId) {
    return {
      ok: false,
      error: `mutation was already undone by ${original.undoneByMutationId}`,
      resolution: "If you want to reverse the undo, undo the undo instead."
    };
  }

  // Compute the current value at the same target · if it differs from
  // original.after, the field has been changed since. We still allow undo
  // but surface the fact so the owner sees an honest before/after.
  // (For simplicity we rely on the mutation registry's readCurrent · but
  //  proposeMutation itself already reads current for the proposal.)

  // Build the undo proposal · same kind, same selector, but newValue = original.before.
  const undoProposal: MutationProposal = {
    kind: original.kind,
    selector: original.selector,
    newValue: original.before,
    instructionText: `Undo mutation ${originalMutationId}` +
      (original.instructionText ? ` (originally: "${original.instructionText}")` : "")
  };

  const result = proposeMutation(bp, businessSlug, undoProposal);
  if (!result.ok) return { ok: false, error: result.error, resolution: result.resolution };

  const currentIsOriginalAfter = deepEqual(result.proposal.before, original.after);
  return { ok: true, proposeResult: result, originalMutationId, currentValueDiffersFromOriginalAfter: !currentIsOriginalAfter };
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  const ak = Object.keys(a as object).sort();
  const bk = Object.keys(b as object).sort();
  if (ak.length !== bk.length) return false;
  for (let i = 0; i < ak.length; i++) if (ak[i] !== bk[i]) return false;
  for (const k of ak) if (!deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  return true;
}
