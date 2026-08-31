// src/lib/nex-midtrans/initiate-topup.ts · Philip 2026-08-29
//
// Transactional core of POST /api/nex/provider/wallet/topup/initiate.
//
// Steps (all inside one DB transaction where possible):
//   1. Resolve provider by learner_ref
//   2. Validate amount is in the approved tier set (DB will also refuse
//      other values via CHECK)
//   3. Rate-limit: at most N unresolved pending intents per provider
//   4. INSERT the intent with a fresh UUID order_id
//   5. Call Midtrans Snap to obtain snap_token + snap_redirect_url
//   6. UPDATE the intent with the returned Snap fields
//   7. Return { intent_id, snap_token, snap_redirect_url }
//
// Design report §2 · doctrine locks: never trust client for amount; every
// intent is server-generated; DB CHECK enforces approved tiers.

import type pg from "pg";
import { isApprovedTier, APPROVED_TOPUP_TIERS } from "./config";

/** Payload we send to Midtrans /snap/v1/transactions (subset). */
export interface SnapCreateRequest {
  transaction_details: { order_id: string; gross_amount: number };
  customer_details?: {
    first_name?: string;
    phone?: string;
  };
  item_details?: Array<{
    id: string; price: number; quantity: number; name: string;
  }>;
  expiry?: { duration: number; unit: "seconds" | "minutes" | "hours" | "days" };
}
export interface SnapCreateResponse {
  token: string;
  redirect_url: string;
}
/** The Midtrans API call, abstracted so tests can inject a mock. */
export type SnapCreateFn = (req: SnapCreateRequest) => Promise<SnapCreateResponse>;

export type InitiateTopupResult =
  | {
      ok: true;
      intent_id: string;
      midtrans_order_id: string;
      amount_idr: number;
      snap_token: string;
      snap_redirect_url: string;
    }
  | { ok: false; error: string; status: number };

const MAX_OPEN_INTENTS_PER_PROVIDER = 3;
const RATE_LIMIT_WINDOW_MINUTES = 60;
const MAX_INTENTS_PER_HOUR = 10;

export async function initiateTopup(input: {
  pool: pg.Pool;
  learnerRef: string;
  amountIdr: number;
  snapCreate: SnapCreateFn;
  /** Optional prefix so tests can tag intents; default "nex-topup-". */
  orderIdPrefix?: string;
}): Promise<InitiateTopupResult> {
  const { pool, learnerRef, amountIdr, snapCreate } = input;
  const orderIdPrefix = input.orderIdPrefix ?? "nex-topup-";

  if (!isApprovedTier(amountIdr)) {
    return {
      ok: false,
      error: `amount_idr must be one of ${APPROVED_TOPUP_TIERS.join(", ")}`,
      status: 400,
    };
  }

  const client = await pool.connect();
  try {
    // Resolve provider
    const { rows: pRows } = await client.query(
      `SELECT provider_id, full_name FROM nex.provider_profile WHERE learner_ref = $1 LIMIT 1`,
      [learnerRef],
    );
    if (pRows.length === 0) {
      return { ok: false, error: "provider not found for this learner_ref", status: 404 };
    }
    const provider_id = pRows[0].provider_id as string;
    const provider_name = (pRows[0].full_name as string | null) ?? null;

    // Rate limits
    const { rows: rateRows } = await client.query(
      `SELECT
         COUNT(*) FILTER (WHERE state = 'pending')::int                          AS open_pending,
         COUNT(*) FILTER (WHERE created_at > now() - interval '1 hour')::int     AS attempts_hour
       FROM nex.provider_topup_intent
       WHERE provider_id = $1`,
      [provider_id],
    );
    const openPending = Number(rateRows[0].open_pending ?? 0);
    const attemptsHour = Number(rateRows[0].attempts_hour ?? 0);
    if (openPending >= MAX_OPEN_INTENTS_PER_PROVIDER) {
      return {
        ok: false,
        error: `too many open pending intents (${openPending}) — finish or wait for expiry`,
        status: 429,
      };
    }
    if (attemptsHour >= MAX_INTENTS_PER_HOUR) {
      return {
        ok: false,
        error: `rate limit: ${MAX_INTENTS_PER_HOUR} top-up attempts per ${RATE_LIMIT_WINDOW_MINUTES} min`,
        status: 429,
      };
    }

    // Fresh order_id
    const orderId = orderIdPrefix + cryptoRandomUuid();

    // Insert intent (idempotency root; DB will reject duplicate order_id)
    const { rows: iRows } = await client.query(
      `INSERT INTO nex.provider_topup_intent
         (provider_id, amount_idr, midtrans_order_id, state)
       VALUES ($1, $2, $3, 'pending')
       RETURNING intent_id`,
      [provider_id, amountIdr, orderId],
    );
    const intent_id = iRows[0].intent_id as string;

    // Call Midtrans (INJECTED · tests pass a mock)
    let snap: SnapCreateResponse;
    try {
      snap = await snapCreate({
        transaction_details: { order_id: orderId, gross_amount: amountIdr },
        customer_details: {
          first_name: provider_name ?? "NEX Provider",
        },
        item_details: [{
          id: "nex-wallet-topup",
          price: amountIdr,
          quantity: 1,
          name: `NEX wallet top-up · Rp ${amountIdr.toLocaleString("id-ID")}`,
        }],
        expiry: { duration: 30, unit: "minutes" },
      });
    } catch (err) {
      // Midtrans failed · leave intent as 'pending' so a retry can attach.
      // Rate limit will eventually purge or admin can reconcile.
      return {
        ok: false,
        error: err instanceof Error ? `midtrans_snap_create_failed: ${err.message}` : "midtrans_snap_create_failed",
        status: 502,
      };
    }

    // Update intent with Snap fields
    await client.query(
      `UPDATE nex.provider_topup_intent
       SET snap_token = $2, snap_redirect_url = $3, updated_at = now()
       WHERE intent_id = $1`,
      [intent_id, snap.token, snap.redirect_url],
    );

    return {
      ok: true,
      intent_id,
      midtrans_order_id: orderId,
      amount_idr: amountIdr,
      snap_token: snap.token,
      snap_redirect_url: snap.redirect_url,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      status: 500,
    };
  } finally {
    client.release();
  }
}

// Local UUID v4 helper · Node 20+ has crypto.randomUUID globally.
function cryptoRandomUuid(): string {
  return (globalThis.crypto?.randomUUID?.() ??
    // Fallback for older runtimes; still random, still uniquely-shaped.
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`);
}
