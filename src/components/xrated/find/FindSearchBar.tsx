"use client";

// Search bar for the customer-facing /find portal. Pure URL-param
// driver — no client state survives the navigation. Three fields:
// trade (dropdown), city/area (free text), postcode (free text).
// Submits to /find?trade=&city=&postcode= and the server page
// re-queries the listings table.

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { TRADE_OFF_TRADES } from "@/lib/tradeOff";

const BRAND_YELLOW = "#FFB300";

export function FindSearchBar() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [trade, setTrade] = useState(params.get("trade") ?? "");
  const [city, setCity] = useState(params.get("city") ?? "");
  const [postcode, setPostcode] = useState(params.get("postcode") ?? "");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams();
    if (trade) next.set("trade", trade);
    if (city) next.set("city", city.trim());
    if (postcode) next.set("postcode", postcode.trim().toUpperCase());
    startTransition(() => {
      router.replace(`/find?${next.toString()}`, { scroll: false });
    });
  }

  function clear() {
    setTrade("");
    setCity("");
    setPostcode("");
    startTransition(() => {
      router.replace("/find", { scroll: false });
    });
  }

  const hasFilter = trade || city || postcode;

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border-2 bg-white p-3 shadow-xl sm:p-4"
      style={{ borderColor: BRAND_YELLOW, boxShadow: `0 20px 50px ${BRAND_YELLOW}33` }}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:gap-2.5">
        {/* Trade */}
        <label className="flex flex-col gap-1 sm:col-span-4">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-neutral-500">
            Trade
          </span>
          <select
            value={trade}
            onChange={(e) => setTrade(e.target.value)}
            disabled={pending}
            className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-3 text-[13px] font-extrabold text-neutral-900 focus:border-neutral-400 focus:outline-none sm:text-sm"
          >
            <option value="">Any trade</option>
            {TRADE_OFF_TRADES.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        {/* City / area */}
        <label className="flex flex-col gap-1 sm:col-span-4">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-neutral-500">
            City or area
          </span>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={pending}
            placeholder="e.g. Manchester"
            className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-3 text-[13px] font-extrabold text-neutral-900 placeholder:font-bold placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none sm:text-sm"
          />
        </label>

        {/* Postcode */}
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-neutral-500">
            Postcode
          </span>
          <input
            type="text"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value.toUpperCase())}
            disabled={pending}
            placeholder="M14"
            maxLength={8}
            className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-3 text-[13px] font-extrabold uppercase text-neutral-900 placeholder:font-bold placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none sm:text-sm"
          />
        </label>

        {/* Search button */}
        <div className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-transparent sm:block">
            .
          </span>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-xl text-[13px] font-extrabold uppercase tracking-wider text-neutral-900 shadow-md transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
            style={{
              background: BRAND_YELLOW,
              boxShadow: `0 6px 20px ${BRAND_YELLOW}55`
            }}
          >
            <SearchGlyph />
            {pending ? "Searching…" : "Search"}
          </button>
        </div>
      </div>

      {hasFilter && (
        <div className="mt-2.5 flex items-center justify-end">
          <button
            type="button"
            onClick={clear}
            disabled={pending}
            className="text-[12px] font-bold text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}
    </form>
  );
}

function SearchGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export default FindSearchBar;
