// src/lib/nex-native/commerce-service.ts
//
// commerce-service · composite operations that couple an order state
// transition with the correct ledger entry.
//
// Doctrine:
//   · Commerce Ledger (Layer C) · every economic event is a balanced
//     double-entry · never Wallet
//   · Reversal-safe · refunds create compensating entries · never mutate
//     historical facts
//   · Anti-fabrication · amount is snapshotted from the order row · never
//     invented
//   · State machine trigger 007 rejects invalid transitions · this service
//     never bypasses it
//
// Account naming follows the existing NEX-native convention:
//   · customer_receivable  · asset · money owed to NEX by the customer
//                            side of the transaction
//   · business_revenue     · income · money owed by NEX to the merchant
//                            side of the transaction
//
// Both accounts are un-namespaced by identity — per-entity drill-down comes
// through the order_id FK on the ledger entry.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import * as orderService from "./order-service";
import * as ledgerService from "./ledger-service";
import type { NexOrderRow, NexUuid } from "./types";

/**
 * Composite: buyer-driven "I've sent payment" · transitions state=created
 * → pending. Offline-payment flow: buyer indicates money sent · seller
 * must still confirm receipt to move the order to `paid`. No ledger entry
 * yet — the commerce fact is not recognised until the seller confirms.
 *
 * Idempotent · already-pending (or later state) returns the current row
 * unchanged. Only `created` may transition here (state machine trigger
 * 007 enforces).
 */
export async function markOrderPending(
  orderId: NexUuid,
  actorAccountId: NexUuid | null,
  reason?: string
): Promise<NexOrderRow> {
  const existing = await orderService.getOrderById(orderId);
  if (!existing) throw new Error(`commerce-service.markOrderPending: order ${orderId} not found`);
  if (existing.state === "pending" || existing.state === "paid" ||
      existing.state === "completed" || existing.state === "refunded") {
    return existing;
  }
  return await orderService.transitionOrderState(orderId, "pending", actorAccountId, {
    from: existing.state,
    reason: reason ?? null,
  });
}

/**
 * Composite: transition an order to `paid` AND post the paid ledger entry.
 * Idempotent — if the order is already `paid` (or later state), no
 * duplicate ledger entry is posted. Refuses invalid transitions honestly
 * (the DB trigger will throw and we surface the message).
 *
 * Ledger entry shape:
 *   Debit customer_receivable   price_pence   currency
 *   Credit business_revenue     price_pence   currency
 *   linked to order_id
 */
export async function markOrderPaid(
  orderId: NexUuid,
  actorAccountId: NexUuid | null
): Promise<{ order: NexOrderRow; ledgerEntryId: NexUuid | null }> {
  const existing = await orderService.getOrderById(orderId);
  if (!existing) throw new Error(`commerce-service.markOrderPaid: order ${orderId} not found`);

  // Idempotency: already at or past paid · no double post
  const paidStates = new Set(["paid", "completed", "refunded"]);
  if (paidStates.has(existing.state)) {
    // Look up prior paid entry (if any) to return · never fabricate one
    const priorEntries = await ledgerService.listEntriesForOrder(orderId);
    const priorPaid = priorEntries.find((e) => e.reversal_of_entry_id === null && /paid/i.test(e.description));
    return { order: existing, ledgerEntryId: priorPaid?.id ?? null };
  }

  const updated = await orderService.transitionOrderState(orderId, "paid", actorAccountId, {
    from: existing.state,
  });

  const posted = await ledgerService.postEntry({
    order_id: orderId,
    description: `Order ${orderId.slice(0, 8)} · paid`,
    lines: [
      {
        account: "customer_receivable",
        debit_pence: updated.price_pence,
        credit_pence: 0,
        currency: updated.currency,
      },
      {
        account: "business_revenue",
        debit_pence: 0,
        credit_pence: updated.price_pence,
        currency: updated.currency,
      },
    ],
  });

  return { order: updated, ledgerEntryId: posted.entry.id };
}

/**
 * Composite: transition an order to `completed`. No new ledger entry — the
 * commerce fact was recognised at `paid`. This just records fulfilment.
 * Idempotent · already-completed returns the current row unchanged.
 */
export async function markOrderCompleted(
  orderId: NexUuid,
  actorAccountId: NexUuid | null
): Promise<NexOrderRow> {
  const existing = await orderService.getOrderById(orderId);
  if (!existing) throw new Error(`commerce-service.markOrderCompleted: order ${orderId} not found`);
  if (existing.state === "completed" || existing.state === "refunded") return existing;
  return await orderService.transitionOrderState(orderId, "completed", actorAccountId, {
    from: existing.state,
  });
}

/**
 * Composite: transition an order to `cancelled`. Only valid from `created`
 * or `pending` (pre-payment). No ledger entry — no commerce fact yet.
 * Idempotent · already-cancelled returns the current row unchanged.
 */
export async function cancelOrder(
  orderId: NexUuid,
  actorAccountId: NexUuid | null,
  reason?: string
): Promise<NexOrderRow> {
  const existing = await orderService.getOrderById(orderId);
  if (!existing) throw new Error(`commerce-service.cancelOrder: order ${orderId} not found`);
  if (existing.state === "cancelled") return existing;
  return await orderService.transitionOrderState(orderId, "cancelled", actorAccountId, {
    from: existing.state,
    reason: reason ?? null,
  });
}

/**
 * Composite: transition an order to `refunded` AND post a reversal of the
 * prior paid ledger entry. If no prior paid entry exists (e.g. transition
 * was created→cancelled), no reversal is posted — but the state machine
 * won't allow refunded from cancelled anyway, so this is defence-in-depth.
 *
 * Idempotent · already-refunded returns the current row and looks up the
 * prior reversal entry (if any) without posting a new one.
 */
export async function refundOrder(
  orderId: NexUuid,
  actorAccountId: NexUuid | null,
  reason?: string
): Promise<{ order: NexOrderRow; reversalEntryId: NexUuid | null }> {
  const existing = await orderService.getOrderById(orderId);
  if (!existing) throw new Error(`commerce-service.refundOrder: order ${orderId} not found`);

  if (existing.state === "refunded") {
    // Look up prior reversal · never fabricate
    const entries = await ledgerService.listEntriesForOrder(orderId);
    const priorReversal = entries.find((e) => e.reversal_of_entry_id !== null);
    return { order: existing, reversalEntryId: priorReversal?.id ?? null };
  }

  // Find the paid entry to reverse
  const priorEntries = await ledgerService.listEntriesForOrder(orderId);
  const priorPaid = priorEntries.find((e) => e.reversal_of_entry_id === null && /paid/i.test(e.description));

  const updated = await orderService.transitionOrderState(orderId, "refunded", actorAccountId, {
    from: existing.state,
    reason: reason ?? null,
  });

  let reversalEntryId: NexUuid | null = null;
  if (priorPaid) {
    const reversal = await ledgerService.reverseEntry(
      priorPaid.id,
      `Order ${orderId.slice(0, 8)} · refunded${reason ? ` · ${reason}` : ""}`
    );
    reversalEntryId = reversal.entry.id;
  }

  return { order: updated, reversalEntryId };
}

// Re-export the type for callers.
export type { NexOrderRow };

/** Utility · check nex_ledger_entry service-role access is working. */
export function isAvailable(): boolean {
  return Boolean(nexSupabaseAdmin);
}
