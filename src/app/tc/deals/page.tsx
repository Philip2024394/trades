// /tc/deals — Trade Deals feed.
//
// Merchant-posted time-boxed discounts + bundles. Ranked ending-soonest
// then by percent saved. Trade Center never boosts by merchant margin.

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Tag,
  Clock,
  Package,
  Store,
  Filter,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { TradeCenterHeader } from "@/apps/tradecenter/components/TradeCenterHeader";
import { allDeals, type Deal, type DealKind } from "@/apps/deals/data/deals";
import { findMerchant } from "@/apps/tradecenter/data/merchants";

const CATEGORY_OPTIONS = ["all", "plastering", "materials", "tools", "electrical", "scaffolding"];

function kindLabel(k: DealKind): string {
  switch (k) {
    case "percent-off":  return "% Off";
    case "bundle":       return "Bundle";
    case "bulk-tier":    return "Bulk";
    case "free-add-on":  return "Free add-on";
    case "clearance":    return "Clearance";
  }
}

function endingLabel(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const hours = Math.round(diff / (1000 * 60 * 60));
  if (hours <= 0) return "Ended";
  if (hours < 24) return `Ends in ${hours}h`;
  const days = Math.round(hours / 24);
  return `${days} days left`;
}

export default function DealsPage() {
  const deals = allDeals();
  const [category, setCategory] = useState<string>("all");

  const filtered = useMemo(
    () => (category === "all" ? deals : deals.filter((d) => d.categoryTag === category)),
    [deals, category]
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <TradeCenterHeader activeCategorySlug={null}/>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-6 md:py-8">
        {/* Header */}
        <header className="mb-6 md:mb-8">
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Trade Center · Trade Deals
          </div>
          <h1 className="mt-1 flex items-center gap-2 text-[22px] font-black leading-tight text-neutral-900 md:text-[28px]">
            <Tag size={24}/>
            Live deals from verified merchants
          </h1>
          <p className="mt-1 text-[12px] leading-snug text-neutral-600 md:text-[13px]">
            Ranked by ending-soonest, then percent saved. Trade Center never boosts a deal
            by merchant margin — merchants publish, we surface.
          </p>
        </header>

        {/* Filters */}
        <section
          className="mb-5 flex flex-col gap-3 rounded-xl border bg-white p-3 shadow-sm md:flex-row md:items-center"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <Filter size={12} className="text-neutral-500"/>
            {CATEGORY_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className="min-h-[36px] rounded-full border px-3 text-[11px] font-black uppercase tracking-wider transition"
                style={{
                  borderColor: category === c ? "#0A0A0A" : "rgba(139,69,19,0.20)",
                  backgroundColor: category === c ? "#FEF3C7" : "#FFFFFF",
                  color: "#0A0A0A"
                }}
              >
                {c === "all" ? "All deals" : c.replace(/-/g, " ")}
              </button>
            ))}
          </div>
          <div className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
            {filtered.length} live
          </div>
        </section>

        {/* Deal cards */}
        {filtered.length === 0 ? (
          <div
            className="rounded-xl border-2 border-dashed p-10 text-center"
            style={{ borderColor: "rgba(139,69,19,0.20)" }}
          >
            <Sparkles size={24} className="mx-auto text-neutral-400"/>
            <div className="mt-2 text-[13px] font-black text-neutral-900">
              No live deals for this category
            </div>
            <p className="mx-auto mt-1 max-w-md text-[11.5px] text-neutral-600">
              Verified merchants post new deals regularly. Check back or browse another category.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filtered.map((deal) => (
              <li key={deal.id}>
                <DealCard deal={deal}/>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-6 text-center text-[10.5px] text-neutral-500">
          Deals are ranked by ending-soonest. Trade Center never accepts payment to place a
          deal higher in the feed.
        </p>
      </main>
    </div>
  );
}

function DealCard({ deal }: { deal: Deal }) {
  const merchant = findMerchant(deal.merchantSlug);
  return (
    <Link
      href={
        deal.productSlug
          ? `/tc/trade-center/product/${deal.productSlug}`
          : `/tc/trade-center/merchant/${deal.merchantSlug}`
      }
      className="flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      {/* Image (or gradient fallback) */}
      <div
        className="relative aspect-[16/9] w-full overflow-hidden"
        style={{ backgroundColor: "#F5F0E4" }}
      >
        {deal.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={deal.imageUrl}
            alt={deal.headline}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Package size={32} strokeWidth={1.5} className="text-neutral-400"/>
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider shadow"
            style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
          >
            <Tag size={9}/>
            {kindLabel(deal.kind)}
          </span>
          {deal.percentSaved && (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black shadow"
              style={{ backgroundColor: "#DC2626", color: "#FFFFFF" }}
            >
              −{deal.percentSaved}%
            </span>
          )}
        </div>
        <div className="absolute right-3 top-3">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider shadow"
            style={{ backgroundColor: "#FFFFFF", color: "#B91C1C" }}
          >
            <Clock size={9}/>
            {endingLabel(deal.endsAtIso)}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2 p-4">
        <div className="text-[14px] font-black leading-tight text-neutral-900">
          {deal.headline}
        </div>
        <p className="line-clamp-3 text-[11.5px] leading-snug text-neutral-600">
          {deal.detail}
        </p>

        {/* Price row */}
        {(deal.nowPriceGbp !== undefined || deal.addOnLabel) && (
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            {deal.nowPriceGbp !== undefined && (
              <span className="text-[20px] font-black text-neutral-900">
                £{deal.nowPriceGbp.toLocaleString()}
              </span>
            )}
            {deal.wasPriceGbp !== undefined && (
              <span className="text-[11.5px] text-neutral-400 line-through">
                £{deal.wasPriceGbp.toLocaleString()}
              </span>
            )}
            {deal.minQty && (
              <span className="text-[11px] text-neutral-500">min {deal.minQty}</span>
            )}
            {deal.addOnLabel && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
                style={{ backgroundColor: "#DCFCE7", color: "#166534" }}
              >
                Free · {deal.addOnLabel}
              </span>
            )}
          </div>
        )}

        {/* Merchant row */}
        <div className="mt-2 flex items-center justify-between gap-2 border-t pt-3" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-black"
              style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
            >
              {merchant?.logoInitials ?? "?"}
            </div>
            <div className="min-w-0">
              <div className="text-[11.5px] font-black text-neutral-900 line-clamp-1">
                {merchant?.displayName ?? deal.merchantSlug}
              </div>
              {merchant && (
                <div className="text-[10px] text-neutral-500">
                  <Store size={9} className="inline"/> {merchant.homeCity}
                </div>
              )}
            </div>
          </div>
          <ArrowRight size={14} className="flex-shrink-0 text-neutral-400"/>
        </div>
      </div>
    </Link>
  );
}
