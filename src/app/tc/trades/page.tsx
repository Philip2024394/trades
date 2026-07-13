// /tc/trades — Verified trades directory.
// Customer-facing browse + filter across all verified trades.

"use client";

import { useMemo, useState } from "react";
import { Search, Filter, ShieldCheck, MapPin } from "lucide-react";
import { MarketplaceHeader } from "@/apps/marketplace/components/MarketplaceHeader";
import { TradeDirectoryCard } from "@/apps/trades/components/TradeDirectoryCard";
import { allTradeProfiles } from "@/apps/trades/data/tradeProfiles";
import { findTradeIdentity } from "@/apps/identity/data/tradeIdentities";

export default function TradesDirectoryPage() {
  const profiles = allTradeProfiles();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<string>("all");

  const allRegions = useMemo(() => {
    const set = new Set<string>();
    profiles.forEach((p) => p.serviceAreaCities.forEach((c) => set.add(c)));
    return ["all", ...Array.from(set).sort()];
  }, [profiles]);

  const filtered = useMemo(() => {
    return profiles.filter((p) => {
      const identity = findTradeIdentity(p.ownerTradeSlug);
      if (!identity) return false;
      if (region !== "all" && !p.serviceAreaCities.includes(region)) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        identity.displayName.toLowerCase().includes(q) ||
        identity.tradeType.toLowerCase().includes(q) ||
        p.disciplines.some((d) => d.toLowerCase().includes(q)) ||
        p.headline.toLowerCase().includes(q)
      );
    });
  }, [profiles, query, region]);

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <MarketplaceHeader activeCategorySlug={null}/>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-6 md:py-8">
        {/* Header */}
        <header className="mb-6 md:mb-8">
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Trade Center · Verified Trades
          </div>
          <h1 className="mt-1 flex items-center gap-2 text-[22px] font-black leading-tight text-neutral-900 md:text-[28px]">
            <ShieldCheck size={24} className="text-[#166534]"/>
            Find a verified trade
          </h1>
          <p className="mt-1 text-[12px] leading-snug text-neutral-600 md:text-[13px]">
            Every trade below has verified their identity, business, insurance and qualifications
            through regulated bodies. Rates published, jobs recorded, disputes arbitrated.
          </p>
        </header>

        {/* Filters */}
        <section
          className="mb-5 flex flex-col gap-3 rounded-xl border bg-white p-3 shadow-sm md:flex-row md:items-center"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <label
            className="flex min-h-[44px] flex-1 items-center gap-2 rounded-md border bg-neutral-50 px-3"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <Search size={13} className="text-neutral-500"/>
            <input
              type="text"
              placeholder="Search by name, trade, or discipline"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-neutral-400"
            />
          </label>
          <label
            className="flex min-h-[44px] items-center gap-2 rounded-md border bg-neutral-50 px-3 md:min-w-[200px]"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <MapPin size={12} className="text-neutral-500"/>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="flex-1 bg-transparent text-[12.5px] outline-none"
            >
              {allRegions.map((r) => (
                <option key={r} value={r}>{r === "all" ? "All regions" : r}</option>
              ))}
            </select>
          </label>
          <div className="inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
            <Filter size={10}/>
            {filtered.length} of {profiles.length}
          </div>
        </section>

        {/* Cards */}
        {filtered.length === 0 ? (
          <div
            className="rounded-xl border-2 border-dashed p-10 text-center"
            style={{ borderColor: "rgba(139,69,19,0.20)" }}
          >
            <div className="text-[13px] font-black text-neutral-900">
              No trades match your search
            </div>
            <p className="mx-auto mt-1 max-w-md text-[11.5px] text-neutral-600">
              Try a different region or trade type. More verified trades onboard every week.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {filtered.map((p) => (
              <li key={p.ownerTradeSlug}>
                <TradeDirectoryCard profile={p}/>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-6 text-center text-[10.5px] text-neutral-500">
          Every trade above has a real Verified Trade Identity — no self-declarations, no
          scraped listings. Trade Center never places sponsored trades at the top.
        </p>
      </main>
    </div>
  );
}
