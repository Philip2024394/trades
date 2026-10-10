// src/lib/nex-native/claims/claim-service.ts
//
// NEX · Universal Business Claim · I/O boundary service.
//
// SEALED CLAIM:
//   Wraps the pure claim-logic planner + the pg Pool writes in a single
//   service module. The service does three things:
//     1. createClaim · generates the 6-digit code, inserts
//        `nex.business_claim` row (migration 176), returns both the
//        plaintext code (for outreach) AND the sealed claim_id.
//     2. verifyClaim · looks up the claim, applies decideVerifyClaim,
//        and on `accept` writes the 3-table transaction
//        (business_claim + business_canonical + lifecycle_log).
//     3. revokeClaim · looks up the claim and transitions to REVOKED.
//
// SEPARATION:
//   · Pure logic           — claim-logic.ts (decideVerify, planCreate, …)
//   · Templates            — claim-templates.ts (render per channel/lang)
//   · THIS                 — I/O boundary (crypto + pg + transactions)
//   · Send adapter         — email-send-adapter.ts (channel delivery)
//
// SAFETY POSTURE:
//   · Plaintext code is RETURNED from createClaim ONCE (so outreach can
//     send it) and NEVER stored. Only the pgcrypto crypt() hash is stored.
//   · Verification runs the hash comparison via `crypt()` inside Postgres;
//     the plaintext never leaves the DB round-trip arg list.
//   · All multi-table writes are transactional (BEGIN / COMMIT / rollback
//     on error).

import { Client } from "pg";
import { randomInt } from "node:crypto";
import {
  CLAIM_CODE_LENGTH,
  decideRevokeClaim,
  decideVerifyClaim,
  planAcceptedClaimWrite,
  planCreateClaim,
  type BusinessClaim,
  type ClaimChannel,
  type CreateClaimResult,
  type RevokeClaimDecision,
  type VerifyClaimDecision,
} from "./claim-logic";

// ═════════════════════════════════════════════════════════════════════
// §1 · Public types
// ═════════════════════════════════════════════════════════════════════

export interface CreateClaimArgs {
  readonly canonical_business_id: string;
  readonly claim_channel: ClaimChannel;
  readonly destination: string;
  readonly requested_by: string;
  readonly connectionString: string;
}

/** Reason codes surfaced by `planCreateClaim` (pure claim-logic). The
 *  sealed `CreateClaimResult` discriminates on `{ok:false; reason: R}`
 *  for exactly the five validator refusals below. We extract them as a
 *  named type so the service-level union is unambiguously parenthesised
 *  (the old `A extends B ? R : never | "x" | "y"` form parses as
 *  `A extends B ? R : (never | "x" | "y")` which breaks the surface).
 *
 *  `Extract<CreateClaimResult, {ok:false}>["reason"]` works where the
 *  conditional-`infer R` form would be swallowed by the distributive
 *  conditional + union-operator precedence trap. */
type PlanCreateClaimReason =
  Extract<CreateClaimResult, { ok: false }>["reason"];

export type CreateClaimServiceResult =
  | {
      readonly ok: true;
      readonly claim_id: string;
      readonly plaintext_code: string;          // returned ONCE, caller must deliver + discard
      readonly expires_at: string;              // ISO
    }
  | {
      readonly ok: false;
      readonly reason:
        | PlanCreateClaimReason
        | "db_insert_failed"
        | "canonical_not_found";
      readonly detail?: string;
    };

export interface VerifyClaimArgs {
  readonly claim_id: string;
  readonly supplied_plaintext_code: string;
  readonly account_id_asserting_claim: string;
  readonly connectionString: string;
}

export type VerifyClaimServiceResult =
  | {
      readonly ok: true;
      readonly canonical_business_id: string;
      readonly claim_id: string;
      readonly claimed_by_account_id: string;
      readonly new_lifecycle_state: "OWNER_CLAIMED";
    }
  | {
      readonly ok: false;
      readonly reason: VerifyClaimDecision["kind"] | "claim_not_found" | "db_update_failed";
      readonly detail?: string;
    };

