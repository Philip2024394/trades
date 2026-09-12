// src/lib/nex/truth-engine/guardian/guardian.ts
//
// Truth Engine Guardian · Stage 1a sub-step 1a.5 · main Guardian class.
//
// Founder-authorised sub-step 1a.5 · 2026-09-11.
// Doctrine: Guardian is a DETERMINISTIC GATE. Guardian INSPECTS. Guardian
// does not MUTATE. Guardian does not PROMOTE. Guardian does not EXECUTE.
// Callers submit envelopes + intended actions; Guardian returns ACCEPT
// or REJECT with named codes; callers act on the decision.
//
// Guardian is PURE. Same input · same decision · forever.

import type {
  GuardianAction,
  GuardianConfig,
  GuardianDecision,
  GuardianInspectionRequest,
  GuardianRejection,
} from "./types";
import type { VerdictEnvelope } from "../verifier/types";
import {
  inspectEnvelopeStructure,
  inspectRuleVerdicts,
  inspectAggregate,
} from "./inspect-envelope";
import { inspectAction } from "./inspect-action";

/**
 * Guardian · encapsulates configuration and provides a deterministic
 * `inspect()` entry point.
 *
 * Construction is one-time per verifier deploy. `guardianVersion` is
 * fixed at construction and MUST match `envelope.guardianVersion` for
 * envelopes to be accepted.
 *
 * A guardian instance is IMMUTABLE post-construction.
 */
export class Guardian {
  private readonly config: GuardianConfig;

  constructor(config: GuardianConfig) {
    if (!config.guardianVersion || config.guardianVersion.length === 0) {
      throw new Error(
        "Guardian construction requires a non-empty guardianVersion per R-18 doctrine.",
      );
    }
    this.config = Object.freeze({ ...config });
  }

  /**
   * Inspect a verdict envelope + intended action. Returns ACCEPT or
   * REJECT with a canonical list of rejections. Deterministic ·
   * side-effect-free.
   */
  inspect(request: GuardianInspectionRequest): GuardianDecision {
    const rejections: GuardianRejection[] = [];

    // Envelope-shape invariants (R-18)
    for (const r of inspectEnvelopeStructure(request.envelope)) rejections.push(r);
    // Per-rule ledger invariants (§7.7 H1 · rule-identity integrity)
    for (const r of inspectRuleVerdicts(request.envelope)) rejections.push(r);
    // Aggregate invariants (silent-conversion detection · recompute check)
    for (const r of inspectAggregate(request.envelope)) rejections.push(r);
    // Guardian-version binding (envelope must match configured guardian)
    if (request.envelope.guardianVersion !== this.config.guardianVersion) {
      rejections.push({
        code: "envelope_missing_guardian_version",
        message: `Envelope guardianVersion "${request.envelope.guardianVersion}" does not match Guardian instance version "${this.config.guardianVersion}".`,
        detail: {
          envelope: request.envelope.guardianVersion,
          expected: this.config.guardianVersion,
        },
      });
    }
    // Optional verifier-instance-id allowlist
    if (
      this.config.expectedVerifierInstanceIds !== undefined &&
      this.config.expectedVerifierInstanceIds.length > 0 &&
      !this.config.expectedVerifierInstanceIds.includes(request.envelope.verifierInstanceId)
    ) {
      rejections.push({
        code: "envelope_missing_verifier_instance_id",
        message: `Envelope verifierInstanceId "${request.envelope.verifierInstanceId}" is not in the expected allowlist.`,
        detail: {
          verifierInstanceId: request.envelope.verifierInstanceId,
          expected: this.config.expectedVerifierInstanceIds,
        },
      });
    }
    // Action-scope invariants (Stage 1a · envelope_only permitted)
    for (const r of inspectAction(request.action, this.config)) rejections.push(r);

    if (rejections.length === 0) {
      return { accepted: true, rejections: [] };
    }
    return { accepted: false, rejections: Object.freeze([...rejections]) };
  }

  /**
   * Convenience: inspect envelope-only (no proposed action). Equivalent
   * to `inspect({ envelope, action: { kind: "envelope_only" } })`.
   */
  inspectEnvelopeOnly(envelope: VerdictEnvelope): GuardianDecision {
    return this.inspect({ envelope, action: { kind: "envelope_only" } });
  }

  /** Guardian version identifier · read-only. */
  version(): string {
    return this.config.guardianVersion;
  }

  /**
   * Whether nex_test writes are permitted at this Guardian configuration.
   * Stage 1a default: false. Stage 1b: true (post fixture-proof).
   */
  nexTestWritesPermitted(): boolean {
    return this.config.nexTestWritesPermitted;
  }
}

/**
 * Factory: constructs the Stage 1a default Guardian. Immutable · rejects
 * every action except envelope-only inspection · rejects any write.
 */
export function createStage1aGuardian(guardianVersion: string): Guardian {
  return new Guardian({
    guardianVersion,
    nexTestWritesPermitted: false,
  });
}

/**
 * Factory: constructs a Guardian with a specific instance-ID allowlist.
 * Used by Stage 1a fixture runners to bind Guardian to a specific
 * verifier deploy.
 */
export function createStage1aGuardianWithAllowlist(
  guardianVersion: string,
  expectedVerifierInstanceIds: readonly string[],
): Guardian {
  return new Guardian({
    guardianVersion,
    nexTestWritesPermitted: false,
    expectedVerifierInstanceIds,
  });
}

export function createGuardian(config: GuardianConfig): Guardian {
  return new Guardian(config);
}

/**
 * Convenience predicate: does the decision permit the action?
 */
export function isAccepted(decision: GuardianDecision): decision is { accepted: true; rejections: readonly [] } {
  return decision.accepted === true;
}
