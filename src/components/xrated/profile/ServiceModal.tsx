"use client";

// Xrated Services Prices add-on — service-tile lightbox.
//
// Parallel to ProductModal (we deliberately fork it for now — see Phase 2
// note in the add-on spec — to avoid stepping on the concurrent ProductModal
// edit). Differences vs ProductModal:
//   – No stock pill (services don't run out).
//   – Yellow brand pill carries the `unit` ("PER TREE", "PER HOUR"…).
//   – Dispatch-days line reads "Lead time" instead of "Ships in".
//   – Two CTAs side-by-side on mobile: WhatsApp Enquire (green) +
//     Add to service cart (yellow). Enquire is the fast path for big jobs
//     ("can you do my whole garden?"); Add-to-cart bundles smaller items.
//
// Phase 2: services can also carry variants — "1-day hire / 7-day hire
// / monthly", "Small / Medium / Large garden", etc. Same picker pattern
// as ProductModal: chips required before Add-to-cart; selected variant
// label flows to cart + WhatsApp message; size-chart overlay layers on
// top when size_chart_url is set.

import { useEffect, useMemo, useState } from "react";
import type { HammerexXratedProduct, HammerexTradeOffListing } from "@/lib/supabase";
import { addItem, cartItemCount, readCart, formatGbp } from "@/lib/xratedCart";
import { whatsappDigits } from "@/lib/tradeOff";
import { AvailabilityPill } from "./AvailabilityPill";

type Variant = HammerexXratedProduct["variants"][number];

function variantStockLabel(stock: number | null | undefined): string {
  if (stock === null || stock === undefined) return "Available";
  if (stock <= 0) return "Out of stock";
  if (stock <= 5) return `${stock} left`;
  return "In stock";
}

function variantStockTone(stock: number | null | undefined): string {
  if (stock === null || stock === undefined) return "text-neutral-500";
  if (stock <= 0) return "text-red-600";
  if (stock <= 5) return "text-orange-600";
  return "text-emerald-700";
}

