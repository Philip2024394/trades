"use client";

// Xrated Shop Mode — product detail lightbox.
//
// Yellow ring-4 modal that opens when a customer taps a product card.
// Image gallery (cover + up to 3 gallery photos), description, price,
// stock + dispatch lines, and the "Add to enquiry" CTA. The CTA writes
// to the per-tradesperson localStorage cart and closes the modal after
// a brief confirmation. Out-of-stock products surface a WhatsApp
// fallback so the customer can still ask.
//
// Scroll model: ONE outer scroll container (the rounded yellow-ring
// panel itself). Image + content + sticky action row all stack inside
// it — no nested overflow-y-auto. Previously a `flex-1 overflow-y-auto`
// inner div was scrolling against the outer panel, producing the
// "sidebar scrollbar from the popup" complaint.
//
// Flip behaviour: the same panel houses two faces — the product detail
// view and the per-product reviews chart (ProductReviewsChart). Tapping
// the star row OR the "View reviews" button cross-fades the body to the
// chart. The action row stays anchored at the bottom on both faces;
// the chart face renders its own "Back to product" button at the top
// of the scrollable area, plus the action row's outline button doubles
// as the back path so customers always have two ways back.
//
// Phase 2 additions:
//   – Variant picker (size / colour chips) shown ABOVE the description
//     when product.variants.length > 0. Picking a chip live-updates the
//     displayed price (price_pence + price_delta_pence). The action row
//     is disabled until a chip is picked. Cart-add sends variant_label
//     so two sizes of the same product cohabit as separate cart lines.
//   – Size chart sub-overlay layered on top of the modal body with
//     `absolute inset-0 z-10` (no second portal) when size_chart_url is
//     set. "View size chart" button lives next to the variant eyebrow.

import { useEffect, useMemo, useState } from "react";
import type { HammerexXratedProduct } from "@/lib/supabase";
import { addItem, cartItemCount, readCart, formatGbp } from "@/lib/xratedCart";
import { CompareProductsModal } from "./CompareProductsModal";
import {
  ProductReviewsChart,
  type ProductStats
} from "./ProductReviewsChart";

