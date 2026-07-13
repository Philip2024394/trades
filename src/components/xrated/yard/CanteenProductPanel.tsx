"use client";

// Canteen host's product showcase. Sits above the composer on the
// canteen page. Renders 3-5 featured products; clicking any card
// flips the canteen feed into a product-focus view (see
// CanteenProductFocus.tsx). Cross-syndicates to the platform-wide side
// lane automatically.
//
// Conditional: only renders when the host has products. Non-merchant
// hosts (e.g. a bricklayer running "UK Bricklayers") don't get an
// empty panel — nothing renders and the composer sits at the top.

import Link from "next/link";
import { ChevronRight, ShoppingBag, Store, Users, Package, Plus, TrendingUp, Zap, Star, Sparkles } from "lucide-react";
import type { CanteenProduct } from "@/lib/canteens";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";

// Continuous horizontal-scroll carousel — slides left, pauses on hover.
// Duplicates the list so the translateX(-50%) keyframe loops seamlessly.
const CAROUSEL_CSS = `
@keyframes canteen-shop-scroll-left {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.canteen-shop-carousel {
  animation: canteen-shop-scroll-left 90s linear infinite;
  will-change: transform;
}
.canteen-shop-shell:hover .canteen-shop-carousel { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) {
  .canteen-shop-carousel { animation: none; }
}
`;