function formatDelta(delta: number | null | undefined): string {
  if (!delta || delta === 0) return "";
  const sign = delta > 0 ? "+" : "−";
  const abs = Math.abs(delta);
  const pounds = abs / 100;
  const display = pounds % 1 === 0
    ? `£${pounds}`
    : `£${pounds.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return ` · ${sign}${display}`;
}

export function ServiceModal({
  service,
  listing,
  onClose
}: {
  service: HammerexXratedProduct;
  listing: HammerexTradeOffListing;
  onClose: () => void;
}) {
  const slug = listing.slug;
  const images = useMemo(() => {
    const all = [service.cover_url, ...(service.gallery_urls ?? [])].filter(
      (u): u is string => typeof u === "string" && u.length > 0
    );
    return Array.from(new Set(all)).slice(0, 4);
  }, [service]);
  const [active, setActive] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedVariantIdx, setSelectedVariantIdx] = useState<number | null>(
    null
  );
  const [sizeChartOpen, setSizeChartOpen] = useState(false);

  const variants = service.variants ?? [];
  const hasVariants = variants.length > 0;
  const variantAxis: "size" | "colour" =
    hasVariants ? variants[0].axis : "size";
  const selectedVariant: Variant | null =
    selectedVariantIdx !== null ? variants[selectedVariantIdx] ?? null : null;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (sizeChartOpen) {
          setSizeChartOpen(false);
          return;
        }
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, sizeChartOpen]);

  const computedPricePence = useMemo(() => {
    const delta = selectedVariant?.price_delta_pence ?? 0;
    return service.price_pence + (delta ?? 0);
  }, [service.price_pence, selectedVariant]);

  const variantOutOfStock =
    selectedVariant !== null &&
    selectedVariant.stock_count !== undefined &&
    selectedVariant.stock_count !== null &&
    selectedVariant.stock_count <= 0;
  const needsVariantPick = hasVariants && selectedVariantIdx === null;
  const addDisabled = needsVariantPick || variantOutOfStock;

  function handleAdd() {
    if (addDisabled) return;
    const next = addItem(slug, {
      product_id: service.id,
      name: service.name,
      price_pence: computedPricePence,
      cover_url: service.cover_url,
      unit: service.unit,
      variant_label: selectedVariant?.label ?? null
    });
    setToast(`Added — ${cartItemCount(next)} in cart`);
    window.setTimeout(() => onClose(), 800);
  }

  // Sum across variants so the badge reflects total of "this service"
  // regardless of the customer's option mix.
  const currentQty = useMemo(() => {
    const state = readCart(slug);
    return state.items
      .filter((it) => it.product_id === service.id)
      .reduce((acc, it) => acc + it.qty, 0);
  }, [slug, service.id]);

  const activeImage = images[active];
  const unitLabel = service.unit?.trim() || null;
  const firstName =
    listing.display_name.split(/\s+/)[0] ?? listing.display_name;
  const waDigits = whatsappDigits(listing.whatsapp);
  // Include the variant in the WhatsApp enquire string so the
  // tradesperson immediately knows which option the customer wants —
  // critical for hire-period variants like "1-day hire / 7-day hire".
  const variantSuffix =
    selectedVariant !== null
      ? ` (${variantAxis === "colour" ? "Colour" : "Size"}: ${selectedVariant.label})`
      : "";
  const enquireMsg = encodeURIComponent(
    [
      `Hi ${firstName} — I'd like to enquire about:`,
      `• ${service.name}${variantSuffix}${unitLabel ? ` (${unitLabel})` : ""}`,
      `Listed: ${formatGbp(computedPricePence)}${unitLabel ? ` ${unitLabel}` : ""}`,
      "",
      "Could you confirm availability + final price?"
    ].join("\n")
  );
  const waHref = `https://wa.me/${waDigits}?text=${enquireMsg}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${service.name} details`}
      className="fixed inset-0 z-[100] flex items-stretch justify-center bg-black/85 backdrop-blur sm:items-center sm:p-3"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl ring-4 ring-[#FFB300] sm:max-h-[95vh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur-sm transition hover:bg-black"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="flex-1 overflow-y-auto">
          <div
            className="relative w-full bg-neutral-100"
            style={{ aspectRatio: "1 / 1" }}
          >
            {activeImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={activeImage}
                alt={`${service.name} — photo ${active + 1}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
                No image yet
              </div>
            )}
            {unitLabel && (
              <span
                className="absolute left-3 top-3 inline-flex items-center rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-neutral-900 shadow-md"
                style={{ background: "#FFB300" }}
              >
                {unitLabel}
              </span>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto border-b border-neutral-100 bg-neutral-50 px-3 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`Show photo ${i + 1}`}
                  aria-pressed={i === active}
                  className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                    i === active
                      ? "border-[#FFB300]"
                      : "border-transparent opacity-70"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3 p-5 sm:p-6">
            <div>
              <h2 className="text-lg font-extrabold leading-tight text-neutral-900 sm:text-xl">
                {service.name}
              </h2>
              <p className="mt-2 flex flex-wrap items-baseline gap-2">
                <span className="text-2xl font-extrabold text-neutral-900 sm:text-3xl">
                  {formatGbp(computedPricePence)}
                </span>
                {unitLabel && (
                  <span className="text-[13px] font-bold text-neutral-500 sm:text-sm">
                    {unitLabel}
                  </span>
                )}
                {selectedVariant && (
                  <span className="text-[13px] font-bold text-neutral-500">
                    · {variantAxis === "colour" ? "Colour" : "Size"}: {selectedVariant.label}
                  </span>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              {service.category && (
                <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 font-bold text-neutral-700">
                  {service.category}
                </span>
              )}
              {typeof service.dispatch_days === "number" &&
                service.dispatch_days > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 font-bold text-neutral-700">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    Lead time {service.dispatch_days}{" "}
                    {service.dispatch_days === 1 ? "day" : "days"}
                  </span>
                )}
              {currentQty > 0 && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-extrabold"
                  style={{ background: "#FFB300", color: "#0A0A0A" }}
                >
                  {currentQty} in your cart
                </span>
              )}
            </div>

            {hasVariants && (
              <VariantPicker
                variants={variants}
                axis={variantAxis}
                selectedIdx={selectedVariantIdx}
                onPick={setSelectedVariantIdx}
                selectedVariant={selectedVariant}
                hasSizeChart={Boolean(service.size_chart_url)}
                onOpenSizeChart={() => setSizeChartOpen(true)}
                basePricePence={service.price_pence}
                unitLabel={unitLabel}
              />
            )}
            {!hasVariants && service.size_chart_url && (
              <button
                type="button"
                onClick={() => setSizeChartOpen(true)}
                className="inline-flex h-11 w-fit items-center gap-1.5 rounded-lg border-2 border-neutral-300 bg-white px-3 text-[13px] font-extrabold uppercase tracking-wider text-neutral-700 transition active:scale-[0.98]"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                  <line x1="15" y1="3" x2="15" y2="21" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                </svg>
                View size chart
              </button>
            )}

            {service.description && (
              <p className="text-[13px] leading-relaxed text-neutral-700 sm:text-sm">
                {service.description}
              </p>
            )}
          </div>
        </div>

        <div
          className="sticky bottom-0 flex flex-col gap-3 border-t border-neutral-200 bg-white p-4 sm:p-5"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <AvailabilityPill
            acceptingJobs={Boolean(listing.accepting_jobs)}
            operatingHours={listing.operating_hours ?? null}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-extrabold uppercase tracking-wider text-white shadow-lg transition active:scale-[0.98]"
            style={{
              background: "#0F7A3F",
              boxShadow: "0 8px 22px rgba(15,122,63,0.45)"
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Z" />
            </svg>
            Enquire now
          </a>
          <div className="flex flex-1 flex-col gap-1 sm:flex-none">
            <button
              type="button"
              onClick={handleAdd}
              disabled={addDisabled}
              aria-disabled={addDisabled}
              className="inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-xl px-5 text-sm font-extrabold uppercase tracking-wider text-neutral-900 shadow-lg transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: "#FFB300",
                boxShadow: addDisabled ? undefined : "0 8px 22px rgba(255,179,0,0.45)"
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              Add to cart
            </button>
            {needsVariantPick && (
              <p className="text-center text-[13px] font-bold text-neutral-500">
                Choose a {variantAxis} above
              </p>
            )}
          </div>
          </div>
        </div>

        {toast && (
          <div
            className="pointer-events-none fixed inset-x-0 bottom-24 z-[110] flex justify-center px-4"
            role="status"
            aria-live="polite"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2.5 text-[13px] font-extrabold text-white shadow-xl">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FFB300"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {toast}
            </span>
          </div>
        )}

        {sizeChartOpen && service.size_chart_url && (
          <SizeChartOverlay
            imageUrl={service.size_chart_url}
            unit={service.size_chart_unit}
            onClose={() => setSizeChartOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

function VariantPicker({
  variants,
  axis,
  selectedIdx,
  onPick,
  selectedVariant,
  hasSizeChart,
  onOpenSizeChart,
  basePricePence,
  unitLabel
}: {
  variants: Variant[];
  axis: "size" | "colour";
  selectedIdx: number | null;
  onPick: (i: number) => void;
  selectedVariant: Variant | null;
  hasSizeChart: boolean;
  onOpenSizeChart: () => void;
  basePricePence: number;
  unitLabel: string | null;
}) {
  const eyebrowLabel = axis === "colour" ? "CHOOSE COLOUR" : "CHOOSE SIZE";
  const computedPence = selectedVariant
    ? basePricePence + (selectedVariant.price_delta_pence ?? 0)
    : null;
  const variantStock = selectedVariant?.stock_count;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
          style={{ color: "#FFB300" }}
        >
          {eyebrowLabel}
        </p>
        {hasSizeChart && axis === "size" && (
          <button
            type="button"
            onClick={onOpenSizeChart}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-neutral-300 bg-white px-2.5 text-[13px] font-extrabold uppercase tracking-wider text-neutral-700 transition active:scale-[0.98]"
            aria-label="View size chart"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <line x1="15" y1="3" x2="15" y2="21" />
              <line x1="3" y1="9" x2="21" y2="9" />
            </svg>
            View size chart
          </button>
        )}
      </div>
      <div
        role="radiogroup"
        aria-label={eyebrowLabel}
        className="flex flex-wrap gap-2"
      >
        {variants.map((v, i) => {
          const isActive = selectedIdx === i;
          const disabled =
            v.stock_count !== undefined &&
            v.stock_count !== null &&
            v.stock_count <= 0;
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
              {!disabled && formatDelta(v.price_delta_pence) && (
                <span className="ml-1 text-[13px] font-bold">
                  {formatDelta(v.price_delta_pence)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {selectedVariant && computedPence !== null && (
        <p className="flex flex-wrap items-baseline gap-2 text-[13px]">
          <span className="font-extrabold text-neutral-900">
            {formatGbp(computedPence)}
            {unitLabel ? ` ${unitLabel}` : ""}
          </span>
          <span className="text-neutral-400">·</span>
          <span className={`font-bold ${variantStockTone(variantStock)}`}>
            {variantStockLabel(variantStock)}
          </span>
        </p>
      )}
      {!selectedVariant && (
        <p className="text-[13px] font-bold text-neutral-500">
          Pick a {axis} to see the final price.
        </p>
      )}
    </div>
  );
}

function SizeChartOverlay({
  imageUrl,
  unit,
  onClose
}: {
  imageUrl: string;
  unit: HammerexXratedProduct["size_chart_unit"];
  onClose: () => void;
}) {
  const unitLabel = unit && unit !== "other" ? unit : "the supplied units";
  return (
    <div
      className="absolute inset-0 z-20 flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-label="Size chart"
    >
      <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 sm:px-5">
        <div>
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: "#FFB300" }}
          >
            Size chart
          </p>
          <p className="mt-0.5 text-[13px] font-extrabold text-neutral-900 sm:text-sm">
            Pick the right fit
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close size chart"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg transition hover:bg-black"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="flex w-full justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Size chart"
            className="h-auto max-h-[60vh] w-full max-w-2xl object-contain"
          />
        </div>
        <p className="mt-3 text-center text-[13px] text-neutral-600">
          Measurements in {unitLabel}.
        </p>
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-xl border-2 border-neutral-300 bg-white px-5 text-[13px] font-extrabold uppercase tracking-wider text-neutral-700 transition active:scale-[0.98]"
          >
            Back to service
          </button>
        </div>
      </div>
    </div>
  );
}
