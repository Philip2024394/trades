// /tc/checkout/[productSlug] — buyer checkout with Trade Center Guaranteed
// explanation. Fixture-mode: card entry is stubbed. On submit we generate
// a new "funds-held" order and hand off to the order detail page so the
// buyer can follow the escrow lifecycle.

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShieldCheck,
  CreditCard,
  Truck,
  Info,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { MarketplaceHeader } from "@/apps/marketplace/components/MarketplaceHeader";
import { PRODUCT_FIXTURES } from "@/apps/marketplace/data/products";
import { findMerchant } from "@/apps/marketplace/data/merchants";
import {
  GUARANTEE_THRESHOLD_GBP,
  SHIELDPAY_ESCROW_THRESHOLD_GBP,
  escrowProviderFor
} from "@/apps/orders/types";

export default function CheckoutPage() {
  const params = useParams<{ productSlug: string }>();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const product = params?.productSlug
    ? PRODUCT_FIXTURES.find((p) => p.slug === params.productSlug)
    : undefined;
  if (!product) return notFound();

  const merchant = findMerchant(product.merchantSlug);
  if (!merchant) return notFound();

  const subtotal = product.priceGbp * qty;
  const delivery = subtotal >= 75 ? 0 : 4.99;
  const total = subtotal + delivery;
  const provider = escrowProviderFor(total);
  const isGuaranteed = provider !== undefined;
  const providerName = provider === "shieldpay-escrow" ? "Shieldpay" : "Stripe";

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <MarketplaceHeader activeCategorySlug={null}/>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 md:px-6 md:py-8">
        <Link
          href={`/tc/trade-center/product/${product.slug}`}
          className="inline-flex min-h-[44px] items-center gap-2 text-[11.5px] font-bold text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft size={13}/>
          Back to {product.name}
        </Link>

        <header className="mt-3 mb-6 md:mb-8">
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Trade Center · Checkout
          </div>
          <h1 className="mt-1 text-[22px] font-black leading-tight text-neutral-900 md:text-[28px]">
            Confirm your order
          </h1>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-5">
            {/* Line item */}
            <section
              className="rounded-2xl border bg-white p-5 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
                Order
              </div>
              <div className="mt-3 flex items-start gap-4">
                <div
                  className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg"
                  style={{ backgroundColor: "#F5F0E4" }}
                >
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.imageUrl} alt="" className="h-full w-full object-contain p-2"/>
                  ) : (
                    <div className="text-[24px] text-neutral-300">📦</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-black text-neutral-900">{product.name}</div>
                  <div className="mt-0.5 text-[11.5px] text-neutral-500">{product.spec}</div>
                  <div className="mt-1 text-[11px] text-neutral-500">
                    From {merchant.displayName} · {merchant.homeCity}
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <label className="flex items-center gap-2 text-[11px] font-bold text-neutral-700">
                      Qty
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={qty}
                        onChange={(e) => setQty(Math.max(1, Math.min(99, parseInt(e.target.value || "1", 10))))}
                        className="w-16 rounded-md border bg-white px-2 py-1 text-[13px]"
                        style={{ borderColor: "rgba(139,69,19,0.15)" }}
                      />
                    </label>
                    <div className="ml-auto text-[15px] font-black text-neutral-900">
                      £{(product.priceGbp * qty).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Delivery */}
            <section
              className="rounded-2xl border bg-white p-5 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
                Delivery
              </div>
              <div className="mt-3 flex items-center gap-3">
                <Truck size={16} className="text-neutral-500"/>
                <div className="text-[12.5px] leading-snug text-neutral-800">
                  {product.deliveryPromise}
                  {delivery === 0 ? (
                    <div className="text-[11px] text-neutral-500">Free delivery (over £75)</div>
                  ) : (
                    <div className="text-[11px] text-neutral-500">£{delivery.toFixed(2)} · add £{(75 - subtotal).toFixed(2)} more for free delivery</div>
                  )}
                </div>
              </div>
            </section>

            {/* Card entry (stubbed) */}
            <section
              className="rounded-2xl border bg-white p-5 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
                Payment
              </div>
              <div className="mt-3 flex items-start gap-3 rounded-md bg-neutral-50 p-3">
                <CreditCard size={16} className="mt-0.5 text-neutral-500"/>
                <div className="text-[11.5px] leading-snug text-neutral-700">
                  Card entry powered by <strong>{providerName}</strong>. In fixture-mode this
                  is a stub — production drops in the real Stripe Elements / Shieldpay session
                  and never lets card data touch a Trade Center server.
                </div>
              </div>
            </section>
          </div>

          {/* Summary + escrow explainer */}
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
                    {delivery === 0 ? "Free" : `£${delivery.toFixed(2)}`}
                  </span>
                </li>
                <li className="mt-1 flex items-baseline justify-between border-t pt-2" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
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
                    <ShieldCheck size={14} strokeWidth={2.5}/>
                    Place order — £{total.toFixed(2)}
                  </>
                )}
              </button>
            </section>

            {/* Escrow explainer — flips messaging depending on order value */}
            {isGuaranteed ? (
              <section
                className="rounded-2xl border p-5"
                style={{ borderColor: "rgba(22,101,52,0.35)", backgroundColor: "#F0FDF4" }}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-[#166534]" strokeWidth={2.5}/>
                  <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[#166534]">
                    Trade Center Guaranteed
                  </div>
                </div>
                <div className="mt-2 flex flex-col gap-2 text-[11.5px] leading-snug text-neutral-800">
                  <p>
                    <strong>Your £{total.toFixed(2)} is held by {providerName}</strong>, not by
                    the merchant, until you confirm delivery.
                  </p>
                  <p>
                    Once you confirm, a 14-day timer starts. You can release funds early or
                    raise a dispute — Trade Center arbitrates independently. Trade Center
                    never holds your money.
                  </p>
                  {provider === "shieldpay-escrow" && (
                    <p className="text-[10.5px] text-neutral-600">
                      Orders over £{SHIELDPAY_ESCROW_THRESHOLD_GBP.toLocaleString()} route through
                      Shieldpay's FCA-regulated escrow account for high-value protection.
                    </p>
                  )}
                </div>
              </section>
            ) : (
              <section
                className="rounded-2xl border p-4"
                style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FFFFFF" }}
              >
                <div className="flex items-start gap-2">
                  <Info size={13} className="mt-0.5 flex-shrink-0 text-neutral-500"/>
                  <div className="text-[11px] leading-snug text-neutral-600">
                    Orders under £{GUARANTEE_THRESHOLD_GBP} settle direct to the merchant.
                    Trade Center Guaranteed activates automatically at £{GUARANTEE_THRESHOLD_GBP}+.
                  </div>
                </div>
              </section>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
