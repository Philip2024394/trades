// /tc/checkout/merchant/[merchantSlug] — Safe Trade checkout for one
// merchant slice of the cart.
//
// Reads the cart items scoped to this merchant, computes delivery per
// the merchant's flat-rate + free-threshold config, and hands off to
// the Stripe / PayPal / Escrow gateway the merchant has wired. In
// fixture-mode the submit is a stub that clears the merchant's cart
// items and routes to the orders list.
//
// Per project_trade_center_checkout_model — this is the RECOMMENDED
// path, shown before WhatsApp handoff. Buyer protection applies.

"use client";

import { useState } from "react";
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShieldCheck,
  CreditCard,
  Truck,
  Loader2,
  Package,
  Info
} from "lucide-react";
import { MarketplaceHeader } from "@/apps/marketplace/components/MarketplaceHeader";
import { useGuestBasket, type GuestBasketItem } from "@/apps/marketplace/lib/useGuestBasket";
import {
  findMerchant,
  checkoutOptionsFor,
  deliveryFor
} from "@/apps/marketplace/data/merchants";

export default function MerchantCheckoutPage() {
  const params = useParams<{ merchantSlug: string }>();
  const router = useRouter();
  const cart = useGuestBasket();
  const [submitting, setSubmitting] = useState(false);
  const [gateway, setGateway] = useState<"stripe" | "paypal" | "escrow">("stripe");

  const merchantSlug = params?.merchantSlug;
  const merchant = merchantSlug ? findMerchant(merchantSlug) : undefined;
  if (!merchant) return notFound();

  const items = cart.items.filter((i) => i.merchantSlug === merchant.slug);
  const options = checkoutOptionsFor(merchant);
  const subtotal = items.reduce((s, i) => s + i.qty * i.unitPriceGbp, 0);
  const delivery = deliveryFor(merchant, subtotal);
  const total = subtotal + delivery.chargeGbp;

  // Guard rails — if the buyer landed here without items or with a
  // merchant that hasn't wired any gateway, redirect them back to the
  // cart page where their options actually make sense.
  if (items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
        <MarketplaceHeader activeCategorySlug={null}/>
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 py-12 text-center">
          <Package size={36} strokeWidth={1.2} className="mb-3 text-neutral-300"/>
          <h1 className="text-[16px] font-black text-neutral-900">
            No items for {merchant.displayName}
          </h1>
          <p className="mt-1 max-w-md text-[12px] text-neutral-600">
            Your cart doesn't have anything from this merchant right now.
          </p>
          <Link
            href="/tc/cart"
            className="mt-4 inline-flex items-center gap-1 rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-wider text-white"
            style={{ backgroundColor: "#166534" }}
          >
            Back to cart
          </Link>
        </main>
      </div>
    );
  }

  if (!options.safeTradeAvailable) {
    return (
      <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
        <MarketplaceHeader activeCategorySlug={null}/>
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 py-12 text-center">
          <Info size={36} strokeWidth={1.2} className="mb-3 text-neutral-300"/>
          <h1 className="text-[16px] font-black text-neutral-900">
            Safe Trade not available for {merchant.displayName}
          </h1>
          <p className="mt-1 max-w-md text-[12px] text-neutral-600">
            This merchant hasn't wired a payment gateway yet. Return to the cart to place your order via WhatsApp instead.
          </p>
          <Link
            href="/tc/cart"
            className="mt-4 inline-flex items-center gap-1 rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-wider text-white"
            style={{ backgroundColor: "#166534" }}
          >
            Back to cart
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <MarketplaceHeader activeCategorySlug={null}/>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 md:px-6 md:py-8">
        <Link
          href="/tc/cart"
          className="inline-flex min-h-[44px] items-center gap-2 text-[11.5px] font-bold text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft size={13}/>
          Back to cart
        </Link>

        <header className="mt-3 mb-6">
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Trade Center · Safe Trade checkout
          </div>
          <h1 className="mt-1 text-[22px] font-black leading-tight text-neutral-900 md:text-[26px]">
            Confirm your order with {merchant.displayName}
          </h1>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-5">
            {/* Line items */}
            <section
              className="rounded-2xl border bg-white shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div className="border-b p-4" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
                  Order · {items.length} {items.length === 1 ? "item" : "items"}
                </div>
              </div>
              <ul className="divide-y" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                {items.map((item) => (
                  <CheckoutLineItem key={item.productId} item={item}/>
                ))}
              </ul>
            </section>

            {/* Delivery */}
            <section
              className="rounded-2xl border bg-white p-5 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
                Delivery
              </div>
              <div className="mt-3 flex items-start gap-3">
                <Truck size={16} className="mt-0.5 text-neutral-500"/>
                <div className="text-[12.5px] leading-snug text-neutral-800">
                  {delivery.free
                    ? "Free delivery."
                    : `£${delivery.chargeGbp.toFixed(2)} flat rate.`}
                  {merchant.freeDeliveryThresholdGbp !== undefined && !delivery.free && (
                    <div className="mt-0.5 text-[11px] text-neutral-500">
                      Add £{(merchant.freeDeliveryThresholdGbp - subtotal).toFixed(2)} more for free delivery.
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Gateway picker */}
            {options.gateways.length > 1 && (
              <section
                className="rounded-2xl border bg-white p-5 shadow-sm"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
                  Payment method
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {options.gateways.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGateway(g)}
                      className="min-h-[44px] rounded-full border-2 px-4 text-[12px] font-black uppercase tracking-wider transition"
                      style={{
                        borderColor: gateway === g ? "#0A0A0A" : "rgba(139,69,19,0.20)",
                        backgroundColor: gateway === g ? "#FEF3C7" : "#FFFFFF",
                        color: "#0A0A0A"
                      }}
                    >
                      {g === "stripe" ? "Card (Stripe)" : g === "paypal" ? "PayPal" : "Escrow"}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Payment surface — stubbed */}
            <section
              className="rounded-2xl border bg-white p-5 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div className="flex items-start gap-3 rounded-md bg-neutral-50 p-3">
                <CreditCard size={16} className="mt-0.5 text-neutral-500"/>
                <div className="text-[11.5px] leading-snug text-neutral-700">
                  Payment powered by <strong>{gateway === "stripe" ? "Stripe" : gateway === "paypal" ? "PayPal" : "Trade Center Escrow"}</strong>.
                  In fixture-mode this is a stub — production drops in the real gateway session.
                  Card data never touches a Trade Center server.
                </div>
              </div>
            </section>
          </div>

          {/* Summary */}
          <aside className="flex flex-col gap-4">
            <section
              className="rounded-2xl border bg-white p-5 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
                Summary
              </div>
              <ul className="mt-3 flex flex-col gap-2 text-[12.5px]">
                <li className="flex items-baseline justify-between">
                  <span className="text-neutral-600">Subtotal</span>
                  <span className="font-bold text-neutral-800">£{subtotal.toFixed(2)}</span>
                </li>
                <li className="flex items-baseline justify-between">
                  <span className="text-neutral-600">Delivery</span>
                  <span className="font-bold text-neutral-800">
                    {delivery.free ? "Free" : `£${delivery.chargeGbp.toFixed(2)}`}
                  </span>
                </li>
                <li
                  className="mt-1 flex items-baseline justify-between border-t pt-2"
                  style={{ borderColor: "rgba(139,69,19,0.15)" }}
                >
                  <span className="text-[13px] font-black text-neutral-900">Total</span>
                  <span className="text-[17px] font-black text-neutral-900">£{total.toFixed(2)}</span>
                </li>
              </ul>

              <button
                type="button"
                disabled={submitting}
                onClick={async () => {
                  setSubmitting(true);
                  await new Promise((r) => setTimeout(r, 850));
                  // Clear this merchant's items from the cart on success.
                  // clearMerchant hits the server in one call for authed
                  // users and updates localStorage for guests.
                  cart.clearMerchant(merchant.slug);
                  router.push("/tc/orders");
                }}
                className="mt-4 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full px-6 text-[13px] font-black uppercase tracking-wider text-white shadow-sm disabled:opacity-70"
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
                    Place order · £{total.toFixed(2)}
                  </>
                )}
              </button>

              <div
                className="mt-3 flex items-start gap-2 rounded-lg p-3 text-[11px]"
                style={{ backgroundColor: "#F0FDF4" }}
              >
                <ShieldCheck size={14} className="mt-0.5 flex-shrink-0" style={{ color: "#166534" }}/>
                <div className="text-neutral-700">
                  <strong style={{ color: "#166534" }}>Customer protected.</strong> Money-back guarantee if the merchant doesn't deliver.
                </div>
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

function CheckoutLineItem({ item }: { item: GuestBasketItem }) {
  const lineTotal = item.qty * item.unitPriceGbp;
  return (
    <li className="flex items-center gap-3 p-4">
      <div
        className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border bg-white"
        style={{ borderColor: "rgba(139,69,19,0.10)" }}
      >
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" className="h-full w-full object-contain p-1"/>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Package size={16} strokeWidth={1.2} className="text-neutral-300"/>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="line-clamp-1 text-[12.5px] font-black text-neutral-900">
          {item.productName}
        </div>
        <div className="mt-0.5 text-[11px] text-neutral-500">
          {item.qty} × £{item.unitPriceGbp.toFixed(2)}
        </div>
      </div>
      <span className="text-[13px] font-black text-neutral-900">£{lineTotal.toFixed(2)}</span>
    </li>
  );
}
