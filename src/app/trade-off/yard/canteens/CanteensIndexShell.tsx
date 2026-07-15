"use client";

// Client shell for the canteens index — renders the header/founding
// strip (passed as children by the server) then owns the search + trade
// filter + grid state.
//
// The parent server component reads canteens from the DB (with mock
// fallback) and passes them as `canteens`. All filtering happens
// client-side against that array — the canteens list is small (dozens,
// not thousands) so we avoid a per-keystroke API round-trip.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Users, Sparkles, ChevronRight, Search, X, ArrowUpDown, Home, Plus } from "lucide-react";
import type { Canteen } from "@/lib/canteens";

type SortKey = "active" | "newest" | "founding";
const SORT_LABEL: Record<SortKey, string> = {
  active: "Most active",
  newest: "Newest",
  founding: "Founding 100"
};

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK = "#0A0A0A";

export function CanteensIndexShell({
  canteens,
  ownCanteenSlug = null,
  viewerIsSignedInMerchant = false
}: {
  canteens: Canteen[];
  /** Signed-in merchant's own canteen slug (if they host one).
   *  Drives the "Enter my canteen" pill at the top of the directory
   *  so owners can jump home in one tap without hunting the grid. */
  ownCanteenSlug?: string | null;
  /** True when the viewer is a signed-in merchant. Merchants without
   *  a canteen yet get a "Create your canteen" pill instead of
   *  "Enter my canteen". Anonymous / DIY visitors see no pill. */
  viewerIsSignedInMerchant?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [tradeFilter, setTradeFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("active");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  // Derive the trade chip row from the input list so it stays in sync.
  const tradeChips = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const c of canteens) {
      const prev = counts.get(c.tradeSlug);
      counts.set(c.tradeSlug, {
        label: c.tradeLabel,
        count: (prev?.count ?? 0) + 1
      });
    }
    return Array.from(counts.entries())
      .map(([slug, meta]) => ({ slug, label: meta.label, count: meta.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [canteens]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = canteens.filter((c) => {
      if (tradeFilter && c.tradeSlug !== tradeFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.tagline ?? "").toLowerCase().includes(q) ||
        c.tradeLabel.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q)
      );
    });
    // Sort — active is the DB order (posts_last_30d desc) which
    // matches the incoming array. Newest / Founding do their own
    // comparators. Copy so we don't mutate the input.
    const sorted = [...base];
    if (sort === "newest") {
      sorted.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    } else if (sort === "founding") {
      sorted.sort((a, b) => {
        // Founding 100 first, then by activity within each group.
        if (a.isFounding100 !== b.isFounding100) return a.isFounding100 ? -1 : 1;
        return b.postsLast30d - a.postsLast30d;
      });
    }
    return sorted;
  }, [canteens, query, tradeFilter, sort]);

  return (
    <section className="mx-auto max-w-6xl px-3 pb-16 pt-6 md:px-6">
      {/* Signed-in merchant fast-path pill — "Enter my canteen" for
          owners, "Create your canteen" for merchants without one yet.
          Anonymous + DIY visitors see nothing here. Sits above the
          search so getting home is one tap even after the
          directory-first flow lands the merchant on this page. */}
      {viewerIsSignedInMerchant && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border bg-white p-3 shadow-sm md:p-4" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
              Your canteen
            </div>
            <div className="mt-0.5 text-[12.5px] leading-snug text-neutral-700">
              {ownCanteenSlug
                ? "Jump straight home, or browse below to see what other trades are running."
                : "You don't have a canteen yet — set one up in 60 seconds and it'll appear in this directory."}
            </div>
          </div>
          <Link
            href={ownCanteenSlug ? `/trade-off/yard/canteens/${ownCanteenSlug}` : "/trade-off/yard/canteens/new"}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[11.5px] font-black uppercase tracking-wider shadow-md transition active:scale-[0.97]"
            style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
          >
            {ownCanteenSlug
              ? <><Home size={13} strokeWidth={2.6}/>Enter my canteen</>
              : <><Plus size={13} strokeWidth={2.6}/>Create your canteen</>}
          </Link>
        </div>
      )}

      {/* Search + trade chips */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search canteens — trade, place, or name…"
              className="w-full rounded-full border border-neutral-200 bg-white py-2.5 pl-9 pr-9 text-[13px] text-neutral-800 shadow-sm focus:border-yellow-400 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
                aria-label="Clear search"
              >
                <X size={12} strokeWidth={3}/>
              </button>
            )}
          </div>
          {/* Sort dropdown — sits next to the search bar on desktop,
              wraps below on narrow viewports because the parent's
              flex-wrap kicks in. */}
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setSortMenuOpen((v) => !v)}
              className="inline-flex h-[42px] items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-[11px] font-black uppercase tracking-wider text-neutral-700 shadow-sm transition hover:border-yellow-400"
              aria-haspopup="menu"
              aria-expanded={sortMenuOpen}
            >
              <ArrowUpDown size={12}/>
              <span className="hidden sm:inline">{SORT_LABEL[sort]}</span>
              <span className="sm:hidden">Sort</span>
            </button>
            {sortMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSortMenuOpen(false)}/>
                <div
                  className="absolute right-0 top-full z-20 mt-1 min-w-[180px] overflow-hidden rounded-lg border bg-white shadow-lg"
                  style={{ borderColor: "rgba(139,69,19,0.15)" }}
                  role="menu"
                >
                  {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => {
                    const active = sort === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        role="menuitemradio"
                        aria-checked={active}
                        onClick={() => { setSort(k); setSortMenuOpen(false); }}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12px] font-bold transition hover:bg-neutral-50"
                        style={{
                          backgroundColor: active ? "#FEF3C7" : "transparent",
                          color: active ? BRAND_BLACK : "#525252"
                        }}
                      >
                        {SORT_LABEL[k]}
                        {active && <span className="text-[9px] font-black uppercase tracking-wider">Active</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
        {tradeChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setTradeFilter(null)}
              className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[10px] font-black uppercase tracking-wider transition"
              style={{
                backgroundColor: tradeFilter === null ? BRAND_BLACK : "transparent",
                color: tradeFilter === null ? BRAND_YELLOW : "#525252",
                border: `1px solid ${tradeFilter === null ? BRAND_BLACK : "rgba(139,69,19,0.20)"}`
              }}
            >
              All · {canteens.length}
            </button>
            {tradeChips.map((t) => {
              const active = tradeFilter === t.slug;
              return (
                <button
                  key={t.slug}
                  type="button"
                  onClick={() => setTradeFilter(active ? null : t.slug)}
                  className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[10px] font-black uppercase tracking-wider transition"
                  style={{
                    backgroundColor: active ? BRAND_BLACK : "transparent",
                    color: active ? BRAND_YELLOW : "#525252",
                    border: `1px solid ${active ? BRAND_BLACK : "rgba(139,69,19,0.20)"}`
                  }}
                >
                  {t.label} · {t.count}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
          {filtered.length === canteens.length ? "Live canteens" : `${filtered.length} matching`}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-10 text-center" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
          <div className="text-[14px] font-black text-neutral-900">Nothing matches that.</div>
          <p className="mt-1 text-[12px] text-neutral-600">Try a broader search, or start a canteen for that trade.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/trade-off/yard/canteens/${c.slug}`}
              className="group flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div
                className="relative h-24 overflow-hidden sm:h-28"
                style={{
                  backgroundColor: "#0A0A0A",
                  backgroundImage: c.headerBgUrl ? `url('${c.headerBgUrl}')` : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center"
                }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background: c.headerBgUrl
                      ? "linear-gradient(160deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.85) 100%)"
                      : `radial-gradient(circle at 20% 30%, #FFB30022 0%, transparent 55%)`
                  }}
                />
                <div className="relative flex h-full flex-col justify-end p-3">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="rounded-sm px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
                      style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                    >
                      {c.tradeLabel}
                    </span>
                    {c.isFounding100 && (
                      <span
                        className="flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white"
                        style={{ backgroundColor: "#8B4513" }}
                      >
                        <Sparkles size={8} strokeWidth={2.5}/>
                        F100
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-3.5">
                <div className="text-[15px] font-black leading-tight text-neutral-900">
                  {c.name}
                </div>
                <p className="mt-1 line-clamp-2 flex-1 text-[12px] leading-snug text-neutral-600">
                  {c.tagline}
                </p>
                <div className="mt-2.5 flex items-center justify-between text-[11px] text-neutral-500">
                  <span className="inline-flex items-center gap-1">
                    <Users size={11}/>
                    {c.memberCount}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="h-1.5 w-1.5 animate-pulse rounded-full"
                      style={{ backgroundColor: c.activityStreakMonths >= 3 ? "#22C55E" : BRAND_YELLOW }}
                    />
                    {c.postsLast30d} posts / 30d
                  </span>
                  <span className="inline-flex items-center gap-0.5 font-black uppercase tracking-wider text-neutral-700 transition group-hover:text-neutral-900">
                    Open
                    <ChevronRight size={11}/>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
