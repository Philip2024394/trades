// Trade Connections — server-side query that finds local trades who
// install/work with a given product category, filtered by distance from
// the merchant's yard (or city) and ranked by distance × rating ×
// activity. Returns a clean list ready for the carousel.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { tradesForCategory } from "@/lib/merchantCategories";
import {
  haversineKm,
  centroidOf,
  type Latlng
} from "@/lib/ukPostcodeCentroids";

export type TradeCard = {
  id: string;
  slug: string;
  display_name: string;
  primary_trade: string;
  city: string;
  whatsapp: string | null;
  phone: string | null;
  avatar_url: string | null;
  rating_avg: number | null;
  review_count: number;
  distance_km: number;
  accepting_jobs: boolean;
  is_verified: boolean;
};

/** Resolve a listing's geographic centre — yard if set, postcode prefix
 *  if not, finally city-area letter. Never throws — returns null when
 *  we can't place the listing on the map. */
export function listingLatLng(listing: {
  wholesale_origin_lat?: number | null;
  wholesale_origin_lng?: number | null;
  postcode_prefix?: string | null;
  city?: string | null;
}): Latlng | null {
  if (
    typeof listing.wholesale_origin_lat === "number" &&
    typeof listing.wholesale_origin_lng === "number"
  ) {
    return { lat: listing.wholesale_origin_lat, lng: listing.wholesale_origin_lng };
  }
  if (listing.postcode_prefix) {
    const c = centroidOf(listing.postcode_prefix);
    if (c) return c;
  }
  // Last-ditch: city name. We don't have a city geocoder so this returns
  // null — caller filters out unlocatable trades.
  return null;
}

export type LoadTradeConnectionsInput = {
  merchantListing: {
    id: string;
    wholesale_origin_lat?: number | null;
    wholesale_origin_lng?: number | null;
    postcode_prefix?: string | null;
    city?: string | null;
    trade_connections_radius_km?: number | null;
  };
  /** The product's merchant_category — drives the trade-type filter. */
  category: string | null | undefined;
  /** Excluded slugs (e.g. don't show the merchant themselves if they
   *  happen to be tagged as a trade type). */
  excludeSlugs?: string[];
};

/** Find trade-card candidates for the carousel. Caps at 12 results. */
export async function loadTradeConnections({
  merchantListing,
  category,
  excludeSlugs = []
}: LoadTradeConnectionsInput): Promise<TradeCard[]> {
  const trades = tradesForCategory(category);
  if (trades.length === 0) return [];
  const merchantLatLng = listingLatLng(merchantListing);
  if (!merchantLatLng) return [];
  const radiusKm = merchantListing.trade_connections_radius_km ?? 25;

  // NOTE: review_count isn't on the listings table — it's aggregated
  // from a reviews table. For Phase 1 we treat all trades as 0-review
  // and rank purely on rating_avg + distance + verified-tier. A Phase 2
  // join with the reviews table can light up the rating-strength signal.
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select(
      "id, slug, display_name, primary_trade, city, postcode_prefix, whatsapp, phone, avatar_url, rating_avg, accepting_jobs, tier, wholesale_origin_lat, wholesale_origin_lng"
    )
    .in("primary_trade", trades)
    .eq("status", "live")
    .neq("id", merchantListing.id)
    .limit(200);

  if (!res.data) return [];

  const candidates: TradeCard[] = [];
  for (const row of res.data) {
    if (excludeSlugs.includes(row.slug)) continue;
    const traderLatLng = listingLatLng(row);
    if (!traderLatLng) continue; // can't place on map → skip
    const distance = haversineKm(merchantLatLng, traderLatLng);
    if (distance > radiusKm) continue;
    candidates.push({
      id: row.id,
      slug: row.slug,
      display_name: row.display_name ?? "Trade business",
      primary_trade: row.primary_trade ?? "",
      city: row.city ?? "",
      whatsapp: row.whatsapp ?? null,
      phone: row.phone ?? null,
      avatar_url: row.avatar_url ?? null,
      rating_avg: typeof row.rating_avg === "number" ? row.rating_avg : null,
      review_count: 0, // populated by a future review-table join
      distance_km: Math.round(distance * 10) / 10,
      accepting_jobs: row.accepting_jobs === true,
      is_verified: row.tier === "app_verified"
    });
  }

  // Rank (per spec): verified first, then highest rating, then nearest
  // as the tiebreaker. Simple + transparent — users can predict why a
  // trade ranks above another.
  candidates.sort((a, b) => {
    if (a.is_verified !== b.is_verified) return a.is_verified ? -1 : 1;
    const aRating = a.rating_avg ?? 0;
    const bRating = b.rating_avg ?? 0;
    if (aRating !== bRating) return bRating - aRating;
    return a.distance_km - b.distance_km;
  });

  // Cap at 3 for the PDP grid (4 max if a fourth equally-qualified trade
  // is present — keeps the section visually balanced as either a row of
  // 3 or 2×2). Wider directory lives at /find-trades View-all.
  return candidates.slice(0, 4);
}
