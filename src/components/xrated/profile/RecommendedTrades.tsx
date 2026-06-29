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
import { TrustedTradesGrid } from "./TrustedTradesGrid";

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
    <section className="mx-auto w-full max-w-6xl px-4 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-12">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-3 text-xl font-extrabold text-neutral-900 sm:text-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2029,%202026,%2006_48_57%20PM.png?tr=w-128,c-at_max,f-png,q-90"
              alt=""
              aria-hidden="true"
              className="h-8 w-auto shrink-0 sm:h-10"
            />
            My Trusted Trades
          </h2>
          <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
            Tradespeople {listing.display_name.split(/\s+/)[0] ?? "I"}{" "}
            personally vouches for. Tap any card to see their profile.
          </p>
        </div>
      </div>

      <TrustedTradesGrid cards={ordered} />
    </section>
  );
}
