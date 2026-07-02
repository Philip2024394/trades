"use client";

/**
 * @fileoverview MERCHANT-ONLY component.
 * @merchantOnly Only renders when isStorefrontOn(listing) === true.
 * Importing this from a service-trade context is a code smell — use
 * the service/ siblings instead.
 */


// Per-product PDP add-to-enquiry island.
//
// Mirrors the ProductModal's add-to-cart logic but lives on a full page
// instead of a lightbox. Handles variant picking, bulk-tier price
// computation, and the cart write.
//
// Layout (PDP refinement 2026-06-28):
//   - The qty +/- stepper has been LIFTED out of this component into the
//     price row on the PDP (see QtyStepper.tsx). We still need qty here
//     for the line-total math, so we mirror it via localStorage + a
//     CustomEvent the QtyStepper dispatches.
//   - Base price + Line total render on their own row ABOVE the CTAs.
//   - Add-to-cart + (optional) Enquiry Now share a single full-width row
//     via a 2-col grid when `enquireHref` is provided.

import { useEffect, useMemo, useState } from "react";
import type { HammerexXratedProduct } from "@/lib/supabase";
import { addItem, formatGbp } from "@/lib/xratedCart";
import { tierForQty } from "./BulkTierTable";
import { QTY_CHANGE_EVENT, QTY_STORAGE_KEY } from "./QtyStepper";

type Variant = HammerexXratedProduct["variants"][number];

type QtyChangeDetail = { productId: string; qty: number };

function clampQty(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(99, Math.floor(n)));
}

