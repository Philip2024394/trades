// Landscape row variant of the /find result card. Used for search
// results (hasFilter) — the grid card is for the featured slate.
// Reads like an Airbnb / Indeed listing row: banner left, info right,
// yellow CTA right-aligned, dotted divider between rows.

import { tradeLabel } from "@/lib/tradeOff";
import { tradeHeroFor } from "@/lib/tradeOffHeroes";
import type { FindCardListing } from "./FindResultCard";

const BRAND_YELLOW = "#FFB300";

export function FindResultRow({ listing }: { listing: FindCardListing }) {
  const banner = tradeHeroFor(listing.primary_trade);
  const tradeText = tradeLabel(listing.primary_trade);
  const name = listing.trading_name?.trim() || listing.display_name;
  const rating = listing.rating_avg ?? 0;
  const reviews = listing.rating_count ?? 0;
  const ratingLabel =
    rating >= 4.9
      ? "Outstanding"
      : rating >= 4.5
        ? "Excellent"
        : rating >= 4.0
          ? "Great"
          : reviews > 0
            ? "Good"
            : null;

  return (
    <a
      href={`/${listing.slug}`}
      className="group grid grid-cols-1 gap-4 py-5 transition hover:bg-neutral-50/60 sm:grid-cols-[200px,1fr,auto] sm:items-center sm:gap-5 sm:py-6"
    >
      {/* Banner */}
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-neutral-100 sm:h-[130px] sm:w-[200px]">
        {banner ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={banner}
            alt={`${tradeText} hero banner`}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="absolute inset-0" style={{ background: BRAND_YELLOW }} />
        )}
      </div>

      {/* Info column */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <h3 className="truncate text-base font-extrabold text-neutral-900 sm:text-lg">
            {name}
          </h3>
        </div>
        <p className="mt-0.5 truncate text-[13px] font-bold text-neutral-600 sm:text-sm">
          {tradeText}
          {listing.city ? ` · ${listing.city}` : ""}
          {listing.years_in_trade && listing.years_in_trade > 0
            ? ` · ${listing.years_in_trade}+ yrs`
            : ""}
        </p>

        {/* Rating row */}
        {reviews > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-neutral-600">
            <span className="inline-flex items-center gap-1 font-extrabold text-neutral-900">
              <span style={{ color: BRAND_YELLOW }}>★</span>
              {rating.toFixed(1)}
            </span>
            <span>— {reviews} reviews</span>
            {ratingLabel && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: `${BRAND_YELLOW}1A`,
                  color: "#7A5300"
                }}
              >
                {ratingLabel}
              </span>
            )}
          </div>
        ) : (
          <p className="mt-2 text-[12px] text-neutral-500">No reviews yet</p>
        )}
      </div>

      {/* CTA column — right-aligned on desktop, full width on mobile */}
      <div className="flex sm:justify-end">
        <span
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-[13px] font-extrabold uppercase tracking-wider text-neutral-900 shadow-sm transition group-hover:shadow-md sm:px-5 sm:text-sm"
          style={{
            background: BRAND_YELLOW,
            boxShadow: `0 4px 14px ${BRAND_YELLOW}55`
          }}
        >
          Open {listing.display_name.split(/\s+/)[0]}&rsquo;s app
          <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
            &rarr;
          </span>
        </span>
      </div>
    </a>
  );
}

export default FindResultRow;
