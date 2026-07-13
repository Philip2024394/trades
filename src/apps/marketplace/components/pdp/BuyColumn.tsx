// PDP Buy Column — variants + qty + live price + add to cart.
// Right-column half of the top of the PDP.
//
// Price is driven by three inputs (in order of precedence):
//   1. multi-buy tier (activeQty) — total price is the tier's totalPriceGbp
//   2. selected variant (priceDeltaGbp)
//   3. base retail priceGbp (or tradePriceGbp if the viewer is verified)
//
// Trade pricing: gated the same way as ProductCard (viewer is a Verified
// Trade). When gated, an "unlock" chip nudges the viewer to /tc/identity.

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Star,
  ShieldCheck,
  Minus,
  Plus,
  ShoppingCart,
  Heart,
  Share2,
  Truck,
  Package,
  CheckCircle2,
  Send,
  Check
} from "lucide-react";
import { MultiBuySwitcher } from "./MultiBuySwitcher";
import { MessageSellerCTA } from "@/apps/messages/components/MessageSellerCTA";
import { TrustAndSocialProof } from "./TrustAndSocialProof";
import { findSocialProof } from "../../data/socialProof";
import { useGuestBasket } from "../../lib/useGuestBasket";
import { useQuoteBasket } from "@/apps/notebook/lib/quoteBasket";
import { useIsTrade } from "@/apps/hub/lib/useIsTrade";
import type { MarketplaceProduct } from "../../types";
import type { MarketplaceMerchant } from "../../data/merchants";
import type { ProductDetails, ProductVariant } from "../../data/productDetails";

type ViewerTier = "free" | "paid" | "verified" | "merchant-pro";

type Props = {
  product: MarketplaceProduct;
  merchant: MarketplaceMerchant;
  details: ProductDetails;
  viewerTier?: ViewerTier;
};

function formatGbp(v: number): string {
  return `£${v.toFixed(2)}`;
}

