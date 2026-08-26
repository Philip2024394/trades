// NEX Sparks · deps.wallet implementation for runNexAction() · F2 (2026-08-25).
//
// Adapts the wallet core library to the NexRuntimeDeps.wallet interface
// declared in ../runtime/run.ts. This is the ONLY place the runtime touches
// the wallet · handlers never call the wallet directly.
//
// Reservation lifecycle managed here:
//   require(action, ctx)  → reserveSpend()  · records reservation_id in a
//                                             per-request cache keyed by ctx
//   commit(action, ctx)   → commitSpend()   · looks up reservation_id
//   refund(action, ctx)   → refundSpend()   · looks up reservation_id
//
// The per-request cache lives in a WeakMap keyed by the context object so it
// GCs naturally after the request completes. It never crosses requests · a
// retried request generates a fresh idempotency key and hits the DB-level
// idempotency short-circuit if it collides with a prior in-flight attempt.

import { commitSpend, getBalance, refundSpend, reserveSpend } from "./index";
import { WalletError } from "./types";
import type { NexAction, NexActionContext } from "../types";
import { getReservation, setReservation } from "../runtime/reservation-store";

// Reservation persists in the shared per-context store so handlers can read
// the reservation_id when linking their audit rows back to wallet history.

// Idempotency key generator · deterministic per action attempt.
// Composed from: actionId + userId + invokedAt (ms) + a request-side nonce.
// The nonce is required so two attempts by the same user at the same ms
// (theoretically possible under retry) still generate distinct keys UNLESS
// they carry the SAME nonce (which is how the caller signals "same attempt").
function idempotencyKeyFor(action: NexAction, ctx: NexActionContext): string {
  const nonce = (ctx.clientPayload?.nonce as string | undefined) ?? String(ctx.invokedAt);
  return `spend_reserved:${action.id}:${ctx.user.id}:${nonce}`;
}

export const walletDeps = {
  async balance(userId: string): Promise<number> {
    const b = await getBalance(userId);
    return Number(b.balance);
  },

  async require(action: NexAction, ctx: NexActionContext): Promise<void> {
    if (action.tier !== "consumable") return;
    if (!action.cost?.sparks) {
      throw new WalletError(
        "invalid-amount",
        `Consumable action ${action.id} declared no Sparks cost`,
      );
    }
    const key = idempotencyKeyFor(action, ctx);
    try {
      const r = await reserveSpend(ctx.user.id, action.id, key);
      setReservation(ctx, { reservationId: r.reservationId, idempotencyKey: key });
    } catch (e) {
      if (e instanceof WalletError && e.code === "insufficient-sparks") {
        // Translate to the shape run.ts expects for NexActionError.
        throw {
          code: "insufficient-sparks" as const,
          required: action.cost.sparks,
          balance: (e.context?.required as number | undefined) ?? 0,
        };
      }
      throw e;
    }
  },

  async commit(action: NexAction, ctx: NexActionContext): Promise<void> {
    if (action.tier !== "consumable") return;
    const r = getReservation(ctx);
    if (!r) return; // no reservation recorded · nothing to commit
    const commitKey = `spend_committed:${r.reservationId}`;
    await commitSpend(ctx.user.id, r.reservationId, commitKey);
  },

  async refund(action: NexAction, ctx: NexActionContext): Promise<void> {
    if (action.tier !== "consumable") return;
    const r = getReservation(ctx);
    if (!r) return;
    const refundKey = `spend_refunded:${r.reservationId}`;
    await refundSpend(ctx.user.id, r.reservationId, refundKey);
  },
};
