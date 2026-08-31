// src/lib/nex-midtrans/handle-webhook.ts · Philip 2026-08-29
//
// Transactional core of POST /api/nex/provider/wallet/topup/webhook.
//
// Authoritative payment result path. Every wallet credit flows through
// this function. The route handler is a thin adapter that reads the raw
// body + calls this.
//
// Guarantees (proven by integration tests in Phase 4e):
//   · Signature-verified — forged webhooks return 403 with no state change
//   · Amount-checked   — payload.gross_amount must match intent.amount_idr
//   · Idempotent       — duplicate webhooks are 200 no-op
//   · Wallet credit at most once per intent (app-level FOR UPDATE lock +
//     DB-level partial unique index from migration 141 as backstop)
//   · Customer-service integrity: we never abandon a completed request for
//     a wallet-credit anomaly · out-of-band ledger flag instead
//
// Design report §3 · Midtrans docs verified 2026-04-28.

import type pg from "pg";
import { verifyMidtransSignature } from "./signature";

/** Raw Midtrans webhook body (relevant fields). Extra keys are ignored. */
export interface MidtransWebhookBody {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  transaction_id?: string;
  payment_type?: string;
  fraud_status?: string;
  [k: string]: unknown;
}

export type WebhookOutcome =
  | { ok: true; result: "credited";     intent_id: string; new_balance_idr: number }
  | { ok: true; result: "already_paid"; intent_id: string; new_balance_idr: number }
  | { ok: true; result: "state_updated"; intent_id: string; new_state: string }
  | { ok: false; error: string; status: number };

// Midtrans status → intent.state (per design report §3 table)
type IntentTerminalState = "paid" | "denied" | "cancelled" | "expired" | "failed";
type IntentState = "pending" | IntentTerminalState;

function classifyPaymentResult(
  transaction_status: string,
  fraud_status: string | undefined,
): { credit: boolean; nextState: IntentState } {
  const fs = (fraud_status ?? "").toLowerCase();
  const ts = transaction_status.toLowerCase();
  // Money-received rule (Midtrans docs verified 2026-04-28)
  if (ts === "settlement")             return { credit: true, nextState: "paid" };
  if (ts === "capture" && fs === "accept") return { credit: true, nextState: "paid" };
  if (ts === "capture" && fs === "deny")   return { credit: false, nextState: "denied" };
  if (ts === "pending")                return { credit: false, nextState: "pending" };
  if (ts === "authorize")              return { credit: false, nextState: "pending" };
  if (ts === "deny")                   return { credit: false, nextState: "denied" };
  if (ts === "cancel")                 return { credit: false, nextState: "cancelled" };
  if (ts === "expire")                 return { credit: false, nextState: "expired" };
  if (ts === "failure")                return { credit: false, nextState: "failed" };
  if (ts === "refund" || ts === "partial_refund")
    return { credit: false, nextState: "paid" }; // v2 · refund flow deferred
  // Unknown status · treat as pending to avoid premature terminal state
  return { credit: false, nextState: "pending" };
}

const TERMINAL_STATES = new Set(["paid", "denied", "cancelled", "expired", "failed"]);

