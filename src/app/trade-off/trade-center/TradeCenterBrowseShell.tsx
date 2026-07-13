"use client";

// Trade Center browse UX. Hero + facet chips + sort + product grid.
// Every card is a plain <Link> — no client-side navigation intercept
// so search-engine crawlers follow the canteen route natively and the
// merchant's canteen gets crawled as the canonical product page.
//
// Filter/sort state is URL-driven (?trade=, ?sort=, ?q=) so links are
// shareable and back-button preserves position. Filter changes push a
// new URL via `router.push` — the server component re-runs and
// re-renders with the new rows.

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  Search,
  X as XIcon,
  Rocket,
  Filter,
  ArrowUpDown,
  Store,
  Package,
  ShoppingCart,
  Star
} from "lucide-react";
import type { BrowseProductRow, BrowseSort } from "@/lib/canteens";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";

const CREAM = "#FBF6EC";

const SORT_LABELS: Record<BrowseSort, string> = {
  "boosted": "Featured first",
  "price-asc": "Price · low to high",
  "price-desc": "Price · high to low",
  "newest": "Newest"
};

export function TradeCenterBrowseShell({
  rows,
  facets,
  activeTradeSlug,
  activeSort,
  activeQuery
}: {
  rows: BrowseProductRow[];
  facets: Array<{ slug: string; label: string; count: number }>;
  activeTradeSlug: string | null;
  activeSort: BrowseSort;
  activeQuery: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [queryInput, setQueryInput] = useState(activeQuery);

  const pushParams = (patch: Partial<{ trade: string | null; sort: BrowseSort; q: string }>) => {
    const next = new URLSearchParams();
    const trade = patch.trade === undefined ? activeTradeSlug : patch.trade;
    const sort = patch.sort ?? activeSort;
    const q = patch.q ?? queryInput;
    if (trade) next.set("trade", trade);
    if (sort !== "boosted") next.set("sort", sort);
    if (q) next.set("q", q);
    const url = `/trade-off/trade-center${next.toString() ? `?${next.toString()}` : ""}`;
    startTransition(() => router.push(url));
  };

  const clearAll = () => {
    setQueryInput("");
    startTransition(() => router.push("/trade-off/trade-center"));
  };

  const activeFacetLabel = activeTradeSlug
    ? facets.find((f) => f.slug === activeTradeSlug)?.label ?? activeTradeSlug
    : null;

  return (
    <main className="min-h-screen" style={{ backgroundColor: CREAM }}>
      {/* Hero — full-bleed, black surface with brand-yellow accent so
          the marketplace reads as a distinct discovery layer from the
          canteen pages (which are cream). Linear/Stripe grade compact
          hero — no marketing bloat, discovery starts scannable. */}
      <section
        className="relative overflow-hidden border-b"
        style={{ backgroundColor: BRAND_BLACK, borderColor: `${BRAND_YELLOW}33` }}
      >
        <div className="mx-auto max-w-6xl px-3 py-8 md:px-6 md:py-10">
          <div className="flex items-baseline gap-2">
            <span
              className="text-[10px] font-black uppercase tracking-[0.28em]"
              style={{ color: BRAND_YELLOW }}
            >
              Trade Center
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
              · Thenetworkers
            </span>
          </div>
          <h1 className="mt-2 text-[26px] font-black leading-tight text-white md:text-[34px]">
            Every product on Thenetworkers.<br className="hidden md:inline"/>
            <span style={{ color: BRAND_YELLOW }}>One click to the trade.</span>
          </h1>
          <p className="mt-2 max-w-xl text-[13px] leading-snug text-neutral-300">
            Every listing lives inside its merchant's canteen — real trades, real crew, WhatsApp handoff. No middleman between you and the person making it.
          </p>

          {/* Search — sits under hero copy, above the facet strip. */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              pushParams({ q: queryInput });
            }}
            className="mt-5 flex max-w-xl items-center gap-2 rounded-full border bg-white/95 px-3 py-2 shadow-lg"
            style={{ borderColor: `${BRAND_YELLOW}88` }}
          >
            <Search size={14} className="flex-shrink-0 text-neutral-500"/>
            <input
              type="search"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Oak worktop, safety boots, drywall stilts..."
              className="min-w-0 flex-1 bg-transparent text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
            />
            {queryInput && (
              <button
                type="button"
                onClick={() => {
                  setQueryInput("");
                  pushParams({ q: "" });
                }}
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                aria-label="Clear search"
              >
                <XIcon size={11}/>
              </button>
            )}
            <button
              type="submit"
              className="h-8 flex-shrink-0 rounded-full px-3 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-sm"
              style={{ backgroundColor: BRAND_YELLOW }}
            >
              Search
            </button>
          </form>
        </div>
      </section>

      {/* Facet chip strip — horizontal-scroll on mobile, wraps on
          desktop. Each chip is a router push. Active chip is the
          brand-yellow filled state, others are outline. */}
      <section
        className="sticky top-[64px] z-20 border-b bg-white/85 backdrop-blur"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <div className="mx-auto max-w-6xl overflow-x-auto px-3 md:px-6">
          <div className="flex items-center gap-2 py-3">
            <div className="flex flex-shrink-0 items-center gap-1 pr-1 text-[10px] font-black uppercase tracking-wider text-neutral-500">
              <Filter size={11}/>
              Trades
            </div>
            <FacetChip
              active={activeTradeSlug === null}
              onClick={() => pushParams({ trade: null })}
              label="All"
              count={rows.length}
            />
            {facets.map((f) => (
              <FacetChip
                key={f.slug}
                active={activeTradeSlug === f.slug}
                onClick={() => pushParams({ trade: f.slug })}
                label={f.label}
                count={f.count}
              />
            ))}
          </div>
        </div>

        {/* Sort + active-filter strip. Only visible when there's
            something to show or clear. */}
        <div
          className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-3 pb-3 md:px-6"
        >
          <div className="flex flex-wrap items-center gap-2">
            {activeFacetLabel && (
              <span
                className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-black uppercase tracking-wider text-neutral-900"
                style={{ backgroundColor: `${BRAND_YELLOW}44` }}
              >
                {activeFacetLabel}
                <button
                  onClick={() => pushParams({ trade: null })}
                  className="flex h-4 w-4 items-center justify-center rounded-full bg-white/80 text-neutral-700 hover:bg-white"
                  aria-label={`Clear ${activeFacetLabel} filter`}
                >
                  <XIcon size={9} strokeWidth={2.5}/>
                </button>
              </span>
            )}
            {activeQuery && (
              <span
                className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-black uppercase tracking-wider text-neutral-900"
                style={{ backgroundColor: `${BRAND_YELLOW}44` }}
              >
                "{activeQuery}"
                <button
                  onClick={() => {
                    setQueryInput("");
                    pushParams({ q: "" });
                  }}
                  className="flex h-4 w-4 items-center justify-center rounded-full bg-white/80 text-neutral-700 hover:bg-white"
                  aria-label="Clear search"
                >
                  <XIcon size={9} strokeWidth={2.5}/>
                </button>
              </span>
            )}
            {(activeFacetLabel || activeQuery) && (
              <button
                onClick={clearAll}
                className="text-[11px] font-black uppercase tracking-wider text-neutral-500 underline underline-offset-2 hover:text-neutral-800"
              >
                Clear all
              </button>
            )}
          </div>
          <label className="flex flex-shrink-0 items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-neutral-600">
            <ArrowUpDown size={11}/>
            <select
              value={activeSort}
              onChange={(e) => pushParams({ sort: e.target.value as BrowseSort })}
              className="cursor-pointer rounded-full border bg-white px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-neutral-800 shadow-sm focus:outline-none"
              style={{ borderColor: `${BRAND_YELLOW}88` }}
            >
              {(Object.entries(SORT_LABELS) as [BrowseSort, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* Product grid — 1 col mobile, 2 tablet, 3 desktop. Boosted
          products get a subtle green ring so buyers know they're
          sponsored without an intrusive banner. */}
      <section className="mx-auto max-w-6xl px-3 pb-16 pt-6 md:px-6" aria-busy={isPending}>
        {rows.length === 0 ? (
          <EmptyState onClear={clearAll} />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3">
            {rows.map((r) => (
              <li key={r.product.id}>
                <ProductCard row={r} />
              </li>
            ))}
          </ul>
        )}

        {/* Result count strip. Sits at the bottom so buyers who
            scanned to the end know the grid is exhaustive. */}
        {rows.length > 0 && (
          <p className="mt-6 text-center text-[11px] font-black uppercase tracking-wider text-neutral-500">
            {rows.length} product{rows.length === 1 ? "" : "s"} · every listing routes to a real trade's canteen
          </p>
        )}
      </section>
    </main>
  );
}

function FacetChip({
  active,
  onClick,
  label,
  count
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-8 flex-shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-black uppercase tracking-wider transition"
      style={
        active
          ? { backgroundColor: BRAND_YELLOW, borderColor: BRAND_YELLOW, color: BRAND_BLACK }
          : { backgroundColor: "#FFFFFF", borderColor: "rgba(139,69,19,0.20)", color: "#525252" }
      }
    >
      {label}
      <span
        className="rounded-full px-1.5 text-[9px] font-black"
        style={{
          backgroundColor: active ? BRAND_BLACK : "#F3F4F6",
          color: active ? BRAND_YELLOW : "#737373"
        }}
      >
        {count}
      </span>
    </button>
  );
}

function ProductCard({ row }: { row: BrowseProductRow }) {
  const { product, hostDisplayName, tradeLabel, href, isBoosted, hostRating } = row;
  return (
    <Link
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
      style={{
        borderColor: isBoosted ? `${BRAND_GREEN_DARK}66` : "rgba(139,69,19,0.15)",
        boxShadow: isBoosted ? `0 0 0 1px ${BRAND_GREEN_DARK}44` : undefined
      }}
    >
      {/* Image */}
      <div
        className="relative aspect-[4/3] flex-shrink-0"
        style={{
          backgroundImage: `url('${product.imageUrl}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: "#F3F4F6"
        }}
      >
        {isBoosted && (
          <span
            className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-md"
            style={{ backgroundColor: BRAND_GREEN_DARK }}
          >
            <Rocket size={9} strokeWidth={2.5}/>
            Sponsored
          </span>
        )}
        {product.bulkBuy && (
          <span
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-sm bg-white/95 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-neutral-800 shadow-md backdrop-blur"
          >
            <Package size={9} strokeWidth={2.5}/>
            Bulk · {product.bulkBuy.committedCount}/{product.bulkBuy.targetCount}
          </span>
        )}
        <span
          className="absolute bottom-2 right-2 rounded-md px-2 py-1 text-[14px] font-black shadow-md"
          style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
        >
          £{product.priceGbp}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block rounded-sm px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
            style={{ backgroundColor: `${BRAND_YELLOW}44`, color: "#7A5300" }}
          >
            {tradeLabel}
          </span>
          {/* Host rating chip — browse-time trust density. Null when
              the host is under the 5-review zero-rating protection
              floor, so a new merchant isn't handicapped in the grid. */}
          {hostRating && (
            <span
              className="inline-flex items-center gap-0.5 text-[10px] font-black text-neutral-700"
              title={`${hostRating.count} verified reviews`}
            >
              <Star size={10} fill={BRAND_YELLOW} color={BRAND_YELLOW} strokeWidth={0}/>
              {hostRating.avg}
              <span className="text-neutral-400">· {hostRating.count}</span>
            </span>
          )}
        </div>
        <h3 className="line-clamp-2 text-[14px] font-black leading-snug text-neutral-900 group-hover:underline">
          {product.name}
        </h3>
        <p className="line-clamp-2 flex-1 text-[12px] leading-snug text-neutral-500">
          {product.blurb}
        </p>
        <div className="mt-1 flex items-center justify-between border-t pt-2" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <span className="inline-flex min-w-0 items-center gap-1 text-[11px] font-black text-neutral-700">
            <Store size={11} className="flex-shrink-0 text-neutral-400"/>
            <span className="truncate">{hostDisplayName}</span>
          </span>
          <span
            className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider"
            style={{ color: BRAND_GREEN_DARK }}
          >
            <ShoppingCart size={10} strokeWidth={2.5}/>
            View
          </span>
        </div>
      </div>
    </Link>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div
      className="mx-auto mt-6 max-w-md rounded-2xl border border-dashed p-8 text-center"
      style={{ borderColor: "rgba(139,69,19,0.25)", backgroundColor: "#FFFFFF" }}
    >
      <div
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${BRAND_YELLOW}22` }}
      >
        <Package size={22} color={BRAND_BLACK} strokeWidth={2}/>
      </div>
      <p className="mt-3 text-[10px] font-black uppercase tracking-[0.28em] text-neutral-500">
        Nothing matches
      </p>
      <h3 className="mt-1 text-[16px] font-black text-neutral-900">
        Try clearing the filter.
      </h3>
      <p className="mt-1.5 text-[12px] leading-snug text-neutral-500">
        Every product on Thenetworkers flows through here. If nothing matches, the filter's too tight.
      </p>
      <button
        onClick={onClear}
        className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-sm"
        style={{ backgroundColor: BRAND_YELLOW }}
      >
        Clear filters
      </button>
    </div>
  );
}
