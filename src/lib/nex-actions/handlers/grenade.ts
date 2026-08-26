// NEX Actions · grenade handler · F3 (2026-08-25).
//
// This runs INSIDE runNexAction() AFTER wallet has reserved the Sparks and
// permissions/rate-limit have passed. If this handler throws or returns
// { ok: false }, the runtime automatically refunds the reservation.
//
// Contract:
//   ctx.target       = { kind: "message", messageId, conversationId }  · required
//   ctx.user         = { id, displayName }                              · required
//   deps.walletTxnId = the wallet_transaction_id of the reservation     · passed
//                      via a WeakMap keyed by ctx (see runtime/deps.ts)
//
// Server-authority rules enforced INSIDE the SQL function:
//   · message must exist
//   · message must not already be deleted
//   · sender_id must match the actor
//   · conversation_id must match
//
// If ANY of those fail, the SQL function throws · this handler returns
// { ok: false, error } · runtime refunds Sparks · client shows a graceful
// failure state · animation never plays.

import { Pool } from "pg";
import type { NexActionContext, NexActionHandler, NexActionResult } from "../types";
import { getReservation } from "../runtime/reservation-store";

let _pool: Pool | null = null;
function pool(): Pool {
  if (_pool) return _pool;
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) throw new Error("NEX_POSTGRES_URL not set");
  _pool = new Pool({ connectionString: url, max: 5 });
  return _pool;
}

export const grenadeHandler: NexActionHandler = {
  key: "grenade",
  async execute(ctx: NexActionContext): Promise<NexActionResult> {
    if (!ctx.target || ctx.target.kind !== "message") {
      return {
        ok: false,
        error: {
          code: "handler-failed",
          message: "grenade requires ctx.target = { kind: 'message', messageId, conversationId }",
        },
      };
    }
    const reservation = getReservation(ctx);
    if (!reservation) {
      return {
        ok: false,
        error: {
          code: "handler-failed",
          message: "grenade: wallet reservation not found · runtime bypass?",
        },
      };
    }

    const client = await pool().connect();
    try {
      const r = await client.query(
        `SELECT * FROM nex.chat_message_grenade_delete($1, $2, $3, $4, $5)`,
        [
          ctx.target.messageId,
          ctx.target.conversationId,
          ctx.user.id,
          ctx.user.displayName,
          reservation.reservationId,
        ],
      );
      const row = r.rows[0];
      return {
        ok: true,
        kind: "message-deleted",
        messageId: row.message_id,
        historyLine: row.history_line,
      };
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      if (/does not own message/.test(msg)) {
        return { ok: false, error: { code: "forbidden", reason: "not-your-message" } };
      }
      if (/conversation mismatch/.test(msg)) {
        return { ok: false, error: { code: "forbidden", reason: "wrong-conversation" } };
      }
      if (/message .* not found/.test(msg)) {
        return { ok: false, error: { code: "handler-failed", message: "message-not-found" } };
      }
      if (/already deleted/.test(msg)) {
        return { ok: false, error: { code: "handler-failed", message: "already-deleted" } };
      }
      return { ok: false, error: { code: "handler-failed", message: msg } };
    } finally {
      client.release();
    }
  },
};
