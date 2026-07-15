// /tc/checkout — Multi-merchant checkout wizard.
//
// Sequential per-merchant checkout: buyer completes one merchant at a
// time via Safe Trade or WhatsApp handoff, wizard advances to the
// next merchant, ends on Orders when all merchants have been handled.
//
// Cart items for a merchant get cleared as soon as that merchant's
// step completes so a mid-wizard refresh doesn't re-show a completed
// step. When the cart is empty (either arrived here empty or all
// steps complete), buyer is routed to /tc/orders.
//
// This wraps the single-merchant checkout page pattern into an
// orchestrated flow. Direct-linking to
// /tc/checkout/merchant/[slug] still works for external callers.

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  MessageCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Package,
  CreditCard,
  Info
} from "lucide-react";
import { TradeCenterHeader } from "@/apps/tradecenter/components/TradeCenterHeader";
import { useGuestBasket, type GuestBasketItem } from "@/apps/tradecenter/lib/useGuestBasket";
import {
  findMerchant,
  checkoutOptionsFor,
  deliveryFor,
  type TradeCenterMerchant
} from "@/apps/tradecenter/data/merchants";
import { buildWhatsAppCartUrl } from "@/apps/tradecenter/lib/whatsapp";

type StepGroup = {
  merchant: TradeCenterMerchant;
  items: GuestBasketItem[];
};

function groupByMerchant(items: GuestBasketItem[]): StepGroup[] {
  const map = new Map<string, StepGroup>();
  for (const item of items) {
    const merchant = findMerchant(item.merchantSlug);
    if (!merchant) continue;
    const existing = map.get(item.merchantSlug);
    if (existing) existing.items.push(item);
    else map.set(item.merchantSlug, { merchant, items: [item] });
  }
  return Array.from(map.values());
}

export default function CheckoutWizardPage() {
  const cart = useGuestBasket();
  const router = useRouter();
  const groups = useMemo(() => groupByMerchant(cart.items), [cart.items]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [completedSlugs, setCompletedSlugs] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const activeGroup = groups[activeIndex];

  // Auto-advance the active pointer to the first incomplete step.
  useEffect(() => {
    if (groups.length === 0) return;
    // Find the first group not already completed.
    for (let i = 0; i < groups.length; i++) {
      if (!completedSlugs.includes(groups[i].merchant.slug)) {
        if (i !== activeIndex) setActiveIndex(i);
        return;
      }
    }
    // Every step complete — route to orders.
    router.push("/tc/orders");
  }, [groups, completedSlugs, activeIndex, router]);

  // Empty cart guard.
  if (cart.count === 0 && completedSlugs.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
        <TradeCenterHeader activeCategorySlug={null}/>
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 py-12 text-center">
          <Package size={40} strokeWidth={1.2} className="mb-3 text-neutral-300"/>
          <h1 className="text-[18px] font-black text-neutral-900">Your cart is empty</h1>
          <p className="mt-1 max-w-md text-[12px] text-neutral-600">
            Add products to your cart before checking out.
          </p>
          <Link
            href="/tc/trade-center"
            className="mt-4 inline-flex items-center gap-1 rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-wider text-white shadow-sm"
            style={{ backgroundColor: "#166534" }}
          >
            Browse products
          </Link>
        </main>
      </div>
    );
  }

  function handleSafeTradeComplete(slug: string) {
    setSubmitting(slug);
    // Simulate gateway session — production would open Stripe elements /
    // PayPal / escrow session in a modal.
    window.setTimeout(() => {
      cart.clearMerchant(slug);
      setCompletedSlugs((prev) => [...prev, slug]);
      setSubmitting(null);
    }, 900);
  }

  function handleWhatsAppComplete(slug: string, url: string) {
    // Open WhatsApp in a new tab. On return the buyer can hit "Mark
    // this order sent" — but for MVP we optimistically mark complete
    // after opening because the handoff itself is confirmation.
    window.open(url, "_blank", "noopener,noreferrer");
    cart.clearMerchant(slug);
    setCompletedSlugs((prev) => [...prev, slug]);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <TradeCenterHeader activeCategorySlug={null}/>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-5 md:px-6 md:py-8">
        <Link
          href="/tc/cart"
          className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full border bg-white px-3 text-[11px] font-black uppercase tracking-wider text-neutral-800 shadow-sm transition hover:bg-neutral-50"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <ArrowLeft size={12}/>
          Back to cart
        </Link>

        <header className="mt-3 mb-5">
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Trade Center · Checkout
          </div>
          <h1 className="mt-1 text-[22px] font-black leading-tight text-neutral-900 md:text-[26px]">
            Complete {groups.length + completedSlugs.length} {groups.length + completedSlugs.length === 1 ? "order" : "orders"}
          </h1>
          <p className="mt-1 text-[12px] text-neutral-500">
            Each merchant is a separate order. Complete them one at a time — Safe Trade recommended.
          </p>
        </header>

        {/* Progress indicator */}
        <ProgressIndicator
          total={groups.length + completedSlugs.length}
          completed={completedSlugs.length}
        />

        {/* Steps stack — completed collapsed, active expanded, upcoming
            collapsed with a preview. */}
        <ol className="mt-6 flex flex-col gap-4">
          {completedSlugs.map((slug, i) => (
            <StepCompleted key={slug} index={i + 1} merchantSlug={slug}/>
          ))}
          {groups.map((group, i) => {
            const stepNumber = completedSlugs.length + i + 1;
            const isActive = i === activeIndex;
            return (
              <MerchantStep
                key={group.merchant.slug}
                stepNumber={stepNumber}
                group={group}
                isActive={isActive}
                submitting={submitting === group.merchant.slug}
                onSafeTradeComplete={() => handleSafeTradeComplete(group.merchant.slug)}
                onWhatsAppComplete={(url) => handleWhatsAppComplete(group.merchant.slug, url)}
              />
            );
          })}
        </ol>
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function ProgressIndicator({ total, completed }: { total: number; completed: number }) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-[10.5px] text-neutral-500">
        <span>
          <strong className="text-neutral-900">{completed}</strong> of {total} complete
        </span>
        <span>{pct}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full"
        style={{ backgroundColor: "rgba(139,69,19,0.10)" }}
      >
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: "#166534" }}
        />
      </div>
    </div>
  );
}

