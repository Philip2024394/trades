// Marketplace — Product Card v3.
//
// Design DNA matches NotebookCompactCard: soft brown hairline border,
// aspect-square image with a floating yellow "View" pill overlapping
// the bottom edge, three tight content rows, and a single black +
// yellow "Add to quote" primary action. No competing chips on the
// card face — trust, delivery, stock, business price all move to the
// PDP.
//
// Portrait silhouette (vs. Notebook's landscape) because this grid is
// browse/discovery; Notebook's landscape rows are review/regulars.

"use client";

import Link from "next/link";
import { ShoppingCart, Check, Star, Package, Eye, ShieldCheck } from "lucide-react";
import type { MarketplaceProduct } from "../types";
import type { MarketplaceMerchant } from "../data/merchants";
import { useGuestBasket } from "../lib/useGuestBasket";

export type ViewerTier = "free" | "paid" | "verified" | "merchant-pro";

type Props = {
  product: MarketplaceProduct;
  merchant: MarketplaceMerchant;
  viewerTier: ViewerTier;
  viewerHasBusinessAccount?: boolean;
  onCompareToggle?: (productId: string) => void;
  isInCompare?: boolean;
  onAskAI?: (prompt: string) => void;
};

function formatDistance(miles: number): string {
  return miles < 1 ? "<1mi" : miles < 10 ? `${miles.toFixed(0)}mi` : `${Math.round(miles)}mi`;
}

function topBadge(product: MarketplaceProduct): { label: string; bg: string; fg: string } | null {
  const b = product.badges?.[0];
  if (!b) return null;
  const YELLOW = { bg: "#FFB300", fg: "#0A0A0A" };
  switch (b) {
    case "best-seller": return { label: "Best seller", ...YELLOW };
    case "top-rated":   return { label: "Top rated",   ...YELLOW };
    case "value-pack":  return { label: "Value pack",  ...YELLOW };
    case "new":         return { label: "New",         ...YELLOW };
  }
}

