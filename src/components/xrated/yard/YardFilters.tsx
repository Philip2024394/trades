"use client";

// Client-side filter bar for The Yard feed. Drives URL search params
// (?kind=&trade=&region=) so the server page re-fetches the feed —
// shareable URLs, no hidden state, no client-side data store.

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { TRADE_OFF_TRADES } from "@/lib/tradeOff";

const KINDS: { value: string; label: string }[] = [
  { value: "", label: "All posts" },
  { value: "available", label: "Available" },
  { value: "needed", label: "Hiring" },
  { value: "chat", label: "Trade Chat" }
];

export function YardFilters({
  counts
}: {
  counts: { total: number; available: number; needed: number; chat: number };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const activeKind = params.get("kind") ?? "";
  const activeTrade = params.get("trade") ?? "";
  const activeRegion = params.get("region") ?? "";

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => {
      router.replace(`/trade-off/yard?${next.toString()}`, { scroll: false });
    });
  }

  const countFor = (k: string) => {
    if (k === "available") return counts.available;
    if (k === "needed") return counts.needed;
    if (k === "chat") return counts.chat;
    return counts.total;
  };

  return (
    <div className="mt-6 flex flex-col gap-3 sm:gap-4">
      {/* Kind pills */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by post kind">
        {KINDS.map((k) => {
          const active = k.value === activeKind;
          return (
            <button
              key={k.value || "all"}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={pending}
              onClick={() => setParam("kind", k.value)}
              className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-extrabold transition active:scale-[0.97] disabled:opacity-60"
              style={
                active
                  ? { background: "#FFB300", color: "#0A0A0A" }
                  : { background: "#fff", color: "#262626", border: "1px solid #e5e5e5" }
              }
            >
              {k.label}
              <span
                className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold"
                style={{
                  background: active ? "rgba(0,0,0,0.15)" : "#f5f5f5",
                  color: active ? "#0A0A0A" : "#737373"
                }}
              >
                {countFor(k.value)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Trade + region selects */}
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex h-11 min-w-[160px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-[13px]">
          <span className="font-bold text-neutral-500">Trade</span>
          <select
            value={activeTrade}
            disabled={pending}
            onChange={(e) => setParam("trade", e.target.value)}
            className="h-full grow bg-transparent text-[13px] font-extrabold text-neutral-900 focus:outline-none"
          >
            <option value="">All trades</option>
            {TRADE_OFF_TRADES.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-flex h-11 min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-[13px]">
          <span className="font-bold text-neutral-500">Area</span>
          <input
            type="text"
            value={activeRegion}
            disabled={pending}
            onChange={(e) => setParam("region", e.target.value)}
            placeholder="e.g. Manchester, West Midlands"
            className="h-full grow bg-transparent text-[13px] font-extrabold text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
          />
        </label>
        {(activeKind || activeTrade || activeRegion) && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(() => {
                router.replace(`/trade-off/yard`, { scroll: false });
              });
            }}
            className="inline-flex h-11 items-center rounded-xl border border-neutral-200 bg-white px-4 text-[13px] font-extrabold text-neutral-700 transition hover:border-neutral-300 active:scale-[0.97] disabled:opacity-60"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

export default YardFilters;
