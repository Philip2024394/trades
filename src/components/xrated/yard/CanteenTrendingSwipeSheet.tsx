"use client";

// CanteenTrendingSwipeSheet — Instagram Stories-style swipe view for the
// trending category tiles on a canteen page. Tapping a tile opens this
// sheet filtered to products that match the category's keywords. Swipe
// left/right to browse; tap a product's action button to WhatsApp the
// merchant or Buy on Trade Center (dual-button pattern, same as
// ProductQuickView). Slide-up sheet on mobile, centered modal on desktop.
//
// Kept intentionally self-contained — takes a pre-filtered `items` list
// so the parent ribbon owns the category→product matching logic.

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { X, MessageCircle, ShoppingBag } from "lucide-react";
import type { CanteenProductVariants } from "@/lib/canteens";
import { CanteenVariantPicker, type VariantSelectionState } from "./CanteenVariantPicker";

const TAN = "#B8860B";

export type TrendingSwipeItem = {
  id: string;
  name: string;
  imageUrl: string;
  priceGbp: number;
  blurb?: string;
  /** When set + sendToTradeCenter true, the sheet renders a
   *  "Buy on Trade Center" button that deep-links to the TC listing. */
  tradeCenterListingId?: string;
  /** Local canteen product path (used for the "See full details" link
   *  under the actions). */
  hrefPath?: string;
  /** Variant shape — when present, the swipe sheet renders the shared
   *  variant picker below the price and the buyer's selection drives
   *  the visible image, price and CTA URLs. */
  variants?: CanteenProductVariants;
};