export function BuyColumn({ product, merchant, details, viewerTier = "free" }: Props) {
  const [activeVariantId, setActiveVariantId] = useState<string | null>(
    details.variants?.[0]?.id ?? null
  );
  const [activeQty, setActiveQty] = useState<number | null>(null);
  const [qty, setQty] = useState<number>(1);
  const [justAdded, setJustAdded] = useState(false);
  const cart = useGuestBasket();
  const quoteBasket = useQuoteBasket();
  const isTrade = useIsTrade();
  const router = useRouter();

  const activeVariant: ProductVariant | undefined = useMemo(
    () => details.variants?.find((v) => v.id === activeVariantId),
    [details.variants, activeVariantId]
  );

  const baseUnit = product.priceGbp + (activeVariant?.priceDeltaGbp ?? 0);
  const activeTier = details.multiBuyTiers?.find((t) => t.qty === activeQty);
  const linePrice = activeTier ? activeTier.totalPriceGbp : baseUnit * qty;
  const unitPriceDisplayed = activeTier ? activeTier.totalPriceGbp / activeTier.qty : baseUnit;
  const positivePct = Math.round((product.starRating / 5) * 100);

  const showTradePrice =
    product.tradePriceGbp &&
    (viewerTier === "paid" || viewerTier === "verified" || viewerTier === "merchant-pro");

  const stockLabel =
    activeVariant
      ? activeVariant.stockCount > 20
        ? "In stock"
        : activeVariant.stockCount > 0
          ? `Low · ${activeVariant.stockCount} left`
          : "Out of stock"
      : product.stockState === "in"
        ? "In stock"
        : product.stockState === "low"
          ? `Low · ${product.stockQty ?? 0} left`
          : product.stockState === "out"
            ? "Out of stock"
            : "Pre-order";

  return (
    <div className="flex flex-col gap-5">
      {/* Merchant chip */}
      <Link
        href={`/tc/trade-center/merchant/${merchant.slug}`}
        className="inline-flex items-center gap-2 self-start rounded-full border bg-white px-3 py-1.5 text-[11.5px] text-neutral-700 shadow-sm hover:bg-neutral-50"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-black"
          style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
        >
          {merchant.logoInitials}
        </span>
        <span className="font-bold">{merchant.displayName}</span>
        <CheckCircle2 size={11} className="text-[#166534]" strokeWidth={2.5}/>
      </Link>

      {/* Name + spec */}
      <div>
        <h1 className="text-[22px] font-black leading-tight text-neutral-900 md:text-[26px]">
          {product.name}
        </h1>
        <p className="mt-1 text-[12.5px] text-neutral-600">{product.spec}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 text-[11px] text-neutral-500">
          <span className="inline-flex items-center gap-1">
            <Star size={11} className="text-amber-500" fill="currentColor"/>
            <span className="font-bold text-neutral-900">{product.starRating.toFixed(1)}</span>
            <span>({product.reviewCount.toLocaleString()} reviews · {positivePct}% positive)</span>
          </span>
          <span>Ref: {product.slug.slice(0, 12).toUpperCase()}</span>
        </div>
      </div>

      {/* Multi-buy switcher — the Hammerex signature 1/2/3/4 tiles */}
      {details.multiBuyTiers && details.multiBuyTiers.length > 0 && (
        <MultiBuySwitcher
          tiers={details.multiBuyTiers}
          unitPriceGbp={baseUnit}
          activeQty={activeQty}
          onChange={(q) => {
            setActiveQty(q);
            if (q !== null) setQty(1);
          }}
        />
      )}

      {/* Variant selector */}
      {details.variants && details.variants.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-600">
            Choose variant
          </span>
          <div className="flex flex-wrap gap-2">
            {details.variants.map((v) => {
              const active = v.id === activeVariantId;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setActiveVariantId(v.id)}
                  aria-pressed={active}
                  className="min-h-[44px] rounded-full border-2 px-4 text-[12px] font-black transition"
                  style={{
                    borderColor: active ? "#0A0A0A" : "rgba(139,69,19,0.20)",
                    backgroundColor: active ? "#FEF3C7" : "#FFFFFF",
                    color: "#0A0A0A"
                  }}
                >
                  {v.label}
                  {typeof v.priceDeltaGbp === "number" && v.priceDeltaGbp !== 0 && (
                    <span className="ml-1 text-[10.5px] font-bold text-neutral-500">
                      {v.priceDeltaGbp > 0 ? `+£${v.priceDeltaGbp}` : `−£${Math.abs(v.priceDeltaGbp)}`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Price block + trade unlock nudge */}
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-3">
          <span className="text-[32px] font-black leading-none text-neutral-900">
            {formatGbp(linePrice)}
          </span>
          {activeTier && (
            <span className="text-[11.5px] text-neutral-500">
              {activeTier.qty}× · {formatGbp(unitPriceDisplayed)}/each
            </span>
          )}
          {!activeTier && qty > 1 && (
            <span className="text-[11.5px] text-neutral-500">
              {qty}× {formatGbp(baseUnit)}
            </span>
          )}
          {showTradePrice && !activeTier && (
            <span
              className="rounded-sm px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider"
              style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
            >
              Trade £{product.tradePriceGbp}
            </span>
          )}
        </div>
        {product.tradePriceGbp && !showTradePrice && (
          <Link
            href="/tc/identity"
            className="inline-flex items-center gap-1 self-start rounded-sm px-2 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-700"
            style={{ backgroundColor: "#F5F0E4" }}
          >
            <ShieldCheck size={10}/>
            Trade price · Verify to see
          </Link>
        )}
      </div>

      {/* Stock + delivery pill row */}
      <div className="flex flex-wrap items-center gap-2 text-[10.5px] font-bold">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
          style={{
            backgroundColor: stockLabel.startsWith("Low") ? "#FEF3C7" : stockLabel === "Out of stock" ? "#FEE2E2" : "#DCFCE7",
            color: stockLabel.startsWith("Low") ? "#B45309" : stockLabel === "Out of stock" ? "#B91C1C" : "#166534"
          }}
        >
          <CheckCircle2 size={10}/>
          {stockLabel}
        </span>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-neutral-700"
          style={{ backgroundColor: "#F5F0E4" }}
        >
          <Truck size={10}/>
          {product.deliveryPromise}
        </span>
        {product.collectAvailable && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-neutral-700"
            style={{ backgroundColor: "#F5F0E4" }}
          >
            <Package size={10}/>
            Click &amp; collect
          </span>
        )}
      </div>

      {/* Quantity stepper (disabled when multi-buy tier active) */}
      {!activeTier && (
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-600">
            Quantity
          </span>
          <div
            className="inline-flex items-center rounded-full border bg-white shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="flex h-11 w-11 items-center justify-center text-neutral-700 disabled:opacity-40"
              disabled={qty <= 1}
              aria-label="Decrease quantity"
            >
              <Minus size={14}/>
            </button>
            <span className="w-8 text-center text-[13px] font-black text-neutral-900">{qty}</span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(99, q + 1))}
              className="flex h-11 w-11 items-center justify-center text-neutral-700"
              aria-label="Increase quantity"
            >
              <Plus size={14}/>
            </button>
          </div>
        </div>
      )}

      {/* Add to cart + secondary buttons */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={stockLabel === "Out of stock"}
          onClick={() => {
            const effectiveQty = activeTier ? activeTier.qty : qty;
            const unitPrice = activeTier
              ? activeTier.totalPriceGbp / activeTier.qty
              : baseUnit;
            cart.add({
              productId:    product.id,
              productSlug:  product.slug,
              productName:  activeVariant ? `${product.name} — ${activeVariant.label}` : product.name,
              imageUrl:     product.imageUrl,
              qty:          effectiveQty,
              unitPriceGbp: unitPrice,
              merchantSlug: merchant.slug,
              merchantName: merchant.displayName
            });
            setJustAdded(true);
            window.setTimeout(() => setJustAdded(false), 2200);
          }}
          className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-full px-5 text-[13px] font-black uppercase tracking-wider text-white shadow-sm transition disabled:opacity-40"
          style={{ backgroundColor: justAdded ? "#0A0A0A" : "#166534" }}
          aria-label={`Add to cart for ${formatGbp(linePrice)}`}
        >
          {justAdded ? (
            <>
              <Check size={15}/>
              Added · view cart
            </>
          ) : (
            <>
              <ShoppingCart size={15}/>
              Add to cart · {formatGbp(linePrice)}
            </>
          )}
        </button>
        <button
          type="button"
          className="inline-flex min-h-[52px] items-center justify-center gap-1 rounded-full border bg-white px-4 text-[11.5px] font-black uppercase tracking-wider text-neutral-700 shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
          aria-label="Save"
        >
          <Heart size={14}/>
        </button>
        <button
          type="button"
          className="inline-flex min-h-[52px] items-center justify-center gap-1 rounded-full border bg-white px-4 text-[11.5px] font-black uppercase tracking-wider text-neutral-700 shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
          aria-label="Share"
        >
          <Share2 size={14}/>
        </button>
      </div>

      {/* View-cart affordance appears after adding — direct link so the
          buyer can jump to checkout without hunting for the header
          basket icon. */}
      {justAdded && (
        <button
          type="button"
          onClick={() => router.push("/tc/cart")}
          className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-full text-[11px] font-black uppercase tracking-wider text-neutral-900 transition hover:brightness-95"
          style={{ backgroundColor: "#FFB300" }}
        >
          Go to cart ({cart.count} {cart.count === 1 ? "item" : "items"}) · {formatGbp(cart.totalGbp)}
        </button>
      )}

      {/* Trade-only: request a quote instead of buying now. Gated by
          useIsTrade() per the constitutional rule — DIY / guest never
          sees this button. Adds the product to the trade's structured
          quote basket then routes to the Quote-Me flow so they can
          send the request to merchants. Never WhatsApp per
          project_trade_center_checkout_model. */}
      {isTrade && (
        <button
          type="button"
          onClick={async () => {
            const effectiveQty = activeTier ? activeTier.qty : qty;
            const unitPrice = activeTier
              ? activeTier.totalPriceGbp / activeTier.qty
              : baseUnit;
            const variantLabel = activeVariant ? ` — ${activeVariant.label}` : "";
            await quoteBasket.add({
              itemId:        `pdp-${product.id}${activeVariant ? `-${activeVariant.id}` : ""}`,
              productName:   `${product.name}${variantLabel}`,
              spec:          product.spec,
              imageUrl:      product.imageUrl,
              qty:           effectiveQty,
              unit:          "ea",
              merchantSlug:  merchant.slug,
              merchantName:  merchant.displayName,
              productSlug:   product.slug,
              unitPriceGbp:  unitPrice
            });
            router.push("/tc/notebook?section=regulars&quoteme=1");
          }}
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border-2 border-dashed px-4 text-[11.5px] font-black uppercase tracking-wider text-neutral-800 transition hover:bg-neutral-50"
          style={{ borderColor: "rgba(10,10,10,0.2)" }}
          title="Send a structured quote request to the merchant"
        >
          <Send size={13}/>
          Request quote instead
        </button>
      )}

      {/* Message seller — Trade Center native + optional WhatsApp */}
      <div className="flex flex-col gap-2">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-600">
          Questions before you order?
        </div>
        <MessageSellerCTA merchant={merchant} product={product} variant="pdp"/>
        <p className="text-[10.5px] leading-snug text-neutral-500">
          Every Trade Center message is your record — quote, invoice, and job context stay
          attached. WhatsApp is a shortcut when the merchant has enabled it.
        </p>
      </div>

      {/* Overview / description */}
      {details.overview && (
        <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
            Overview
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-neutral-700">
            {details.overview}
          </p>
        </div>
      )}

      {/* Trust + trade-native social proof — trade-specific alternative
          to eBay's "20 people watching" / "12 sold" panel. Every counter
          is real trade activity, aggregated + anonymised. */}
      <TrustAndSocialProof
        socialProof={findSocialProof(product.slug)}
        trust={{
          verifiedLayers: Object.values(merchant.trust.layers).filter((l) => l !== null).length,
          layersTotal: 8,
          tradeCenterGuaranteed: true,
          dispatchPromise: merchant.dispatchPromise ?? "Same-day dispatch",
          returnPolicy: "Customer pays return postage. Trade Center arbitrates disputes.",
          sameDayCutoffLocalTime: "2pm"
        }}
        merchant={merchant}
      />
    </div>
  );
}
