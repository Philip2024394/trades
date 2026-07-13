"use client";

// CanteenCheckoutBody — mobile-first checkout for a canteen product
// via Trade Center. Resolves variant from ?v=, applies overrides,
// computes total, and hands off to the merchant on WhatsApp with
// every order detail baked in (variant + qty + total + delivery ask).

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, MessageCircle, Minus, Plus, Store, Truck, Info } from "lucide-react";
import type { CanteenProduct } from "@/lib/canteens";
import { MarketplaceHeader } from "@/apps/marketplace/components/MarketplaceHeader";

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN_DARK = "#166534";

// Parse a combo key back into readable form + look up the merchant's
// override for that combo. All defensive — bad keys fall back to base
// product fields.
function resolveVariant(product: CanteenProduct, comboKey: string | null) {
  if (!comboKey || !product.variants) {
    return {
      label: null as string | null,
      priceGbp: product.priceGbp,
      imageUrl: product.imageUrl,
      sku: undefined as string | undefined,
      inStock: true
    };
  }
  const override = product.variants.overrides?.[comboKey];
  const [size, color] = product.variants.axis === "size_color"
    ? comboKey.split("|")
    : [null, null];
  const label = product.variants.axis === "size_color"
    ? `${size} · ${color}`
    : comboKey;
  return {
    label,
    priceGbp: override?.priceGbp ?? product.priceGbp,
    imageUrl: override?.imageUrl || product.imageUrl,
    sku: override?.sku,
    inStock: override?.stock !== 0
  };
}