function StepCompleted({ index, merchantSlug }: { index: number; merchantSlug: string }) {
  const merchant = findMerchant(merchantSlug);
  return (
    <li
      className="flex items-center gap-3 rounded-2xl border p-4 shadow-sm"
      style={{
        backgroundColor: "#F0FDF4",
        borderColor: "rgba(22,101,52,0.35)"
      }}
    >
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
      >
        <CheckCircle2 size={16} strokeWidth={2.5}/>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: "#166534" }}>
          Step {index} · Complete
        </div>
        <div className="mt-0.5 text-[13px] font-black text-neutral-900">
          {merchant?.displayName ?? merchantSlug}
        </div>
      </div>
    </li>
  );
}

function MerchantStep({
  stepNumber,
  group,
  isActive,
  submitting,
  onSafeTradeComplete,
  onWhatsAppComplete
}: {
  stepNumber: number;
  group: StepGroup;
  isActive: boolean;
  submitting: boolean;
  onSafeTradeComplete: () => void;
  onWhatsAppComplete: (url: string) => void;
}) {
  const { merchant, items } = group;
  const options = checkoutOptionsFor(merchant);
  const subtotal = items.reduce((s, i) => s + i.qty * i.unitPriceGbp, 0);
  const delivery = deliveryFor(merchant, subtotal);
  const total = subtotal + delivery.chargeGbp;
  const whatsappUrl = buildWhatsAppCartUrl(merchant, items, delivery.chargeGbp);

  return (
    <li
      className={`overflow-hidden rounded-2xl border shadow-sm transition ${
        isActive ? "bg-white" : "bg-neutral-50"
      }`}
      style={{ borderColor: isActive ? "rgba(255,179,0,0.4)" : "rgba(139,69,19,0.15)" }}
    >
      {/* Step header */}
      <header className="flex items-center gap-3 border-b p-4" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-black"
          style={{
            backgroundColor: isActive ? "#FFB300" : "#F5F0E4",
            color: isActive ? "#0A0A0A" : "#525252"
          }}
        >
          {stepNumber}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Step {stepNumber} · {isActive ? "Active" : "Upcoming"}
          </div>
          <div className="mt-0.5 text-[13.5px] font-black text-neutral-900">
            {merchant.displayName}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Total</div>
          <div className="text-[16px] font-black text-neutral-900">£{total.toFixed(2)}</div>
        </div>
      </header>

      {isActive ? (
        <ActiveStepBody
          items={items}
          subtotal={subtotal}
          delivery={delivery}
          total={total}
          options={options}
          submitting={submitting}
          onSafeTradeComplete={onSafeTradeComplete}
          onWhatsAppUrl={whatsappUrl}
          onWhatsAppComplete={onWhatsAppComplete}
        />
      ) : (
        <div className="p-4 text-[11px] text-neutral-500">
          {items.length} {items.length === 1 ? "item" : "items"} · Ready after previous step
        </div>
      )}
    </li>
  );
}