export function CanteenTrendingSwipeSheet({
  open,
  onClose,
  items,
  categoryLabel,
  canteenSlug,
  hostFirstName,
  hostWhatsapp,
  sendToTradeCenter = false
}: {
  open: boolean;
  onClose: () => void;
  items: TrendingSwipeItem[];
  categoryLabel: string;
  canteenSlug: string;
  hostFirstName: string;
  hostWhatsapp: string | null;
  sendToTradeCenter?: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Reset to first item every time the sheet opens on a new category —
  // avoids the "user opens Cabinets, then Tiling, and lands mid-way
  // through" surprise.
  useEffect(() => {
    if (open) setIdx(0);
  }, [open, categoryLabel]);

  // Body-scroll lock while open. Restores overflow on close/unmount.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const total = items.length;
  const goto = useCallback((next: number) => {
    if (total === 0) return;
    if (next < 0) return;
    if (next >= total) return;
    setIdx(next);
  }, [total]);

  const goPrev = useCallback(() => goto(idx - 1), [goto, idx]);
  const goNext = useCallback(() => goto(idx + 1), [goto, idx]);

  // Keyboard: Esc closes, arrows navigate.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, goPrev, goNext]);

  // Touch: horizontal swipe > 45px = next/prev. Vertical swipes are
  // ignored so the user can still scroll the product description.
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current == null || touchStartY.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) < 45) return;
    if (Math.abs(dy) > Math.abs(dx)) return; // dominant vertical → scroll
    if (dx < 0) goNext();
    else goPrev();
  }

  // Variant state per swipe item — keyed by item id so switching items
  // in the swipe carousel keeps each item's selection independent.
  const [variantByItemId, setVariantByItemId] = useState<Record<string, VariantSelectionState>>({});

  // Reset variant state on any category change to keep the sheet
  // predictable (new category = different products, stale state
  // would leak).
  useEffect(() => {
    setVariantByItemId({});
  }, [categoryLabel]);

  if (!open) return null;

  const current = items[idx];
  const variantState = current ? variantByItemId[current.id] : undefined;

  // Effective values — variant overrides beat product-level values.
  const effectivePriceGbp = variantState?.priceGbp ?? current?.priceGbp ?? 0;
  const effectiveImageUrl = variantState?.imageUrl || current?.imageUrl || "";
  const variantSuffix = variantState?.label ? ` (${variantState.label})` : "";
  const outOfStockNote = variantState?.isOutOfStock ? " — is this variant back in stock?" : "";

  const waUrl = current && hostWhatsapp
    ? `https://wa.me/${hostWhatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
        `Hi ${hostFirstName}, I saw "${current.name}${variantSuffix}" in your ${categoryLabel} trending on Thenetworkers${outOfStockNote}. Can you tell me more?`
      )}`
    : null;

  // Trade Center URL carries the selected combo key for downstream
  // pre-selection on the PDP.
  const tcHref = current?.tradeCenterListingId
    ? (() => {
        const params = new URLSearchParams();
        params.set("from", "canteen");
        params.set("slug", canteenSlug);
        if (variantState?.comboKey) params.set("v", variantState.comboKey);
        return `/tc/product/${current.tradeCenterListingId}?${params.toString()}`;
      })()
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Trending ${categoryLabel}`}
      className="fixed inset-0 z-[110] flex items-end justify-center md:items-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      {/* Sheet — mobile: full-viewport slide-up, desktop: 480px card */}
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative z-10 flex h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl md:h-[86vh] md:rounded-2xl"
      >
        {/* Position dots — Instagram Stories pattern. One thin bar per
            item, filled up to and including the current index. */}
        <div className="absolute inset-x-0 top-0 z-20 flex gap-1 px-3 pt-2">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goto(i)}
              aria-label={`Go to item ${i + 1} of ${total}`}
              className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30"
            >
              <span
                className="block h-full rounded-full transition-all"
                style={{
                  width: i < idx ? "100%" : i === idx ? "100%" : "0%",
                  backgroundColor: i <= idx ? "#FFB300" : "transparent"
                }}
              />
            </button>
          ))}
        </div>

        {/* Close X — top-right, above the position dots */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close trending sheet"
          className="absolute right-3 top-4 z-30 flex h-8 w-8 items-center justify-center rounded-full shadow-md active:scale-[0.95]"
          style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
        >
          <X size={14} strokeWidth={2.8}/>
        </button>

        {/* Category label — thin uppercase strip so the user always
            knows which trending category they're browsing */}
        <div className="absolute left-3 top-4 z-30 flex items-center gap-1.5">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: "#FFB300" }}
          />
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-900">
            {categoryLabel}
          </span>
        </div>

        {/* Body — image on top, content beneath */}
        <div className="flex flex-1 flex-col overflow-y-auto pt-10">
          {current ? (
            <>
              {/* Image — object-contain per platform rule. Swaps to
                  the selected variant's image when the buyer picks a
                  combo with an image override. */}
              <div className="relative flex aspect-square w-full items-center justify-center bg-neutral-50">
                <img
                  src={effectiveImageUrl}
                  alt={current.name}
                  className="h-full w-full object-contain p-4"
                  loading="lazy"
                />
                {/* Left/right tap zones — Stories-style. Tap left =
                    previous, tap right = next. Hidden hitboxes over
                    the image area. */}
                {idx > 0 && (
                  <button
                    type="button"
                    onClick={goPrev}
                    aria-label="Previous"
                    className="absolute left-0 top-0 h-full w-1/3 focus:outline-none"
                    style={{ background: "transparent" }}
                  />
                )}
                {idx < total - 1 && (
                  <button
                    type="button"
                    onClick={goNext}
                    aria-label="Next"
                    className="absolute right-0 top-0 h-full w-1/3 focus:outline-none"
                    style={{ background: "transparent" }}
                  />
                )}
              </div>

              {/* Product details */}
              <div className="flex flex-col gap-1 px-4 pt-3">
                <div className="text-[15px] font-black leading-tight text-neutral-900">
                  {current.name}
                </div>
                <div className="text-[16px] font-black leading-none text-neutral-900">
                  {effectivePriceGbp > 0
                    ? `£${effectivePriceGbp}`
                    : <span className="italic text-neutral-600">Price on request</span>}
                </div>
                {current.blurb && (
                  <p className="mt-1 text-[12px] leading-snug text-neutral-600">
                    {current.blurb}
                  </p>
                )}
              </div>

              {/* Variant picker — only when the merchant configured
                  variants on this item. Selection drives the visible
                  image, price and CTA URLs. Per-item state so swiping
                  between items preserves each item's choice. */}
              {current.variants && (
                <div className="mt-3 px-4">
                  <CanteenVariantPicker
                    variants={current.variants}
                    basePriceGbp={current.priceGbp}
                    baseImageUrl={current.imageUrl}
                    onChange={(next) =>
                      setVariantByItemId((prev) => ({ ...prev, [current.id]: next }))
                    }
                  />
                </div>
              )}

              {/* Actions — mirrors ProductQuickView's dual-button pattern.
                  Yellow "Ask on WhatsApp" primary; dark green "Buy on
                  Trade Center" secondary. Only rendered when the merchant
                  has opted in AND the product has a TC listing. */}
              {(waUrl || (sendToTradeCenter && tcHref)) && (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 px-4">
                  {waUrl && (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-5 text-[11.5px] font-black uppercase tracking-wider text-neutral-900 shadow-md active:scale-[0.98]"
                      style={{ backgroundColor: "#FFB300" }}
                    >
                      <MessageCircle size={13} strokeWidth={2.6}/>
                      Ask on WhatsApp
                    </a>
                  )}
                  {sendToTradeCenter && tcHref && (
                    <Link
                      href={tcHref}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-5 text-[11.5px] font-black uppercase tracking-wider text-white shadow-md active:scale-[0.98]"
                      style={{ backgroundColor: "#166534" }}
                    >
                      <ShoppingBag size={13} strokeWidth={2.6}/>
                      Buy on Trade Center
                      {effectivePriceGbp > 0 && (
                        <span className="ml-0.5 rounded-full bg-white/15 px-1.5 py-0.5 text-[10px]">
                          £{effectivePriceGbp}
                        </span>
                      )}
                    </Link>
                  )}
                </div>
              )}

              {/* See full details — deep link into canteen products */}
              {current.hrefPath && (
                <div className="mt-2 flex justify-center px-4 pb-4">
                  <Link
                    href={current.hrefPath}
                    onClick={onClose}
                    className="text-[10.5px] font-bold uppercase tracking-wider text-neutral-500 underline underline-offset-2 hover:text-neutral-800"
                  >
                    See full product details
                  </Link>
                </div>
              )}

              {/* Position + counter footer — small "3 / 5" */}
              <div className="mt-auto flex items-center justify-center gap-1 pb-4 pt-4">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">
                  {idx + 1} of {total}
                </span>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 text-center">
              <p className="text-[12px] font-bold text-neutral-500">
                Nothing in this trending category yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
