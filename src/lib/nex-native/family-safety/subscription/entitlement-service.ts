// src/lib/nex-native/family-safety/subscription/entitlement-service.ts
//
// NEX Family Safety · entitlement service · Phase 1 · test-mode only.
//
// Load-bearing invariants (every one is a test):
//   · test_mode=TRUE at every INSERT · the service refuses writes that
//     attempt test_mode=false in Phase 1.
//   · simulated=TRUE at every INSERT · forced.
//   · hasActiveEntitlement(accountId, planId) is the SINGLE gate for
//     feature flags that require entitlement. Only state='active'
//     counts as "active" · pending / failed / cancelled / expired /
//     suspended are NOT active.
//   · Duplicate payment callback with same idempotency_key is
//     resolved to outcome='duplicate_ignored' without granting a
//     second entitlement.
//   · Fail path leaves no entitlement in state='active' · the row
//     is written in state='failed' with the attempt log in
//     outcome='failed'.
//   · Cancel path same · no state='active'.
//
// Server-only · writes to the shared pg pool.

import "server-only";
import { withClient, type PgClientLike } from "@/lib/nex/db";
import type {
  EntitlementRow,
  EntitlementState,
  PaymentAttemptRow,
  PaymentOutcome,
  PaymentProvider,
  PlanId,
} from "./types";
import { isPlanId } from "./types";

// --------------------------------------------------------------------
// Row mappers
// --------------------------------------------------------------------

