// Merchant directory search — the read-side over
// hammerex_trade_off_listings. Supports:
//   • trade filter (primary_trade OR contains in secondary_trades[])
//   • area filter (city case-insensitive OR postcode_prefix startsWith)
//   • distance calc when caller supplies lat/lng
//
// No fuzzy full-text search yet — the listings table has plenty of
// exact fields to lean on. When a search relevance model lands we
// swap the matching layer here.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evidenceFor, type NetworkBusiness } from "./types";

const MAX_RESULTS = 20;

export type FindBusinessesInput = {
  trade?:          string;            // slug or free-text ("bricklayer" / "roofer")
  city?:           string;
  postcode_prefix?: string;
  /** When set, results include distance_km sorted ascending. */
  origin?:         { lat: number; lng: number };
  limit?:          number;
  /** Exclude these slugs (usually the caller's own listing). */
  exclude_slugs?:  string[];
};

export async function findBusinesses(opts: FindBusinessesInput): Promise<NetworkBusiness[]> {
  const evidence = evidenceFor("hammerex_trade_off_listings", ["hammerex_trade_off_listings"]);

  let q = supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("slug, display_name, trading_name, primary_trade, secondary_trades, city, postcode_prefix, lat, lng")
    .limit(opts.limit ?? MAX_RESULTS);

  const trade = opts.trade?.toLowerCase().trim();
  if (trade) {
    // Match primary_trade case-insensitive OR contains in secondary_trades[].
    q = q.or(`primary_trade.ilike.${trade}%,secondary_trades.cs.{${trade}}`);
  }
  if (opts.city) q = q.ilike("city", `%${opts.city}%`);
  if (opts.postcode_prefix) q = q.ilike("postcode_prefix", `${opts.postcode_prefix}%`);

  const rows = await q;
  let results: NetworkBusiness[] = (rows.data ?? []).map((r) => {
    const lat = r.lat as number | null;
    const lng = r.lng as number | null;
    const dist = opts.origin && lat !== null && lng !== null
      ? haversineKm(opts.origin.lat, opts.origin.lng, Number(lat), Number(lng))
      : null;
    return {
      slug:             String(r.slug),
      display_name:     String(r.display_name),
      trading_name:     (r.trading_name as string | null) ?? null,
      primary_trade:    String(r.primary_trade),
      secondary_trades: (r.secondary_trades as string[] | null) ?? [],
      city:             String(r.city),
      postcode_prefix:  (r.postcode_prefix as string | null) ?? null,
      distance_km:      dist,
      evidence
    };
  });

  if (opts.exclude_slugs && opts.exclude_slugs.length > 0) {
    const skip = new Set(opts.exclude_slugs);
    results = results.filter((r) => !skip.has(r.slug));
  }

  if (opts.origin) {
    results.sort((a, b) => {
      const ax = a.distance_km ?? Number.POSITIVE_INFINITY;
      const bx = b.distance_km ?? Number.POSITIVE_INFINITY;
      return ax - bx;
    });
  }

  return results;
}

/** Great-circle distance in km via Haversine. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}
