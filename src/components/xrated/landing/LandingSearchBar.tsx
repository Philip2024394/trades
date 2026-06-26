"use client";

// Xrated Trades — long landing search bar under the hero image.
// Three sections in one horizontal container:
//   LEFT   : 'Search trades' text input + magnifying-glass submit
//   MIDDLE : yellow 'Near me' city picker with type-to-filter dropdown
//   RIGHT  : 'Filter' button opening a drawer (trade, city, price, etc.)

import { useEffect, useMemo, useRef, useState } from "react";
import { TRADE_OFF_TRADES } from "@/lib/tradeOff";
import { XRATED_BRAND } from "@/lib/xratedTrades";

type Props = {
  cities: string[]; // distinct city names from listings + jobs
};

export function LandingSearchBar({ cities }: Props) {
  const [query, setQuery] = useState("");
  const [cityOpen, setCityOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const cityRef = useRef<HTMLDivElement | null>(null);

  // Close city dropdown on outside click.
  useEffect(() => {
    if (!cityOpen) return;
    function onDown(e: MouseEvent) {
      if (!cityRef.current) return;
      if (!cityRef.current.contains(e.target as Node)) setCityOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [cityOpen]);

  // ESC closes any open overlay.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setCityOpen(false);
        setFilterOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Lock body scroll when filter drawer is open.
  useEffect(() => {
    if (!filterOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [filterOpen]);

  const filteredCities = useMemo(() => {
    const q = cityQuery.trim().toLowerCase();
    if (!q) return cities.slice(0, 20);
    return cities.filter((c) => c.toLowerCase().includes(q)).slice(0, 20);
  }, [cityQuery, cities]);

  function submitSearch() {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (selectedCity) params.set("city", selectedCity);
    const qs = params.toString();
    window.location.href = qs ? `/trade-off/search?${qs}` : "/trade-off/search";
  }

  function chooseCity(city: string) {
    setSelectedCity(city);
    setCityQuery(city);
    setCityOpen(false);
  }

  function clearCity() {
    setSelectedCity(null);
    setCityQuery("");
  }

  return (
    <section id="search" className="relative z-20 mx-auto -mt-8 max-w-6xl px-3 sm:-mt-12 sm:px-4">
      <div className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-black p-1.5 shadow-xl sm:gap-2 sm:p-2.5">
        {/* LEFT — search input */}
        <form
          className="flex flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submitSearch();
          }}
        >
          <div className="relative flex-1">
            <span
              className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-white/50"
              aria-hidden="true"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search trades…"
              className="h-12 w-full rounded-xl border border-transparent bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-white/50 focus:border-[#FFB300] focus:bg-white/10 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            aria-label="Search trades"
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-neutral-900 transition active:scale-[0.97] sm:hidden"
            style={{ background: XRATED_BRAND.accent }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>
        </form>

        <span className="hidden h-8 w-px bg-white/15 sm:block" aria-hidden="true" />

        {/* MIDDLE — Near me city picker */}
        <div ref={cityRef} className="relative flex-1">
          <button
            type="button"
            onClick={() => setCityOpen((v) => !v)}
            aria-expanded={cityOpen}
            aria-label="Filter by city"
            className="flex h-12 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-white transition hover:bg-white/10"
          >
            <span
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
              style={{ background: XRATED_BRAND.accent, color: "#1a1a1a" }}
              aria-hidden="true"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </span>
            <span className="flex-1 truncate">
              {selectedCity ? selectedCity : "Near me"}
            </span>
            {selectedCity ? (
              <span
                role="button"
                aria-label="Clear city"
                onClick={(e) => {
                  e.stopPropagation();
                  clearCity();
                }}
                className="text-xs text-white/40 hover:text-white"
              >
                ✕
              </span>
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white/50"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            )}
          </button>

          {cityOpen && (
            <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl">
              <div className="p-2">
                <input
                  type="text"
                  value={cityQuery}
                  onChange={(e) => setCityQuery(e.target.value)}
                  placeholder="Type a city…"
                  autoFocus
                  className="h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#FFB300] focus:outline-none"
                />
              </div>
              <ul className="max-h-64 overflow-y-auto pb-2">
                {filteredCities.length === 0 ? (
                  <li className="px-4 py-3 text-xs text-neutral-500">
                    No matching cities. Press Filter for an advanced search.
                  </li>
                ) : (
                  filteredCities.map((city) => (
                    <li key={city}>
                      <button
                        type="button"
                        onClick={() => chooseCity(city)}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-white transition hover:bg-white/10"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        {city}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>

        <span className="hidden h-8 w-px bg-white/15 sm:block" aria-hidden="true" />

        {/* RIGHT — Filter drawer trigger (icon-only) */}
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          aria-label="Open filters"
          title="Filter"
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-neutral-900 transition active:scale-[0.97]"
          style={{ background: XRATED_BRAND.accent }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
        </button>
      </div>

      {filterOpen && (
        <FilterDrawer
          cities={cities}
          initial={{ q: query, city: selectedCity }}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </section>
  );
}

function FilterDrawer({
  cities,
  initial,
  onClose
}: {
  cities: string[];
  initial: { q: string; city: string | null };
  onClose: () => void;
}) {
  const [trade, setTrade] = useState<string | null>(null);
  const [city, setCity] = useState<string>(initial.city ?? "");
  const [priceMax, setPriceMax] = useState<string>("");
  const [acceptingOnly, setAcceptingOnly] = useState(false);
  const [keyword, setKeyword] = useState<string>(initial.q);
  const [minRating, setMinRating] = useState<"0" | "3" | "4" | "4.5">("0");
  const [hasPhotos, setHasPhotos] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [featuredOnly, setFeaturedOnly] = useState(false);

  function apply() {
    const params = new URLSearchParams();
    if (keyword.trim()) params.set("q", keyword.trim());
    if (trade) params.set("trade", trade);
    if (city.trim()) params.set("city", city.trim());
    if (priceMax.trim() && /^\d+$/.test(priceMax.trim())) {
      params.set("price_max", priceMax.trim());
    }
    if (acceptingOnly) params.set("accepting", "1");
    if (minRating !== "0") params.set("min_rating", minRating);
    if (hasPhotos) params.set("has_photos", "1");
    if (verifiedOnly) params.set("verified", "1");
    if (featuredOnly) params.set("featured", "1");
    const qs = params.toString();
    window.location.href = qs ? `/trade-off/search?${qs}` : "/trade-off/search";
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search filters"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-2xl rounded-t-2xl border border-neutral-200 bg-white p-5 sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: XRATED_BRAND.accent }}>
            Filter trades
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="-mr-1 inline-flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </button>
        </div>

        <p className="mt-4 text-xs font-bold uppercase tracking-widest text-neutral-500">
          Keyword
        </p>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Skim coat · 14 yrs experience · electrician…"
          className="mt-2 h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#FFB300] focus:outline-none"
        />

        <p className="mt-5 text-xs font-bold uppercase tracking-widest text-neutral-500">
          Trade
        </p>
        <ul className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto pr-1">
          <li>
            <button
              type="button"
              onClick={() => setTrade(null)}
              className={`inline-flex h-10 items-center rounded-full border px-3 text-xs font-semibold transition ${
                trade === null
                  ? "border-[#FFB300] bg-[#FFB300] text-neutral-900"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-[#FFB300]"
              }`}
            >
              All trades
            </button>
          </li>
          {TRADE_OFF_TRADES.map((t) => (
            <li key={t.slug}>
              <button
                type="button"
                onClick={() => setTrade(t.slug)}
                className={`inline-flex h-10 items-center rounded-full border px-3 text-xs font-semibold transition ${
                  trade === t.slug
                    ? "border-[#FFB300] bg-[#FFB300] text-neutral-900"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-[#FFB300]"
                }`}
              >
                {t.label}
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">
              City
            </p>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Manchester"
              list="filter-city-list"
              maxLength={80}
              className="mt-2 h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#FFB300] focus:outline-none"
            />
            <datalist id="filter-city-list">
              {cities.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">
              Max budget (£)
            </p>
            <input
              type="number"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
              placeholder="e.g. 1000"
              min={0}
              className="mt-2 h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#FFB300] focus:outline-none"
            />
          </div>
        </div>

        <p className="mt-5 text-xs font-bold uppercase tracking-widest text-neutral-500">
          Minimum rating
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {([
            { v: "0", label: "Any" },
            { v: "3", label: "★ 3+" },
            { v: "4", label: "★ 4+" },
            { v: "4.5", label: "★ 4.5+" }
          ] as const).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setMinRating(opt.v)}
              className={`inline-flex h-10 items-center rounded-full border px-3 text-xs font-semibold transition ${
                minRating === opt.v
                  ? "border-[#FFB300] bg-[#FFB300] text-neutral-900"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-[#FFB300]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <p className="mt-5 text-xs font-bold uppercase tracking-widest text-neutral-500">
          More filters
        </p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-800">
            <input
              type="checkbox"
              checked={hasPhotos}
              onChange={(e) => setHasPhotos(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300"
              style={{ accentColor: XRATED_BRAND.accent }}
            />
            Photos of work
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-800">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300"
              style={{ accentColor: XRATED_BRAND.accent }}
            />
            Verified badge only
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-800">
            <input
              type="checkbox"
              checked={featuredOnly}
              onChange={(e) => setFeaturedOnly(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300"
              style={{ accentColor: XRATED_BRAND.accent }}
            />
            Featured businesses
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-800">
            <input
              type="checkbox"
              checked={acceptingOnly}
              onChange={(e) => setAcceptingOnly(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300"
              style={{ accentColor: XRATED_BRAND.accent }}
            />
            Accepting new jobs
          </label>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-lg px-4 text-xs font-semibold text-neutral-600 transition hover:text-neutral-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-xs font-bold text-neutral-900 transition active:scale-[0.97]"
            style={{ background: XRATED_BRAND.accent }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            Apply filters
          </button>
        </div>
      </div>
    </div>
  );
}
