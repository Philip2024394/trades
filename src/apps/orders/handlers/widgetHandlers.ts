// Orders — widget handlers.

import { ordersArrivingWithin, ordersByStatus } from "../data/orders";
import { MERCHANT_FIXTURES } from "@/apps/marketplace/data/merchants";
import type { WidgetPayload } from "@/platform/widgets/runtime";
import type { Order } from "../types";

function merchantName(slug: string): string {
  return MERCHANT_FIXTURES.find((m) => m.slug === slug)?.displayName ?? slug;
}

function etaLabel(order: Order): string {
  const at = order.confirmedDeliveryAt ?? order.requestedDeliveryAt;
  if (!at) return "TBD";
  const diff = at - Date.now();
  const hours = Math.round(diff / (1000 * 60 * 60));
  if (hours <= 0) return "Today";
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

/** orders.arriving_today — dispatched or accepted orders arriving
 *  within the next 24 hours. */
export function arrivingTodayWidget(): WidgetPayload {
  const items = ordersArrivingWithin(24);
  if (items.length === 0) {
    return { emptyLabel: "No deliveries expected today." };
  }
  const total = items.reduce((sum, o) => sum + o.totalGbp, 0);
  return {
    headline: `${items.length} order${items.length === 1 ? "" : "s"} on the way.`,
    chips: [
      { kind: "eta", label: "Arriving", value: items.length },
      { kind: "money", label: "Total", value: `£${total.toLocaleString()}` }
    ],
    rows: items.slice(0, 4).map((o) => ({
      id: o.id,
      title: o.itemsSummary,
      subtitle: `${merchantName(o.merchantSlug)} · ${o.trackingRef ?? "no tracking yet"}`,
      trailing: etaLabel(o),
      href: `/tc/orders#${o.id}`
    })),
    href: "/tc/orders"
  };
}

/** orders.awaiting_confirmation — orders in placed status. */
export function awaitingConfirmationWidget(): WidgetPayload {
  const items = ordersByStatus("placed");
  if (items.length === 0) {
    return { emptyLabel: "Every order is confirmed." };
  }
  return {
    headline: `${items.length} order${items.length === 1 ? "" : "s"} waiting on merchant confirmation.`,
    chips: [{ kind: "warn", label: "Awaiting", value: items.length }],
    rows: items.slice(0, 3).map((o) => ({
      id: o.id,
      title: o.itemsSummary,
      subtitle: `${merchantName(o.merchantSlug)} · placed £${o.totalGbp}`,
      trailing: `${Math.round((Date.now() - o.placedAt) / (60 * 60 * 1000))}h ago`,
      href: `/tc/orders#${o.id}`
    })),
    href: "/tc/orders"
  };
}
