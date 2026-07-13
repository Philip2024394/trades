// /tc/orders — Orders kanban.
//
// Redesigned 2026-07-11 in the warm cream + amber + black + yellow
// palette to match the Yard / landing page. Blue and green kept minimal
// — only ever on the escrow status pill on the actual card, never as
// column backgrounds or big blocks.

import Link from "next/link";
import {
  ShieldCheck,
  Package,
  Truck,
  Clock,
  CheckCircle2,
  ArrowRight
} from "lucide-react";
import { bootstrapPlatform } from "@/platform/bootstrap";
import { MarketplaceHeader } from "@/apps/marketplace/components/MarketplaceHeader";
import { ORDER_FIXTURES, ordersByStatus } from "@/apps/orders/data/orders";
import { MERCHANT_FIXTURES } from "@/apps/marketplace/data/merchants";
import type { Order } from "@/apps/orders/types";

bootstrapPlatform();

export const dynamic = "force-dynamic";

// Column config — every column uses cream/amber tones. The visual
// difference between columns is the numbered chevron on the left and
// the icon in the column header, NOT background colour.
const COLUMNS: Array<{
  status: Order["status"];
  label: string;
  Icon: typeof Package;
  stageNumber: number;
}> = [
  { status: "placed",     label: "Placed",     Icon: Package,      stageNumber: 1 },
  { status: "accepted",   label: "Accepted",   Icon: Clock,        stageNumber: 2 },
  { status: "dispatched", label: "Dispatched", Icon: Truck,        stageNumber: 3 },
  { status: "delivered",  label: "Delivered",  Icon: CheckCircle2, stageNumber: 4 }
];

function merchantName(slug: string): string {
  return MERCHANT_FIXTURES.find((m) => m.slug === slug)?.displayName ?? slug;
}

function merchantInitials(slug: string): string {
  return MERCHANT_FIXTURES.find((m) => m.slug === slug)?.logoInitials ?? "?";
}

