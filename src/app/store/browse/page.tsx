// /store/browse — Site Interest search + filter grid.
//
// Server component: reads query params for search + trade filter,
// runs storeSearch(), renders a watermarked masonry grid. Client
// filter chips route back to this page with updated params.

import Link from "next/link";
import { storeSearch, storeAllImages, storeTradeCounts, storeImagesForTrade } from "@/lib/storeLibrary.server";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?:     string;
  trade?: string;
};

export default async function BrowsePage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const trade = params.trade?.trim() ?? "";

  const trades = await storeTradeCounts();
  const allTotal = (await storeAllImages()).length;
  const nice = (s: string) => s.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

  // Trade filter uses the exact trade_slug — text search runs over
  // alt + trade tokens. Trade takes precedence when set.
  const results = trade
    ? await storeImagesForTrade(trade, 120)
    : q
      ? await storeSearch(q, 120)
      : (await storeAllImages()).slice(0, 60);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Search bar */}
      <form className="mb-4 flex gap-2" method="get">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search — e.g. plumber, roof rafters, kitchen door…"
          className="min-w-0 flex-1 rounded-md border px-3 py-2 text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
          style={{ borderColor: "rgba(0,0,0,0.12)" }}
        />
        {trade && <input type="hidden" name="trade" value={trade}/>}
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-md bg-neutral-900 px-4 text-[12px] font-black uppercase tracking-wider text-white transition hover:opacity-90"
        >
          Search
        </button>
      </form>

      {/* Trade chips */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        <Link
          href={q ? `/store/browse?q=${encodeURIComponent(q)}` : "/store/browse"}
          className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition"
          style={{
            borderColor:     !trade ? "#0A0A0A" : "rgba(0,0,0,0.12)",
            backgroundColor: !trade ? "#0A0A0A" : "#FFFFFF",
            color:           !trade ? "#FFFFFF" : "#404040"
          }}
        >
          All trades ({allTotal})
        </Link>
        {trades.map(({ trade: t, count }) => {
          const active = trade === t;
          const href = `/store/browse?trade=${encodeURIComponent(t)}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
          return (
            <Link
              key={t}
              href={href}
              className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition"
              style={{
                borderColor:     active ? "#0A0A0A" : "rgba(0,0,0,0.12)",
                backgroundColor: active ? "#0A0A0A" : "#FFFFFF",
                color:           active ? "#FFFFFF" : "#404040"
              }}
            >
              {nice(t)} ({count})
            </Link>
          );
        })}
      </div>

      {/* Results header */}
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <div className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
          {results.length} image{results.length !== 1 ? "s" : ""}
          {trade && ` in ${nice(trade)}`}
          {q && ` for "${q}"`}
        </div>
        <div className="text-[11px] font-bold text-neutral-500">
          £10 each · packs from £39
        </div>
      </div>

      {/* Grid */}
      {results.length === 0 ? (
        <div
          className="rounded-lg border p-10 text-center"
          style={{ borderColor: "rgba(0,0,0,0.12)", backgroundColor: "#FAFAF7" }}
        >
          <div className="text-[13px] font-black text-neutral-700">No matches</div>
          <p className="mt-1 text-[12px] text-neutral-500">
            Try a broader term, or <Link href="/store/browse" className="underline">clear filters</Link>.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {results.map((img) => (
            <Link
              key={img.id}
              href={`/store/i/${encodeURIComponent(img.id)}`}
              className="group relative overflow-hidden rounded-lg border bg-neutral-100 transition hover:shadow-md"
              style={{ borderColor: "rgba(0,0,0,0.08)", aspectRatio: "9 / 12" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.alt}
                loading="lazy"
                className="h-full w-full object-cover transition group-hover:scale-[1.03]"
              />
              {/* Watermark diagonal */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <span
                  className="rotate-[-25deg] text-[11px] font-black uppercase tracking-[0.3em] text-white/40"
                  style={{ textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}
                >
                  Site Interest
                </span>
              </div>
              {/* Hover overlay */}
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-16 opacity-0 transition group-hover:opacity-100"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" }}
              />
              <div className="absolute bottom-2 left-2 right-2 opacity-0 transition group-hover:opacity-100">
                <div className="line-clamp-2 text-[11px] font-black text-white drop-shadow-md">
                  {img.alt}
                </div>
              </div>
              {/* Price pill */}
              <div className="absolute right-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-black text-neutral-900 shadow-sm">
                £10
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