export function ProductPageAddToCart({
  product,
  slug,
  themeColor: _themeColor,
  enquireHref
}: {
  product: HammerexXratedProduct;
  slug: string;
  themeColor: string;
  /** When provided, renders the Enquiry Now anchor side-by-side with the
   *  Add-to-cart button so they share a single row. Without it the
   *  Add-to-cart button takes the full width on its own. */
  enquireHref?: string;
}) {
  const variants = product.variants ?? [];
  const hasVariants = variants.length > 0;
  const variantAxis: "size" | "colour" | "model" | "material" | "custom" =
    hasVariants ? variants[0].axis : "size";
  const variantAxisCustomLabel: string | null = hasVariants
    ? variants[0].axis_label ?? null
    : null;

  const [selectedVariantIdx, setSelectedVariantIdx] = useState<number | null>(null);
  const [qty, setQty] = useState<number>(1);
  const [toast, setToast] = useState<string | null>(null);

  // Mirror the lifted QtyStepper's value. Initial hydration from
  // localStorage + subscription to the CustomEvent fired by QtyStepper.
  useEffect(() => {
    const key = `${QTY_STORAGE_KEY}:${product.id}`;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setQty(clampQty(Number(raw)));
    } catch {
      /* ignore */
    }
    function onChange(e: Event) {
      const detail = (e as CustomEvent<QtyChangeDetail>).detail;
      if (!detail || detail.productId !== product.id) return;
      setQty(clampQty(detail.qty));
    }
    window.addEventListener(QTY_CHANGE_EVENT, onChange as EventListener);
    return () => {
      window.removeEventListener(QTY_CHANGE_EVENT, onChange as EventListener);
    };
  }, [product.id]);

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

  const basePricePence = product.price_pence + (selectedVariant?.price_delta_pence ?? 0);
  const computedPricePence = useMemo(() => {
    const delta = selectedVariant?.price_delta_pence ?? 0;
    const base = matchedTier ? matchedTier.price_pence : product.price_pence;
    return base + (delta ?? 0);
  }, [product.price_pence, selectedVariant, matchedTier]);

  const lineTotalPence = computedPricePence * Math.max(1, qty);

  function handleAdd() {
    if (addDisabled) return;
    addItem(slug, {
      product_id: product.id,
      name: product.name,
      price_pence: computedPricePence,
      cover_url: product.cover_url,
      variant_label: selectedVariant?.label ?? null,
      bulk_tiers: bulkTiers.length > 0 ? bulkTiers : null,
      qty: Math.max(1, Math.min(99, qty))
    });
    setToast("Added to enquiry");
    window.setTimeout(() => setToast(null), 2400);
  }

  const freeDeliveryMinQty =
    typeof product.free_delivery_min_qty === "number" &&
    product.free_delivery_min_qty > 0
      ? product.free_delivery_min_qty
      : null;
  const freeDeliveryUnlocked =
    freeDeliveryMinQty !== null && qty >= freeDeliveryMinQty;

  return (
    <div className="flex w-full flex-col gap-3">
      {freeDeliveryMinQty !== null && (
        <div
          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-extrabold"
          style={{
            background: freeDeliveryUnlocked ? "#0F513215" : "#FFF8E5",
            color: freeDeliveryUnlocked ? "#0F5132" : "#7A4F00",
            borderColor: freeDeliveryUnlocked ? "#0F5132" : "#FFB300"
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M1 3h15v13H1z" />
            <path d="M16 8h4l3 3v5h-7" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
          </svg>
          {freeDeliveryUnlocked
            ? "Free delivery unlocked on this order"
            : `Free delivery on ${freeDeliveryMinQty}+ — within our delivery zones`}
        </div>
      )}

      {hasVariants && (
        <VariantPicker
          variants={variants}
          axis={variantAxis}
          axisCustomLabel={variantAxisCustomLabel}
          selectedIdx={selectedVariantIdx}
          onPick={setSelectedVariantIdx}
          selectedVariant={selectedVariant}
          basePricePence={product.price_pence}
        />
      )}

      {/* Base price + Line total — own row, no qty stepper here anymore
          (the stepper lives on the price row via QtyStepper). qty is
          still mirrored via localStorage so the line-total stays
          accurate. */}
      <div className="flex flex-col gap-1 sm:items-end">
        <div className="flex w-full items-baseline justify-between gap-3 sm:w-auto sm:justify-end">
          <span className="text-[13px] font-bold text-neutral-500">
            Line total
          </span>
          {/* Same size as PriceDisplay (text-3xl sm:text-4xl) so the
           *  line-total reads as the headline price the buyer commits to. */}
          <span className="text-3xl font-extrabold text-neutral-900 sm:text-4xl">
            {formatGbp(lineTotalPence)}
          </span>
        </div>
      </div>

      {/* Bottom CTAs — Add to cart + (optional) Enquiry Now share a
          single full-width row. When enquireHref is omitted the Add to
          cart button takes the row alone. */}
      <div className={enquireHref ? "grid grid-cols-2 gap-2" : "block"}>
        <button
          type="button"
          onClick={handleAdd}
          disabled={addDisabled}
          aria-disabled={addDisabled}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-extrabold uppercase tracking-wider shadow-lg transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            background: outOfStock ? "#737373" : "#FFB300",
            color: outOfStock ? "#FFFFFF" : "#0A0A0A",
            boxShadow: outOfStock ? undefined : "0 8px 22px rgba(255,179,0,0.45)"
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
              Add to cart
            </>
          )}
        </button>
        {enquireHref && (
          <a
            href={enquireHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-extrabold uppercase tracking-wider text-white shadow-lg transition active:scale-[0.98]"
            style={{ background: "#0F7A3F", boxShadow: "0 8px 22px rgba(15,122,63,0.45)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Zm-7.05 15.4a8.36 8.36 0 0 1-4.27-1.17l-.3-.18-3.34.87.89-3.26-.2-.33A8.32 8.32 0 1 1 12 20.31Z" />
            </svg>
            Enquiry Now
          </a>
        )}
      </div>
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
  axisCustomLabel,
  selectedIdx,
  onPick,
  selectedVariant,
  basePricePence
}: {
  variants: Variant[];
  axis: "size" | "colour" | "model" | "material" | "custom";
  axisCustomLabel: string | null;
  selectedIdx: number | null;
  onPick: (i: number) => void;
  selectedVariant: Variant | null;
  basePricePence: number;
}) {
  const eyebrowLabel = (() => {
    if (axis === "colour") return "CHOOSE COLOUR";
    if (axis === "model") return "CHOOSE MODEL";
    if (axis === "material") return "CHOOSE MATERIAL";
    if (axis === "custom") {
      const trimmed = (axisCustomLabel ?? "").trim();
      return trimmed.length > 0 ? `CHOOSE ${trimmed.toUpperCase()}` : "CHOOSE OPTION";
    }
    return "CHOOSE SIZE";
  })();
  const computedPence = selectedVariant
    ? basePricePence + (selectedVariant.price_delta_pence ?? 0)
    : null;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <p
        className="text-[13px] font-extrabold uppercase tracking-[0.18em]"
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
