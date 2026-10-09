// src/lib/nex-native/claims/claim-logic.ts
//
// NEX · Universal Business Claim · pure business logic.
//
// SEALED CLAIM:
//   This module contains ONLY pure functions. No DB, no network, no clock
//   (clocks are passed in as `now: Date`), no randomness (`code` is passed
//   in as `code: string`), no filesystem.
//
// SEPARATION OF CONCERNS:
//   · Pure logic (THIS FILE)       — rules, state transitions, validation.
//   · I/O boundary (claim-service.ts) — pg Pool connection + crypto wrapper.
//
// SCOPE:
//   Generalises `src/lib/nex-food/claim-service.ts` across every entity_type
//   via `nex.business_claim` (migration 176). The food-only path remains
//   operational side-by-side.
//
// SEE ALSO:
//   · Migration 176 · nex.business_claim schema
//   · Migration 168 · lifecycle_transition_log for OWNER_CLAIMED promotion
//   · docs/doctrine/nex-business-canonical-seed-cohort-and-eval-corpus-design-2026-10-08.md

// ═════════════════════════════════════════════════════════════════════
// §1 · Public types · mirror of nex.business_claim column shape
// ═════════════════════════════════════════════════════════════════════

export const CLAIM_CODE_LENGTH = 6;
export const CLAIM_CODE_TTL_MS = 10 * 60 * 1000;
export const CLAIM_CODE_MAX_ATTEMPTS = 5;

export const CLAIM_CHANNELS = ["whatsapp", "email", "sms", "phone"] as const;
export type ClaimChannel = typeof CLAIM_CHANNELS[number];

export const CLAIM_STATES = [
  "PENDING",
  "VERIFIED",
  "EXPIRED",
  "REVOKED",
] as const;
export type ClaimState = typeof CLAIM_STATES[number];

/** The sealed canonical lifecycle values that permit a claim to begin. */
export const CLAIMABLE_LIFECYCLE_STATES = [
  "DISCOVERED",
  "ENRICHED",
  "VERIFIED",
] as const;
export type ClaimableLifecycleState =
  typeof CLAIMABLE_LIFECYCLE_STATES[number];

/** A row from `nex.business_claim`. Caller passes the loaded row through
 *  the pure validators here. Column names match the migration-176 shape. */
export interface BusinessClaim {
  readonly claim_id: string;
  readonly canonical_business_id: string;
  readonly code_hash: string;
  readonly claim_channel: ClaimChannel;
  readonly destination: string;
  readonly state: ClaimState;
  readonly requested_at: string;              // ISO-8601
  readonly expires_at: string;                // ISO-8601
  readonly attempt_count: number;
  readonly verified_at: string | null;
  readonly claimed_by_account_id: string | null;
  readonly expired_at: string | null;
  readonly revoked_at: string | null;
  readonly revoked_by: string | null;
  readonly requested_by: string;
}

export interface CreateClaimInput {
  readonly canonical_business_id: string;
  readonly claim_channel: ClaimChannel;
  readonly destination: string;
  readonly requested_by: string;
  /** Caller supplies the hashed code; the I/O boundary wraps crypto. */
  readonly code_hash: string;
  readonly now: Date;
}

export interface CreateClaimPlan {
  readonly canonical_business_id: string;
  readonly claim_channel: ClaimChannel;
  readonly destination: string;
  readonly requested_by: string;
  readonly code_hash: string;
  readonly expires_at: Date;
}

export type CreateClaimResult =
  | { readonly ok: true; readonly plan: CreateClaimPlan }
  | {
      readonly ok: false;
      readonly reason:
        | "invalid_channel"
        | "blank_destination"
        | "blank_requested_by"
        | "blank_code_hash"
        | "blank_canonical_business_id";
    };

// ═════════════════════════════════════════════════════════════════════
// §2 · Pure validators
// ═════════════════════════════════════════════════════════════════════

export function isClaimChannel(c: string): c is ClaimChannel {
  return (CLAIM_CHANNELS as readonly string[]).includes(c);
}

export function computeExpiry(now: Date): Date {
  return new Date(now.getTime() + CLAIM_CODE_TTL_MS);
}

/** Validate inputs and return a CreateClaimPlan or a structured refusal.
 *  No side effects. Does not generate the code (caller provides code_hash). */
