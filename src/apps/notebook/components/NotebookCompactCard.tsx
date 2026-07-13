// Notebook item card — compact landscape row.
//
// Design goal: Linear/Stripe-grade compactness. One visual anchor
// (image), one primary action (Add to quote), everything else muted
// inline. No raised chrome — clean rectangular silhouette.
//
// Layout:
//   ┌──────────────────────────────────────────────────────────┐
//   │ ┌─────┐  Product name                            £22    │
//   │ │ img │  Short description · 2-line clamp                │
//   │ │  →  │  Merchant · ★ 4.9 · <1mi              View →   │
//   │ └─────┘  [− 40 bag +]                    [ Add to quote ]│
//   └──────────────────────────────────────────────────────────┘
//
// Image is the QuickView trigger. Merchant name links to the merchant
// profile. Description falls back to notebook item's spec when the
// merchant product doesn't have a marketing overview.

"use client";

import { useState } from "react";
import Link from "next/link";
import { Send, Check, Star, Package, Plus, Minus, Eye, Trash2 } from "lucide-react";
import type { NotebookItem } from "../data/notebook";
import type { NearestMatch } from "../lib/findNearestMerchant";
import { findProductDetails } from "@/apps/marketplace/data/productDetails";
import { useQuoteBasket } from "../lib/quoteBasket";

function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

type Props = {
  item: NotebookItem;
  match: NearestMatch | null;
  onView: () => void;
  onRemove?: () => void;
};

