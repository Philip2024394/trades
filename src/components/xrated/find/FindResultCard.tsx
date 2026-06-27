// Member showcase card on /find. The whole card links to the
// tradesperson's premium app at /<slug> — we explicitly do NOT
// route to a quote form or message routing endpoint, because that
// would turn the portal into a directory. The customer's only path
// is "tap → land on their app → use the tradie's WhatsApp button."

import { tradeLabel } from "@/lib/tradeOff";
import { tradeHeroFor } from "@/lib/tradeOffHeroes";

export type FindCardListing = {
  slug: string;
  display_name: string;
  trading_name: string | null;
  primary_trade: string;
  city: string | null;
  country: string | null;
  avatar_url: string | null;
  rating_avg: number | null;
  rating_count: number | null;
  years_in_trade: number | null;
  bio: string | null;
  tier: string | null;
  verified_plus_status: string | null;
};

// Centralised: a listing is "verified" when their tier is one of the
// paid-verified tiers OR they've been approved through Verified Plus.
// The find row + grid card both render the badge from this single
// predicate so the visual rule stays consistent.
export function isListingVerified(
  l: Pick<FindCardListing, "tier" | "verified_plus_status">
): boolean {
  if (l.verified_plus_status === "approved") return true;
  const t = (l.tier ?? "").toLowerCase();
  return t === "verified" || t === "verified_plus";
}

export const VERIFIED_BADGE_URL =
  "https://ik.imagekit.io/9mrgsv2rp/Untitledsdfsdfsdfdfsdfsdfsdfsdfsdf-removebg-preview.png";

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK = "#0A0A0A";

export function FindResultCard({ listing }: { listing: FindCardListing }) {
  const banner = tradeHeroFor(listing.primary_trade);
  const tradeText = tradeLabel(listing.primary_trade);
  const name = listing.trading_name?.trim() || listing.display_name;
  const initials = (listing.display_name.match(/\b[A-Z]/g) ?? []).slice(0, 2).join("");
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
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-lg"
    >
      {/* Banner */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-100">
        {banner ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={banner}
            alt={`${tradeText} hero banner`}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0" style={{ background: BRAND_YELLOW }} />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-1/2"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0) 100%)"
          }}
        />
        {/* Trade chip */}
        <span
          className="absolute left-3 top-3 inline-flex items-center rounded-full bg-black/80 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white backdrop-blur"
        >
          {tradeText}
        </span>
        {/* Verified tick */}
        <span
          className="absolute right-3 top-3 inline-flex h-7 items-center gap-1 rounded-full px-2 text-[10px] font-extrabold uppercase tracking-wider text-neutral-900 shadow-md"
          style={{ background: BRAND_YELLOW }}
          aria-label="Verified Xrated member"
          title="Verified Xrated member"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={BRAND_BLACK} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Verified
        </span>
        {/* Name + city overlay bottom-left */}
        <div className="absolute inset-x-0 bottom-0 px-4 pb-3 sm:px-5 sm:pb-4">
          <p className="text-xl font-extrabold leading-tight text-white drop-shadow sm:text-2xl">
            {name}
          </p>
          {listing.city && (
            <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-white/85 sm:text-xs">
              {listing.city}
              {listing.country && listing.country !== "UK" ? `, ${listing.country}` : ""}
            </p>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-center gap-3">
          {listing.avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={listing.avatar_url}
              alt=""
              className="h-10 w-10 rounded-full object-cover ring-2 ring-neutral-100"
            />
          ) : (
            <span
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-extrabold text-neutral-900"
              style={{ background: BRAND_YELLOW }}
              aria-hidden="true"
            >
              {initials || "X"}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-[13px] font-extrabold text-neutral-900">
              {listing.display_name}
            </p>
            {listing.years_in_trade !== null && listing.years_in_trade > 0 && (
              <p className="text-[11px] text-neutral-500">
                {listing.years_in_trade}+ years in trade
              </p>
            )}
          </div>
        </div>

        {/* Rating row */}
        {reviews > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs">
            <span className="inline-flex items-center gap-1 font-extrabold text-neutral-900">
              <span style={{ color: BRAND_YELLOW }}>★</span>
              {rating.toFixed(1)}
            </span>
            <span className="text-neutral-500">— {reviews} reviews</span>
            {ratingLabel && (
              <span
                className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: `${BRAND_YELLOW}1A`,
                  color: "#7A5300"
                }}
              >
                {ratingLabel}
              </span>
            )}
          </div>
        )}

        {/* Yellow CTA — same brand chip as the rest of the site. */}
        <span
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-[13px] font-extrabold uppercase tracking-wider text-neutral-900 shadow-sm transition group-hover:shadow-md sm:text-sm"
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

export default FindResultCard;
