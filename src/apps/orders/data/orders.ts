// Orders App — fixture orders for Week 5 demo.
//
// Extended 2026-07-11 with escrow details on qualifying orders (Trade
// Center Guaranteed via Stripe Connect delayed payout for £100+, via
// Shieldpay escrow for £5,000+).

import type { Order } from "../types";

const now = Date.now();
const daysAgo = (n: number) => now - n * 24 * 60 * 60 * 1000;
const daysAhead = (n: number) => now + n * 24 * 60 * 60 * 1000;
const isoDaysAgo = (n: number) => new Date(daysAgo(n)).toISOString();
const isoDaysAhead = (n: number) => new Date(daysAhead(n)).toISOString();

export const ORDER_FIXTURES: Order[] = [
  {
    id: "ord_20260710_001",
    merchantSlug: "manchester-tools-direct",
    status: "dispatched",
    placedAt: daysAgo(1),
    confirmedDeliveryAt: daysAhead(0),
    itemCount: 3,
    subtotalGbp: 84,
    deliveryGbp: 0,
    totalGbp: 84,
    itemsSummary: "Marshalltown trowel + OX hawk + hard hat",
    trackingRef: "DPD-04872-M"
  },
  {
    id: "ord_20260709_042",
    merchantSlug: "leeds-builders-supplies",
    status: "delivered",
    placedAt: daysAgo(3),
    confirmedDeliveryAt: daysAgo(1),
    itemCount: 12,
    subtotalGbp: 156,
    deliveryGbp: 8,
    totalGbp: 164,
    itemsSummary: "2PC trowel set × 4 · Skimming blade × 2",
    trackingRef: "PNP-33291"
  },
  {
    id: "ord_20260711_007",
    merchantSlug: "glasgow-scaffolding-co",
    status: "accepted",
    placedAt: daysAgo(0),
    requestedDeliveryAt: daysAhead(2),
    itemCount: 40,
    subtotalGbp: 848,
    deliveryGbp: 60,
    totalGbp: 908,
    itemsSummary: "40 × scaffold tube 4m",
    escrow: {
      status: "funds-held",
      provider: "stripe-connect-delayed-payout",
      fundsHeldGbp: 908,
      fundsHeldAtIso: isoDaysAgo(0)
    }
  },
  {
    id: "ord_20260711_008",
    merchantSlug: "brighton-tile-warehouse",
    status: "placed",
    placedAt: daysAgo(0),
    itemCount: 8,
    subtotalGbp: 24,
    deliveryGbp: 0,
    totalGbp: 24,
    itemsSummary: "PVC corner beads × 8"
  },
  // ─── Additional escrow-flow fixtures ────────────────────────────
  {
    id: "ord_20260706_215",
    merchantSlug: "manchester-tools-direct",
    status: "delivered",
    placedAt: daysAgo(6),
    confirmedDeliveryAt: daysAgo(2),
    itemCount: 6,
    subtotalGbp: 264,
    deliveryGbp: 0,
    totalGbp: 264,
    itemsSummary: "3 × Marshalltown trowel + 3 × OX hawk",
    trackingRef: "DPD-51234-M",
    escrow: {
      status: "release-scheduled",
      provider: "stripe-connect-delayed-payout",
      fundsHeldGbp: 264,
      fundsHeldAtIso: isoDaysAgo(6),
      deliveryConfirmedAtIso: isoDaysAgo(2),
      autoReleaseAtIso: isoDaysAhead(12)
    }
  },
  {
    id: "ord_20260624_198",
    merchantSlug: "leeds-builders-supplies",
    status: "delivered",
    placedAt: daysAgo(17),
    confirmedDeliveryAt: daysAgo(14),
    itemCount: 45,
    subtotalGbp: 6420,
    deliveryGbp: 120,
    totalGbp: 6540,
    itemsSummary: "45 × plasterboard 12.5mm 2400×1200 · pallet delivery",
    trackingRef: "SHIELDPAY-M42918",
    escrow: {
      status: "disputed",
      provider: "shieldpay-escrow",
      fundsHeldGbp: 6540,
      fundsHeldAtIso: isoDaysAgo(17),
      deliveryConfirmedAtIso: isoDaysAgo(14),
      dispute: {
        raisedByRole: "buyer",
        raisedAtIso: isoDaysAgo(12),
        reason: "6 sheets damaged in transit — visible cracks",
        buyerStatement: "Pallet arrived on a broken pallet base. 6 sheets have cracks across the paper face, unusable for skim.",
        status: "under-review"
      }
    }
  }
];

export function findOrder(id: string): Order | undefined {
  return ORDER_FIXTURES.find((o) => o.id === id);
}

export function ordersByStatus(status: Order["status"]): Order[] {
  return ORDER_FIXTURES.filter((o) => o.status === status);
}

export function ordersArrivingWithin(hours: number): Order[] {
  const now = Date.now();
  const cutoff = now + hours * 60 * 60 * 1000;
  return ORDER_FIXTURES.filter(
    (o) =>
      (o.status === "dispatched" || o.status === "accepted") &&
      (o.confirmedDeliveryAt ?? o.requestedDeliveryAt ?? Infinity) <= cutoff
  );
}

export function searchOrdersFixture(q: string): Order[] {
  const query = q.toLowerCase().trim();
  if (!query) return [];
  return ORDER_FIXTURES.filter(
    (o) =>
      o.id.toLowerCase().includes(query) ||
      o.itemsSummary.toLowerCase().includes(query) ||
      (o.trackingRef?.toLowerCase().includes(query) ?? false)
  );
}
