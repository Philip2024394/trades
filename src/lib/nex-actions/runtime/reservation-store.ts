// NEX Actions · per-context reservation store · F3 (2026-08-25).
//
// The wallet reserves Sparks during deps.wallet.require() · the handler
// needs the resulting reservation_id to link the deletion audit row back to
// the wallet transaction. We use a WeakMap keyed by the context object so
// the reservation is available to the handler for the lifetime of the
// action and GCs when the request ends.

import type { NexActionContext } from "../types";

export type ReservationRecord = {
  reservationId: string;
  idempotencyKey: string;
};

const STORE = new WeakMap<NexActionContext, ReservationRecord>();

export function setReservation(ctx: NexActionContext, rec: ReservationRecord): void {
  STORE.set(ctx, rec);
}
export function getReservation(ctx: NexActionContext): ReservationRecord | undefined {
  return STORE.get(ctx);
}