// Mirror of ServicesTabbedGallery's RATING_BADGE_MIN — we only show the
// star row above the price when the product has at least 3 live reviews
// so a single 5-star outlier doesn't game the surface.
const RATING_BADGE_MIN = 3;

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
  // Drop trailing zero pence on whole-pound deltas for chip compactness:
  // "+£2" instead of "+£2.00" reads cleaner at 13px.
  const display = pounds % 1 === 0
    ? `£${pounds}`
    : `£${pounds.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return ` · ${sign}${display}`;
}

export function ProductModal({
  product,
  slug,
  siblings,
  themeColor,
  onClose
}: {
  product: HammerexXratedProduct;
  slug: string;
  siblings: HammerexXratedProduct[];
  themeColor: string;
  onClose: () => void;
}) {
  const images = useMemo(() => {
    const all = [product.cover_url, ...(product.gallery_urls ?? [])].filter(
      (u): u is string => typeof u === "string" && u.length > 0
    );
    return Array.from(new Set(all)).slice(0, 4);
  }, [product]);
  const [active, setActive] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState<ProductStats | null>(null);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [selectedVariantIdx, setSelectedVariantIdx] = useState<number | null>(null);
  const [sizeChartOpen, setSizeChartOpen] = useState(false);

  const variants = product.variants ?? [];
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

  // Fetch product review stats on mount. Cached in component state so
  // flipping back and forth never re-fires the request, and the API
  // already sets s-maxage=60 to absorb adjacent product opens.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/trade-off/reviews/product-stats?product_id=${encodeURIComponent(product.id)}`,
          { method: "GET" }
        );
        const json = (await res.json()) as ProductStats & {
          ok: boolean;
          error?: string;
        };
        if (cancelled) return;
        if (json.ok) {
          setStats(json);
        } else {
          setStats(null);
        }
      } catch {
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setStatsLoaded(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [product.id]);

  // Parent-level stock + variant-level stock combine — if the parent is
  // OOS we treat the whole product as OOS; if a specific variant is OOS
  // we disable that chip; if the customer hasn't picked yet we require
  // the pick before enabling Add-to-enquiry.
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

  const computedPricePence = useMemo(() => {
    const delta = selectedVariant?.price_delta_pence ?? 0;
    return product.price_pence + (delta ?? 0);
  }, [product.price_pence, selectedVariant]);

  // Phase 2: Compare is always available. Manual siblings render
  // immediately; if there are none the modal auto-fetches from the
  // /siblings endpoint and renders an empty state if zero matches.
  const canCompare = true;

  const reviewCount = stats?.total ?? 0;
  const hasReviews = reviewCount > 0;
  const showStarRow = reviewCount >= RATING_BADGE_MIN && stats?.overall_avg != null;

  function handleAdd() {
    if (addDisabled) return;
    const next = addItem(slug, {
      product_id: product.id,
      name: product.name,
      price_pence: computedPricePence,
      cover_url: product.cover_url,
      variant_label: selectedVariant?.label ?? null
    });
    setToast(`Added — ${cartItemCount(next)} in cart`);
    window.setTimeout(() => {
      onClose();
    }, 800);
  }

  // Pre-read the cart for the modal-open lifetime so the "already in
  // cart" badge can show the customer they already added this once. We
  // sum across variants since the customer cares about total qty of
  // "this product" regardless of which size/colour they picked.
  const currentQty = useMemo(() => {
    const state = readCart(slug);
    return state.items
      .filter((it) => it.product_id === product.id)
      .reduce((acc, it) => acc + it.qty, 0);
  }, [slug, product.id]);

  const activeImage = images[active];

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${product.name} details`}
        className="fixed inset-0 z-[100] flex items-stretch justify-center bg-black/85 backdrop-blur sm:items-center sm:p-3"
        onClick={onClose}
      >
        {/* ONE scroll container — overflow-y-auto lives here and only
            here. Image, body, and the sticky action row all flow inside
            this single scroller, killing the inner-sidebar-scrollbar
            issue. max-h on mobile uses dvh so the toolbar doesn't clip
            the action row. */}
        <div
          className="relative flex w-full max-w-2xl flex-col overflow-y-auto bg-white shadow-2xl ring-4 ring-[#FFB300] sm:max-h-[92vh] sm:rounded-2xl"
          style={{ maxHeight: "100dvh" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur-sm transition hover:bg-black"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Flip face — simple cross-fade swap rather than a 3D
              rotateY because Safari can't keep transform-style: preserve-3d
              jank-free inside a scroller; the fade is identical UX
              without the cost. */}
          <div
            className={`transition-opacity duration-300 ${flipped ? "opacity-0 pointer-events-none absolute inset-0" : "opacity-100"}`}
            aria-hidden={flipped}
          >
            <ProductDetailView
              product={product}
              images={images}
              active={active}
              setActive={setActive}
              activeImage={activeImage}
              currentQty={currentQty}
              themeColor={themeColor}
              showStarRow={showStarRow}
              overallAvg={stats?.overall_avg ?? null}
              reviewCount={reviewCount}
              onTapStars={() => setFlipped(true)}
              variants={variants}
              variantAxis={variantAxis}
              selectedVariantIdx={selectedVariantIdx}
              onPickVariant={setSelectedVariantIdx}
              computedPricePence={computedPricePence}
              selectedVariant={selectedVariant}
              onOpenSizeChart={() => setSizeChartOpen(true)}
              hasSizeChart={Boolean(product.size_chart_url)}
            />
          </div>

          <div
            className={`transition-opacity duration-300 ${flipped ? "opacity-100" : "opacity-0 pointer-events-none absolute inset-0"}`}
            aria-hidden={!flipped}
          >
            <ProductReviewsChart
              product={product}
              stats={stats}
              onBack={() => setFlipped(false)}
            />
          </div>

          <div
            className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-neutral-200 bg-white p-4 sm:flex-row sm:p-5"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            {flipped ? (
              <button
                type="button"
                onClick={() => setFlipped(false)}
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-extrabold uppercase tracking-wider text-white shadow-lg transition active:scale-[0.98]"
                style={{ background: "#0A0A0A" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m15 18-6-6 6-6" />
                </svg>
                Back to product
              </button>
            ) : (
              <>
                <div className="flex flex-1 flex-col gap-1">
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
                </div>
                <button
                  type="button"
                  onClick={() => hasReviews && setFlipped(true)}
                  disabled={!hasReviews || !statsLoaded}
                  aria-disabled={!hasReviews || !statsLoaded}
                  className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl border-2 border-neutral-300 bg-white px-5 text-[13px] font-extrabold uppercase tracking-wider text-neutral-700 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="6" y1="20" x2="6" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="18" y1="20" x2="18" y2="14" />
                  </svg>
                  {hasReviews ? "View reviews" : "No reviews yet"}
                </button>
                {canCompare && (
                  <button
                    type="button"
                    onClick={() => setCompareOpen(true)}
                    className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl border-2 border-neutral-300 bg-white px-5 text-[13px] font-extrabold uppercase tracking-wider text-neutral-700 transition active:scale-[0.98]"
                  >
                    Compare
                  </button>
                )}
              </>
            )}
          </div>

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

          {sizeChartOpen && product.size_chart_url && (
            <SizeChartOverlay
              imageUrl={product.size_chart_url}
              unit={product.size_chart_unit}
              onClose={() => setSizeChartOpen(false)}
            />
          )}
        </div>
      </div>

      {compareOpen && (
        <CompareProductsModal
          anchor={product}
          siblings={siblings}
          slug={slug}
          themeColor={themeColor}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </>
  );
}

function ProductDetailView({
  product,
  images,
  active,
  setActive,
  activeImage,
  currentQty,
  themeColor,
  showStarRow,
  overallAvg,
  reviewCount,
  onTapStars,
  variants,
  variantAxis,
  selectedVariantIdx,
  onPickVariant,
  computedPricePence,
  selectedVariant,
  onOpenSizeChart,
  hasSizeChart
}: {
  product: HammerexXratedProduct;
  images: string[];
  active: number;
  setActive: (i: number) => void;
  activeImage: string | undefined;
  currentQty: number;
  themeColor: string;
  showStarRow: boolean;
  overallAvg: number | null;
  reviewCount: number;
  onTapStars: () => void;
  variants: Variant[];
  variantAxis: "size" | "colour";
  selectedVariantIdx: number | null;
  onPickVariant: (i: number) => void;
  computedPricePence: number;
  selectedVariant: Variant | null;
  onOpenSizeChart: () => void;
  hasSizeChart: boolean;
}) {
  const hasVariants = variants.length > 0;
  const eyebrowLabel = variantAxis === "colour" ? "CHOOSE COLOUR" : "CHOOSE SIZE";

  return (
    <div>
      <div className="relative w-full bg-neutral-100" style={{ aspectRatio: "1 / 1" }}>
        {activeImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={activeImage}
            alt={`${product.name} — photo ${active + 1}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[13px] text-neutral-400">
            No image yet
          </div>
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
                i === active ? "border-[#FFB300]" : "border-transparent opacity-70"
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
            {product.name}
          </h2>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-neutral-900 sm:text-3xl">
              {formatGbp(computedPricePence)}
            </span>
            {selectedVariant && (
              <span className="text-[13px] font-bold text-neutral-500">
                {variantAxis === "colour" ? "Colour" : "Size"}: {selectedVariant.label}
              </span>
            )}
          </p>
          {showStarRow && overallAvg !== null && (
            <button
              type="button"
              onClick={onTapStars}
              className="mt-2 inline-flex h-11 items-center gap-2 rounded-xl px-2 -ml-2 text-left transition active:scale-[0.98] hover:bg-neutral-50"
              aria-label={`${overallAvg.toFixed(1)} out of 5 — view all reviews`}
            >
              <span className="flex items-center gap-0.5" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((i) => (
                  <svg
                    key={i}
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill={i <= Math.round(overallAvg) ? "#FFB300" : "none"}
                    stroke="#FFB300"
                    strokeWidth="1.75"
                  >
                    <path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
                  </svg>
                ))}
              </span>
              <span className="text-[13px] font-extrabold text-neutral-900">
                {overallAvg.toFixed(1)}
              </span>
              <span className="text-[13px] text-neutral-500">
                ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
              </span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <StockPill stock={product.stock_count} />
          {typeof product.dispatch_days === "number" && product.dispatch_days > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 font-bold text-neutral-700">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="1" y="3" width="15" height="13" />
                <path d="M16 8h4l3 3v5h-7z" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
              Ships in {product.dispatch_days}{" "}
              {product.dispatch_days === 1 ? "day" : "days"}
            </span>
          )}
          {currentQty > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-extrabold"
              style={{ background: themeColor, color: "#0A0A0A" }}
            >
              {currentQty} in your cart
            </span>
          )}
        </div>

        {hasVariants && (
          <VariantPicker
            variants={variants}
            axis={variantAxis}
            eyebrowLabel={eyebrowLabel}
            selectedIdx={selectedVariantIdx}
            onPick={onPickVariant}
            selectedVariant={selectedVariant}
            hasSizeChart={hasSizeChart}
            onOpenSizeChart={onOpenSizeChart}
            basePricePence={product.price_pence}
          />
        )}
        {/* If the product has no variants but DOES have a size chart
            (rare — usually paired with sizes, but render-defensively),
            still surface the chart link below the metadata row. */}
        {!hasVariants && hasSizeChart && (
          <button
            type="button"
            onClick={onOpenSizeChart}
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

        {product.description && (
          <p className="text-[13px] leading-relaxed text-neutral-700 sm:text-sm">
            {product.description}
          </p>
        )}
      </div>
    </div>
  );
}

function VariantPicker({
  variants,
  axis,
  eyebrowLabel,
  selectedIdx,
  onPick,
  selectedVariant,
  hasSizeChart,
  onOpenSizeChart,
  basePricePence
}: {
  variants: Variant[];
  axis: "size" | "colour";
  eyebrowLabel: string;
  selectedIdx: number | null;
  onPick: (i: number) => void;
  selectedVariant: Variant | null;
  hasSizeChart: boolean;
  onOpenSizeChart: () => void;
  basePricePence: number;
}) {
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
      className="absolute inset-0 z-30 flex flex-col bg-white"
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
            Back to product
          </button>
        </div>
      </div>
    </div>
  );
}

function StockPill({ stock }: { stock: number | null }) {
  if (stock === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[13px] font-bold text-neutral-700">
        Available on enquiry
      </span>
    );
  }
  if (stock <= 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-extrabold text-white" style={{ background: "#DC2626" }}>
        Out of stock
      </span>
    );
  }
  if (stock <= 5) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-extrabold text-white" style={{ background: "#F97316" }}>
        Only {stock} left
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-extrabold text-neutral-900" style={{ background: "#FFB300" }}>
      In stock
    </span>
  );
}
