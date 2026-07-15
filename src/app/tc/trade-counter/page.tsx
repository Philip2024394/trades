// /tc/trade-counter — Trade-to-trade classifieds.
//
// Distinct from Marketplace (merchant catalogue). Individual verified
// trades post ONE-OFF listings: surplus material, used tool, swap,
// giveaway. Filter by kind (For Sale / Offer / Free).

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Handshake, Plus, Search, Filter } from "lucide-react";
import { TradeCenterHeader } from "@/apps/tradecenter/components/TradeCenterHeader";
import { ListingCard } from "@/apps/tradeCounter/components/ListingCard";
import {
  tradeCounterListingsByKind,
  type TradeCounterListingKind
} from "@/apps/tradeCounter/data/listings";

const KIND_TABS: Array<{ key: TradeCounterListingKind | "all"; label: string }> = [
  { key: "all",       label: "All" },
  { key: "for-sale",  label: "For Sale" },
  { key: "offer",     label: "Swap / Offer" },
  { key: "free",      label: "Free" }
];

export default function TradeCounterPage() {
  const [kind, setKind] = useState<TradeCounterListingKind | "all">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const base = tradeCounterListingsByKind(kind);
    if (!query.trim()) return base;
    const q = query.toLowerCase();
    return base.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.locationCity.toLowerCase().includes(q)
    );
  }, [kind, query]);

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <TradeCenterHeader activeCategorySlug={null}/>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6 md:py-8">
        {/* Dark header — matches Yard / landing tone */}
        <section
          className="mb-6 overflow-hidden rounded-2xl border shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#0A0A0A" }}
        >
          <div className="p-4 md:p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: "#FFB300" }}>
              Trade Center · Trade Counter
            </div>
            <h1 className="mt-1 flex items-center gap-2 text-[20px] font-black leading-tight text-white md:text-[24px]">
              <Handshake size={22}/>
              Trade-to-trade classifieds
            </h1>
            <p className="mt-1 text-[11.5px] leading-snug text-white/70">
              Post ONE item at a time — surplus from a job, used tool you upgraded from,
              spare pallet, swap, or free giveaway. Different from the merchant Marketplace.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link
                href="/tc/trade-counter/new"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 text-[12px] font-black uppercase tracking-wider shadow-sm"
                style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
              >
                <Plus size={14}/>
                Post an item
              </Link>
              <span className="text-[10.5px] text-white/60">
                Free to post · Zero commission on sale
              </span>
            </div>
          </div>
        </section>

        {/* Tabs + search */}
        <section
          className="mb-5 flex flex-col gap-3 rounded-xl border bg-white p-3 shadow-sm md:flex-row md:items-center"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <div
            className="inline-flex items-center gap-1 rounded-full border bg-neutral-50 p-1"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            {KIND_TABS.map((t) => {
              const active = t.key === kind;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setKind(t.key)}
                  className="inline-flex min-h-[36px] items-center rounded-full px-3 text-[11px] font-black uppercase tracking-wider"
                  style={{
                    backgroundColor: active ? "#0A0A0A" : "transparent",
                    color: active ? "#FFB300" : "#525252"
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <label
            className="flex min-h-[44px] flex-1 items-center gap-2 rounded-md border bg-neutral-50 px-3"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <Search size={13} className="text-neutral-500"/>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search — plasterboard, drill, transformer…"
              className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-neutral-400"
            />
          </label>
          <div className="inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
            <Filter size={10}/>
            {filtered.length}
          </div>
        </section>

        {/* Cards */}
        {filtered.length === 0 ? (
          <div
            className="rounded-xl border-2 border-dashed p-10 text-center"
            style={{ borderColor: "rgba(139,69,19,0.20)" }}
          >
            <div className="text-[13px] font-black text-neutral-900">
              Nothing posted here yet
            </div>
            <p className="mx-auto mt-1 max-w-md text-[11.5px] text-neutral-600">
              Verified trades post one-off listings here regularly. Try a different filter or
              be the first to post an item.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((l) => (
              <li key={l.id}>
                <ListingCard listing={l}/>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-6 text-center text-[10.5px] text-neutral-500">
          Trade Center hosts the listing. Zero commission on sale. Trades transact peer-to-peer
          via Messages + optional Trade Center Guaranteed on higher-value items.
        </p>
      </main>
    </div>
  );
}
