// NEX Sparks Wallet · core library · F2 (2026-08-25).
//
// Server-authoritative wallet operations. Every function is atomic (delegates
// to the SQL functions in migration 102 which wrap balance check + ledger
// insert + wallet update in a single transaction with row locking).
//
// The CLIENT MUST NOT tell the server how many Sparks to spend. Callers of
// `reserveSpend()` pass the actionId · the wallet resolves the required cost
// from the NexAction registry. If a caller wants to spend an amount not tied
// to a registered action, they must use grant/adjust primitives (which are
// gated to admin operators).

import { Pool, type PoolClient } from "pg";
import { getAction } from "../registry";
import {
  toSparks,
  WalletError,
  type GrantSource,
  type PurchaseCredit,
  type SparksAmount,
  type SparksBalance,
  type SparksReservation,
  type WalletTransaction,
  type WalletTransactionKind,
} from "./types";

// ── Pool · lazy singleton (per-module) ────────────────────────────────
let _pool: Pool | null = null;
function pool(): Pool {
  if (_pool) return _pool;
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) throw new WalletError("db-error", "NEX_POSTGRES_URL not set");
  _pool = new Pool({ connectionString: url, max: 5 });
  return _pool;
}
async function withClient<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try { return await fn(c); } finally { c.release(); }
}

// ── Read: balance ─────────────────────────────────────────────────────
export async function getBalance(userId: string): Promise<SparksBalance> {
  return withClient(async (c) => {
    const r = await c.query(
      `SELECT user_id, sparks_balance, lifetime_granted, lifetime_purchased,
              lifetime_spent, created_at, updated_at
         FROM nex.user_wallet WHERE user_id = $1`,
      [userId],
    );
    if (r.rowCount === 0) {
      // First read for a user with no wallet · return a zero snapshot without
      // creating a row. The wallet is created on first grant / purchase / spend
      // attempt (via signup grant hook or wallet_reserve_spend / wallet_grant_sparks).
      const now = new Date();
      return {
        userId,
        balance: toSparks(0),
        lifetimeGranted: toSparks(0),
        lifetimePurchased: toSparks(0),
        lifetimeSpent: toSparks(0),
        createdAt: now,
        updatedAt: now,
      };
    }
    const row = r.rows[0];
    return {
      userId: row.user_id,
      balance: toSparks(Number(row.sparks_balance)),
      lifetimeGranted: toSparks(Number(row.lifetime_granted)),
      lifetimePurchased: toSparks(Number(row.lifetime_purchased)),
      lifetimeSpent: toSparks(Number(row.lifetime_spent)),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  });
}

// ── Write: reserve spend · atomic · idempotent ────────────────────────
// The runtime calls this at deps.wallet.require step. Cost is resolved from
// the NexAction registry · the caller cannot pass an amount. If the user
// has insufficient Sparks, throws WalletError('insufficient-sparks').
export async function reserveSpend(
  userId: string,
  actionId: string,
  idempotencyKey: string,
): Promise<SparksReservation> {
  const action = getAction(actionId);
  if (!action) throw new WalletError("invalid-kind", `Unknown action ${actionId}`, { actionId });
  const cost = action.cost?.sparks;
  if (!cost || cost <= 0) {
    throw new WalletError(
      "invalid-amount",
      `Action ${actionId} has no positive Sparks cost declared in the registry`,
      { actionId },
    );
  }

  return withClient(async (c) => {
    try {
      const r = await c.query(
        `SELECT transaction_id, balance_after, idempotent_hit
           FROM nex.wallet_reserve_spend($1, $2, $3, $4)`,
        [userId, actionId, cost, idempotencyKey],
      );
      const row = r.rows[0];
      return {
        reservationId: row.transaction_id,
        userId,
        actionId,
        amount: toSparks(cost),
        balanceAfter: toSparks(Number(row.balance_after)),
        idempotencyKey,
        idempotentHit: Boolean(row.idempotent_hit),
        createdAt: new Date(),
      };
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("insufficient sparks")) {
        throw new WalletError("insufficient-sparks", msg, { userId, actionId, required: cost });
      }
      if (msg.includes("no wallet for user")) {
        throw new WalletError("wallet-not-found", msg, { userId });
      }
      throw new WalletError("db-error", msg, { userId, actionId });
    }
  });
}

