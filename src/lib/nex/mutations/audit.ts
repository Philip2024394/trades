// NEX Mutations · audit log (Philip 2026-08-14).
//
// Every APPLIED mutation is recorded here. Owner-queryable per business.
// In-memory · deterministic · deferred to a real DB later.
//
// Phase 16 additions:
//   - findAuditEntry(slug, mutationId)
//   - markUndone(slug, originalId, undoId) · link the two entries

import type { MutationAuditEntry } from "./types";

const ENTRIES = new Map<string, MutationAuditEntry[]>();   // key = businessSlug

export function recordAuditEntry(entry: MutationAuditEntry): void {
  const list = ENTRIES.get(entry.businessSlug) ?? [];
  list.push(entry);
  ENTRIES.set(entry.businessSlug, list);
}

export function auditEntriesForBusiness(businessSlug: string): MutationAuditEntry[] {
  return [...(ENTRIES.get(businessSlug) ?? [])];
}

export function findAuditEntry(businessSlug: string, mutationId: string): MutationAuditEntry | null {
  const list = ENTRIES.get(businessSlug) ?? [];
  return list.find((e) => e.mutationId === mutationId) ?? null;
}

/** Link an original entry to the undo entry that reversed it.
 *  Idempotent-guard · returns false if already undone or not found. */
export function markUndone(businessSlug: string, originalMutationId: string, undoMutationId: string): boolean {
  const list = ENTRIES.get(businessSlug) ?? [];
  const original = list.find((e) => e.mutationId === originalMutationId);
  if (!original) return false;
  if (original.undoneByMutationId) return false;
  original.undoneByMutationId = undoMutationId;
  return true;
}

export function _resetAuditForTest(): void {
  ENTRIES.clear();
}
