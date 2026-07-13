// /tc/cart — Trade Center cart.
//
// Multi-merchant cart. Buyer reviews here; execution happens in the
// /tc/checkout wizard which walks through each merchant's payment or
// WhatsApp handoff step-by-step.
//
// Layout (per the brainstorm approved by Philip 2026-07-12):
//   • Keep-shopping pill top-left
//   • Merchant sections, each collapsible, showing:
//     - Merchant header with logo, name, verified chip
//     - Line items: image + name + spec + price + qty stepper + delete
//     - Merchant subtotal + delivery breakdown + free-delivery nudge
//     - Remove-all-from-this-merchant secondary link
//   • Grand summary card
//   • Safe Trade banner
//   • Big yellow "Proceed to checkout" button → /tc/checkout
//   • Sticky footer on mobile with grand total + button
//   • Undo toast for delete (4-second window)

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ShoppingCart,
  Package,
  Plus,
  Minus,
  Trash2,
  X,
  ShieldCheck,
  ChevronUp,
  ChevronDown,
  CheckCircle2
} from "lucide-react";
import { MarketplaceHeader } from "@/apps/marketplace/components/MarketplaceHeader";
import { useGuestBasket, type GuestBasketItem } from "@/apps/marketplace/lib/useGuestBasket";
import {
  findMerchant,
  deliveryFor,
  type MarketplaceMerchant
} from "@/apps/marketplace/data/merchants";

type MerchantGroup = {
  merchant: MarketplaceMerchant;
  items: GuestBasketItem[];
};

function groupByMerchant(items: GuestBasketItem[]): MerchantGroup[] {
  const map = new Map<string, MerchantGroup>();
  for (const item of items) {
    const merchant = findMerchant(item.merchantSlug);
    if (!merchant) continue;
    const existing = map.get(item.merchantSlug);
    if (existing) existing.items.push(item);
    else map.set(item.merchantSlug, { merchant, items: [item] });
  }
  return Array.from(map.values());
}

type PendingDelete = {
  item: GuestBasketItem;
  timerId: number;
} | null;