// ── Write: commit reserved spend · idempotent ─────────────────────────
export async function commitSpend(
  userId: string,
  reservationId: string,
  idempotencyKey: string,
): Promise<void> {
  await withClient(async (c) => {
    await c.query(
      `SELECT nex.wallet_commit_spend($1, $2, $3)`,
      [userId, reservationId, idempotencyKey],
    );
  });
}

// ── Write: refund reserved spend · idempotent · returns new balance ──
export async function refundSpend(
  userId: string,
  reservationId: string,
  idempotencyKey: string,
): Promise<SparksAmount> {
  return withClient(async (c) => {
    const r = await c.query(
      `SELECT nex.wallet_refund_spend($1, $2, $3) AS balance_after`,
      [userId, reservationId, idempotencyKey],
    );
    return toSparks(Number(r.rows[0].balance_after));
  });
}

// ── Write: grant Sparks · signup / promotion / admin adjustment ──────
export async function grantSparks(args: {
  userId: string;
  source: GrantSource;
  amount: number;                    // positive for grant · negative allowed for admin adjustment
  idempotencyKey: string;
  note?: string;
  operatorId?: string;
}): Promise<SparksAmount> {
  return withClient(async (c) => {
    const r = await c.query(
      `SELECT nex.wallet_grant_sparks($1, $2, $3, $4, $5, $6) AS balance_after`,
      [args.userId, args.source, args.amount, args.idempotencyKey, args.note ?? null, args.operatorId ?? null],
    );
    return toSparks(Number(r.rows[0].balance_after));
  });
}

// ── Write: record Stripe purchase · idempotent by purchase ref ───────
export async function recordPurchase(args: {
  userId: string;
  amount: number;
  purchaseRef: string;
  note?: string;
}): Promise<PurchaseCredit> {
  return withClient(async (c) => {
    const r = await c.query(
      `SELECT nex.wallet_record_purchase($1, $2, $3, $4) AS balance_after`,
      [args.userId, args.amount, args.purchaseRef, args.note ?? null],
    );
    return {
      userId: args.userId,
      amount: toSparks(args.amount),
      purchaseRef: args.purchaseRef,
      balanceAfter: toSparks(Number(r.rows[0].balance_after)),
      createdAt: new Date(),
    };
  });
}

// ── Read: transaction history · paginated ─────────────────────────────
export async function listTransactions(
  userId: string,
  opts?: { limit?: number; before?: Date },
): Promise<WalletTransaction[]> {
  const limit = Math.min(Math.max(1, opts?.limit ?? 50), 200);
  const before = opts?.before ?? new Date(Date.now() + 60_000);
  return withClient(async (c) => {
    const r = await c.query(
      `SELECT transaction_id, user_id, kind, delta_sparks, idempotency_key,
              related_transaction_id, action_id, purchase_ref, operator_id,
              note, balance_after, created_at
         FROM nex.wallet_transaction
        WHERE user_id = $1 AND created_at < $2
        ORDER BY created_at DESC LIMIT $3`,
      [userId, before, limit],
    );
    return r.rows.map((row) => ({
      transactionId: row.transaction_id,
      userId: row.user_id,
      kind: row.kind as WalletTransactionKind,
      deltaSparks: Number(row.delta_sparks),
      idempotencyKey: row.idempotency_key,
      relatedTransactionId: row.related_transaction_id ?? undefined,
      actionId: row.action_id ?? undefined,
      purchaseRef: row.purchase_ref ?? undefined,
      operatorId: row.operator_id ?? undefined,
      note: row.note ?? undefined,
      balanceAfter: toSparks(Number(row.balance_after)),
      createdAt: new Date(row.created_at),
    }));
  });
}
