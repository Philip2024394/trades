// src/lib/nex-mobility/complete-request.ts · Philip 2026-08-29
//
// Extracted transactional core of POST /api/nex/service-request/[id]/complete.
// HTTP route handler is a thin adapter around this. Tests exercise this
// directly for idempotency, wallet threshold, allowance consumption, and
// price-lock semantics.
//
// Doctrine locks respected here:
//   · Lock 37/38 · NEX takes 8% of price_agreed_idr, deducted from provider
//                   wallet, never charged to the customer
//   · Lock 39    · First MONTHLY_FREE_ALLOWANCE completed requests per
//                   calendar month carry no network fee
//   · Lock 43    · price_agreed_idr is the immutable financial truth
//   · Lock 44    · Every wallet change writes an immutable ledger row
//
// Idempotency: the SELECT ... FOR UPDATE on the request row + the state ==
// 'COMPLETED' check make repeated calls safe. A second call on an already-
// completed request returns { ok: false, error: 'already_completed', 409 }
// without deducting the wallet again or writing a new ledger row.

import type pg from "pg";
import { calcNetworkFee, MONTHLY_FREE_ALLOWANCE } from "./fee";

export type CompleteRequestResult =
  | {
      ok: true;
      request_id: string;
      state: "COMPLETED";
      network_fee_idr: number;
      was_free_allowance: boolean;
      free_requests_used_this_month_after: number;
      free_requests_remaining_this_month: number;
    }
  | { ok: false; error: string; status: number };

export async function completeRequest(input: {
  pool: pg.Pool;
  requestId: string;
}): Promise<CompleteRequestResult> {
  const { pool, requestId } = input;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: rows0 } = await client.query(
      `SELECT provider_id, price_agreed_idr, state
       FROM nex.service_request
       WHERE request_id = $1
       FOR UPDATE`,
      [requestId],
    );
    if (rows0.length === 0) {
      await client.query("ROLLBACK");
      return { ok: false, error: "request not found", status: 404 };
    }
    const { provider_id, price_agreed_idr, state } = rows0[0];

    if (state === "COMPLETED") {
      await client.query("ROLLBACK");
      return { ok: false, error: "already_completed", status: 409 };
    }
    if (!provider_id || price_agreed_idr == null) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        error: "request_missing_provider_or_price",
        status: 409,
      };
    }

    // How many completed requests this month already? · Lock 39
    // The SELECT is inside the same transaction as the UPDATE that inserts
    // this completion, so the count is stable for our decision.
    const { rows: countRows } = await client.query(
      `SELECT COUNT(*)::int AS n
       FROM nex.service_request
       WHERE provider_id = $1
         AND state = 'COMPLETED'
         AND completed_at >= date_trunc('month', now())`,
      [provider_id],
    );
    const free_used = countRows[0].n as number;
    const is_free = free_used < MONTHLY_FREE_ALLOWANCE;

    const network_fee_idr = is_free
      ? 0
      : calcNetworkFee(Number(price_agreed_idr));

    if (network_fee_idr > 0) {
      const { rows: walletRows } = await client.query(
        `SELECT balance_idr FROM nex.provider_wallet WHERE provider_id = $1 FOR UPDATE`,
        [provider_id],
      );
      const currentBalance = walletRows[0]?.balance_idr ?? 0;

      if (currentBalance < network_fee_idr) {
        // Provider slipped past the eligibility gate · never abandon the
        // customer's completed service · complete + flag for review.
        await client.query(
          `INSERT INTO nex.provider_wallet_transaction
             (provider_id, kind, amount_idr, balance_after_idr, related_request_id, note)
           VALUES ($1, 'adjustment', 0, $2, $3, $4)`,
          [
            provider_id, currentBalance, requestId,
            `WALLET_UNDERFUNDED · fee=${network_fee_idr} balance=${currentBalance} · flagged for review`,
          ],
        );
      } else {
        const newBalance = currentBalance - network_fee_idr;
        await client.query(
          `UPDATE nex.provider_wallet
           SET balance_idr = $2, updated_at = now()
           WHERE provider_id = $1`,
          [provider_id, newBalance],
        );
        await client.query(
          `INSERT INTO nex.provider_wallet_transaction
             (provider_id, kind, amount_idr, balance_after_idr, related_request_id, note)
           VALUES ($1, 'network_fee', $2, $3, $4, $5)`,
          [
            provider_id, -network_fee_idr, newBalance, requestId,
            `NEX network fee 8% of Rp ${price_agreed_idr}`,
          ],
        );
      }
    }

    await client.query(
      `UPDATE nex.service_request
       SET state = 'COMPLETED',
           state_entered_at = now(),
           completed_at = now(),
           network_fee_idr = $2,
           was_free_allowance = $3,
           network_fee_deducted_at = CASE WHEN $2 > 0 THEN now() ELSE NULL END,
           updated_at = now()
       WHERE request_id = $1`,
      [requestId, network_fee_idr, is_free],
    );

    await client.query("COMMIT");

    return {
      ok: true,
      request_id: requestId,
      state: "COMPLETED",
      network_fee_idr,
      was_free_allowance: is_free,
      free_requests_used_this_month_after: free_used + 1,
      free_requests_remaining_this_month: Math.max(
        0, MONTHLY_FREE_ALLOWANCE - (free_used + 1),
      ),
    };
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      status: 500,
    };
  } finally {
    client.release();
  }
}