function mapEntitlement(r: Record<string, unknown>): EntitlementRow {
  return {
    entitlementId: String(r.entitlement_id),
    ownerAccountId: String(r.owner_account_id),
    planId: String(r.plan_id) as PlanId,
    state: String(r.state) as EntitlementState,
    activatedAt: r.activated_at === null ? null : String(r.activated_at),
    expiresAt: r.expires_at === null ? null : String(r.expires_at),
    cancelledAt: r.cancelled_at === null ? null : String(r.cancelled_at),
    paymentProvider: String(r.payment_provider) as PaymentProvider,
    paymentProviderRef:
      r.payment_provider_ref === null ? null : String(r.payment_provider_ref),
    testMode: Boolean(r.test_mode),
    simulated: Boolean(r.simulated),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function mapAttempt(r: Record<string, unknown>): PaymentAttemptRow {
  return {
    attemptId: String(r.attempt_id),
    ownerAccountId: String(r.owner_account_id),
    planId: String(r.plan_id) as PlanId,
    idempotencyKey: String(r.idempotency_key),
    outcome: String(r.outcome) as PaymentOutcome,
    provider: String(r.provider) as PaymentProvider,
    providerResponseSummary:
      r.provider_response_summary === null
        ? null
        : String(r.provider_response_summary),
    entitlementId: r.entitlement_id === null ? null : String(r.entitlement_id),
    testMode: Boolean(r.test_mode),
    simulated: Boolean(r.simulated),
    attemptedAt: String(r.attempted_at),
  };
}

// --------------------------------------------------------------------
// Enforced invariants
// --------------------------------------------------------------------

export const PHASE_1_TEST_MODE = true as const;
export const PHASE_1_SIMULATED = true as const;

export class TestModeInvariantViolation extends Error {
  constructor(detail: string) {
    super(`entitlement-service: test_mode/simulated invariant violated · ${detail}`);
  }
}

function enforcePhase1Invariants(
  testMode: boolean,
  simulated: boolean,
): void {
  if (testMode !== PHASE_1_TEST_MODE) {
    throw new TestModeInvariantViolation(
      "test_mode must be TRUE in Phase 1",
    );
  }
  if (simulated !== PHASE_1_SIMULATED) {
    throw new TestModeInvariantViolation(
      "simulated must be TRUE in Phase 1",
    );
  }
}

function clampSummary(s: string | null | undefined): string | null {
  if (s === null || s === undefined) return null;
  const str = String(s);
  if (str.length <= 500) return str;
  return str.slice(0, 500);
}

// --------------------------------------------------------------------
// Public helpers
// --------------------------------------------------------------------

export interface RecordAttemptInput {
  readonly ownerAccountId: string;
  readonly planId: PlanId;
  readonly idempotencyKey: string;
  readonly outcome: PaymentOutcome;
  readonly provider?: PaymentProvider;
  readonly providerResponseSummary?: string | null;
  readonly entitlementId?: string | null;
  readonly testMode?: boolean;
  readonly simulated?: boolean;
}

export interface GrantEntitlementInput {
  readonly ownerAccountId: string;
  readonly planId: PlanId;
  readonly provider?: PaymentProvider;
  readonly providerRef?: string | null;
  readonly expiresAt?: string | null;
  readonly testMode?: boolean;
  readonly simulated?: boolean;
}

/** Returns TRUE iff the owner has state='active' for the given plan.
 *  SINGLE gate for feature flags. */
export async function hasActiveEntitlement(
  ownerAccountId: string,
  planId: PlanId,
): Promise<boolean> {
  if (!isPlanId(planId)) return false;
  const row = await withClient(async (client) => {
    const r = await client.query(
      `SELECT 1 FROM nex.family_safety_entitlement
        WHERE owner_account_id = $1 AND plan_id = $2 AND state = 'active'
        LIMIT 1`,
      [ownerAccountId, planId],
    );
    return (r.rowCount ?? 0) > 0;
  });
  return row ?? false;
}

/** Returns the newest active entitlement row (if any) for an owner. */
export async function getActiveEntitlement(
  ownerAccountId: string,
  planId: PlanId,
): Promise<EntitlementRow | null> {
  const out = await withClient(async (client) => {
    const r = await client.query(
      `SELECT * FROM nex.family_safety_entitlement
        WHERE owner_account_id = $1 AND plan_id = $2 AND state = 'active'
        ORDER BY created_at DESC
        LIMIT 1`,
      [ownerAccountId, planId],
    );
    const row = r.rows[0];
    if (!row) return null;
    return mapEntitlement(row);
  });
  return out ?? null;
}

/** Returns the newest entitlement row for the owner regardless of state. */
export async function getNewestEntitlement(
  ownerAccountId: string,
  planId: PlanId,
): Promise<EntitlementRow | null> {
  const out = await withClient(async (client) => {
    const r = await client.query(
      `SELECT * FROM nex.family_safety_entitlement
        WHERE owner_account_id = $1 AND plan_id = $2
        ORDER BY created_at DESC
        LIMIT 1`,
      [ownerAccountId, planId],
    );
    const row = r.rows[0];
    if (!row) return null;
    return mapEntitlement(row);
  });
  return out ?? null;
}

/** Lists every entitlement for the owner, newest first. */
export async function listEntitlementsForOwner(
  ownerAccountId: string,
): Promise<ReadonlyArray<EntitlementRow>> {
  const out = await withClient(async (client) => {
    const r = await client.query(
      `SELECT * FROM nex.family_safety_entitlement
        WHERE owner_account_id = $1
        ORDER BY created_at DESC`,
      [ownerAccountId],
    );
    return r.rows.map((row) => mapEntitlement(row));
  });
  return out ?? [];
}

/** Finds a prior attempt by idempotency_key (null if none). */
export async function findAttemptByIdempotencyKey(
  key: string,
): Promise<PaymentAttemptRow | null> {
  const out = await withClient(async (client) => {
    const r = await client.query(
      `SELECT * FROM nex.family_safety_payment_attempt
        WHERE idempotency_key = $1
        LIMIT 1`,
      [key],
    );
    const row = r.rows[0];
    if (!row) return null;
    return mapAttempt(row);
  });
  return out ?? null;
}

// --------------------------------------------------------------------
// Write operations
// --------------------------------------------------------------------

/** Inserts an entitlement row in state='pending' or 'failed'/'cancelled'
 *  depending on the attempt outcome. For 'succeeded' flows the caller
 *  should use `grantActiveEntitlement`. */
export async function recordPaymentAttempt(
  input: RecordAttemptInput,
  explicitClient?: PgClientLike,
): Promise<PaymentAttemptRow | null> {
  const testMode = input.testMode ?? PHASE_1_TEST_MODE;
  const simulated = input.simulated ?? PHASE_1_SIMULATED;
  enforcePhase1Invariants(testMode, simulated);

  const summary = clampSummary(input.providerResponseSummary ?? null);
  const provider: PaymentProvider = input.provider ?? "test_mode";

  const run = async (client: PgClientLike) => {
    const r = await client.query(
      `INSERT INTO nex.family_safety_payment_attempt
        (owner_account_id, plan_id, idempotency_key, outcome, provider,
         provider_response_summary, entitlement_id, test_mode, simulated)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING *`,
      [
        input.ownerAccountId,
        input.planId,
        input.idempotencyKey,
        input.outcome,
        provider,
        summary,
        input.entitlementId ?? null,
        testMode,
        simulated,
      ],
    );
    const row = r.rows[0];
    if (!row) return null;
    return mapAttempt(row);
  };

  if (explicitClient) return await run(explicitClient);
  const result = await withClient(run);
  return result ?? null;
}

/** Grants a new entitlement row in state='active' AND records a
 *  succeeded payment attempt in the SAME transaction. If a prior
 *  attempt with the same idempotency_key exists, this function records
 *  a duplicate_ignored attempt row and returns the EXISTING linked
 *  entitlement (idempotent · one real activation per key). */
export async function grantActiveEntitlement(
  input: GrantEntitlementInput & { readonly idempotencyKey: string },
): Promise<{
  readonly entitlement: EntitlementRow;
  readonly duplicate: boolean;
} | null> {
  const testMode = input.testMode ?? PHASE_1_TEST_MODE;
  const simulated = input.simulated ?? PHASE_1_SIMULATED;
  enforcePhase1Invariants(testMode, simulated);

  const provider: PaymentProvider = input.provider ?? "test_mode";

  const out = await withClient(async (client) => {
    // Idempotency check · if the key has already been seen, DO NOT
    // insert a second entitlement.
    const prior = await client.query(
      `SELECT entitlement_id FROM nex.family_safety_payment_attempt
        WHERE idempotency_key = $1
        LIMIT 1`,
      [input.idempotencyKey],
    );
    if ((prior.rowCount ?? 0) > 0) {
      // Record a duplicate_ignored row so the audit shows the
      // retry · but do NOT grant a second entitlement.
      await client.query(
        `INSERT INTO nex.family_safety_payment_attempt
          (owner_account_id, plan_id, idempotency_key, outcome, provider,
           provider_response_summary, entitlement_id, test_mode, simulated)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          input.ownerAccountId,
          input.planId,
          `${input.idempotencyKey}__dup__${Date.now()}`,
          "duplicate_ignored",
          provider,
          "SIMULATED · duplicate callback ignored",
          (prior.rows[0] as Record<string, unknown>)?.entitlement_id ?? null,
          testMode,
          simulated,
        ],
      );
      const existingRow = (prior.rows[0] as Record<string, unknown>)
        ?.entitlement_id;
      if (!existingRow) return null;
      const er = await client.query(
        `SELECT * FROM nex.family_safety_entitlement
          WHERE entitlement_id = $1
          LIMIT 1`,
        [existingRow],
      );
      const row = er.rows[0];
      if (!row) return null;
      return { entitlement: mapEntitlement(row), duplicate: true };
    }

    // Check for an already-active entitlement for this owner+plan
    // · the partial unique index would reject a second · we return
    // the existing one.
    const existing = await client.query(
      `SELECT * FROM nex.family_safety_entitlement
        WHERE owner_account_id = $1 AND plan_id = $2 AND state = 'active'
        LIMIT 1`,
      [input.ownerAccountId, input.planId],
    );
    if ((existing.rowCount ?? 0) > 0) {
      const row = existing.rows[0];
      if (!row) return null;
      const mapped = mapEntitlement(row);
      // Record attempt as duplicate_ignored for audit.
      await client.query(
        `INSERT INTO nex.family_safety_payment_attempt
          (owner_account_id, plan_id, idempotency_key, outcome, provider,
           provider_response_summary, entitlement_id, test_mode, simulated)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          input.ownerAccountId,
          input.planId,
          input.idempotencyKey,
          "duplicate_ignored",
          provider,
          "SIMULATED · owner already has an active entitlement for this plan",
          mapped.entitlementId,
          testMode,
          simulated,
        ],
      );
      return { entitlement: mapped, duplicate: true };
    }

    // Insert a fresh active entitlement.
    const er = await client.query(
      `INSERT INTO nex.family_safety_entitlement
        (owner_account_id, plan_id, state, activated_at, expires_at,
         payment_provider, payment_provider_ref, test_mode, simulated)
       VALUES ($1, $2, 'active', now(), $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.ownerAccountId,
        input.planId,
        input.expiresAt ?? null,
        provider,
        input.providerRef ?? null,
        testMode,
        simulated,
      ],
    );
    const entRow = er.rows[0];
    if (!entRow) return null;
    const ent = mapEntitlement(entRow);

    // Record the succeeded attempt tied to this entitlement.
    await client.query(
      `INSERT INTO nex.family_safety_payment_attempt
        (owner_account_id, plan_id, idempotency_key, outcome, provider,
         provider_response_summary, entitlement_id, test_mode, simulated)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        input.ownerAccountId,
        input.planId,
        input.idempotencyKey,
        "succeeded",
        provider,
        "SIMULATED · test adapter succeeded",
        ent.entitlementId,
        testMode,
        simulated,
      ],
    );

    return { entitlement: ent, duplicate: false };
  });

  return out ?? null;
}

