// Fixed bottom action bar on the public trade profile.
//
// Left side  : star rating + review count (visible only when the
//              listing has a real aggregated rating).
// Right side : WhatsApp button (green pill, primary action).
// Surface    : black (#0A0A0A) to match TradeProfileFooter and the
//              rest of the tradie chrome. Always sits above scroll.

import type { HammerexTradeOffListing } from "@/lib/supabase";

export function TradeProfileStickyCTA({
  listing,
  waUrl
}: {
  listing: HammerexTradeOffListing;
  waUrl: string;
}) {
  const rating =
    typeof listing.rating_avg === "number" && listing.rating_avg > 0
      ? listing.rating_avg.toFixed(1)
      : null;
  const reviewCount = listing.rating_count ?? 0;
  const hasWhatsapp = Boolean((listing.whatsapp ?? "").trim());

  // Nothing to surface at all → render nothing.
  if (!rating && !hasWhatsapp) return null;

  return (
    <div
      role="region"
      aria-label={`${listing.display_name} — quick actions`}
      className="fixed inset-x-0 bottom-0 z-40"
      style={{
        background: "#0A0A0A",
        paddingBottom: "env(safe-area-inset-bottom)"
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Left — rating */}
        {rating ? (
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="#FFB300"
                aria-hidden="true"
              >
                <path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
              </svg>
              <span className="text-[15px] font-extrabold text-white">
                {rating}
              </span>
            </span>
            {reviewCount > 0 ? (
              <span className="text-[12px] text-white/60">
                ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
              </span>
            ) : null}
          </div>
        ) : (
          <div className="min-w-0 text-[12px] text-white/60">
            {listing.display_name}
          </div>
        )}

        {/* Right — WhatsApp CTA */}
        {hasWhatsapp ? (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full px-5 text-[13px] font-extrabold text-white shadow-lg transition active:scale-[0.97] sm:text-sm"
            style={{
              background: "#0F7A3F",
              boxShadow: "0 8px 22px rgba(15,122,63,0.45)"
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Zm-7.05 15.4a8.36 8.36 0 0 1-4.27-1.17l-.3-.18-3.34.87.89-3.26-.2-.33A8.32 8.32 0 1 1 12 20.31Z" />
            </svg>
            <span className="hidden sm:inline">Message on WhatsApp</span>
            <span className="sm:hidden">WhatsApp</span>
          </a>
        ) : null}
      </div>
    </div>
  );
}