export interface RevokeClaimArgs {
  readonly claim_id: string;
  readonly revoked_by: string;
  readonly reason: string;
  readonly connectionString: string;
}

export type RevokeClaimServiceResult =
  | { readonly ok: true; readonly claim_id: string }
  | {
      readonly ok: false;
      readonly reason: RevokeClaimDecision["kind"] | "claim_not_found" | "db_update_failed";
      readonly detail?: string;
    };

// ═════════════════════════════════════════════════════════════════════
// §2 · Code generation (crypto-strong 6-digit)
// ═════════════════════════════════════════════════════════════════════

export function generateClaimCode(): string {
  const digits: string[] = [];
  for (let i = 0; i < CLAIM_CODE_LENGTH; i++) {
    digits.push(String(randomInt(0, 10)));
  }
  return digits.join("");
}

// ═════════════════════════════════════════════════════════════════════
// §3 · createClaim · the "send-a-claim-invitation" entry point
// ═════════════════════════════════════════════════════════════════════

export async function createClaim(
  args: CreateClaimArgs,
): Promise<CreateClaimServiceResult> {
  const plaintext = generateClaimCode();
  const now = new Date();

  const planResult = planCreateClaim({
    canonical_business_id: args.canonical_business_id,
    claim_channel: args.claim_channel,
    destination: args.destination,
    requested_by: args.requested_by,
    code_hash: "placeholder",             // we hash via pgcrypto crypt() below
    now,
  });
  if (!planResult.ok) {
    return { ok: false, reason: planResult.reason };
  }
  const plan = planResult.plan;

  const client = new Client({ connectionString: args.connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");

    // Verify the canonical exists (fail-closed · migration 176 CASCADE
    // on canonical delete would silently void a claim, but creating
    // against a non-existent canonical should surface loudly).
    const check = await client.query(
      "SELECT 1 FROM nex.business_canonical WHERE canonical_business_id = $1",
      [plan.canonical_business_id],
    );
    if (check.rowCount !== 1) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        reason: "canonical_not_found",
        detail: `canonical ${plan.canonical_business_id} does not exist`,
      };
    }

    // Supersede any PENDING claim for this canonical (per sealed
    // claim-logic §9: "Requesting a new code SUPERSEDES the previous").
    await client.query(
      `UPDATE nex.business_claim
          SET state = 'EXPIRED',
              expired_at = now()
        WHERE canonical_business_id = $1
          AND state = 'PENDING'`,
      [plan.canonical_business_id],
    );

    // Insert new PENDING row · hash the code using pgcrypto crypt().
    // crypt(password, gen_salt('bf')) uses Blowfish; strong enough for
    // a 6-digit code with 10-min expiry + 5-attempt limit.
    const insert = await client.query(
      `INSERT INTO nex.business_claim (
         canonical_business_id, code_hash, claim_channel, destination,
         state, requested_at, expires_at, attempt_count, requested_by
       ) VALUES (
         $1,
         crypt($2, gen_salt('bf')),
         $3, $4,
         'PENDING',
         $5, $6, 0, $7
       )
       RETURNING claim_id, expires_at`,
      [
        plan.canonical_business_id,
        plaintext,
        plan.claim_channel,
        plan.destination,
        now.toISOString(),
        plan.expires_at.toISOString(),
        plan.requested_by,
      ],
    );
    if (insert.rowCount !== 1) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "db_insert_failed" };
    }

    await client.query("COMMIT");

    return {
      ok: true,
      claim_id: insert.rows[0].claim_id,
      plaintext_code: plaintext,
      expires_at: insert.rows[0].expires_at.toISOString(),
    };
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    return {
      ok: false,
      reason: "db_insert_failed",
      detail: ((e instanceof Error) ? e.message : String(e)).replace(args.connectionString, "<redacted>"),
    };
  } finally {
    try { await client.end(); } catch { /* ignore */ }
  }
}

// ═════════════════════════════════════════════════════════════════════
// §4 · verifyClaim · owner enters the 6-digit code
// ═════════════════════════════════════════════════════════════════════

