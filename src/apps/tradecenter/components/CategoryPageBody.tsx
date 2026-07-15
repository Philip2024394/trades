// Marketplace — Category page body (right of the rail).
//
// Header: "Plastering · 1,248 products found" + grid/list/compact
// toggle + Sort by Popular.
// Sub-category chip row underneath.
// Product grid (4-col) below.
//
// Reuses the existing ProductCard v2 primitive (merchant chip +
// trust + delivery + distance + trade price + Find alternatives AI
// chip). The mock's badges (Best Seller / 20% OFF / etc.) already
// live on ProductCard via the `badges` field.

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ShoppingCart, FileText } from "lucide-react";
import { ProductCard, type ViewerTier } from "./ProductCard";
import { MobileCategoryStrip } from "./MobileCategoryStrip";
import { findMerchant } from "../data/merchants";
import { askAI } from "@/platform/shell/WorkspaceShell";
import { useGuestBasket } from "../lib/useGuestBasket";
import { useIsTrade } from "@/apps/hub/lib/useIsTrade";
import type { TradeCenterProduct } from "../types";
import type { RailCategorySlug } from "../data/categoryTaxonomy";

// Sort dropdown removed 2026-07-12 — Popular/Newest/Top-rated/Nearest
// were over-engineered for MVP browse and the toolbar slot is more
// valuable to the buyer as a live basket-status pill. Reintroduce when
// real search/discovery replaces fixture rendering and users ask for it.

type Props = {
  categorySlug: RailCategorySlug | null;
  categoryLabel: string;
  products: TradeCenterProduct[];
  subCategories: readonly string[];
  viewerTier?: ViewerTier;
  viewerHasBusinessAccount?: boolean;
};

export function CategoryPageBody({
  categorySlug,
  categoryLabel,
  products,
  subCategories,
  // NOTE: this prop is now a fallback — the actual tier passed to
  // each card is derived from useIsTrade() below so DIY / guest can
  // never see trade prices (constitutional gate). Kept as a prop for
  // tests / storybook overrides.
  viewerTier: viewerTierProp,
  viewerHasBusinessAccount = false
}: Props) {
  const [activeSubCat, setActiveSubCat] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const cart = useGuestBasket();
  const isTrade = useIsTrade();
  // Constitutional gate — trades see "paid" tier (trade prices unlocked
  // when the merchant offers them). DIY and guest are force-locked to
  // "free" tier so trade-price surfaces stay hidden. A test can still
  // override with viewerTier prop for storybook.
  const viewerTier: ViewerTier = viewerTierProp ?? (isTrade ? "paid" : "free");

  const filtered = useMemo(() => {
    if (!activeSubCat) return products;
    const needle = activeSubCat.toLowerCase().replace(/\s+/g, "-");
    return products.filter((p) => p.subCategory.toLowerCase() === needle);
  }, [products, activeSubCat]);

  function toggleCompare(id: string) {
    setCompareIds((prev) =>
      prev.includes(id)
        ? prev.filter((p) => p !== id)
        : prev.length >= 4
          ? prev
          : [...prev, id]
    );
  }

  return (
    <section className="min-w-0 flex-1 px-4 py-4 md:px-6 md:py-5">
      {/* Mobile-only horizontal category strip. Vertical rail hidden
          below md. */}
      <MobileCategoryStrip activeSlug={categorySlug}/>

      {/* Category header — title + count on the left, cart pill on the
          right. Trade Quotes moved below the title to sit with the
          quotation explainer copy where it reads as a call-to-action
          rather than a toolbar chip. */}
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h1 className="flex flex-wrap items-baseline gap-2 text-[18px] font-black leading-tight text-neutral-900 md:text-[22px]">
          {categoryLabel}
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            {products.length.toLocaleString()}{" "}
            {categoryLabel.startsWith("Results for") ? "results" : "products"}
          </span>
        </h1>

        {/* Cart pill — always present. Empty state = white subtle invite;
            populated state = brand yellow act-now pull. */}
        <Link
          href="/tc/cart"
          className="inline-flex h-8 flex-shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-black uppercase tracking-wider shadow-sm transition hover:brightness-105"
          style={cart.count > 0
            ? { backgroundColor: "#FFB300", color: "#0A0A0A", borderColor: "#FFB300" }
            : { backgroundColor: "#FFFFFF", color: "#525252", borderColor: "rgba(139,69,19,0.15)" }}
          aria-label={cart.count > 0
            ? `Cart · ${cart.count} items · £${cart.totalGbp.toFixed(2)}`
            : "Cart (empty)"}
        >
          <span className="relative flex items-center">
            <ShoppingCart size={13}/>
            {cart.count > 0 && (
              <span
                className="absolute -right-2 -top-2 flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-1 text-[8px] font-black shadow-sm"
                style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
              >
                {cart.count}
              </span>
            )}
          </span>
          {cart.count === 0 ? (
            <span>Cart</span>
          ) : (
            <>
              <span className="hidden sm:inline">Cart</span>
              <span>£{cart.totalGbp.toFixed(2)}</span>
            </>
          )}
        </Link>
      </div>

      {/* Quotation explainer + Trade Quotes CTA — trade-only per
          constitutional rule. Sits under the header as a subtle nudge
          so trades planning a larger buy know they can request a
          bespoke quote instead of paying retail. DIY / guest never
          see this whole strip. */}
      {isTrade && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <p className="text-[11.5px] leading-snug text-neutral-500">
            Planning a larger order? Request a bespoke quotation from merchants for the best pricing.
          </p>
          <Link
            href="/tc/notebook"
            aria-label="Request trade quotations from merchants"
            className="inline-flex h-8 flex-shrink-0 items-center gap-1.5 rounded-full px-3 text-[11px] font-black uppercase tracking-wider shadow-sm transition hover:brightness-105"
            style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
          >
            <FileText size={12} strokeWidth={2.2}/>
            <span>Trade quotes</span>
          </Link>
        </div>
      )}

      {/* Sub-category chips — softer chip aesthetic. Active chip picks
          up the yellow highlight tone used across the platform. */}
      {subCategories.length > 0 && (
        <div className="mb-5 -mx-1 flex snap-x flex-nowrap gap-1.5 overflow-x-auto px-1 pb-1 md:flex-wrap md:overflow-visible">
          <SubChip label="All" active={activeSubCat === null} onClick={() => setActiveSubCat(null)}/>
          {subCategories.map((sc) => (
            <SubChip
              key={sc}
              label={sc}
              active={activeSubCat === sc}
              onClick={() => setActiveSubCat(activeSubCat === sc ? null : sc)}
            />
          ))}
          <SubChip label="More" trailing={<ChevronDown size={10}/>}/>
        </div>
      )}

      {/* Grid — 2/3/4-col responsive so cards get breathing room on
          desktop instead of the previous 4-col crunch. */}
      {filtered.length === 0 ? (
        <EmptyCategory categorySlug={categorySlug} categoryLabel={categoryLabel}/>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => {
            const merchant = findMerchant(p.merchantSlug);
            if (!merchant) return null;
            return (
              <ProductCard
                key={p.id}
                product={p}
                merchant={merchant}
                viewerTier={viewerTier}
                viewerHasBusinessAccount={viewerHasBusinessAccount}
                onCompareToggle={toggleCompare}
                isInCompare={compareIds.includes(p.id)}
                onAskAI={askAI}
              />
            );
          })}
        </div>
      )}

      {/* Pagination — visual only for now. Compact centered row so the
          old per-page selector and "showing X of Y" text no longer
          compete with the grid for attention. */}
      {filtered.length > 0 && (
        <div className="mt-8 flex items-center justify-center gap-1">
          <PageButton label="1" active/>
          <PageButton label="2"/>
          <PageButton label="3"/>
          <PageButton label="4"/>
          <span className="px-1 text-[11px] text-neutral-400">…</span>
          <PageButton label="52"/>
          <PageButton label="›"/>
        </div>
      )}
    </section>
  );
}

