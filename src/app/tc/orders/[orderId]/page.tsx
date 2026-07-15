// /tc/orders/[orderId] — single order view with escrow timeline + actions.

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import {
  ArrowLeft,
  Truck,
  Package,
  MessageSquare,
  Building2,
  Calendar
} from "lucide-react";
import { TradeCenterHeader } from "@/apps/tradecenter/components/TradeCenterHeader";
import { EscrowTimeline } from "@/apps/orders/components/EscrowTimeline";
import { OrderActions } from "@/apps/orders/components/OrderActions";
import { findOrder } from "@/apps/orders/data/orders";
import { findMerchant } from "@/apps/tradecenter/data/merchants";
import type { EscrowDetails } from "@/apps/orders/types";

const daysAheadIso = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
};

export default function OrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const seed = params?.orderId ? findOrder(params.orderId) : undefined;
  const [localEscrow, setLocalEscrow] = useState<EscrowDetails | undefined>(seed?.escrow);

  if (!seed) return notFound();
  const merchant = findMerchant(seed.merchantSlug);
  const merchantName = merchant?.displayName ?? seed.merchantSlug;
  const escrow = localEscrow ?? seed.escrow;

  const placed = useMemo(() => new Date(seed.placedAt), [seed.placedAt]);
  const eta = seed.confirmedDeliveryAt ?? seed.requestedDeliveryAt;

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <TradeCenterHeader activeCategorySlug={null}/>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 md:px-6 md:py-8">
        <Link
          href="/tc/orders"
          className="inline-flex min-h-[44px] items-center gap-2 text-[11.5px] font-bold text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft size={13}/>
          All orders
        </Link>

        {/* Header */}
        <header className="mt-3 mb-6 md:mb-8">
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Order · {seed.id}
          </div>
          <h1 className="mt-1 text-[22px] font-black leading-tight text-neutral-900 md:text-[28px]">
            {seed.itemsSummary}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-neutral-600">
            <span className="inline-flex items-center gap-1">
              <Building2 size={11}/> {merchantName}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar size={11}/>
              Placed {placed.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </span>
            {eta && (
              <span className="inline-flex items-center gap-1">
                <Truck size={11}/>
                {seed.status === "delivered" ? "Delivered" : "Expected"}
                {" "}
                {new Date(eta).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </span>
            )}
            {seed.trackingRef && (
              <span className="inline-flex items-center gap-1 font-mono">
                <Package size={11}/> {seed.trackingRef}
              </span>
            )}
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-5">
            {/* Summary card */}
            <section
              className="rounded-2xl border bg-white p-5 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
                Order summary
              </div>
              <ul className="mt-3 flex flex-col gap-2">
                <SummaryRow label="Subtotal" value={`£${seed.subtotalGbp}`}/>
                <SummaryRow label="Delivery" value={seed.deliveryGbp > 0 ? `£${seed.deliveryGbp}` : "Free"}/>
                <SummaryRow label="Total"    value={`£${seed.totalGbp}`} bold/>
                <SummaryRow label="Item count" value={`${seed.itemCount} items`}/>
              </ul>

              {merchant && (
                <div className="mt-4 flex items-center gap-3 rounded-lg border p-3" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-[11px] font-black"
                    style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
                  >
                    {merchant.logoInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-black text-neutral-900">{merchant.displayName}</div>
                    <div className="text-[10.5px] text-neutral-500">{merchant.homeCity}</div>
                  </div>
                  <Link
                    href={`/tc/messages?compose=${merchant.slug}`}
                    className="inline-flex min-h-[40px] items-center gap-1 rounded-full border bg-white px-4 text-[10.5px] font-black uppercase tracking-wider text-neutral-700 shadow-sm"
                    style={{ borderColor: "rgba(139,69,19,0.15)" }}
                  >
                    <MessageSquare size={12}/> Message
                  </Link>
                </div>
              )}
            </section>

            {/* Escrow timeline (if guaranteed) */}
            {escrow ? (
              <>
                <EscrowTimeline escrow={escrow} merchantName={merchantName}/>
                <OrderActions
                  escrow={escrow}
                  onConfirmDelivery={() => {
                    if (!escrow) return;
                    const nowIso = new Date().toISOString();
                    setLocalEscrow({
                      ...escrow,
                      status: "release-scheduled",
                      deliveryConfirmedAtIso: nowIso,
                      autoReleaseAtIso: daysAheadIso(14)
                    });
                  }}
                  onReleaseNow={() => {
                    if (!escrow) return;
                    setLocalEscrow({
                      ...escrow,
                      status: "released",
                      releasedAtIso: new Date().toISOString()
                    });
                  }}
                  onRaiseDispute={(reason, statement) => {
                    if (!escrow) return;
                    setLocalEscrow({
                      ...escrow,
                      status: "disputed",
                      dispute: {
                        raisedByRole: "buyer",
                        raisedAtIso: new Date().toISOString(),
                        reason,
                        buyerStatement: statement,
                        status: "under-review"
                      }
                    });
                  }}
                />
              </>
            ) : (
              <section
                className="rounded-2xl border bg-white p-5 shadow-sm"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
                  Standard checkout
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-neutral-700">
                  This order is below Trade Center Guaranteed threshold (£100). Payment settled
                  directly to the merchant. Refunds handled by the merchant if you raise a
                  problem — Trade Center arbitrates if needed.
                </p>
              </section>
            )}
          </div>

          <aside className="flex flex-col gap-4">
            <section
              className="rounded-2xl border bg-white p-4 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
                Need help?
              </div>
              <p className="mt-1 text-[11.5px] leading-snug text-neutral-600">
                Trade Center arbitrates every dispute independently. We look at the delivery
                record, the messages between you and the merchant, and any evidence you both
                share.
              </p>
              <Link
                href="/tc/messages"
                className="mt-3 inline-flex min-h-[40px] items-center justify-center gap-1 rounded-full border bg-white px-4 text-[10.5px] font-black uppercase tracking-wider text-neutral-700 shadow-sm"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                Open a support message
              </Link>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <li className="flex items-baseline justify-between">
      <span className="text-[11.5px] text-neutral-600">{label}</span>
      <span className={`text-[13px] ${bold ? "font-black text-neutral-900" : "font-bold text-neutral-800"}`}>
        {value}
      </span>
    </li>
  );
}
