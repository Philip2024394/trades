// Orders — AI tool handlers.

import { findOrder, ORDER_FIXTURES } from "../data/orders";
import { MERCHANT_FIXTURES } from "@/apps/tradecenter/data/merchants";
import type { Order } from "../types";

function decorate(order: Order) {
  const merchant = MERCHANT_FIXTURES.find((m) => m.slug === order.merchantSlug);
  return {
    id: order.id,
    status: order.status,
    itemCount: order.itemCount,
    itemsSummary: order.itemsSummary,
    totalGbp: order.totalGbp,
    trackingRef: order.trackingRef,
    merchant: merchant
      ? { slug: merchant.slug, name: merchant.displayName, city: merchant.homeCity }
      : null,
    placedAt: order.placedAt,
    eta: order.confirmedDeliveryAt ?? order.requestedDeliveryAt ?? null
  };
}

export function trackOrderTool(args: unknown): unknown {
  const orderId =
    typeof args === "object" && args && "orderId" in args
      ? String((args as Record<string, unknown>).orderId ?? "")
      : "";
  const order = findOrder(orderId);
  if (!order) return { error: `order-not-found:${orderId}` };
  return decorate(order);
}

export function listRecentTool(args: unknown): unknown {
  const limit =
    typeof args === "object" && args && "limit" in args
      ? Math.max(1, Math.min(50, Number((args as Record<string, unknown>).limit ?? 10)))
      : 10;
  return {
    orders: ORDER_FIXTURES
      .slice()
      .sort((a, b) => b.placedAt - a.placedAt)
      .slice(0, limit)
      .map(decorate)
  };
}

export function cancelOrderTool(args: unknown): unknown {
  const rec = (args ?? {}) as Record<string, unknown>;
  const orderId = String(rec.orderId ?? "");
  const order = findOrder(orderId);
  if (!order) return { outcome: "not-found", orderId };
  if (order.status !== "placed" && order.status !== "accepted") {
    return {
      outcome: "cannot-cancel",
      orderId,
      status: order.status,
      reason:
        "Only orders in status 'placed' or 'accepted' can be cancelled. The merchant must be contacted directly for later stages."
    };
  }
  return {
    outcome: "cancelled",
    orderId,
    previousStatus: order.status,
    note: rec.reason ?? null
  };
}