function SubChip({
  label,
  active,
  onClick,
  trailing
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex flex-shrink-0 snap-start items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-bold transition hover:bg-neutral-50"
      style={{
        borderColor: active ? "#0A0A0A" : "rgba(139,69,19,0.15)",
        backgroundColor: active ? "#0A0A0A" : "#FFFFFF",
        color: active ? "#FFB300" : "#374151"
      }}
    >
      {label}
      {trailing}
    </button>
  );
}

function PageButton({ label, active }: { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-full border text-[11px] font-black transition"
      style={{
        borderColor: active ? "#0A0A0A" : "rgba(139,69,19,0.15)",
        backgroundColor: active ? "#0A0A0A" : "#FFFFFF",
        color: active ? "#FFB300" : "#525252"
      }}
    >
      {label}
    </button>
  );
}

function EmptyCategory({
  categorySlug,
  categoryLabel
}: {
  categorySlug: RailCategorySlug | null;
  categoryLabel: string;
}) {
  const isSearchMode = categoryLabel.startsWith("Results for");
  if (isSearchMode) {
    return (
      <div
        className="rounded-xl border-2 border-dashed p-10 text-center"
        style={{ borderColor: "rgba(139,69,19,0.20)" }}
      >
        <div className="text-[13px] font-black text-neutral-900">
          No matches for {categoryLabel.replace(/^Results for /, "")}.
        </div>
        <p className="mx-auto mt-1 max-w-md text-[11.5px] text-neutral-600">
          Try a shorter search term, a different brand, or browse a category from the left rail. Search matches product names, specs, categories, and sub-categories.
        </p>
        <a
          href="/tc/trade-center"
          className="mt-4 inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-[11px] font-black uppercase tracking-wider text-white"
          style={{ backgroundColor: "#166534" }}
        >
          Clear search
        </a>
      </div>
    );
  }
  return (
    <div className="rounded-xl border-2 border-dashed p-10 text-center" style={{ borderColor: "rgba(139,69,19,0.20)" }}>
      <div className="text-[13px] font-black text-neutral-900">
        {categoryLabel} isn't populated yet.
      </div>
      <p className="mx-auto mt-1 max-w-md text-[11.5px] text-neutral-600">
        No verified merchants have listed products in this category. Try Plastering, Machinery, Materials, PPE &amp; Safety, or Tools — or invite a merchant you trust to list here.
      </p>
      <a
        href="/tc/trade-center/plastering"
        className="mt-4 inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-[11px] font-black uppercase tracking-wider text-white"
        style={{ backgroundColor: "#166534" }}
      >
        Browse Plastering
      </a>
    </div>
  );
}
