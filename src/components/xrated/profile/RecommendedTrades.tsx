// Public profile — "My Trusted Trades" recommendation grid.
//
// Server component. Takes the recommendations array from the listing
// (each entry = { slug, note? }), server-fetches the matching live
// listings from Supabase in one batch, and renders a card grid.
//
// The whole point: when a customer lands on Mike (bricklayer) but
// realises they also need an electrician, Mike's "Trusted Trades"
// puts Dave (electrician) one tap away. Linktree-style network effect
// for construction trades.

import type { HammerexTradeOffListing } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { tradeLabel } from "@/lib/tradeOff";

export async function RecommendedTrades({
  listing
}: {
  listing: HammerexTradeOffListing;
}) {
  const recs = listing.recommendations ?? [];
  if (recs.length === 0) return null;

  // Server-fetch the recommended listings in one batch. We filter to
  // status='live' so an archived/hidden tradesperson silently drops
  // from the grid without breaking the layout.
  const slugs = Array.from(new Set(recs.map((r) => r.slug).filter(Boolean)));
  const res = await supabase
    .from("hammerex_trade_off_listings")
    .select(
      "slug, display_name, primary_trade, city, avatar_url, rating_avg, rating_count, hammerex_standard_verified"
    )
    .in("slug", slugs)
    .eq("status", "live");

  type RecCard = Pick<
    HammerexTradeOffListing,
    | "slug"
    | "display_name"
    | "primary_trade"
    | "city"
    | "avatar_url"
    | "rating_avg"
    | "rating_count"
    | "hammerex_standard_verified"
  >;
  const found = ((res.data ?? []) as RecCard[]).reduce<Record<string, RecCard>>(
    (acc, row) => {
      acc[row.slug] = row;
      return acc;
    },
    {}
  );

  // Preserve the tradesperson's chosen ordering — they care which trade
  // they recommend first. Drop any rec whose slug didn't match a live
  // profile (archived, deleted, or never existed).
  const ordered = recs
    .map((r) => {
      const card = found[r.slug];
      return card ? { ...card, note: r.note?.trim() || null } : null;
    })
    .filter(
      (r): r is RecCard & { note: string | null } => r !== null
    );

  if (ordered.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6 sm:pt-12">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
            My Trusted Trades
          </h2>
          <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
            Tradespeople {listing.display_name.split(/\s+/)[0] ?? "I"}{" "}
            personally vouches for. Tap any card to see their profile.
          </p>
        </div>
        <a
          href={`/${listing.slug}/trusted-trades`}
          className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3.5 text-xs font-bold text-neutral-700 transition hover:border-[#FFB300] hover:text-[#FFB300] sm:inline-flex sm:h-10"
        >
          View all
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </a>
      </div>

      <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ordered.map((r) => {
          const rating =
            typeof r.rating_avg === "number" && r.rating_avg > 0
              ? r.rating_avg.toFixed(1)
              : null;
          const trade = tradeLabel(r.primary_trade);
          return (
            <li key={r.slug}>
              <a
                href={`/${r.slug}`}
                className="group flex h-full items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-[#FFB300] hover:shadow-md"
              >
                {/* Avatar */}
                <span className="relative inline-block shrink-0">
                  <span
                    className="block h-14 w-14 overflow-hidden rounded-full bg-neutral-200 ring-2 ring-white shadow-sm"
                    style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                  >
                    {r.avatar_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={r.avatar_url}
                        alt={r.display_name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-black text-base font-extrabold text-[#FFB300]">
                        {r.display_name
                          .split(/\s+/)
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((w) => w[0]?.toUpperCase() ?? "")
                          .join("")}
                      </span>
                    )}
                  </span>
                  {r.hammerex_standard_verified && (
                    <span
                      className="absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-white"
                      style={{ background: "#FFB300" }}
                      aria-label="Verified by Xrated"
                      title="Verified by Xrated"
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  )}
                </span>

                {/* Text column */}
                <div className="min-w-0 flex-1">
                  {/* Trade chip — the headline label customers scan
                      for. Yellow brand pill so the trade pops at a
                      glance ("Need an electrician?" → eye lands on the
                      yellow ELECTRICIAN chip immediately). */}
                  <span
                    className="inline-flex max-w-full items-center gap-1 truncate rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-neutral-900 sm:text-[11px]"
                    style={{ background: "#FFB300" }}
                  >
                    {trade}
                  </span>
                  <p className="mt-1.5 truncate text-sm font-extrabold text-neutral-900 sm:text-base">
                    {r.display_name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-neutral-500 sm:text-sm">
                    {r.city}
                  </p>
                  {rating && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-neutral-700 sm:text-sm">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#FFB300" aria-hidden="true">
                        <path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
                      </svg>
                      <span className="font-bold">{rating}</span>
                      <span className="text-neutral-500">
                        ({r.rating_count} review{r.rating_count === 1 ? "" : "s"})
                      </span>
                    </p>
                  )}
                  {r.note && (
                    <p className="mt-2 line-clamp-3 text-xs italic leading-relaxed text-neutral-600 sm:text-[13px]">
                      &ldquo;{r.note}&rdquo;
                    </p>
                  )}
                  <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-neutral-500 transition group-hover:text-[#FFB300] sm:text-xs">
                    View profile
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition group-hover:translate-x-0.5">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </p>
                </div>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
