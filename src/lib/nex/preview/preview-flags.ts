// src/lib/nex/preview/preview-flags.ts
//
// Stage 5 · emergency-revert flag layer. Per founder feedback:
// "A feature flag alone is not sufficient isolation." → this is a SECONDARY
// safety layer that stacks on top of the isolated preview environment.
//
// Flags are IN-MEMORY here so unit tests don't require a DB. Production
// wiring persists them in nex.preview_emergency_flag (schema authored at
// Stage 5b when applied). The pure store + resolver pattern lets both
// backends share the same evaluator.

import type { EmergencyFlag, EmergencyFlagScope } from "./preview-config";

export interface FlagEvaluationInput {
  readonly capabilityId: string;
  readonly revisionId: string | null;
}

export interface FlagEvaluationResult {
  readonly blocked: boolean;
  readonly reason: string | null;
  readonly matchedFlag: EmergencyFlag | null;
}

/**
 * In-memory flag store. Pluggable · production replaces with pg-backed store.
 */
export class InMemoryFlagStore {
  private flags: EmergencyFlag[] = [];

  add(flag: EmergencyFlag): void {
    this.flags.push(flag);
  }

  remove(matcher: (f: EmergencyFlag) => boolean): number {
    const before = this.flags.length;
    this.flags = this.flags.filter((f) => !matcher(f));
    return before - this.flags.length;
  }

  list(): readonly EmergencyFlag[] {
    return this.flags.slice();
  }

  clear(): void {
    this.flags = [];
  }
}

/**
 * Determine if a given (capability, revision) is currently blocked by any
 * emergency flag. First-match wins · order does not matter (any match blocks).
 */
export function evaluateFlags(
  flags: readonly EmergencyFlag[],
  input: FlagEvaluationInput,
): FlagEvaluationResult {
  for (const f of flags) {
    if (scopeMatches(f.scope, input)) {
      return {
        blocked: true,
        reason: f.reason,
        matchedFlag: f,
      };
    }
  }
  return { blocked: false, reason: null, matchedFlag: null };
}

function scopeMatches(scope: EmergencyFlagScope, input: FlagEvaluationInput): boolean {
  switch (scope.kind) {
    case "global":
      return true;
    case "capability":
      return scope.capabilityId === input.capabilityId;
    case "revision":
      return input.revisionId !== null && scope.revisionId === input.revisionId;
  }
}

/**
 * Build a founder-signed emergency flag. Requires signature (session token) ·
 * empty signature is rejected (defence-in-depth even if UI-side already gates).
 */
export function makeFlag(input: {
  scope: EmergencyFlagScope;
  reason: string;
  signedBy: string;
  now?: () => Date;
}): EmergencyFlag {
  if (!input.signedBy || input.signedBy.length === 0) {
    throw new Error("Emergency flag requires signedBy (founder session token)");
  }
  if (!input.reason || input.reason.length === 0) {
    throw new Error("Emergency flag requires reason (audit trail)");
  }
  const at = (input.now ?? (() => new Date()))();
  return {
    scope: input.scope,
    reason: input.reason,
    signedBy: input.signedBy,
    signedAt: at.toISOString(),
  };
}
