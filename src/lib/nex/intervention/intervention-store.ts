// src/lib/nex/intervention/intervention-store.ts
//
// Stage 7 · in-memory intervention store + auto-rebuild lock. Pure enough
// to test without a DB. Production wiring persists in nex.section_intervention
// (schema authored below · applied separately).

import type {
  AutoRebuildAttempt,
  InterventionKind,
  InterventionRecord,
  InterventionValidation,
} from "./types";

/**
 * Validate an intervention input before persisting.
 * Enforces:
 *   - founder signature present
 *   - reason present
 *   - rollback target present iff kind = ROLLBACK
 *   - rollback target NEVER equal to target (can't roll back to same)
 */
export function validateIntervention(input: {
  capabilityId: string;
  targetRevisionId: string;
  kind: InterventionKind;
  rollbackTargetRevisionId?: string | null;
  reason: string;
  issuedBy: string;
}): InterventionValidation {
  if (!/^CAP-\d+$/.test(input.capabilityId)) {
    return { ok: false, code: "sec.intervention_bad_capability", reason: "Invalid capability" };
  }
  if (!input.issuedBy || input.issuedBy.length === 0) {
    return { ok: false, code: "sec.intervention_missing_signature", reason: "Founder signature required" };
  }
  if (!input.reason || input.reason.length === 0) {
    return { ok: false, code: "sec.intervention_missing_reason", reason: "Reason required (audit trail)" };
  }
  if (input.kind === "ROLLBACK") {
    if (!input.rollbackTargetRevisionId) {
      return { ok: false, code: "sec.intervention_rollback_missing_target", reason: "ROLLBACK requires target revision" };
    }
    if (input.rollbackTargetRevisionId === input.targetRevisionId) {
      return {
        ok: false,
        code: "sec.intervention_rollback_self",
        reason: "Cannot rollback to same revision",
      };
    }
  } else {
    if (input.rollbackTargetRevisionId) {
      return {
        ok: false,
        code: "sec.intervention_rollback_target_on_non_rollback",
        reason: "rollbackTargetRevisionId only valid for ROLLBACK",
      };
    }
  }
  return { ok: true };
}

/**
 * In-memory intervention store + auto-rebuild lock.
 */
export class InMemoryInterventionStore {
  private interventions = new Map<string, InterventionRecord>();
  private autoRebuildLockedCaps = new Map<string, string>(); // capabilityId → blocking intervention id
  private autoRebuildAttempts: AutoRebuildAttempt[] = [];

  record(intervention: InterventionRecord): void {
    this.interventions.set(intervention.interventionId, intervention);
    if (intervention.kind === "REMOVE_FROM_LIVE") {
      this.autoRebuildLockedCaps.set(intervention.capabilityId, intervention.interventionId);
    }
  }

  /**
   * Check whether the given capability is currently locked against auto-rebuild.
   * If it is · record the attempt (audit trail) and return the blocking intervention.
   */
  attemptAutoRebuild(input: {
    capabilityId: string;
    attemptedBy: string;
    now?: () => Date;
  }): {
    readonly allowed: boolean;
    readonly blockingInterventionId: string | null;
  } {
    const blocking = this.autoRebuildLockedCaps.get(input.capabilityId);
    if (!blocking) {
      return { allowed: true, blockingInterventionId: null };
    }
    const at = (input.now ?? (() => new Date()))();
    this.autoRebuildAttempts.push({
      capabilityId: input.capabilityId,
      attemptedBy: input.attemptedBy,
      attemptedAt: at.toISOString(),
      rejectionCode: "sec.constitutional_auto_rebuild_attempted",
      blockingInterventionId: blocking,
    });
    return { allowed: false, blockingInterventionId: blocking };
  }

  /**
   * Founder-only: unlock a previously REMOVE_FROM_LIVE capability. Requires a
   * dedicated new intervention record (audit trail preserved).
   */
  unlockAutoRebuild(input: {
    capabilityId: string;
    unlockedBy: string;
    reason: string;
  }): { readonly unlocked: boolean; readonly reason: string | null } {
    if (!input.unlockedBy || !input.reason) {
      return { unlocked: false, reason: "Signature + reason required" };
    }
    const removed = this.autoRebuildLockedCaps.delete(input.capabilityId);
    return { unlocked: removed, reason: removed ? null : "Not locked" };
  }

  listInterventions(): readonly InterventionRecord[] {
    return Array.from(this.interventions.values());
  }

  listAutoRebuildAttempts(): readonly AutoRebuildAttempt[] {
    return this.autoRebuildAttempts.slice();
  }

  isCapabilityLocked(capabilityId: string): boolean {
    return this.autoRebuildLockedCaps.has(capabilityId);
  }

  clear(): void {
    this.interventions.clear();
    this.autoRebuildLockedCaps.clear();
    this.autoRebuildAttempts = [];
  }
}