export function planCreateClaim(input: CreateClaimInput): CreateClaimResult {
  if (input.canonical_business_id.trim().length === 0) {
    return { ok: false, reason: "blank_canonical_business_id" };
  }
  if (!isClaimChannel(input.claim_channel)) {
    return { ok: false, reason: "invalid_channel" };
  }
  if (input.destination.trim().length === 0) {
    return { ok: false, reason: "blank_destination" };
  }
  if (input.requested_by.trim().length === 0) {
    return { ok: false, reason: "blank_requested_by" };
  }
  if (input.code_hash.trim().length === 0) {
    return { ok: false, reason: "blank_code_hash" };
  }
  return {
    ok: true,
    plan: {
      canonical_business_id: input.canonical_business_id,
      claim_channel: input.claim_channel,
      destination: input.destination,
      requested_by: input.requested_by,
      code_hash: input.code_hash,
      expires_at: computeExpiry(input.now),
    },
  };
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Verification policy
// ═════════════════════════════════════════════════════════════════════

export interface VerifyClaimInput {
  readonly claim: BusinessClaim;
  /** Caller runs the crypt() comparison and supplies the result. */
  readonly supplied_code_matches: boolean;
  readonly account_id_asserting_claim: string;
  readonly now: Date;
}

export type VerifyClaimDecision =
  | {
      readonly kind: "accept";
      readonly new_state: "VERIFIED";
      readonly verified_at: Date;
      readonly claimed_by_account_id: string;
    }
  | {
      readonly kind: "reject_wrong_code";
      readonly new_attempt_count: number;
      readonly auto_expire: boolean;
    }
  | {
      readonly kind: "reject_expired";
    }
  | {
      readonly kind: "reject_terminal_state";
      readonly current_state: Exclude<ClaimState, "PENDING">;
    }
  | {
      readonly kind: "reject_attempts_exhausted";
    }
  | {
      readonly kind: "reject_blank_account";
    };

export function decideVerifyClaim(input: VerifyClaimInput): VerifyClaimDecision {
  const { claim, supplied_code_matches, account_id_asserting_claim, now } = input;

  // Terminal states refuse re-verification.
  if (claim.state !== "PENDING") {
    return {
      kind: "reject_terminal_state",
      current_state: claim.state,
    };
  }

  if (account_id_asserting_claim.trim().length === 0) {
    return { kind: "reject_blank_account" };
  }

  // Expiry gate (even if attempts remain).
  const expiresAt = new Date(claim.expires_at);
  if (now.getTime() >= expiresAt.getTime()) {
    return { kind: "reject_expired" };
  }

  // Attempt limit (pre-check: this attempt would be N+1).
  if (claim.attempt_count >= CLAIM_CODE_MAX_ATTEMPTS) {
    return { kind: "reject_attempts_exhausted" };
  }

  if (!supplied_code_matches) {
    const newAttemptCount = claim.attempt_count + 1;
    return {
      kind: "reject_wrong_code",
      new_attempt_count: newAttemptCount,
      auto_expire: newAttemptCount >= CLAIM_CODE_MAX_ATTEMPTS,
    };
  }

  return {
    kind: "accept",
    new_state: "VERIFIED",
    verified_at: now,
    claimed_by_account_id: account_id_asserting_claim,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Revocation policy
// ═════════════════════════════════════════════════════════════════════

export interface RevokeClaimInput {
  readonly claim: BusinessClaim;
  readonly revoked_by: string;
  readonly reason: string;
  readonly now: Date;
}

export type RevokeClaimDecision =
  | {
      readonly kind: "accept";
      readonly new_state: "REVOKED";
      readonly revoked_at: Date;
      readonly revoked_by: string;
      readonly reason: string;
    }
  | {
      readonly kind: "reject_blank_revoked_by";
    }
  | {
      readonly kind: "reject_already_terminal";
      readonly current_state: Exclude<ClaimState, "PENDING">;
    };

export function decideRevokeClaim(input: RevokeClaimInput): RevokeClaimDecision {
  if (input.revoked_by.trim().length === 0) {
    return { kind: "reject_blank_revoked_by" };
  }
  if (input.claim.state !== "PENDING") {
    return {
      kind: "reject_already_terminal",
      current_state: input.claim.state,
    };
  }
  return {
    kind: "accept",
    new_state: "REVOKED",
    revoked_at: input.now,
    revoked_by: input.revoked_by,
    reason: input.reason,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §5 · Lifecycle promotion contract
// ═════════════════════════════════════════════════════════════════════
//
// A successful `decideVerifyClaim` returning `accept` MUST be accompanied
// (in the same DB transaction, written by the I/O layer) by:
//   1. UPDATE nex.business_claim · state → VERIFIED, verified_at, claimed_by
//   2. UPDATE nex.business_canonical · lifecycle_state → OWNER_CLAIMED
//      WHERE canonical_business_id = claim.canonical_business_id
//        AND lifecycle_state IN (DISCOVERED, ENRICHED, VERIFIED)
//   3. INSERT nex.business_canonical_lifecycle_log · transition record:
//        from_state = canonical.lifecycle_state (pre-update)
//        to_state = 'OWNER_CLAIMED'
//        transition_reason = 'owner_claim'
//        transitioned_by = 'owner:<account_id>'
//        transitioned_at = now
//
// The I/O layer owns the transaction. This logic module authors the
// contract above as a plan the I/O layer executes.

export interface AcceptedClaimDbPlan {
  readonly update_claim: {
    readonly claim_id: string;
    readonly state: "VERIFIED";
    readonly verified_at: Date;
    readonly claimed_by_account_id: string;
  };
  readonly update_canonical: {
    readonly canonical_business_id: string;
    readonly expected_lifecycle_states_in: readonly ClaimableLifecycleState[];
    readonly to_lifecycle_state: "OWNER_CLAIMED";
  };
  readonly insert_lifecycle_log: {
    readonly canonical_business_id: string;
    readonly to_state: "OWNER_CLAIMED";
    readonly transition_reason: "owner_claim";
    readonly transitioned_by: string;
    readonly transitioned_at: Date;
  };
}

export function planAcceptedClaimWrite(
  claim: BusinessClaim,
  decision: Extract<VerifyClaimDecision, { kind: "accept" }>,
): AcceptedClaimDbPlan {
  return {
    update_claim: {
      claim_id: claim.claim_id,
      state: "VERIFIED",
      verified_at: decision.verified_at,
      claimed_by_account_id: decision.claimed_by_account_id,
    },
    update_canonical: {
      canonical_business_id: claim.canonical_business_id,
      expected_lifecycle_states_in: CLAIMABLE_LIFECYCLE_STATES,
      to_lifecycle_state: "OWNER_CLAIMED",
    },
    insert_lifecycle_log: {
      canonical_business_id: claim.canonical_business_id,
      to_state: "OWNER_CLAIMED",
      transition_reason: "owner_claim",
      transitioned_by: `owner:${decision.claimed_by_account_id}`,
      transitioned_at: decision.verified_at,
    },
  };
}
