"use client";

// Full trade counter UI — search bar + category filter + product grid
// + featured carousel. Handles 100+ items smoothly via useMemo filter
// and simple pagination (loads 24 at a time). WhatsApp handoff for
// enquiries.

import { useMemo, useState } from "react";
import type { PartsCategory, PartsItem } from "@/lib/plantHire";

type Props = {
  items: PartsItem[];
  categories: PartsCategory[];
  waHref: string | null;
  merchantName: string;
};

export function PlantPartsCounterClient({
  items,
  categories,
  waHref,
  merchantName
}: Props) {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string>("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [pageSize, setPageSize] = useState(24);

  const featured = useMemo(() => items.filter((i) => i.featured).slice(0, 12), [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (activeCat && i.category_slug !== activeCat) return false;
      if (inStockOnly && !i.in_stock) return false;
      if (!q) return true;
      return (
        i.name.toLowerCase().includes(q) ||
        i.sku.toLowerCase().includes(q) ||
        i.brand.toLowerCase().includes(q) ||
        i.fits.toLowerCase().includes(q) ||
        i.short_desc.toLowerCase().includes(q)
      );
    });
  }, [items, query, activeCat, inStockOnly]);

  const shown = filtered.slice(0, pageSize);

  const enquire = (item: PartsItem) => {
    const parts = [
      `🔧 *PARTS ENQUIRY — ${merchantName}*`,
      "",
      `Item: ${item.name}`,
      item.sku ? `SKU: ${item.sku}` : "",
      item.brand ? `Brand: ${item.brand}` : "",
      item.fits ? `Fits: ${item.fits}` : "",
      item.price_pence !== null
        ? `Listed price: £${(item.price_pence / 100).toFixed(2)}`
        : "",
      "",
      `Please confirm stock + delivery to my postcode.`
    ];
    const msg = encodeURIComponent(parts.filter((p) => p).join("\n"));
    const url = waHref ? `${waHref}?text=${msg}` : "#";
    if (typeof window !== "undefined") window.open(url, "_blank");
  };

  const bulkEnquire = () => {
    const parts = [
      `🔧 *BULK PARTS ENQUIRY — ${merchantName}*`,
      "",
      "Filter used:",
      activeCat ? `Category: ${activeCat}` : "All categories",
      query ? `Search: "${query}"` : "",
      inStockOnly ? "In-stock only" : "",
      "",
      `Please quote a bulk price + lead time for the ${filtered.length} matching items.`
    ];
    const msg = encodeURIComponent(parts.filter((p) => p).join("\n"));
    const url = waHref ? `${waHref}?text=${msg}` : "#";
    if (typeof window !== "undefined") window.open(url, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Search + filters */}
      <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
          Search the counter
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SKU, part name, brand, or machine it fits…"
              className="h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 pl-10 text-[14px] outline-none focus:border-[#FFB300] focus:bg-white"
            />
            <span
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-neutral-400"
            >
              🔍
            </span>
          </div>
          <label className="flex h-12 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 accent-[#FFB300]"
            />
            <span className="text-[12px] font-bold text-neutral-900">In-stock only</span>
          </label>
        </div>

        {categories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveCat("")}
              className={`inline-flex h-8 items-center rounded-full px-3 text-[11px] font-extrabold uppercase tracking-widest transition ${
                activeCat === ""
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              All · {items.length}
            </button>
            {categories.map((c) => {
              const slug = c.slug || c.name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
              const count = items.filter((i) => i.category_slug === slug).length;
              if (count === 0) return null;
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => setActiveCat(slug)}
                  className={`inline-flex h-8 items-center rounded-full px-3 text-[11px] font-extrabold uppercase tracking-widest transition ${
                    activeCat === slug
                      ? "bg-neutral-900 text-white"
                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                  }`}
                >
                  {c.name} · {count}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-neutral-500">
          <span>
            Showing <strong className="text-neutral-900">{shown.length}</strong> of{" "}
            <strong className="text-neutral-900">{filtered.length}</strong> results
          </span>
          {filtered.length > 0 && (
            <button
              type="button"
              onClick={bulkEnquire}
              className="inline-flex h-9 items-center rounded-lg bg-[#FFB300] px-3 text-[10px] font-extrabold uppercase tracking-widest text-neutral-900 hover:brightness-95"
            >
              Bulk quote for {filtered.length} →
            </button>
          )}
        </div>
      </div>

      {/* Product grid */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-neutral-300 bg-white p-8 text-center">
          <p className="text-[14px] font-extrabold text-neutral-900">No matches.</p>
          <p className="mt-1 text-[12px] text-neutral-500">
            Try a different SKU, brand or machine model — or WhatsApp us the part number and
            we&rsquo;ll cross-reference.
          </p>
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((it, i) => (
              <li key={it.sku + i}>
                <PartCard item={it} onEnquire={() => enquire(it)} />
              </li>
            ))}
          </ul>
          {shown.length < filtered.length && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setPageSize((p) => p + 24)}
                className="inline-flex h-11 items-center rounded-xl border border-neutral-200 bg-white px-5 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 hover:bg-neutral-50"
              >
                Load {Math.min(24, filtered.length - shown.length)} more →
              </button>
            </div>
          )}
        </>
      )}

      {/* Featured carousel — auto-scroll marquee. No visible scrollbar;
          cards glide continuously left. Duplicated once so the animation
          appears seamless. */}
      {featured.length > 0 && (
        <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-900 p-5 text-white sm:p-6">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
            Featured at the counter
          </p>
          <h3 className="mt-1 text-[20px] font-extrabold sm:text-[24px]">
            Fast-moving parts on the shelf right now.
          </h3>
          <div
            className="parts-marquee-mask relative mt-4 overflow-hidden"
            aria-label="Featured parts — auto-scrolling"
          >
            <ul className="parts-marquee-track flex w-max gap-3">
              {[...featured, ...featured].map((it, i) => (
                <li
                  key={"feat_" + it.sku + "_" + i}
                  className="w-[220px] shrink-0 sm:w-[250px]"
                  aria-hidden={i >= featured.length ? "true" : undefined}
                >
                  <FeaturedCard item={it} onEnquire={() => enquire(it)} />
                </li>
              ))}
            </ul>
          </div>
          <style>{`
            @keyframes parts-marquee {
              from { transform: translateX(0); }
              to   { transform: translateX(-50%); }
            }
            .parts-marquee-track {
              animation: parts-marquee 40s linear infinite;
            }
            .parts-marquee-track:hover {
              animation-play-state: paused;
            }
            @media (prefers-reduced-motion: reduce) {
              .parts-marquee-track { animation: none; }
            }
            .parts-marquee-mask {
              /* Soft fade at both ends so the cards feel like they enter
                 + exit the container rather than pop in/out. */
              -webkit-mask-image: linear-gradient(90deg, transparent 0, black 40px, black calc(100% - 40px), transparent 100%);
                      mask-image: linear-gradient(90deg, transparent 0, black 40px, black calc(100% - 40px), transparent 100%);
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

function PartCard({ item, onEnquire }: { item: PartsItem; onEnquire: () => void }) {
  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="relative aspect-square w-full max-w-full shrink-0 overflow-hidden bg-neutral-50">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt={item.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full max-h-full max-w-full object-contain p-3 transition group-hover:scale-105"
          />
        ) : (
          <div
            className="absolute inset-0 grid h-full w-full place-items-center text-center"
            style={{
              background: "linear-gradient(135deg, #1f2937 0%, #111827 60%, #0a0a0a 100%)"
            }}
          >
            <span className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
              Photo pending
            </span>
          </div>
        )}
        <span
          className={`absolute left-2 top-2 text-[10px] font-extrabold uppercase tracking-widest ${
            item.in_stock ? "text-white" : "text-white/80"
          }`}
          style={{ textShadow: "0 1px 3px rgba(0,0,0,0.75), 0 0 6px rgba(0,0,0,0.5)" }}
        >
          {item.in_stock
            ? `In stock${
                item.stock_count !== null && item.stock_count !== undefined
                  ? ` · ${item.stock_count}`
                  : ""
              }`
            : "To order"}
        </span>
        {item.sku && (
          <span className="absolute bottom-2 left-2 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
            {item.sku}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="text-[13px] font-extrabold leading-tight text-neutral-900">{item.name}</p>
        {item.brand && (
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
            {item.brand}
          </p>
        )}
        {item.fits && (
          <p className="mt-1 line-clamp-2 text-[11px] leading-tight text-neutral-600">
            Fits: {item.fits}
          </p>
        )}
        <div className="mt-2 flex items-baseline justify-between">
          {item.price_pence !== null ? (
            <p className="text-[15px] font-extrabold text-neutral-900">
              £{(item.price_pence / 100).toFixed(2)}
            </p>
          ) : (
            <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">POA</p>
          )}
          {item.lead_time && (
            <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-500">
              {item.lead_time}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onEnquire}
          className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-lg bg-[#FFB300] px-3 text-[10px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95"
        >
          Enquire on WhatsApp →
        </button>
      </div>
    </div>
  );
}

function FeaturedCard({ item, onEnquire }: { item: PartsItem; onEnquire: () => void }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-white/5 backdrop-blur">
      <div className="relative aspect-square w-full max-w-full shrink-0 overflow-hidden bg-white/5">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt={item.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full max-h-full max-w-full object-contain p-3"
          />
        ) : (
          <div className="absolute inset-0 grid h-full w-full place-items-center text-[10px] font-extrabold uppercase text-white/50">
            Photo pending
          </div>
        )}
        {item.sku && (
          <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
            {item.sku}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3 text-white">
        <p className="text-[13px] font-extrabold leading-tight">{item.name}</p>
        {item.brand && (
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-white/60">
            {item.brand}
          </p>
        )}
        <div className="mt-auto flex items-baseline justify-between pt-2">
          {item.price_pence !== null ? (
            <p className="text-[15px] font-extrabold">£{(item.price_pence / 100).toFixed(2)}</p>
          ) : (
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/50">POA</p>
          )}
          <button
            type="button"
            onClick={onEnquire}
            className="inline-flex h-8 items-center rounded-lg px-2.5 text-[10px] font-extrabold uppercase tracking-widest text-neutral-900"
            style={{ background: "#FFB300" }}
          >
            Enquire →
          </button>
        </div>
      </div>
    </div>
  );
}