export function ProductCard({
  product,
  merchant,
  viewerTier
}: Props) {
  const showTradePrice =
    product.tradePriceGbp !== undefined &&
    (viewerTier === "paid" || viewerTier === "verified" || viewerTier === "merchant-pro");
  const displayPrice = showTradePrice ? product.tradePriceGbp! : product.priceGbp;
  const wasPrice = showTradePrice ? product.priceGbp : null;
  const badge = topBadge(product);
  const outOfStock = product.stockState === "out";
  const cart = useGuestBasket();
  const inCart = cart.has(product.id);

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock) return;
    if (inCart) {
      cart.remove(product.id);
      return;
    }
    cart.add({
      productId:    product.id,
      productSlug:  product.slug,
      productName:  product.name,
      imageUrl:     product.imageUrl,
      qty:          1,
      unitPriceGbp: displayPrice,
      merchantSlug: merchant.slug,
      merchantName: merchant.displayName
    });
  }

  return (
    <article
      className="relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md"
      style={{ borderColor: "rgba(139,69,19,0.12)" }}
      data-product-id={product.id}
    >
      {/* Image + floating View pill. Background-removed PNGs sit on a
          beige matte, forced to a 1:1 tile with object-contain so
          nothing gets cropped. Fallback to Package icon when the
          fixture doesn't carry an imageUrl yet. */}
      <div className="relative">
        <Link
          href={`/tc/trade-center/product/${product.slug}`}
          className="relative block aspect-square overflow-hidden bg-white"
          aria-label={`View ${product.name}`}
        >
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-full w-full object-contain p-4"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-neutral-300">
              <Package aria-hidden size={42} strokeWidth={1.2}/>
            </div>
          )}
        </Link>
        {badge && (
          <span
            className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-sm"
            style={{ backgroundColor: badge.bg, color: badge.fg }}
          >
            {badge.label}
          </span>
        )}
        {outOfStock && !badge && (
          <span
            className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-sm"
            style={{ backgroundColor: "#FEE2E2", color: "#DC2626" }}
          >
            Out of stock
          </span>
        )}
        {/* Pack / piece signal — top-right, informational (not a
            promotional badge). White pill with hairline border so it
            reads as "spec-level info" not "sale badge". Renders only
            when packSize is set on the product. */}
        {product.packSize && (
          <span
            className="absolute right-2 top-2 inline-flex items-center rounded-full border bg-white/95 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-neutral-800 shadow-sm backdrop-blur"
            style={{ borderColor: "rgba(139,69,19,0.25)" }}
            aria-label={`Sold as ${product.packSize}`}
          >
            {product.packSize}
          </span>
        )}
        <Link
          href={`/tc/trade-center/product/${product.slug}`}
          aria-label={`Quick view: ${product.name}`}
          className="absolute -bottom-3 left-1/2 z-10 inline-flex h-7 -translate-x-1/2 items-center gap-1 rounded-full px-3 text-[10px] font-black uppercase tracking-wider shadow-md ring-2 ring-white transition hover:brightness-105"
          style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
        >
          <Eye size={11}/>
          View
        </Link>
      </div>

      {/* Content — three tight rows */}
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-3 pt-5">
        {/* Row 1: name + price */}
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/tc/trade-center/product/${product.slug}`}
            className="line-clamp-2 flex-1 text-[13px] font-black leading-tight text-neutral-900 hover:text-neutral-700"
          >
            {product.name}
          </Link>
          <div className="flex flex-col items-end leading-none">
            {wasPrice !== null && (
              <span className="mb-0.5 text-[10px] text-neutral-400 line-through">£{wasPrice}</span>
            )}
            <div className="flex items-center gap-1">
              {/* TRADE chip — only renders when the merchant offers a
                  trade price AND the viewer is a trade (constitutional
                  gate via showTradePrice). Lets trades pick out
                  discounted cards at a glance when scanning many
                  merchants selling the same item. */}
              {showTradePrice && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider shadow-sm"
                  style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
                  aria-label="Trade price applied"
                >
                  Trade
                </span>
              )}
              <span className="text-[15px] font-black text-neutral-900">
                £{displayPrice}
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: spec */}
        {product.spec && (
          <p className="line-clamp-1 text-[11px] leading-snug text-neutral-500">
            {product.spec}
          </p>
        )}

        {/* Row 3: merchant · star · distance */}
        <div className="flex items-center gap-1.5 text-[10.5px] text-neutral-500">
          <Link
            href={`/tc/trade-center/merchant/${merchant.slug}`}
            className="truncate font-bold text-neutral-800 hover:underline"
          >
            {merchant.displayName}
          </Link>
          <span className="text-neutral-300">·</span>
          <span className="inline-flex flex-shrink-0 items-center gap-0.5">
            <Star size={9} className="text-amber-500" fill="currentColor"/>
            <span className="font-bold text-neutral-700">{product.starRating.toFixed(1)}</span>
          </span>
          {product.distanceMi !== undefined && (
            <>
              <span className="text-neutral-300">·</span>
              <span className="flex-shrink-0 font-bold text-neutral-700">
                {formatDistance(product.distanceMi)}
              </span>
            </>
          )}
        </div>

        {/* Trade-price unlock nudge — only when the merchant offers a
            trade price but the viewer isn't verified. Sits inline as a
            small pill, not competing with the primary action. */}
        {product.tradePriceGbp && !showTradePrice && (
          <Link
            href="/tc/identity"
            className="inline-flex items-center gap-1 self-start rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-neutral-700 transition hover:bg-neutral-100"
            style={{ backgroundColor: "#F5F0E4" }}
          >
            <ShieldCheck size={10}/>
            Trade price · Verify
          </Link>
        )}

        {/* Row 4: single primary action — Add to cart (all viewers).
            mt-auto pins the button to the bottom of the content area
            so every card in the grid has its CTA aligned at the same
            baseline, no matter how much variable content sits above
            (spec length, distance visibility, trade-verify nudge etc). */}
        <div className="mt-auto pt-2">
          <button
            type="button"
            disabled={outOfStock}
            onClick={handleAddToCart}
            aria-pressed={inCart}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-[10.5px] font-black uppercase tracking-wider shadow-sm transition disabled:opacity-40"
            style={{
              backgroundColor: inCart ? "#166534" : "#0A0A0A",
              color: inCart ? "#FFFFFF" : "#FFB300"
            }}
            aria-label={`Add ${product.name} to cart`}
          >
            {inCart ? (
              <>
                <Check size={12}/>
                In cart
              </>
            ) : (
              <>
                <ShoppingCart size={12}/>
                {outOfStock ? "Out of stock" : "Add to cart"}
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