export function CanteenCheckoutBody({
  product,
  hostDisplayName,
  tradeLabel,
  canteenSlug,
  hostWhatsapp
}: {
  product: CanteenProduct;
  hostDisplayName: string;
  tradeLabel: string;
  canteenSlug: string;
  hostWhatsapp: string | null;
}) {
  const searchParams = useSearchParams();
  const comboKey = searchParams.get("v");
  const qtyParam = Number.parseInt(searchParams.get("qty") ?? "1", 10);
  const [qty, setQty] = useState(Number.isFinite(qtyParam) && qtyParam > 0 ? Math.min(qtyParam, 99) : 1);

  const resolved = useMemo(() => resolveVariant(product, comboKey), [product, comboKey]);
  const hostFirstName = hostDisplayName.split(/\s+/)[0] || hostDisplayName;

  const unitPrice = resolved.priceGbp;
  const subtotal = unitPrice * qty;
  const shipping = product.commerce?.shipping?.freeLocalShipping
    ? 0
    : product.commerce?.shipping?.localShippingGbp ?? 0;
  const total = subtotal + shipping;

  // WhatsApp handoff — everything the merchant needs to confirm the
  // order in one message. No round-trip clarification required.
  const orderLines: string[] = [
    `Hi ${hostFirstName}, I'd like to buy from your Trade Center listing:`,
    ``,
    `• Product: ${product.name}`
  ];
  if (resolved.label) orderLines.push(`• Variant: ${resolved.label}`);
  if (resolved.sku) orderLines.push(`• Ref: ${resolved.sku}`);
  orderLines.push(`• Quantity: ${qty}`);
  orderLines.push(`• Unit price: £${unitPrice.toFixed(2)}`);
  if (shipping > 0) orderLines.push(`• Local delivery: £${shipping.toFixed(2)}`);
  else if (product.commerce?.shipping?.freeLocalShipping) orderLines.push(`• Delivery: Free (UK)`);
  orderLines.push(`• Total: £${total.toFixed(2)}`);
  orderLines.push(``);
  orderLines.push(`Please confirm availability and payment options. Thank you.`);

  const waUrl = hostWhatsapp
    ? `https://wa.me/${hostWhatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(orderLines.join("\n"))}`
    : null;

  const backHref = `/tc/product/${product.tradeCenterListingId ?? product.id}${comboKey ? `?v=${encodeURIComponent(comboKey)}` : ""}`;

  return (
    <main className="min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
      {/* Persistent Trade Center header — burger + identity chip +
          basket, same as the PDP so buyers see one consistent nav
          across the buy flow. */}
      <MarketplaceHeader/>

      <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 pt-4 md:px-6 md:pt-6">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
        >
          <ArrowLeft size={14} strokeWidth={2.4}/>
          Product
        </Link>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.22em] text-amber-700">
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: BRAND_YELLOW }}/>
          Checkout
        </span>
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-3 pb-32 pt-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-8 md:px-6 md:pt-6">
        {/* Left column: order summary card (desktop rendering order) */}
        <div className="flex flex-col gap-3 md:order-2">
          <div className="rounded-2xl border border-[#E5D9BD] bg-white/70 p-4 md:p-5">
            <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1B1A17]/60">
              Order summary
            </h2>

            <div className="mt-3 flex gap-3">
              <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-[#E5D9BD] bg-neutral-50">
                {resolved.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolved.imageUrl} alt="" className="h-full w-full object-contain p-1.5"/>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-black leading-tight text-[#1B1A17]">
                  {product.name}
                </div>
                {resolved.label && (
                  <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#FFF8E6] px-2 py-0.5 text-[10.5px] font-black uppercase tracking-wider text-amber-800">
                    {resolved.label}
                  </div>
                )}
                {resolved.sku && (
                  <div className="mt-1 text-[10.5px] font-bold text-[#1B1A17]/50">
                    Ref: {resolved.sku}
                  </div>
                )}
                {!resolved.inStock && (
                  <div className="mt-1 rounded-sm bg-red-50 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-700">
                    Out of stock — enquire anyway
                  </div>
                )}
              </div>
            </div>

            {/* Qty stepper */}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-[12px] font-bold text-[#1B1A17]/70">Quantity</span>
              <div className="inline-flex items-center gap-1 rounded-full border border-[#E5D9BD] bg-white p-1">
                <button
                  type="button"
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  disabled={qty <= 1}
                  aria-label="Decrease quantity"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[#1B1A17] hover:bg-[#FFF8E6] disabled:opacity-40"
                >
                  <Minus size={14} strokeWidth={2.4}/>
                </button>
                <span className="min-w-[2ch] text-center text-[13px] font-black text-[#1B1A17]">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => setQty(Math.min(99, qty + 1))}
                  disabled={qty >= 99}
                  aria-label="Increase quantity"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[#1B1A17] hover:bg-[#FFF8E6] disabled:opacity-40"
                >
                  <Plus size={14} strokeWidth={2.4}/>
                </button>
              </div>
            </div>

            {/* Cost breakdown */}
            <div className="mt-4 space-y-1.5 text-[12.5px]">
              <div className="flex items-center justify-between text-[#1B1A17]/70">
                <span>Subtotal</span>
                <span className="font-bold text-[#1B1A17]">£{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-[#1B1A17]/70">
                <span className="inline-flex items-center gap-1">
                  <Truck size={11} strokeWidth={2.4}/>
                  Local delivery
                </span>
                <span className="font-bold text-[#1B1A17]">
                  {shipping > 0 ? `£${shipping.toFixed(2)}` : product.commerce?.shipping?.freeLocalShipping ? "Free" : "Ask merchant"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-[#E5D9BD] pt-2 text-[14px] font-black text-[#1B1A17]">
                <span>Total</span>
                <span>£{total.toFixed(2)}</span>
              </div>
            </div>

            {/* Zero-commission chip */}
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-900">
              <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"/>
              0% commission on this sale
            </div>
          </div>

          {/* How this works — collapsible on mobile so the summary
              stays scannable */}
          <details className="rounded-2xl border border-[#E5D9BD] bg-white/70 p-4">
            <summary className="flex cursor-pointer items-center gap-2 text-[11px] font-black uppercase tracking-wider text-[#1B1A17]/60">
              <Info size={11} strokeWidth={2.4}/>
              How Trade Center checkout works
            </summary>
            <div className="mt-3 space-y-2 text-[11.5px] leading-relaxed text-[#1B1A17]/70">
              <p>
                Trade Center takes <b>0% commission</b> on your purchase. When you tap Confirm we hand you off to the merchant on WhatsApp with your order pre-filled.
              </p>
              <p>
                The merchant confirms availability, arranges payment (bank transfer / card / PayPal — their choice), and delivers directly to you. No middleman skims the price.
              </p>
              <p>
                For high-value orders we&apos;ll add an escrow option in a future update — for now the WhatsApp handoff is the fastest, most honest path.
              </p>
            </div>
          </details>
        </div>

        {/* Right column: merchant + hero (desktop rendering order) */}
        <div className="flex flex-col gap-3 md:order-1">
          <h1 className="text-[22px] font-black leading-tight text-[#1B1A17] md:text-[28px]">
            Confirm your order
          </h1>
          <p className="text-[13px] leading-relaxed text-[#1B1A17]/70">
            One tap sends your full order to <b>{hostFirstName}</b> on WhatsApp. They confirm and take payment their way.
          </p>

          <Link
            href={`/trade-off/yard/canteens/${canteenSlug}`}
            className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#E5D9BD] bg-white px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-[#1B1A17] hover:bg-[#FFF8E6]"
          >
            <Store size={11} strokeWidth={2.4}/>
            Selling: {hostDisplayName} · {tradeLabel}
          </Link>

          {/* Desktop Confirm CTA — sticky bar renders instead on mobile */}
          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="hidden h-12 items-center justify-center gap-2 rounded-full px-6 text-[13px] font-black uppercase tracking-wider text-white shadow-md active:scale-[0.98] md:inline-flex"
              style={{ backgroundColor: BRAND_GREEN_DARK }}
            >
              <MessageCircle size={15} strokeWidth={2.6}/>
              Confirm on WhatsApp
            </a>
          )}
          {!waUrl && (
            <div className="rounded-xl border border-[#E5D9BD] bg-white p-3 text-[12px] text-[#1B1A17]/70">
              This merchant hasn&apos;t set a WhatsApp number yet. Go back to the canteen page to send a message instead.
            </div>
          )}
        </div>
      </div>

      {/* Sticky mobile Confirm bar */}
      {waUrl && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E5D9BD] bg-[#FBF6EC]/95 px-3 py-3 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-[10.5px] font-bold text-[#1B1A17]/60 uppercase tracking-wider">
                Total
              </div>
              <div className="text-[15px] font-black text-[#1B1A17]">
                £{total.toFixed(2)}
              </div>
            </div>
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-11 flex-shrink-0 items-center justify-center gap-1.5 rounded-full px-5 text-[11.5px] font-black uppercase tracking-wider text-white shadow-md active:scale-[0.98]"
              style={{ backgroundColor: BRAND_GREEN_DARK }}
            >
              <MessageCircle size={13} strokeWidth={2.6}/>
              Confirm
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