export default function CartPage() {
  const cart = useGuestBasket();
  const groups = useMemo(() => groupByMerchant(cart.items), [cart.items]);

  // Track which merchant sections are collapsed. Default: all expanded.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const pendingRef = useRef<PendingDelete>(null);
  pendingRef.current = pendingDelete;

  function toggleCollapsed(slug: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function requestDelete(item: GuestBasketItem) {
    // Optimistically hide the item from the UI. Actual removal fires
    // after the undo window expires unless the user hits Undo.
    cart.remove(item.productId);
    const timerId = window.setTimeout(() => {
      if (pendingRef.current?.item.productId === item.productId) {
        setPendingDelete(null);
      }
    }, 4000);
    setPendingDelete({ item, timerId });
  }

  function undoDelete() {
    if (!pendingDelete) return;
    window.clearTimeout(pendingDelete.timerId);
    cart.add({
      productId:    pendingDelete.item.productId,
      productSlug:  pendingDelete.item.productSlug,
      productName:  pendingDelete.item.productName,
      imageUrl:     pendingDelete.item.imageUrl,
      qty:          pendingDelete.item.qty,
      unit:         pendingDelete.item.unit,
      unitPriceGbp: pendingDelete.item.unitPriceGbp,
      merchantSlug: pendingDelete.item.merchantSlug,
      merchantName: pendingDelete.item.merchantName
    });
    setPendingDelete(null);
  }

  // Grand totals across all merchants.
  const grand = useMemo(() => {
    let subtotal = 0;
    let delivery = 0;
    for (const group of groups) {
      const merchSub = group.items.reduce((s, i) => s + i.qty * i.unitPriceGbp, 0);
      const d = deliveryFor(group.merchant, merchSub);
      subtotal += merchSub;
      delivery += d.chargeGbp;
    }
    return { subtotal, delivery, total: subtotal + delivery };
  }, [groups]);

  useEffect(() => {
    // Clean up any orphan timer if the component unmounts mid-window.
    return () => {
      if (pendingRef.current) window.clearTimeout(pendingRef.current.timerId);
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <MarketplaceHeader activeCategorySlug={null}/>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-5 pb-40 md:px-6 md:py-8 md:pb-8">
        <Link
          href="/tc/trade-center"
          className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full border bg-white px-3 text-[11px] font-black uppercase tracking-wider text-neutral-800 shadow-sm transition hover:bg-neutral-50"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <ArrowLeft size={12}/>
          Keep shopping
        </Link>

        <header className="mt-3 mb-6">
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Trade Center · Your cart
          </div>
          <h1 className="mt-1 text-[22px] font-black leading-tight text-neutral-900 md:text-[28px]">
            {cart.count === 0
              ? "Your cart is empty"
              : `${cart.count} ${cart.count === 1 ? "item" : "items"} · ${groups.length} ${
                  groups.length === 1 ? "merchant" : "merchants"
                }`}
          </h1>
        </header>

        {cart.count === 0 ? (
          <EmptyCart/>
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map((g) => (
              <MerchantSection
                key={g.merchant.slug}
                group={g}
                collapsed={collapsed.has(g.merchant.slug)}
                onToggleCollapse={() => toggleCollapsed(g.merchant.slug)}
                onDelete={requestDelete}
              />
            ))}

            {/* Unified summary card — items + price breakdown, Safe
                Trade banner, and Proceed to checkout button ALL in one
                container. Reads as a single "you're about to pay this
                much, safely, click here" moment. Cleaner than three
                stacked sections. */}
            <GrandSummaryCard
              itemsSubtotal={grand.subtotal}
              totalDelivery={grand.delivery}
              grandTotal={grand.total}
              merchantCount={groups.length}
            />
          </div>
        )}
      </main>

      {/* Sticky mobile footer — Grand total + Safe Trade + Checkout. */}
      {cart.count > 0 && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t bg-white p-3 shadow-lg md:hidden"
          style={{
            borderColor: "rgba(139,69,19,0.15)",
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)"
          }}
        >
          <div
            className="mb-2 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-[10.5px]"
            style={{ backgroundColor: "#F0FDF4", borderColor: "rgba(22,101,52,0.35)" }}
          >
            <div className="flex items-center gap-1.5 font-black" style={{ color: "#166534" }}>
              <ShieldCheck size={12}/>
              Safe Trade protected
            </div>
            <div className="text-[13px] font-black text-neutral-900">
              £{grand.total.toFixed(2)}
            </div>
          </div>
          <ProceedButton grandTotal={grand.total} merchantCount={groups.length}/>
        </div>
      )}

      {/* Undo toast — floats bottom-center. */}
      {pendingDelete && (
        <div
          className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-fit items-center gap-3 rounded-full border bg-neutral-900 px-4 py-2 text-[12px] text-white shadow-2xl md:bottom-6"
          style={{ borderColor: "rgba(0,0,0,0.15)" }}
          role="status"
          aria-live="polite"
        >
          <span>Removed <strong>{pendingDelete.item.productName}</strong></span>
          <button
            type="button"
            onClick={undoDelete}
            className="rounded-full px-3 py-1 text-[10.5px] font-black uppercase tracking-wider"
            style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function EmptyCart() {
  return (
    <div
      className="rounded-2xl border-2 border-dashed p-10 text-center"
      style={{ borderColor: "rgba(139,69,19,0.20)" }}
    >
      <Package aria-hidden size={40} strokeWidth={1.2} className="mx-auto mb-3 text-neutral-300"/>
      <div className="text-[15px] font-black text-neutral-900">
        Your cart is empty
      </div>
      <p className="mx-auto mt-1 max-w-md text-[12px] leading-snug text-neutral-600">
        Browse Trade Center — items you add show up here, grouped by merchant.
      </p>
      <Link
        href="/tc/trade-center"
        className="mt-4 inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[11.5px] font-black uppercase tracking-wider text-white shadow-sm hover:brightness-110"
        style={{ backgroundColor: "#166534" }}
      >
        <ShoppingCart size={13}/>
        Browse products
      </Link>
    </div>
  );
}

function MerchantSection({
  group,
  collapsed,
  onToggleCollapse,
  onDelete
}: {
  group: MerchantGroup;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onDelete: (item: GuestBasketItem) => void;
}) {
  const cart = useGuestBasket();
  const { merchant, items } = group;
  const subtotal = items.reduce((s, i) => s + i.qty * i.unitPriceGbp, 0);
  const delivery = deliveryFor(merchant, subtotal);
  const total = subtotal + delivery.chargeGbp;
  const verifiedLayers = Object.values(merchant.trust.layers).filter((l) => l !== null).length;
  const gapToFreeDelivery =
    merchant.freeDeliveryThresholdGbp !== undefined && !delivery.free
      ? Math.max(0, merchant.freeDeliveryThresholdGbp - subtotal)
      : 0;

  return (
    <section
      className="overflow-hidden rounded-2xl border bg-white shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      {/* Merchant header */}
      <header
        className="flex items-center gap-3 border-b p-4"
        style={{ borderColor: "rgba(139,69,19,0.10)" }}
      >
        <span
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-black"
          style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
        >
          {merchant.logoInitials}
        </span>
        <div className="min-w-0 flex-1">
          <Link
            href={`/tc/trade-center/merchant/${merchant.slug}`}
            className="line-clamp-1 text-[13.5px] font-black text-neutral-900 hover:underline"
          >
            {merchant.displayName}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10.5px] text-neutral-500">
            <span>{items.length} {items.length === 1 ? "item" : "items"}</span>
            <span className="text-neutral-300">·</span>
            <span>{merchant.homeCity}</span>
            {verifiedLayers >= 4 && (
              <>
                <span className="text-neutral-300">·</span>
                <span
                  className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
                  style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
                >
                  <ShieldCheck size={8} strokeWidth={2.5}/>
                  Verified {verifiedLayers}/8
                </span>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand merchant section" : "Collapse merchant section"}
          aria-expanded={!collapsed}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100"
        >
          {collapsed ? <ChevronDown size={16}/> : <ChevronUp size={16}/>}
        </button>
      </header>

      {!collapsed && (
        <>
          {/* Line items */}
          <ul className="divide-y" style={{ borderColor: "rgba(139,69,19,0.06)" }}>
            {items.map((item) => (
              <LineItem key={item.productId} item={item} onDelete={onDelete}/>
            ))}
          </ul>

          {/* Merchant summary */}
          <div
            className="border-t p-4"
            style={{ borderColor: "rgba(139,69,19,0.10)" }}
          >
            <SummaryRow label="Subtotal" value={`£${subtotal.toFixed(2)}`}/>
            <SummaryRow
              label={
                delivery.free
                  ? "Delivery"
                  : `Delivery (${merchant.deliveryFlatRateGbp !== undefined
                      ? `£${merchant.deliveryFlatRateGbp.toFixed(2)} flat`
                      : "flat rate"})`
              }
              value={
                delivery.free ? (
                  <span style={{ color: "#166534" }}>Free</span>
                ) : (
                  `£${delivery.chargeGbp.toFixed(2)}`
                )
              }
            />
            {gapToFreeDelivery > 0 && (
              <div className="mt-1 text-[10.5px] text-neutral-500">
                Add <strong className="text-neutral-800">£{gapToFreeDelivery.toFixed(2)}</strong> more for free delivery.
              </div>
            )}
            <div
              className="mt-2 flex items-baseline justify-between border-t pt-2"
              style={{ borderColor: "rgba(139,69,19,0.10)" }}
            >
              <span className="text-[12px] font-black text-neutral-900">Merchant total</span>
              <span className="text-[16px] font-black text-neutral-900">£{total.toFixed(2)}</span>
            </div>
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => cart.clearMerchant(merchant.slug)}
                className="inline-flex items-center gap-1 text-[10.5px] font-bold text-neutral-500 hover:text-red-600"
              >
                <Trash2 size={11}/>
                Remove all from this merchant
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function LineItem({
  item,
  onDelete
}: {
  item: GuestBasketItem;
  onDelete: (item: GuestBasketItem) => void;
}) {
  const cart = useGuestBasket();
  const lineTotal = item.qty * item.unitPriceGbp;

  function decrement() {
    if (item.qty <= 1) {
      onDelete(item);
      return;
    }
    // useGuestBasket doesn't expose setQty; we approximate by removing
    // and re-adding at qty-1. Server-cart PATCH endpoint can replace
    // this later for a cleaner update path.
    cart.remove(item.productId);
    cart.add({
      productId:    item.productId,
      productSlug:  item.productSlug,
      productName:  item.productName,
      imageUrl:     item.imageUrl,
      qty:          item.qty - 1,
      unit:         item.unit,
      unitPriceGbp: item.unitPriceGbp,
      merchantSlug: item.merchantSlug,
      merchantName: item.merchantName
    });
  }

  function increment() {
    cart.add({
      productId:    item.productId,
      productSlug:  item.productSlug,
      productName:  item.productName,
      imageUrl:     item.imageUrl,
      qty:          1,
      unit:         item.unit,
      unitPriceGbp: item.unitPriceGbp,
      merchantSlug: item.merchantSlug,
      merchantName: item.merchantName
    });
  }

  return (
    <li className="relative flex gap-3 p-4">
      {/* Image */}
      <Link
        href={`/tc/trade-center/product/${item.productSlug}`}
        className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border bg-white"
        style={{ borderColor: "rgba(139,69,19,0.10)" }}
      >
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" className="h-full w-full object-contain p-1"/>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Package size={20} strokeWidth={1.2} className="text-neutral-300"/>
          </div>
        )}
      </Link>

      {/* Right side — name, ref, qty stepper, line total */}
      <div className="min-w-0 flex-1 pr-8">
        <Link
          href={`/tc/trade-center/product/${item.productSlug}`}
          className="line-clamp-1 text-[13px] font-black text-neutral-900 hover:underline"
        >
          {item.productName}
        </Link>
        <div className="mt-0.5 text-[10.5px] text-neutral-500">
          Ref: {item.productSlug.slice(0, 12).toUpperCase()} · £{item.unitPriceGbp.toFixed(2)} each
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <QtyStepper qty={item.qty} onDec={decrement} onInc={increment}/>
          <div className="text-right">
            <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Line total</div>
            <div className="text-[15px] font-black text-neutral-900">£{lineTotal.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Delete X — top-right of the item */}
      <button
        type="button"
        onClick={() => onDelete(item)}
        aria-label={`Remove ${item.productName} from cart`}
        className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full text-neutral-400 hover:bg-red-50 hover:text-red-600"
      >
        <X size={13}/>
      </button>
    </li>
  );
}

function QtyStepper({
  qty,
  onDec,
  onInc
}: {
  qty: number;
  onDec: () => void;
  onInc: () => void;
}) {
  const atMin = qty <= 1;
  return (
    <div
      className="inline-flex h-9 items-center overflow-hidden rounded-full border bg-white"
      style={{ borderColor: "rgba(139,69,19,0.20)" }}
      role="group"
      aria-label="Adjust quantity"
    >
      <button
        type="button"
        onClick={onDec}
        aria-label={atMin ? "Remove item" : "Decrease quantity"}
        className="flex h-full w-9 items-center justify-center transition"
        style={atMin ? { color: "#DC2626" } : { color: "#525252" }}
        title={atMin ? "Click to remove item" : "Decrease quantity"}
      >
        {atMin ? <Trash2 size={13}/> : <Minus size={13}/>}
      </button>
      <span className="min-w-[36px] border-x px-2 text-center text-[12.5px] font-black text-neutral-900" style={{ borderColor: "rgba(139,69,19,0.12)" }}>
        {qty}
      </span>
      <button
        type="button"
        onClick={onInc}
        aria-label="Increase quantity"
        className="flex h-full w-9 items-center justify-center text-neutral-700 hover:bg-neutral-50"
      >
        <Plus size={13}/>
      </button>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between text-[12px]">
      <span className="text-neutral-600">{label}</span>
      <span className="font-bold text-neutral-900">{value}</span>
    </div>
  );
}

function GrandSummaryCard({
  itemsSubtotal,
  totalDelivery,
  grandTotal,
  merchantCount
}: {
  itemsSubtotal: number;
  totalDelivery: number;
  grandTotal: number;
  merchantCount: number;
}) {
  return (
    <section
      className="rounded-2xl border p-5 shadow-sm"
      style={{ backgroundColor: "#FEF3C7", borderColor: "rgba(255,179,0,0.4)" }}
    >
      <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-700">
        Order summary
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        <SummaryRow label="Items subtotal" value={`£${itemsSubtotal.toFixed(2)}`}/>
        <SummaryRow
          label="Total delivery"
          value={
            totalDelivery === 0 ? (
              <span style={{ color: "#166534" }}>Free</span>
            ) : (
              `£${totalDelivery.toFixed(2)}`
            )
          }
        />
      </div>
      <div
        className="mt-3 flex items-baseline justify-between border-t pt-3"
        style={{ borderColor: "rgba(139,69,19,0.20)" }}
      >
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-600">
            Grand total
          </div>
          <div className="text-[10.5px] text-neutral-500">
            Across {merchantCount} {merchantCount === 1 ? "merchant" : "merchants"}
          </div>
        </div>
        <div className="text-[22px] font-black text-neutral-900">£{grandTotal.toFixed(2)}</div>
      </div>

      {/* Safe Trade banner + Checkout button embedded in the same
          container so they read as one continuous "you're about to pay
          this much, safely, click here" moment. Desktop shows this;
          mobile still has the sticky footer duplicate for reach. */}
      <div
        className="mt-4 flex items-start gap-2.5 rounded-lg border p-3"
        style={{ backgroundColor: "#F0FDF4", borderColor: "rgba(22,101,52,0.35)" }}
      >
        <ShieldCheck size={14} className="mt-0.5 flex-shrink-0" style={{ color: "#166534" }}/>
        <div className="text-[11px] leading-snug">
          <div className="font-black" style={{ color: "#166534" }}>
            Safe Trade — customer protected
          </div>
          <div className="mt-0.5 text-neutral-700">
            Pay via Stripe, PayPal or escrow. Money-back guarantee if any merchant doesn&apos;t deliver.
          </div>
        </div>
      </div>

      <div className="mt-3 hidden md:block">
        <Link
          href="/tc/checkout"
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-[13px] font-black uppercase tracking-wider shadow-md transition hover:brightness-105"
          style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
        >
          <ShoppingCart size={16}/>
          Proceed to checkout · £{grandTotal.toFixed(2)}
          <ArrowRight size={16}/>
        </Link>
        <p className="mt-2 text-center text-[10.5px] text-neutral-600">
          You&apos;ll complete {merchantCount} {merchantCount === 1 ? "merchant order" : "separate merchant orders"} in the wizard.
        </p>
      </div>
    </section>
  );
}

function ProceedButton({
  grandTotal,
  merchantCount
}: {
  grandTotal: number;
  merchantCount: number;
}) {
  // Kept for the mobile sticky footer — desktop button now lives inside
  // GrandSummaryCard.
  return (
    <div>
      <Link
        href="/tc/checkout"
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-[13px] font-black uppercase tracking-wider shadow-md transition hover:brightness-105"
        style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
      >
        <ShoppingCart size={16}/>
        Proceed · £{grandTotal.toFixed(2)}
        <ArrowRight size={16}/>
      </Link>
      <p className="mt-1 text-center text-[9.5px] text-neutral-500">
        {merchantCount} {merchantCount === 1 ? "merchant order" : "merchant orders"} · Wizard
      </p>
    </div>
  );
}