function etaLabel(order: Order): string {
  const at = order.confirmedDeliveryAt ?? order.requestedDeliveryAt;
  if (!at) return "";
  const diff = at - Date.now();
  const hours = Math.round(diff / (1000 * 60 * 60));
  if (order.status === "delivered") return "Delivered";
  if (hours < 0) return `${Math.abs(hours)}h ago`;
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.round(hours / 24)}d`;
}

function escrowMicroLabel(order: Order): { label: string; bg: string; fg: string } | null {
  const s = order.escrow?.status;
  if (!s) return null;
  switch (s) {
    case "funds-held":         return { label: "Held", bg: "#FEF3C7", fg: "#78350F" };
    case "release-scheduled":  return { label: "Release scheduled", bg: "#FFEDD5", fg: "#7C2D12" };
    case "released":           return { label: "Released", bg: "#F5F0E4", fg: "#525252" };
    case "disputed":           return { label: "Dispute open", bg: "#FEE2E2", fg: "#B91C1C" };
    case "refunded":           return { label: "Refunded", bg: "#F5F0E4", fg: "#525252" };
    default:                   return null;
  }
}

export default function OrdersPage() {
  const totalOrders = ORDER_FIXTURES.length;
  const totalValue = ORDER_FIXTURES.reduce((s, o) => s + o.totalGbp, 0);
  const guaranteedCount = ORDER_FIXTURES.filter((o) => o.escrow).length;

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <MarketplaceHeader activeCategorySlug={null}/>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6 md:py-8">
        {/* Header — black surface with yellow accent — matches landing page hero */}
        <section
          className="mb-6 overflow-hidden rounded-2xl border shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#0A0A0A" }}
        >
          <div className="p-5 md:p-6">
            <div className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: "#FFB300" }}>
              Trade Center · Orders
            </div>
            <h1 className="mt-1 text-[22px] font-black leading-tight text-white md:text-[26px]">
              Every purchase, tracked from placed to delivered.
            </h1>
            <p className="mt-2 text-[12px] leading-snug text-white/70">
              Ordered across four stages. Trade Center Guaranteed orders show a small pill on the card —
              you can jump into each order for the full escrow timeline.
            </p>

            {/* Summary strip — cream chips on the dark surface for warmth */}
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <SummaryChip label="Orders live" value={totalOrders.toString()}/>
              <SummaryChip label="Total value" value={`£${totalValue.toLocaleString()}`}/>
              <SummaryChip label="Guaranteed" value={guaranteedCount.toString()}/>
              <SummaryChip label="Stages" value={COLUMNS.length.toString()}/>
            </div>
          </div>
        </section>

        {/* Kanban — every column in cream / amber, warmth over blue-green */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((col) => {
            const orders = ordersByStatus(col.status);
            return (
              <section
                key={col.status}
                className="flex flex-col rounded-xl border shadow-sm"
                style={{
                  borderColor: "rgba(139,69,19,0.15)",
                  backgroundColor: "#F5F0E4"
                }}
              >
                {/* Column header */}
                <header
                  className="flex items-center justify-between border-b px-3 py-2.5"
                  style={{ borderColor: "rgba(139,69,19,0.10)" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black"
                      style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
                      aria-hidden
                    >
                      {col.stageNumber}
                    </span>
                    <col.Icon size={13} className="text-neutral-700"/>
                    <div className="text-[11px] font-black uppercase tracking-[0.14em] text-neutral-800">
                      {col.label}
                    </div>
                  </div>
                  <span
                    className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-neutral-700 shadow-sm"
                  >
                    {orders.length}
                  </span>
                </header>

                {/* Card list */}
                <ul className="flex flex-col gap-2 p-2">
                  {orders.length === 0 && (
                    <li
                      className="rounded-md border-2 border-dashed bg-white/70 p-3 text-center text-[10.5px] text-neutral-500"
                      style={{ borderColor: "rgba(139,69,19,0.15)" }}
                    >
                      Empty
                    </li>
                  )}
                  {orders.map((o) => {
                    const escrow = escrowMicroLabel(o);
                    return (
                      <li key={o.id}>
                        <Link
                          href={`/tc/orders/${o.id}`}
                          className="block overflow-hidden rounded-lg bg-white shadow-sm transition hover:shadow-md"
                        >
                          {/* Card body */}
                          <div className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div
                                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-black"
                                style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
                                aria-hidden
                              >
                                {merchantInitials(o.merchantSlug)}
                              </div>
                              {escrow && (
                                <span
                                  className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
                                  style={{ backgroundColor: escrow.bg, color: escrow.fg }}
                                  title="Trade Center Guaranteed status"
                                >
                                  <ShieldCheck size={9} strokeWidth={2.5}/>
                                  {escrow.label}
                                </span>
                              )}
                            </div>
                            <div className="mt-2 line-clamp-2 text-[12px] font-black leading-tight text-neutral-900">
                              {o.itemsSummary}
                            </div>
                            <div className="mt-1 text-[10.5px] text-neutral-500">
                              {merchantName(o.merchantSlug)}
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[10.5px]">
                              <span className="font-black text-neutral-900">£{o.totalGbp.toLocaleString()}</span>
                              <span className="text-neutral-500">{etaLabel(o)}</span>
                            </div>
                            {o.trackingRef && (
                              <div className="mt-1 truncate text-[9.5px] font-mono text-neutral-500">
                                {o.trackingRef}
                              </div>
                            )}
                          </div>
                          {/* Card footer — amber-tinted "view" strip */}
                          <div
                            className="flex items-center justify-end gap-1 border-t px-3 py-1.5 text-[9.5px] font-black uppercase tracking-wider text-neutral-700"
                            style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#FEF3C7" }}
                          >
                            View
                            <ArrowRight size={10}/>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        {/* Footer note */}
        <p className="mt-6 text-center text-[10.5px] text-neutral-500">
          Trade Center Guaranteed orders route funds through Stripe or Shieldpay depending on value.
          Trade Center never holds the money.
        </p>
      </main>
    </div>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{
        borderColor: "rgba(255,179,0,0.25)",
        backgroundColor: "rgba(255,179,0,0.08)"
      }}
    >
      <div className="text-[9.5px] font-black uppercase tracking-[0.14em]" style={{ color: "rgba(255,179,0,0.8)" }}>
        {label}
      </div>
      <div className="mt-0.5 text-[18px] font-black text-white">{value}</div>
    </div>
  );
}
