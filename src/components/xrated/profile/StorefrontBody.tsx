"use client";

// Xrated Shop Mode Phase 3 — storefront body.
//
// Client island that owns the search/filter/sort/pagination loop. Reads
// the initial product page server-side via SSR (passed as initialState)
// so first paint shows the same grid Google indexes, then takes over for
// debounced search + facet toggles + load-more.
//
// Mobile UX: filter sidebar collapses into a bottom-sheet drawer behind
// a "Filter (N)" pill button — sticky alongside the search bar on the
// toolbar. Desktop renders the filter column as a left rail.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HammerexXratedProduct } from "@/lib/supabase";
import { ProductCardLink } from "./ProductCardLink";
import { formatGbp } from "@/lib/xratedCart";

type SortKey = "featured" | "price_asc" | "price_desc" | "newest";

type FilterCounts = {
  categories: { name: string; count: number }[];
  price_range: { min: number | null; max: number | null };
};

type InitialState = {
  slug: string;
  firstName: string;
  products: HammerexXratedProduct[];
  total: number;
  has_more: boolean;
  filter_counts: FilterCounts;
};

const PAGE_SIZE = 24;

const SORT_LABELS: { key: SortKey; label: string }[] = [
  { key: "featured", label: "Featured" },
  { key: "newest", label: "Newest" },
  { key: "price_asc", label: "Price: low to high" },
  { key: "price_desc", label: "Price: high to low" }
];