export function NotebookCompactCard({ item, match, onView, onRemove }: Props) {
  const merchantHasTradePrice = match?.product.tradePriceGbp !== undefined;
  const displayPrice = merchantHasTradePrice ? match!.product.tradePriceGbp! : match?.product.priceGbp;
  const wasPrice = merchantHasTradePrice ? match!.product.priceGbp : null;
  const [qty, setQty] = useState<number>(item.usualQty ?? 1);
  const details = match ? findProductDetails(match.product.slug) : undefined;
  const description = details?.overview ?? item.spec;
  const basket = useQuoteBasket();
  const inQuote = basket.has(item.id);
  const dec = () => setQty((n) => Math.max(1, n - 1));
  const inc = () => setQty((n) => Math.min(999, n + 1));
  function toggleInQuote() {
    if (!match) return;
    if (inQuote) {
      basket.remove(item.id);
    } else {
      basket.add({
        itemId: item.id,
        productName: item.productName,
        spec: item.spec,
        imageUrl: match.product.imageUrl,
        qty,
        unit: item.unit,
        merchantSlug: match.merchant.slug,
        merchantName: match.merchant.displayName,
        productSlug: match.product.slug,
        unitPriceGbp: displayPrice ?? 0
      });
    }
  }

  return (
    <article
      className="relative flex overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md"
      style={{ borderColor: "rgba(139,69,19,0.12)" }}
    >
      {/* Delete button — bold red pill top-right so the trade can't miss it */}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${item.productName} from notebook`}
          className="absolute right-2 top-2 z-20 flex h-9 w-9 items-center justify-center rounded-full text-white shadow-md ring-2 ring-white transition hover:brightness-110"
          style={{ backgroundColor: "#B91C1C" }}
          title="Remove from notebook"
        >
          <Trash2 size={15}/>
        </button>
      )}

      {/* Image with floating View pill — pill is the only click target */}
      <div className="relative m-2 flex-shrink-0">
        <div
          className="relative aspect-square h-[96px] w-[96px] overflow-hidden rounded-lg sm:h-[108px] sm:w-[108px]"
          style={{ backgroundColor: "#F5F0E4" }}
        >
          {match?.product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={match.product.imageUrl}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Package size={24} strokeWidth={1.5} className="text-neutral-400"/>
            </div>
          )}
        </div>
        {/* Small yellow View pill — centered on the image bottom edge */}
        <button
          type="button"
          onClick={onView}
          aria-label={`Quick view: ${item.productName}`}
          className="absolute bottom-1.5 left-1/2 inline-flex h-6 -translate-x-1/2 items-center gap-1 rounded-full px-2.5 text-[9.5px] font-black uppercase tracking-wider shadow-md ring-2 ring-white"
          style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
        >
          <Eye size={11}/>
          View
        </button>
      </div>

      {/* Right column — three tight rows */}
      <div className="flex min-w-0 flex-1 flex-col gap-1 py-2.5 pl-1 pr-2.5">
        {/* Row 1: name + price */}
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="line-clamp-1 flex-1 text-[13px] font-black leading-tight text-neutral-900">
            {item.productName}
          </h3>
          {displayPrice !== undefined ? (
            <div className="flex items-baseline gap-1.5">
              {merchantHasTradePrice && wasPrice !== null && (
                <span className="text-[10px] text-neutral-400 line-through">£{wasPrice}</span>
              )}
              <span className="text-[15px] font-black leading-none text-neutral-900">
                £{displayPrice}
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-neutral-400">—</span>
          )}
        </div>

        {/* Row 2: description */}
        {description && (
          <p className="line-clamp-2 text-[11px] leading-snug text-neutral-500">
            {description}
          </p>
        )}

        {/* Row 3: meta — merchant · star · distance · View */}
        {match && (
          <div className="flex items-center gap-1.5 text-[10.5px] text-neutral-500">
            <Link
              href={`/tc/trade-center/merchant/${match.merchant.slug}`}
              className="truncate font-bold text-neutral-800 hover:underline"
            >
              {match.merchant.displayName}
            </Link>
            <span className="text-neutral-300">·</span>
            <span className="inline-flex flex-shrink-0 items-center gap-0.5">
              <Star size={9} className="text-amber-500" fill="currentColor"/>
              <span className="font-bold text-neutral-700">
                {match.product.starRating.toFixed(1)}
              </span>
            </span>
          </div>
        )}

        {/* Row 4: last-quoted chip — trade's own history for this item */}
        {item.lastQuotedAt && item.lastQuotedPriceGbp !== undefined && (
          <div
            className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-neutral-600"
            title={`Last quoted at ${new Date(item.lastQuotedAt).toLocaleString("en-GB", { dateStyle: "medium" })}`}
          >
            Last quoted £{item.lastQuotedPriceGbp.toFixed(2)}
            {item.lastQuotedMerchantName && (
              <>
                <span className="text-neutral-400">·</span>
                <span className="truncate normal-case tracking-normal">{item.lastQuotedMerchantName}</span>
              </>
            )}
            <span className="text-neutral-400">·</span>
            <span className="normal-case tracking-normal">{daysAgo(item.lastQuotedAt)}</span>
          </div>
        )}

        {/* Row 4: stepper + Add to quote */}
        <div className="mt-1 flex items-center justify-between gap-2">
          {/* Compact stepper — single rounded container */}
          <div
            className="inline-flex h-7 items-center overflow-hidden rounded-full border bg-white"
            style={{ borderColor: "rgba(139,69,19,0.18)" }}
            role="group"
            aria-label={`Order quantity in ${item.unit}`}
          >
            <button
              type="button"
              onClick={dec}
              disabled={qty <= 1}
              aria-label="Decrease quantity"
              className="flex h-full w-7 items-center justify-center text-neutral-700 hover:bg-neutral-50 disabled:opacity-30"
            >
              <Minus size={12}/>
            </button>
            <span className="flex items-baseline gap-1 border-x px-2 text-[11px] font-black leading-none text-neutral-900" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
              {qty}
              <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                {item.unit}
              </span>
            </span>
            <button
              type="button"
              onClick={inc}
              disabled={qty >= 999}
              aria-label="Increase quantity"
              className="flex h-full w-7 items-center justify-center text-neutral-700 hover:bg-neutral-50 disabled:opacity-30"
            >
              <Plus size={12}/>
            </button>
          </div>

          {/* Primary action */}
          <button
            type="button"
            disabled={!match}
            onClick={toggleInQuote}
            aria-pressed={inQuote}
            className="inline-flex h-8 items-center gap-1 rounded-full px-4 text-[10.5px] font-black uppercase tracking-wider shadow-sm transition disabled:opacity-40"
            style={{
              backgroundColor: inQuote ? "#166534" : "#0A0A0A",
              color: inQuote ? "#FFFFFF" : "#FFB300"
            }}
          >
            {inQuote ? (
              <>
                <Check size={12}/>
                In quote
              </>
            ) : (
              <>
                <Send size={12}/>
                Add to quote
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