function ActiveStepBody({
  items,
  subtotal,
  delivery,
  total,
  options,
  submitting,
  onSafeTradeComplete,
  onWhatsAppUrl,
  onWhatsAppComplete
}: {
  items: GuestBasketItem[];
  subtotal: number;
  delivery: { chargeGbp: number; free: boolean };
  total: number;
  options: ReturnType<typeof checkoutOptionsFor>;
  submitting: boolean;
  onSafeTradeComplete: () => void;
  onWhatsAppUrl: string | null;
  onWhatsAppComplete: (url: string) => void;
}) {
  const [gateway, setGateway] = useState<"stripe" | "paypal" | "escrow">(options.gateways[0] ?? "stripe");

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Compact item list */}
      <ul className="divide-y" style={{ borderColor: "rgba(139,69,19,0.06)" }}>
        {items.map((item) => (
          <li key={item.productId} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
            <div
              className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md border bg-white"
              style={{ borderColor: "rgba(139,69,19,0.10)" }}
            >
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt="" className="h-full w-full object-contain p-1"/>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Package size={14} strokeWidth={1.2} className="text-neutral-300"/>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="line-clamp-1 text-[12px] font-black text-neutral-900">{item.productName}</div>
              <div className="text-[10.5px] text-neutral-500">
                {item.qty} × £{item.unitPriceGbp.toFixed(2)}
              </div>
            </div>
            <div className="text-[12px] font-black text-neutral-900">
              £{(item.qty * item.unitPriceGbp).toFixed(2)}
            </div>
          </li>
        ))}
      </ul>

      {/* Summary */}
      <div className="rounded-lg border p-3" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
        <div className="flex items-baseline justify-between text-[11.5px]">
          <span className="text-neutral-600">Subtotal</span>
          <span className="font-bold text-neutral-900">£{subtotal.toFixed(2)}</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between text-[11.5px]">
          <span className="text-neutral-600">Delivery</span>
          <span className="font-bold text-neutral-900">
            {delivery.free ? <span style={{ color: "#166534" }}>Free</span> : `£${delivery.chargeGbp.toFixed(2)}`}
          </span>
        </div>
        <div
          className="mt-2 flex items-baseline justify-between border-t pt-2"
          style={{ borderColor: "rgba(139,69,19,0.10)" }}
        >
          <span className="text-[12px] font-black text-neutral-900">Total</span>
          <span className="text-[16px] font-black text-neutral-900">£{total.toFixed(2)}</span>
        </div>
      </div>

      {/* Payment options */}
      {options.safeTradeAvailable ? (
        <>
          <div
            className="flex items-start gap-3 rounded-lg border p-3"
            style={{ backgroundColor: "#F0FDF4", borderColor: "rgba(22,101,52,0.35)" }}
          >
            <ShieldCheck size={16} className="mt-0.5 flex-shrink-0" style={{ color: "#166534" }}/>
            <div className="text-[11px]">
              <div className="font-black" style={{ color: "#166534" }}>Safe Trade — recommended</div>
              <div className="mt-0.5 text-neutral-700">
                Customer-protected. Money-back if the merchant doesn&apos;t deliver.
              </div>
            </div>
          </div>

          {/* Gateway picker (only when merchant has multiple) */}
          {options.gateways.length > 1 && (
            <div>
              <div className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
                Payment method
              </div>
              <div className="flex flex-wrap gap-2">
                {options.gateways.map((g) => {
                  const active = gateway === g;
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGateway(g)}
                      className="inline-flex h-10 items-center rounded-full border-2 px-4 text-[12px] font-black uppercase tracking-wider transition"
                      style={{
                        borderColor: active ? "#0A0A0A" : "rgba(139,69,19,0.20)",
                        backgroundColor: active ? "#FEF3C7" : "#FFFFFF",
                        color: "#0A0A0A"
                      }}
                    >
                      {g === "stripe" ? "Card" : g === "paypal" ? "PayPal" : "Escrow"}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stubbed gateway UI */}
          <div className="flex items-start gap-2 rounded-md bg-neutral-50 p-3">
            <CreditCard size={14} className="mt-0.5 text-neutral-500"/>
            <div className="text-[11px] leading-snug text-neutral-700">
              Payment powered by <strong>{gateway === "stripe" ? "Stripe" : gateway === "paypal" ? "PayPal" : "Trade Center Escrow"}</strong>.
              In fixture-mode this is a stub — production drops in the real gateway session.
            </div>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={onSafeTradeComplete}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-[13px] font-black uppercase tracking-wider text-white shadow-md transition hover:brightness-105 disabled:opacity-70"
            style={{ backgroundColor: "#166534" }}
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin"/>
                Placing order…
              </>
            ) : (
              <>
                <ShieldCheck size={14}/>
                Pay £{total.toFixed(2)} · Safe Trade
                <ArrowRight size={14}/>
              </>
            )}
          </button>

          {/* WhatsApp secondary */}
          {onWhatsAppUrl && (
            <details className="rounded-lg border" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
              <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[11px] font-bold text-neutral-700 hover:bg-neutral-50">
                <MessageCircle size={12}/>
                Other options
              </summary>
              <div className="border-t p-3" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                <div className="flex items-start gap-2 rounded-md p-2" style={{ backgroundColor: "#FEF3C7" }}>
                  <AlertTriangle size={13} className="mt-0.5" style={{ color: "#B45309" }}/>
                  <div className="text-[10.5px] leading-snug text-neutral-800">
                    <strong>Less protected.</strong> WhatsApp orders happen off-platform — no money-back guarantee.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onWhatsAppComplete(onWhatsAppUrl)}
                  className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-full border bg-white text-[11px] font-bold text-neutral-800 hover:bg-neutral-50"
                  style={{ borderColor: "rgba(139,69,19,0.15)" }}
                >
                  <MessageCircle size={13} style={{ color: "#25D366" }}/>
                  Message on WhatsApp instead
                </button>
              </div>
            </details>
          )}
        </>
      ) : onWhatsAppUrl ? (
        <>
          <div
            className="flex items-start gap-2 rounded-lg border p-3"
            style={{ backgroundColor: "#FEF3C7", borderColor: "rgba(180,83,9,0.35)" }}
          >
            <Info size={14} className="mt-0.5 flex-shrink-0" style={{ color: "#B45309" }}/>
            <div className="text-[11px]">
              <div className="font-black" style={{ color: "#B45309" }}>WhatsApp only</div>
              <div className="mt-0.5 text-neutral-700">
                This merchant hasn&apos;t wired Safe Trade yet. Orders happen off-platform — no money-back guarantee.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onWhatsAppComplete(onWhatsAppUrl)}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-[13px] font-black uppercase tracking-wider text-white shadow-md hover:brightness-110"
            style={{ backgroundColor: "#25D366" }}
          >
            <MessageCircle size={14}/>
            Message on WhatsApp · £{total.toFixed(2)}
          </button>
        </>
      ) : (
        <div className="rounded-lg border-2 border-dashed p-3 text-center text-[11px] text-neutral-600" style={{ borderColor: "rgba(220,38,38,0.4)" }}>
          This merchant hasn&apos;t set up checkout yet. Message them directly from your inbox.
        </div>
      )}
    </div>
  );
}
