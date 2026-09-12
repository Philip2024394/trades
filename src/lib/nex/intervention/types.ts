// src/lib/nex/intervention/types.ts
//
// Stage 7 · three-level section intervention + constitutional auto-rebuild lock.
//
// Per feedback memory (2026-09-11) · three intervention levels:
//   1. DISABLE            — hide from live · intact · reversible
//   2. ROLLBACK           — activate previous known-good revision
//   3. REMOVE_FROM_LIVE   — lock capability against future auto-rebuild
//                           (`sec.constitutional_auto_rebuild_attempted`)
//
// Immutable history preserved · "It never existed in live" ≠ "It never existed at all."

export type InterventionKind = "DISABLE" | "ROLLBACK" | "REMOVE_FROM_LIVE";

export interface InterventionRecord {
  readonly interventionId: string;
  readonly capabilityId: string;
  readonly targetRevisionId: string;
  readonly kind: InterventionKind;
  readonly rollbackTargetRevisionId: string | null;   // populated for ROLLBACK only
  readonly reason: string;
  readonly issuedBy: string;                          // founder session token
  readonly issuedAt: string;
  readonly autoRebuildLocked: boolean;                // true iff kind = REMOVE_FROM_LIVE
}

export interface AutoRebuildAttempt {
  readonly capabilityId: string;
  readonly attemptedBy: string;                       // agent id · Master AI · NEX1 · etc.
  readonly attemptedAt: string;
  readonly rejectionCode: "sec.constitutional_auto_rebuild_attempted";
  readonly blockingInterventionId: string;
}

export type InterventionValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string; readonly reason: string };