export function StorefrontBody({ initialState }: { initialState: InitialState }) {
  const [products, setProducts] = useState<HammerexXratedProduct[]>(
    initialState.products
  );
  const [total, setTotal] = useState<number>(initialState.total);
  const [hasMore, setHasMore] = useState<boolean>(initialState.has_more);
  const [counts, setCounts] = useState<FilterCounts>(initialState.filter_counts);

  // Toolbar / filter inputs.
  const [q, setQ] = useState<string>("");
  const [debouncedQ, setDebouncedQ] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("featured");
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [minPounds, setMinPounds] = useState<string>("");
  const [maxPounds, setMaxPounds] = useState<string>("");
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const requestSeqRef = useRef<number>(0);

  // Debounce the search input — 250ms is a comfortable balance between
  // "feels live" and "doesn't hammer the API on every keystroke".
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => window.clearTimeout(id);
  }, [q]);

  const filterCount = useMemo(() => {
    let n = activeCategories.length;
    if (minPounds.trim().length > 0) n += 1;
    if (maxPounds.trim().length > 0) n += 1;
    if (inStockOnly) n += 1;
    return n;
  }, [activeCategories, minPounds, maxPounds, inStockOnly]);

  const buildBody = useCallback(
    (offset: number) => {
      const minPence = parsePoundsToPence(minPounds);
      const maxPence = parsePoundsToPence(maxPounds);
      return {
        slug: initialState.slug,
        q: debouncedQ,
        category: activeCategories,
        min_price_pence: minPence,
        max_price_pence: maxPence,
        in_stock: inStockOnly,
        sort,
        limit: PAGE_SIZE,
        offset
      };
    },
    [
      initialState.slug,
      debouncedQ,
      activeCategories,
      minPounds,
      maxPounds,
      inStockOnly,
      sort
    ]
  );

  // Re-fetch whenever any filter changes. We track a request sequence so
  // a slow earlier response can't clobber a fresh one.
  useEffect(() => {
    let cancelled = false;
    const seq = ++requestSeqRef.current;
    async function run() {
      setLoading(true);
      try {
        const res = await fetch("/api/trade-off/products/search", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(buildBody(0))
        });
        const json = (await res.json()) as {
          ok: boolean;
          products?: HammerexXratedProduct[];
          total?: number;
          has_more?: boolean;
          filter_counts?: FilterCounts;
        };
        if (cancelled || seq !== requestSeqRef.current) return;
        if (json.ok) {
          setProducts(json.products ?? []);
          setTotal(json.total ?? 0);
          setHasMore(json.has_more ?? false);
          if (json.filter_counts) setCounts(json.filter_counts);
        }
      } catch {
        // Best-effort — leave the previous grid in place.
      } finally {
        if (!cancelled && seq === requestSeqRef.current) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [buildBody]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch("/api/trade-off/products/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildBody(products.length))
      });
      const json = (await res.json()) as {
        ok: boolean;
        products?: HammerexXratedProduct[];
        total?: number;
        has_more?: boolean;
      };
      if (json.ok) {
        setProducts((prev) => [...prev, ...(json.products ?? [])]);
        setHasMore(json.has_more ?? false);
        if (typeof json.total === "number") setTotal(json.total);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  function clearFilters() {
    setActiveCategories([]);
    setMinPounds("");
    setMaxPounds("");
    setInStockOnly(false);
  }

  function toggleCategory(name: string) {
    setActiveCategories((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
      {/* Toolbar — search input, sort dropdown, mobile filter button. */}
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${initialState.firstName}'s shop…`}
            aria-label="Search products"
            className="block h-11 w-full rounded-lg border border-neutral-300 bg-white pl-9 pr-3 text-[13px] text-neutral-900 outline-none transition focus:border-[#FFB300] focus:ring-2 focus:ring-[#FFB300]/30 sm:text-sm"
          />
          {q.length > 0 && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
        <label className="hidden sm:flex items-center gap-2 text-[13px] font-bold text-neutral-700">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-11 rounded-lg border border-neutral-300 bg-white px-3 text-[13px] font-bold text-neutral-900 outline-none transition focus:border-[#FFB300]"
            aria-label="Sort products"
          >
            {SORT_LABELS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open filters"
          className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 text-[13px] font-extrabold text-neutral-900 transition active:scale-[0.98] lg:hidden"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="7" y1="12" x2="17" y2="12" />
            <line x1="10" y1="18" x2="14" y2="18" />
          </svg>
          Filter
          {filterCount > 0 && (
            <span
              className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-extrabold"
              style={{ background: "#FFB300", color: "#0A0A0A" }}
            >
              {filterCount}
            </span>
          )}
        </button>
        <label className="flex items-center gap-2 text-[13px] font-bold text-neutral-700 sm:hidden">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-11 rounded-lg border border-neutral-300 bg-white px-2 text-[13px] font-bold text-neutral-900 outline-none transition focus:border-[#FFB300]"
            aria-label="Sort products"
          >
            {SORT_LABELS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 flex gap-6 lg:gap-8">
        {/* Desktop filter rail. Hidden under lg, replaced by the
            bottom-sheet drawer. */}
        <aside
          className="hidden w-60 shrink-0 self-start lg:block xl:w-64"
          aria-label="Filter products"
        >
          <FilterPanel
            counts={counts}
            activeCategories={activeCategories}
            onToggleCategory={toggleCategory}
            minPounds={minPounds}
            setMinPounds={setMinPounds}
            maxPounds={maxPounds}
            setMaxPounds={setMaxPounds}
            inStockOnly={inStockOnly}
            setInStockOnly={setInStockOnly}
            filterCount={filterCount}
            onClear={clearFilters}
            stacked={true}
          />
        </aside>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between">
            <p className="text-[13px] font-bold text-neutral-500 sm:text-sm">
              {loading ? (
                "Searching…"
              ) : (
                <>
                  {total} product{total === 1 ? "" : "s"}
                  {debouncedQ.length > 0 && (
                    <>
                      {" "}
                      matching{" "}
                      <span className="font-extrabold text-neutral-900">
                        “{debouncedQ}”
                      </span>
                    </>
                  )}
                </>
              )}
            </p>
          </div>

          {products.length === 0 ? (
            <EmptyResults
              q={debouncedQ}
              filterCount={filterCount}
              onClear={clearFilters}
            />
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((p) => (
                <li key={p.id}>
                  <ProductCardLink product={p} slug={initialState.slug} />
                </li>
              ))}
            </ul>
          )}

          {hasMore && products.length > 0 && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex h-12 items-center gap-2 rounded-xl border-2 px-6 text-[13px] font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                style={{ borderColor: "#FFB300", background: "#FFFFFF" }}
              >
                {loadingMore ? "Loading…" : "Load more products"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom-sheet drawer. We render it always-mounted but
          translate it off-screen when closed so the animation feels
          smooth. */}
      <div
        className={`fixed inset-0 z-40 transition lg:hidden ${
          drawerOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Filter products"
      >
        <div
          className={`absolute inset-0 bg-black/55 backdrop-blur-sm transition-opacity ${
            drawerOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setDrawerOpen(false)}
        />
        <div
          className={`absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl ring-1 ring-black/10 transition-transform ${
            drawerOpen ? "translate-y-0" : "translate-y-full"
          }`}
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
            <p
              className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
              style={{ color: "#FFB300" }}
            >
              Filter products
            </p>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close filters"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg transition hover:bg-black"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="px-4 py-4">
            <FilterPanel
              counts={counts}
              activeCategories={activeCategories}
              onToggleCategory={toggleCategory}
              minPounds={minPounds}
              setMinPounds={setMinPounds}
              maxPounds={maxPounds}
              setMaxPounds={setMaxPounds}
              inStockOnly={inStockOnly}
              setInStockOnly={setInStockOnly}
              filterCount={filterCount}
              onClear={clearFilters}
              stacked={false}
            />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-extrabold uppercase tracking-wider text-white shadow-lg transition active:scale-[0.98] sm:text-sm"
              style={{ background: "#0A0A0A" }}
            >
              View {total} product{total === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterPanel({
  counts,
  activeCategories,
  onToggleCategory,
  minPounds,
  setMinPounds,
  maxPounds,
  setMaxPounds,
  inStockOnly,
  setInStockOnly,
  filterCount,
  onClear,
  stacked
}: {
  counts: FilterCounts;
  activeCategories: string[];
  onToggleCategory: (name: string) => void;
  minPounds: string;
  setMinPounds: (v: string) => void;
  maxPounds: string;
  setMaxPounds: (v: string) => void;
  inStockOnly: boolean;
  setInStockOnly: (v: boolean) => void;
  filterCount: number;
  onClear: () => void;
  // stacked=true is the desktop layout (vertical column); false is the
  // drawer layout (same logic, slightly tighter spacing).
  stacked: boolean;
}) {
  const minHint = counts.price_range.min !== null ? formatGbp(counts.price_range.min) : "";
  const maxHint = counts.price_range.max !== null ? formatGbp(counts.price_range.max) : "";
  return (
    <div className={stacked ? "space-y-6" : "space-y-5"}>
      {counts.categories.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.22em] text-neutral-700">
            Category
          </legend>
          <ul className="flex flex-col gap-1.5">
            {counts.categories.map((cat) => {
              const active = activeCategories.includes(cat.name);
              return (
                <li key={cat.name}>
                  <button
                    type="button"
                    onClick={() => onToggleCategory(cat.name)}
                    aria-pressed={active}
                    className={`flex h-11 w-full items-center justify-between gap-2 rounded-lg border px-3 text-left text-[13px] font-bold transition ${
                      active
                        ? "border-[#FFB300] bg-[#FFB300] text-neutral-900"
                        : "border-neutral-200 bg-white text-neutral-800 hover:border-[#FFB300]"
                    }`}
                  >
                    <span className="truncate">{cat.name}</span>
                    <span className="shrink-0 text-[13px] font-bold text-neutral-500">
                      {cat.count}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}

      <fieldset>
        <legend className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.22em] text-neutral-700">
          Price (£)
        </legend>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={minPounds}
            onChange={(e) => setMinPounds(e.target.value)}
            placeholder={minHint || "Min"}
            aria-label="Minimum price"
            className="block h-11 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 text-[13px] text-neutral-900 outline-none focus:border-[#FFB300]"
          />
          <span className="text-[13px] font-bold text-neutral-500">—</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={maxPounds}
            onChange={(e) => setMaxPounds(e.target.value)}
            placeholder={maxHint || "Max"}
            aria-label="Maximum price"
            className="block h-11 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 text-[13px] text-neutral-900 outline-none focus:border-[#FFB300]"
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.22em] text-neutral-700">
          Availability
        </legend>
        <label className="flex h-11 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-bold text-neutral-800">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="h-5 w-5 accent-[#FFB300]"
          />
          In stock only
        </label>
      </fieldset>

      {filterCount > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-11 items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 text-[13px] font-extrabold text-neutral-700 transition hover:border-[#FFB300] hover:text-neutral-900"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function EmptyResults({
  q,
  filterCount,
  onClear
}: {
  q: string;
  filterCount: number;
  onClear: () => void;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center">
      <p className="text-[13px] font-extrabold text-neutral-900 sm:text-sm">
        No matching products.
      </p>
      <p className="mt-1 text-[13px] text-neutral-500 sm:text-sm">
        {q.length > 0
          ? `Nothing matched "${q}". Try a different word or clear filters.`
          : "Try widening your filters."}
      </p>
      {filterCount > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 inline-flex h-11 items-center justify-center rounded-lg border-2 px-5 text-[13px] font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.98]"
          style={{ borderColor: "#FFB300", background: "#FFFFFF" }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function parsePoundsToPence(input: string): number | null {
  const t = (input ?? "").trim();
  if (t.length === 0) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