export async function handleMidtransWebhook(input: {
  pool: pg.Pool;
  serverKey: string;
  body: MidtransWebhookBody;
}): Promise<WebhookOutcome> {
  const { pool, serverKey, body } = input;

  // 1. Signature verification (BEFORE opening a transaction · fail-fast)
  const signatureOk = verifyMidtransSignature({
    order_id: body.order_id,
    status_code: body.status_code,
    gross_amount: body.gross_amount,
    server_key: serverKey,
    signature_key: body.signature_key,
  });
  if (!signatureOk) {
    return { ok: false, error: "signature_invalid", status: 403 };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 2. Lock the intent row
    const { rows: iRows } = await client.query(
      `SELECT intent_id, provider_id, amount_idr, state, credited_at
       FROM nex.provider_topup_intent
       WHERE midtrans_order_id = $1
       FOR UPDATE`,
      [body.order_id],
    );
    if (iRows.length === 0) {
      await client.query("ROLLBACK");
      return { ok: false, error: "intent_not_found", status: 404 };
    }
    const intent = iRows[0] as {
      intent_id: string;
      provider_id: string;
      amount_idr: number;
      state: string;
      credited_at: Date | null;
    };

    // 3. Amount check (server-side)
    const grossParsed = parseInt(body.gross_amount, 10); // "50000.00" → 50000
    if (Number(intent.amount_idr) !== grossParsed) {
      // Amount tampering · record last_webhook_status but do NOT credit
      await client.query(
        `UPDATE nex.provider_topup_intent
         SET last_webhook_at = now(),
             last_webhook_status = 'amount_mismatch',
             updated_at = now()
         WHERE intent_id = $1`,
        [intent.intent_id],
      );
      await client.query("COMMIT");
      return { ok: false, error: "amount_mismatch", status: 409 };
    }

    // 4. Classify by status
    const { credit, nextState } = classifyPaymentResult(
      body.transaction_status,
      body.fraud_status,
    );

    // 5. Idempotency · if intent is already in a terminal state matching
    //    this webhook's classification, or already paid, this is a
    //    duplicate delivery — no-op with 200.
    if (intent.state === "paid" && credit) {
      // Read current wallet balance for the response payload
      const { rows: wRows } = await client.query(
        `SELECT balance_idr FROM nex.provider_wallet WHERE provider_id = $1`,
        [intent.provider_id],
      );
      const bal = Number(wRows[0]?.balance_idr ?? 0);
      await client.query(
        `UPDATE nex.provider_topup_intent
         SET last_webhook_at = now(), last_webhook_status = $2, updated_at = now()
         WHERE intent_id = $1`,
        [intent.intent_id, body.transaction_status],
      );
      await client.query("COMMIT");
      return {
        ok: true, result: "already_paid",
        intent_id: intent.intent_id, new_balance_idr: bal,
      };
    }
    if (TERMINAL_STATES.has(intent.state) && !credit) {
      // Duplicate terminal-fail webhook · no-op
      await client.query(
        `UPDATE nex.provider_topup_intent
         SET last_webhook_at = now(), last_webhook_status = $2, updated_at = now()
         WHERE intent_id = $1`,
        [intent.intent_id, body.transaction_status],
      );
      await client.query("COMMIT");
      return {
        ok: true, result: "state_updated",
        intent_id: intent.intent_id, new_state: intent.state,
      };
    }

    // 6. Apply the state transition
    if (credit) {
      // Ensure wallet row exists · then lock + credit
      await client.query(
        `INSERT INTO nex.provider_wallet (provider_id, balance_idr)
         VALUES ($1, 0) ON CONFLICT (provider_id) DO NOTHING`,
        [intent.provider_id],
      );
      const { rows: wRows } = await client.query(
        `SELECT balance_idr FROM nex.provider_wallet WHERE provider_id = $1 FOR UPDATE`,
        [intent.provider_id],
      );
      const currentBalance = Number(wRows[0]?.balance_idr ?? 0);
      const newBalance = currentBalance + Number(intent.amount_idr);

      await client.query(
        `UPDATE nex.provider_wallet
         SET balance_idr = $2, updated_at = now()
         WHERE provider_id = $1`,
        [intent.provider_id, newBalance],
      );
      // DB backstop (migration 141 partial UNIQUE) makes duplicate insert impossible
      await client.query(
        `INSERT INTO nex.provider_wallet_transaction
           (provider_id, kind, amount_idr, balance_after_idr,
            related_topup_intent_id, note)
         VALUES ($1, 'topup', $2, $3, $4, $5)`,
        [
          intent.provider_id, intent.amount_idr, newBalance, intent.intent_id,
          `Midtrans top-up · order_id ${body.order_id} · ${body.payment_type ?? "unknown"}`,
        ],
      );
      await client.query(
        `UPDATE nex.provider_topup_intent
         SET state = 'paid',
             midtrans_transaction_id = $2,
             midtrans_payment_type   = $3,
             last_webhook_at         = now(),
             last_webhook_status     = $4,
             credited_at             = now(),
             updated_at              = now()
         WHERE intent_id = $1`,
        [
          intent.intent_id,
          body.transaction_id ?? null,
          body.payment_type ?? null,
          body.transaction_status,
        ],
      );
      await client.query("COMMIT");
      return {
        ok: true, result: "credited",
        intent_id: intent.intent_id, new_balance_idr: newBalance,
      };
    }

    // Non-credit state (pending → pending, or fail-terminal)
    await client.query(
      `UPDATE nex.provider_topup_intent
       SET state = $2,
           last_webhook_at = now(),
           last_webhook_status = $3,
           updated_at = now()
       WHERE intent_id = $1`,
      [intent.intent_id, nextState, body.transaction_status],
    );
    await client.query("COMMIT");
    return {
      ok: true, result: "state_updated",
      intent_id: intent.intent_id, new_state: nextState,
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
