"use client";

// Style browser — search bar + trades/supplies dropdown + samples
// grid. Lives inside /logo/style/[slug]. When a sample is picked it
// jumps to /logo/build with the style + trade pre-selected.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Filter, ArrowRight } from "lucide-react";
import type { LogoStyle } from "@/lib/logo/catalog";
import { LOGO_CATEGORIES, tradeBySlug, supplyBySlug } from "@/lib/logo/catalog";
import { StylePreviewTile } from "@/components/logo/StylePreviewTile";

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK  = "#0A0A0A";

export function StyleBrowser({ style }: { style: LogoStyle }) {
  const router = useRouter();
  const [query,  setQuery]  = useState("");
  const [filter, setFilter] = useState<string>("all");   // slug of trade/supply, or 'all'

  const trades   = LOGO_CATEGORIES.filter((c) => c.kind === "trade");
  const supplies = LOGO_CATEGORIES.filter((c) => c.kind === "supply");

  // Build the flat list of visible samples after applying filter + query.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return style.samples.filter((s) => {
      if (filter !== "all" && s.tradeSlug !== filter) return false;
      if (!q) return true;
      const label = (tradeBySlug(s.tradeSlug)?.label ?? supplyBySlug(s.tradeSlug)?.label ?? s.tradeSlug).toLowerCase();
      return label.includes(q) || s.tradeSlug.includes(q);
    });
  }, [style.samples, filter, query]);

  function pickSample(tradeSlug: string, imageUrl: string) {
    const q = new URLSearchParams({ style: style.slug, trade: tradeSlug, sample: imageUrl });
    router.push(`/logo/build?${q.toString()}`);
  }

  return (
    <div>
      {/* Search + filter row */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"/>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your trade or supply category…"
            className="w-full rounded-full border border-neutral-300 bg-white py-2.5 pl-9 pr-4 text-[13px] outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
          />
        </label>
        <label className="relative sm:w-72">
          <Filter size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"/>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full appearance-none rounded-full border border-neutral-300 bg-white py-2.5 pl-9 pr-8 text-[13px] outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
          >
            <option value="all">All trades and supplies</option>
            <optgroup label="Trades">
              {trades.map((t) => (
                <option key={t.slug} value={t.slug}>{t.label}</option>
              ))}
            </optgroup>
            <optgroup label="Supplies">
              {supplies.map((s) => (
                <option key={s.slug} value={s.slug}>{s.label}</option>
              ))}
            </optgroup>
          </select>
        </label>
      </div>

      {/* Result count */}
      <p className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">
        {visible.length} {visible.length === 1 ? "variant" : "variants"}
        {filter !== "all" && (
          <> for <span className="text-neutral-800">{tradeBySlug(filter)?.label ?? supplyBySlug(filter)?.label ?? filter}</span></>
        )}
      </p>

      {/* Samples grid */}
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <p className="text-[13px] font-black">No variants match that filter yet.</p>
          <p className="mt-1 text-[11px] text-neutral-500">Try &ldquo;All trades and supplies&rdquo; or clear the search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((sample) => {
            const label = tradeBySlug(sample.tradeSlug)?.label ?? supplyBySlug(sample.tradeSlug)?.label ?? sample.tradeSlug;
            return (
              <button
                key={sample.imageUrl}
                onClick={() => pickSample(sample.tradeSlug, sample.imageUrl)}
                className="group text-left"
              >
                <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition group-hover:shadow-lg">
                  <div className="aspect-square">
                    <StylePreviewTile style={style} size="md" imageUrl={sample.imageUrl} tradeSlug={sample.tradeSlug}/>
                  </div>
                  <span
                    className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-center gap-1 rounded-full py-1.5 text-[10px] font-black opacity-0 shadow transition group-hover:opacity-100"
                    style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
                  >
                    Use this variant <ArrowRight size={10}/>
                  </span>
                </div>
                <p className="mt-2 text-[11px] font-black text-neutral-800">{label}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