export async function verifyClaim(
  args: VerifyClaimArgs,
): Promise<VerifyClaimServiceResult> {
  const client = new Client({ connectionString: args.connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");

    const lookup = await client.query(
      `SELECT claim_id, canonical_business_id, code_hash, claim_channel,
              destination, state, requested_at, expires_at, attempt_count,
              verified_at, claimed_by_account_id, expired_at,
              revoked_at, revoked_by, requested_by,
              (code_hash = crypt($2, code_hash)) AS code_matches
         FROM nex.business_claim
        WHERE claim_id = $1
        FOR UPDATE`,
      [args.claim_id, args.supplied_plaintext_code],
    );
    if (lookup.rowCount !== 1) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "claim_not_found" };
    }

    const row = lookup.rows[0];
    const codeMatches: boolean = row.code_matches === true;

    const claim: BusinessClaim = {
      claim_id: row.claim_id,
      canonical_business_id: row.canonical_business_id,
      code_hash: row.code_hash,
      claim_channel: row.claim_channel,
      destination: row.destination,
      state: row.state,
      requested_at: row.requested_at.toISOString(),
      expires_at: row.expires_at.toISOString(),
      attempt_count: row.attempt_count,
      verified_at: row.verified_at ? row.verified_at.toISOString() : null,
      claimed_by_account_id: row.claimed_by_account_id,
      expired_at: row.expired_at ? row.expired_at.toISOString() : null,
      revoked_at: row.revoked_at ? row.revoked_at.toISOString() : null,
      revoked_by: row.revoked_by,
      requested_by: row.requested_by,
    };

    const decision = decideVerifyClaim({
      claim,
      supplied_code_matches: codeMatches,
      account_id_asserting_claim: args.account_id_asserting_claim,
      now: new Date(),
    });

    if (decision.kind !== "accept") {
      // Non-accept branches may still require a mutation (attempt count +
      // auto-expire on 5th wrong attempt).
      if (decision.kind === "reject_wrong_code") {
        await client.query(
          `UPDATE nex.business_claim
              SET attempt_count = $2,
                  state = CASE WHEN $3 THEN 'EXPIRED' ELSE state END,
                  expired_at = CASE WHEN $3 THEN now() ELSE expired_at END
            WHERE claim_id = $1`,
          [args.claim_id, decision.new_attempt_count, decision.auto_expire],
        );
      }
      await client.query("COMMIT");
      return { ok: false, reason: decision.kind };
    }

    // ACCEPT · write the sealed 3-table transaction.
    const writePlan = planAcceptedClaimWrite(claim, decision);

    await client.query(
      `UPDATE nex.business_claim
          SET state = $2,
              verified_at = $3,
              claimed_by_account_id = $4
        WHERE claim_id = $1`,
      [
        writePlan.update_claim.claim_id,
        writePlan.update_claim.state,
        writePlan.update_claim.verified_at.toISOString(),
        writePlan.update_claim.claimed_by_account_id,
      ],
    );

    // Promote canonical lifecycle to OWNER_CLAIMED, iff still in
    // claimable state (defence against race with admin promotion).
    const prevState = await client.query(
      `SELECT lifecycle_state
         FROM nex.business_canonical
        WHERE canonical_business_id = $1
          AND lifecycle_state = ANY($2::text[])
        FOR UPDATE`,
      [
        writePlan.update_canonical.canonical_business_id,
        [...writePlan.update_canonical.expected_lifecycle_states_in],
      ],
    );

    if (prevState.rowCount !== 1) {
      // Canonical no longer in a claimable state. Accept the claim as
      // a VERIFIED record but do NOT silently overwrite a non-claimable
      // lifecycle · the claim stands as evidence, admin reviews.
      await client.query("COMMIT");
      return {
        ok: true,
        canonical_business_id: writePlan.update_canonical.canonical_business_id,
        claim_id: writePlan.update_claim.claim_id,
        claimed_by_account_id: writePlan.update_claim.claimed_by_account_id,
        new_lifecycle_state: "OWNER_CLAIMED",
      };
    }

    const fromState: string = prevState.rows[0].lifecycle_state;

    await client.query(
      `UPDATE nex.business_canonical
          SET lifecycle_state = $2,
              updated_at = $3
        WHERE canonical_business_id = $1`,
      [
        writePlan.update_canonical.canonical_business_id,
        writePlan.update_canonical.to_lifecycle_state,
        writePlan.insert_lifecycle_log.transitioned_at.toISOString(),
      ],
    );

    await client.query(
      `INSERT INTO nex.business_canonical_lifecycle_log
         (canonical_business_id, from_state, to_state, transition_reason,
          transitioned_by, transitioned_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        writePlan.insert_lifecycle_log.canonical_business_id,
        fromState,
        writePlan.insert_lifecycle_log.to_state,
        writePlan.insert_lifecycle_log.transition_reason,
        writePlan.insert_lifecycle_log.transitioned_by,
        writePlan.insert_lifecycle_log.transitioned_at.toISOString(),
      ],
    );

    await client.query("COMMIT");

    return {
      ok: true,
      canonical_business_id: writePlan.update_canonical.canonical_business_id,
      claim_id: writePlan.update_claim.claim_id,
      claimed_by_account_id: writePlan.update_claim.claimed_by_account_id,
      new_lifecycle_state: "OWNER_CLAIMED",
    };
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    return {
      ok: false,
      reason: "db_update_failed",
      detail: ((e instanceof Error) ? e.message : String(e)).replace(args.connectionString, "<redacted>"),
    };
  } finally {
    try { await client.end(); } catch { /* ignore */ }
  }
}

// ═════════════════════════════════════════════════════════════════════
// §5 · revokeClaim · admin cancels a pending claim
// ═════════════════════════════════════════════════════════════════════

export async function revokeClaim(
  args: RevokeClaimArgs,
): Promise<RevokeClaimServiceResult> {
  const client = new Client({ connectionString: args.connectionString });
  await client.connect();
  try {
    const lookup = await client.query(
      `SELECT claim_id, canonical_business_id, code_hash, claim_channel,
              destination, state, requested_at, expires_at, attempt_count,
              verified_at, claimed_by_account_id, expired_at,
              revoked_at, revoked_by, requested_by
         FROM nex.business_claim
        WHERE claim_id = $1`,
      [args.claim_id],
    );
    if (lookup.rowCount !== 1) {
      return { ok: false, reason: "claim_not_found" };
    }
    const row = lookup.rows[0];
    const claim: BusinessClaim = {
      claim_id: row.claim_id,
      canonical_business_id: row.canonical_business_id,
      code_hash: row.code_hash,
      claim_channel: row.claim_channel,
      destination: row.destination,
      state: row.state,
      requested_at: row.requested_at.toISOString(),
      expires_at: row.expires_at.toISOString(),
      attempt_count: row.attempt_count,
      verified_at: row.verified_at ? row.verified_at.toISOString() : null,
      claimed_by_account_id: row.claimed_by_account_id,
      expired_at: row.expired_at ? row.expired_at.toISOString() : null,
      revoked_at: row.revoked_at ? row.revoked_at.toISOString() : null,
      revoked_by: row.revoked_by,
      requested_by: row.requested_by,
    };

    const decision = decideRevokeClaim({
      claim,
      revoked_by: args.revoked_by,
      reason: args.reason,
      now: new Date(),
    });

    if (decision.kind !== "accept") {
      return { ok: false, reason: decision.kind };
    }

    const upd = await client.query(
      `UPDATE nex.business_claim
          SET state = 'REVOKED',
              revoked_at = $2,
              revoked_by = $3
        WHERE claim_id = $1
          AND state = 'PENDING'`,
      [args.claim_id, decision.revoked_at.toISOString(), decision.revoked_by],
    );

    if (upd.rowCount !== 1) {
      return { ok: false, reason: "db_update_failed" };
    }

    return { ok: true, claim_id: args.claim_id };
  } catch (e) {
    return {
      ok: false,
      reason: "db_update_failed",
      detail: ((e instanceof Error) ? e.message : String(e)).replace(args.connectionString, "<redacted>"),
    };
  } finally {
    try { await client.end(); } catch { /* ignore */ }
  }
}
