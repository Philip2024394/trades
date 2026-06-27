"use client";

// Per-product PDP add-to-enquiry island.
//
// Mirrors the ProductModal's add-to-cart logic but lives on a full page
// instead of a lightbox. Handles variant picking, quantity, bulk-tier
// price computation, and the cart write — then bounces a toast so the
// customer sees the cart island update.

import { useEffect, useMemo, useState } from "react";
import type { HammerexXratedProduct } from "@/lib/supabase";
import { addItem, cartItemCount, formatGbp, readCart } from "@/lib/xratedCart";
import { tierForQty } from "./BulkTierTable";

type Variant = HammerexXratedProduct["variants"][number];

export function ProductPageAddToCart({
  product,
  slug,
  themeColor
}: {
  product: HammerexXratedProduct;
  slug: string;
  themeColor: string;
}) {
  const variants = product.variants ?? [];
  const hasVariants = variants.length > 0;
  const variantAxis: "size" | "colour" = hasVariants ? variants[0].axis : "size";

  const [selectedVariantIdx, setSelectedVariantIdx] = useState<number | null>(null);
  const [qty, setQty] = useState<number>(1);
  const [toast, setToast] = useState<string | null>(null);

  const selectedVariant: Variant | null =
    selectedVariantIdx !== null ? variants[selectedVariantIdx] ?? null : null;

  const parentOutOfStock =
    product.stock_count !== null && product.stock_count <= 0;
  const variantOutOfStock =
    selectedVariant !== null &&
    selectedVariant.stock_count !== undefined &&
    selectedVariant.stock_count !== null &&
    selectedVariant.stock_count <= 0;
  const outOfStock = parentOutOfStock || variantOutOfStock;
  const needsVariantPick = hasVariants && selectedVariantIdx === null;
  const addDisabled = outOfStock || needsVariantPick;

  const bulkTiers = Array.isArray(product.bulk_tiers) ? product.bulk_tiers : [];
  const matchedTier = bulkTiers.length > 0 ? tierForQty(bulkTiers, qty) : null;

  const computedPricePence = useMemo(() => {
    const delta = selectedVariant?.price_delta_pence ?? 0;
    const base = matchedTier ? matchedTier.price_pence : product.price_pence;
    return base + (delta ?? 0);
  }, [product.price_pence, selectedVariant, matchedTier]);

  const lineTotalPence = computedPricePence * Math.max(1, qty);

  const currentQty = useMemo(() => {
    const state = readCart(slug);
    return state.items
      .filter((it) => it.product_id === product.id)
      .reduce((acc, it) => acc + it.qty, 0);
  }, [slug, product.id]);

  function handleAdd() {
    if (addDisabled) return;
    const next = addItem(slug, {
      product_id: product.id,
      name: product.name,
      price_pence: computedPricePence,
      cover_url: product.cover_url,
      variant_label: selectedVariant?.label ?? null,
      qty: Math.max(1, Math.min(99, qty))
    });
    setToast(`Added — ${cartItemCount(next)} in cart`);
    window.setTimeout(() => setToast(null), 2400);
  }

  return (
    <div className="flex flex-col gap-4">
      {hasVariants && (
        <VariantPicker
          variants={variants}
          axis={variantAxis}
          selectedIdx={selectedVariantIdx}
          onPick={setSelectedVariantIdx}
          selectedVariant={selectedVariant}
          basePricePence={product.price_pence}
        />
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3">
        <div>
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: "#FFB300" }}
          >
            Quantity
          </p>
          <p className="mt-1 text-[13px] text-neutral-500">
            {matchedTier ? "Tier price applied" : "Base price"}
          </p>
        </div>
        <div className="inline-flex items-center overflow-hidden rounded-lg border border-neutral-200">
          <button
            type="button"
            onClick={() => setQty(Math.max(1, qty - 1))}
            aria-label="Decrease quantity"
            disabled={qty <= 1}
            className="inline-flex h-11 w-11 items-center justify-center text-base font-extrabold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-40"
          >
            −
          </button>
          <span className="inline-flex h-11 min-w-[2.25rem] items-center justify-center bg-white px-2 text-sm font-extrabold text-neutral-900">
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty(Math.min(99, qty + 1))}
            aria-label="Increase quantity"
            disabled={qty >= 99}
            className="inline-flex h-11 w-11 items-center justify-center text-base font-extrabold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-40"
          >
            +
          </button>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">
            Line total
          </p>
          <p className="mt-1 text-base font-extrabold text-neutral-900">
            {formatGbp(lineTotalPence)}
          </p>
        </div>
      </div>

      {currentQty > 0 && (
        <p
          className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-extrabold"
          style={{ background: themeColor, color: "#0A0A0A" }}
        >
          {currentQty} in your cart
        </p>
      )}

      <button
        type="button"
        onClick={handleAdd}
        disabled={addDisabled}
        aria-disabled={addDisabled}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-extrabold uppercase tracking-wider text-white shadow-lg transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          background: outOfStock ? "#737373" : "#0F7A3F",
          boxShadow: outOfStock ? undefined : "0 8px 22px rgba(15,122,63,0.45)"
        }}
      >
        {outOfStock ? (
          <>Out of stock — message on WhatsApp</>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            Add to enquiry
          </>
        )}
      </button>
      {needsVariantPick && !outOfStock && (
        <p className="text-center text-[13px] font-bold text-neutral-500">
          Choose a {variantAxis} above
        </p>
      )}

      {toast && (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-24 z-[110] flex justify-center px-4"
          role="status"
          aria-live="polite"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2.5 text-[13px] font-extrabold text-white shadow-xl">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFB300" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            {toast}
          </span>
        </div>
      )}
    </div>
  );
}

function VariantPicker({
  variants,
  axis,
  selectedIdx,
  onPick,
  selectedVariant,
  basePricePence
}: {
  variants: Variant[];
  axis: "size" | "colour";
  selectedIdx: number | null;
  onPick: (i: number) => void;
  selectedVariant: Variant | null;
  basePricePence: number;
}) {
  const eyebrowLabel = axis === "colour" ? "CHOOSE COLOUR" : "CHOOSE SIZE";
  const computedPence = selectedVariant
    ? basePricePence + (selectedVariant.price_delta_pence ?? 0)
    : null;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <p
        className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
        style={{ color: "#FFB300" }}
      >
        {eyebrowLabel}
      </p>
      <div role="radiogroup" aria-label={eyebrowLabel} className="flex flex-wrap gap-2">
        {variants.map((v, i) => {
          const isActive = selectedIdx === i;
          const disabled =
            v.stock_count !== undefined && v.stock_count !== null && v.stock_count <= 0;
          return (
            <button
              key={`${v.label}-${i}`}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-disabled={disabled}
              disabled={disabled}
              onClick={() => !disabled && onPick(i)}
              className={`inline-flex h-11 min-w-[44px] items-center justify-center rounded-full border-2 px-3 text-[13px] font-extrabold transition active:scale-[0.98] ${
                disabled
                  ? "cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400 line-through decoration-2"
                  : isActive
                    ? "border-[#FFB300] bg-[#FFB300] text-neutral-900 shadow-sm"
                    : "border-neutral-300 bg-white text-neutral-800 hover:border-[#FFB300]"
              }`}
            >
              {v.label}
            </button>
          );
        })}
      </div>
      {selectedVariant && computedPence !== null && (
        <p className="text-[13px] font-bold text-neutral-700">
          {formatGbp(computedPence)} · {selectedVariant.label}
        </p>
      )}
    </div>
  );
}