export function CanteenProductPanel({
  hostDisplayName,
  canteenSlug,
  products,
  totalCount,
  onSelect,
  manageHref,
  hostRating = null
}: {
  hostDisplayName: string;
  /** Canteen slug — powers the "View all N products" link, routing
   *  to /trade-off/yard/canteens/{canteenSlug}/products. Missing slug
   *  hides the link so we never render a dead href on mobile. */
  canteenSlug?: string;
  products: CanteenProduct[];
  totalCount: number;
  onSelect: (productId: string) => void;
  /** Href to the canteen's manage dashboard product section — used by
   *  the empty-state conversion CTA so a merchant-host can add their
   *  first product in one tap. */
  manageHref?: string;
  /** Host's aggregate review rating. Rendered as a star chip in the
   *  top-right of every card (proxy for per-product ratings until the
   *  data model lands). Only pass when reviews.count >= 5 — the caller
   *  is responsible for the honesty gate. */
  hostRating?: { avg: number; count: number } | null;
}) {
  // Empty state — convert the host into a merchant instead of running
  // a third-party ad. The empty product panel is more valuable as a
  // conversion surface than as ad inventory.
  if (products.length === 0) {
    return (
      <div
        className="mb-4 overflow-hidden rounded-xl border shadow-sm"
        style={{
          borderColor: `${BRAND_YELLOW}66`,
          background: `linear-gradient(135deg, ${BRAND_YELLOW}22 0%, #FFFFFF 60%)`
        }}
      >
        <div className="flex items-start gap-3 p-4">
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl shadow-sm"
            style={{ backgroundColor: BRAND_BLACK }}
          >
            <Package size={18} color={BRAND_YELLOW} strokeWidth={2}/>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-black uppercase tracking-wider" style={{ color: BRAND_BLACK }}>
              {hostDisplayName}'s canteen · empty shop
            </div>
            <div className="mt-1 text-[14px] font-black text-neutral-900">
              Turn this canteen into a real shop.
            </div>
            <p className="mt-1 text-[12px] leading-snug text-neutral-600">
              Add your first product — it flows across every canteen on The Network. Merchants who list see 5× more profile visits and unlock the Founding 100 free-app perk faster.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {manageHref && (
                <Link
                  href={manageHref}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition active:scale-[0.97]"
                  style={{ backgroundColor: BRAND_YELLOW }}
                >
                  <Plus size={12} strokeWidth={2.5}/>
                  Add first product
                </Link>
              )}
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-neutral-500">
                <TrendingUp size={11}/>
                Included with Network Pro
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Duplicate so translateX(-50%) loops seamlessly (desktop marquee).
  const looped = [...products, ...products];

  return (
    <>
      {/* ── Mobile variant ─────────────────────────────────────
          No card container / border / shadow — just a clean header
          row and a native touch-swipe carousel. Snap-x mandatory
          makes cards settle into place; scrollbar hidden for a
          polished look. */}
      <div className="mb-4 md:hidden">
        <div className="mb-2 flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: BRAND_YELLOW }}
            />
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-800">
              Library of products
            </span>
          </div>
          {canteenSlug && totalCount > products.length && (
            <Link
              href={`/trade-off/yard/canteens/${canteenSlug}/products`}
              className="text-[10px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-800"
            >
              View all →
            </Link>
          )}
        </div>
        <div
          className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-3 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="group relative aspect-[4/5] w-[160px] flex-shrink-0 snap-start overflow-hidden rounded-xl border text-left shadow-md transition active:scale-[0.98]"
              style={{
                borderColor: "rgba(139,69,19,0.12)",
                backgroundImage: `url('${p.imageUrl}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundColor: "#F3F4F6"
              }}
            >
              {/* Bottom gradient — makes the overlaid name readable
                  against any image. */}
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-2/3"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 10%, rgba(0,0,0,0.35) 60%, transparent 100%)" }}
              />

              {/* Top-left chip stack: Featured / Bulk-buy */}
              <div className="absolute left-1.5 top-1.5 flex flex-col gap-1">
                {p.featured && (
                  <span
                    className="inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[8px] font-black uppercase tracking-wider shadow-md"
                    style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                  >
                    <Sparkles size={8} strokeWidth={3}/>
                    Featured
                  </span>
                )}
                {p.bulkBuy && (
                  <span
                    className="inline-flex items-center rounded-sm px-1 py-0.5 text-[8px] font-black uppercase tracking-wider text-white shadow-md"
                    style={{ backgroundColor: BRAND_GREEN_DARK }}
                  >
                    Bulk-buy
                  </span>
                )}
              </div>

              {/* Top-right: rating chip — hidden when host hasn't
                  earned it (count < 5, gate enforced by caller). */}
              {hostRating && (
                <span
                  className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-white/95 px-1.5 py-0.5 text-[9px] font-black shadow-md backdrop-blur"
                  style={{ color: BRAND_BLACK }}
                  title={`Seller rating · ${hostRating.count} reviews`}
                >
                  <Star size={9} fill={BRAND_BLACK} strokeWidth={0}/>
                  {hostRating.avg.toFixed(1)}
                </span>
              )}

              {/* Bottom content: name overlay + price chip */}
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2">
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-[12px] font-black leading-tight text-white drop-shadow-md">
                    {p.name}
                  </div>
                </div>
                <span
                  className="flex-shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-black shadow-md"
                  style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                >
                  £{p.priceGbp}
                </span>
              </div>
            </button>
          ))}
          {/* Sentinel end card — nudges users to the full list without
              needing them to find the header link. */}
          {canteenSlug && totalCount > products.length && (
            <Link
              href={`/trade-off/yard/canteens/${canteenSlug}/products`}
              className="flex w-[120px] flex-shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-3 text-center text-[10px] font-black uppercase tracking-wider text-neutral-600 transition active:scale-[0.98]"
              style={{ borderColor: "rgba(139,69,19,0.20)" }}
            >
              <ShoppingBag size={16} className="text-neutral-500"/>
              View all {totalCount}
            </Link>
          )}
        </div>
      </div>

      {/* ── Desktop variant ────────────────────────────────────
          Bordered card + auto-scrolling marquee — the original
          treatment. Hidden below md. */}
      <div
        className="canteen-shop-shell mb-4 hidden overflow-hidden rounded-xl border bg-white shadow-sm md:block"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
      <style>{CAROUSEL_CSS}</style>
      {/* Header — small strip; makes it clear these are host's products */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: "1px solid rgba(139,69,19,0.10)", backgroundColor: `${BRAND_YELLOW}0F` }}
      >
        <div className="flex items-center gap-1.5">
          <Store size={13} className="text-amber-700" />
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-700">
            Library of products
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-neutral-500">
          <Users size={10} />
          Trade prices
        </div>
      </div>

      {/* Product row — continuous left-moving carousel (pauses on hover).
          Duplicate the product list so translateX(-50%) loops seamlessly.
          Edge fades so tiles enter/exit softly instead of hard-clipping. */}
      <div
        className="relative overflow-hidden p-3"
        style={{
          maskImage: "linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)",
          WebkitMaskImage: "linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)"
        }}
      >
        <div className="canteen-shop-carousel flex w-max gap-2">
        {looped.map((p, i) => (
          <button
            key={`${p.id}-${i}`}
            onClick={() => onSelect(p.id)}
            className="group relative aspect-[4/5] w-[140px] flex-shrink-0 overflow-hidden rounded-lg border text-left shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
            style={{
              borderColor: "rgba(139,69,19,0.12)",
              backgroundImage: `url('${p.imageUrl}')`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundColor: "#F3F4F6"
            }}
          >
            {/* Bottom gradient — makes overlaid name legible */}
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-2/3"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 10%, rgba(0,0,0,0.35) 60%, transparent 100%)" }}
            />

            {/* Top-left chip stack */}
            <div className="absolute left-1.5 top-1.5 flex flex-col gap-1">
              {p.featured && (
                <span
                  className="inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[8px] font-black uppercase tracking-wider shadow-md"
                  style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                >
                  <Sparkles size={8} strokeWidth={3}/>
                  Featured
                </span>
              )}
              {p.bulkBuy && (
                <span
                  className="inline-flex items-center rounded-sm px-1 py-0.5 text-[8px] font-black uppercase tracking-wider text-white shadow-md"
                  style={{ backgroundColor: BRAND_GREEN_DARK }}
                >
                  Bulk · {p.bulkBuy.committedCount}/{p.bulkBuy.targetCount}
                </span>
              )}
              {p.boost?.expiresAt && Date.parse(p.boost.expiresAt) > Date.now() && (
                <span
                  className="inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[8px] font-black uppercase tracking-wider shadow-md"
                  style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                  title="Boosted across all canteens"
                >
                  <Zap size={8} strokeWidth={3}/>
                  Boosted
                </span>
              )}
            </div>

            {/* Top-right: seller rating chip */}
            {hostRating && (
              <span
                className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-white/95 px-1.5 py-0.5 text-[9px] font-black shadow-md backdrop-blur"
                style={{ color: BRAND_BLACK }}
                title={`Seller rating · ${hostRating.count} reviews`}
              >
                <Star size={9} fill={BRAND_BLACK} strokeWidth={0}/>
                {hostRating.avg.toFixed(1)}
              </span>
            )}

            {/* Bottom: name overlay + price chip */}
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2">
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-[11px] font-black leading-tight text-white drop-shadow-md">
                  {p.name}
                </div>
              </div>
              <span
                className="flex-shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-black shadow-md"
                style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
              >
                £{p.priceGbp}
              </span>
            </div>
          </button>
        ))}
        </div>
      </div>

      {/* Footer — view-all shop link */}
      {totalCount > products.length && canteenSlug && (
        <Link
          href={`/trade-off/yard/canteens/${canteenSlug}/products`}
          className="flex items-center justify-between border-t bg-neutral-50 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-neutral-700 transition hover:bg-neutral-100"
          style={{ borderColor: "rgba(139,69,19,0.10)" }}
        >
          <span className="inline-flex items-center gap-1.5">
            <ShoppingBag size={11} />
            View all {totalCount} products
          </span>
          <ChevronRight size={12} />
        </Link>
      )}
      </div>
    </>
  );
}