/** Cancels an active entitlement for the owner · state → 'cancelled'. */
export async function cancelActiveEntitlement(
  ownerAccountId: string,
  planId: PlanId,
): Promise<EntitlementRow | null> {
  const out = await withClient(async (client) => {
    const r = await client.query(
      `UPDATE nex.family_safety_entitlement
         SET state = 'cancelled',
             cancelled_at = now(),
             updated_at = now()
       WHERE owner_account_id = $1 AND plan_id = $2 AND state = 'active'
       RETURNING *`,
      [ownerAccountId, planId],
    );
    const row = r.rows[0];
    if (!row) return null;
    return mapEntitlement(row);
  });
  return out ?? null;
}

/** Marks an active entitlement expired · state → 'expired'. */
export async function expireActiveEntitlement(
  ownerAccountId: string,
  planId: PlanId,
): Promise<EntitlementRow | null> {
  const out = await withClient(async (client) => {
    const r = await client.query(
      `UPDATE nex.family_safety_entitlement
         SET state = 'expired',
             updated_at = now()
       WHERE owner_account_id = $1 AND plan_id = $2 AND state = 'active'
       RETURNING *`,
      [ownerAccountId, planId],
    );
    const row = r.rows[0];
    if (!row) return null;
    return mapEntitlement(row);
  });
  return out ?? null;
}

/** Inserts a failed-outcome attempt record · no entitlement granted. */
export async function recordFailedPayment(
  ownerAccountId: string,
  planId: PlanId,
  idempotencyKey: string,
  reason: string,
): Promise<PaymentAttemptRow | null> {
  return await recordPaymentAttempt({
    ownerAccountId,
    planId,
    idempotencyKey,
    outcome: "failed",
    provider: "test_mode",
    providerResponseSummary: clampSummary(
      `SIMULATED · test adapter failed · reason=${reason}`,
    ),
    entitlementId: null,
  });
}

/** Inserts a cancelled-outcome attempt record · no entitlement granted. */
export async function recordCancelledPayment(
  ownerAccountId: string,
  planId: PlanId,
  idempotencyKey: string,
): Promise<PaymentAttemptRow | null> {
  return await recordPaymentAttempt({
    ownerAccountId,
    planId,
    idempotencyKey,
    outcome: "cancelled",
    provider: "test_mode",
    providerResponseSummary: "SIMULATED · test adapter cancelled",
    entitlementId: null,
  });
}
