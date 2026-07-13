// Merchant orders needing attention — new / disputed / release-scheduled.
// Compact rows with one-tap actions to the escrow surface.

import Link from "next/link";
import { ArrowRight, ShoppingBag, ShieldAlert, Clock, CheckCircle2 } from "lucide-react";
import { ORDER_FIXTURES } from "@/apps/orders/data/orders";
import type { Order } from "@/apps/orders/types";

type Props = {
  merchantSlug: string;
};

function statusVisuals(order: Order) {
  const escrow = order.escrow?.status;
  if (escrow === "disputed") {
    return { label: "Dispute open", bg: "#FEE2E2", fg: "#B91C1C", Icon: ShieldAlert };
  }
  if (escrow === "funds-held") {
    return { label: "Funds held — ship it", bg: "#FEF3C7", fg: "#B45309", Icon: Clock };
  }
  if (escrow === "release-scheduled") {
    return { label: "Release scheduled", bg: "#DBEAFE", fg: "#1E40AF", Icon: Clock };
  }
  if (order.status === "placed") {
    return { label: "New — accept order", bg: "#F5F0E4", fg: "#525252", Icon: ShoppingBag };
  }
  if (order.status === "accepted") {
    return { label: "Accepted — dispatch", bg: "#DBEAFE", fg: "#1E40AF", Icon: ShoppingBag };
  }
  return { label: "Complete", bg: "#DCFCE7", fg: "#166534", Icon: CheckCircle2 };
}

export function MerchantOrdersPanel({ merchantSlug }: Props) {
  const orders = ORDER_FIXTURES.filter((o) => o.merchantSlug === merchantSlug)
    .sort((a, b) => b.placedAt - a.placedAt);

  return (
    <section
      className="rounded-2xl border bg-white p-5 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <header className="mb-3 flex items-center justify-between">
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
          Orders — {orders.length}
        </div>
        <Link
          href="/tc/orders"
          className="text-[10px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
        >
          View all →
        </Link>
      </header>

      {orders.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed p-6 text-center text-[11.5px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.20)" }}>
          No orders yet. Publish more products or share your merchant page.
        </div>
      ) : (
        <ul className="flex flex-col divide-y" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          {orders.map((o) => {
            const v = statusVisuals(o);
            return (
              <li key={o.id}>
                <Link
                  href={`/tc/orders/${o.id}`}
                  className="flex min-h-[64px] items-center gap-3 py-2 pl-1 transition hover:bg-neutral-50"
                >
                  <span
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: v.bg, color: v.fg }}
                  >
                    <v.Icon size={14} strokeWidth={2}/>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-[12px] font-black text-neutral-900">
                      {o.itemsSummary}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10.5px] text-neutral-600">
                      <span
                        className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider"
                        style={{ backgroundColor: v.bg, color: v.fg }}
                      >
                        {v.label}
                      </span>
                      <span>£{o.totalGbp}</span>
                    </div>
                  </div>
                  <ArrowRight size={13} className="flex-shrink-0 text-neutral-400"/>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
