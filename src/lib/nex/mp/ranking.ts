// Ranking — turn a set of ProductListing into RankedListing rows.
//
// Each factor is scored 0..100 independently, then a weighted mean
// gives the overall score. Null factors are excluded from the mean.
//
// Weights:
//   price     3   (biggest driver — cost matters most day-to-day)
//   stock     2   (in-stock beats "coming soon")
//   lead_time 2   (soonest reaches site)
//   distance  1.5 (closer = cheaper delivery, faster reordering)
//   trust     1   (supplier reputation, from NET when available)

import type { ProductListing, RankedListing } from "./types";

const WEIGHTS = { price: 3, stock: 2, lead_time: 2, distance: 1.5, trust: 1 } as const;

const STOCK_SCORE: Record<ProductListing["stock_status"], number> = {
  in_stock:     100,
  low_stock:    70,
  unknown:      50,
  out_of_stock: 10
};

export type TrustLookup = (merchantSlug: string) => Promise<number | null>;

export type RankInput = {
  listings:    ProductListing[];
  /** Optional: supply a trust score per merchant. Skipped when omitted. */
  trustLookup?: TrustLookup;
};

export async function rankListings(input: RankInput): Promise<RankedListing[]> {
  const listings = input.listings;
  if (listings.length === 0) return [];

  // Normalise price + lead time + distance across the batch so scores
  // reflect this specific search (a £5 board vs £10 board — not vs the
  // whole market).
  const prices    = listings.map((l) => l.price_pence).filter((n): n is number => typeof n === "number");
  const leads     = listings.map((l) => l.lead_time_days).filter((n): n is number => typeof n === "number");
  const distances = listings.map((l) => l.distance_km).filter((n): n is number => typeof n === "number");

  const minPrice = prices.length    ? Math.min(...prices)    : null;
  const maxPrice = prices.length    ? Math.max(...prices)    : null;
  const minLead  = leads.length     ? Math.min(...leads)     : null;
  const maxLead  = leads.length     ? Math.max(...leads)     : null;
  const minDist  = distances.length ? Math.min(...distances) : null;
  const maxDist  = distances.length ? Math.max(...distances) : null;

  const out: RankedListing[] = [];
  for (const l of listings) {
    const priceScore    = scoreLowerIsBetter(l.price_pence, minPrice, maxPrice);
    const stockScore    = STOCK_SCORE[l.stock_status];
    const leadScore     = scoreLowerIsBetter(l.lead_time_days, minLead, maxLead);
    const distanceScore = scoreLowerIsBetter(l.distance_km, minDist, maxDist);
    const trustScore    = input.trustLookup && l.merchant_slug ? await input.trustLookup(l.merchant_slug) : null;

    const parts: Array<{ score: number | null; weight: number }> = [
      { score: priceScore,    weight: WEIGHTS.price    },
      { score: stockScore,    weight: WEIGHTS.stock    },
      { score: leadScore,     weight: WEIGHTS.lead_time },
      { score: distanceScore, weight: WEIGHTS.distance },
      { score: trustScore,    weight: WEIGHTS.trust    }
    ];
    let ws = 0, vs = 0;
    for (const p of parts) if (p.score !== null) { ws += p.weight; vs += p.score * p.weight; }
    const score = ws === 0 ? 50 : Math.round(vs / ws);

    const reason = writeReason(l, { priceScore, stockScore, leadScore, distanceScore, trustScore });

    out.push({
      listing: l,
      score,
      score_breakdown: {
        price:     priceScore,
        stock:     stockScore,
        lead_time: leadScore,
        distance:  distanceScore,
        trust:     trustScore
      },
      reason
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

// ─── Scoring helpers ─────────────────────────────────────────

function scoreLowerIsBetter(value: number | null, min: number | null, max: number | null): number | null {
  if (value === null || min === null || max === null) return null;
  if (max === min) return 100;
  const normalised = (value - min) / (max - min);   // 0 at min, 1 at max
  return Math.round((1 - normalised) * 100);
}

function writeReason(l: ProductListing, s: { priceScore: number | null; stockScore: number; leadScore: number | null; distanceScore: number | null; trustScore: number | null }): string {
  const bits: string[] = [];
  if (l.price_pence !== null) bits.push(`£${(l.price_pence / 100).toFixed(2)}`);
  if (l.stock_status === "in_stock") bits.push("in stock");
  else if (l.stock_status === "low_stock") bits.push("low stock");
  else if (l.stock_status === "out_of_stock") bits.push("OUT OF STOCK");
  if (l.lead_time_days !== null) bits.push(`${l.lead_time_days}d lead`);
  if (l.distance_km !== null) bits.push(`~${l.distance_km} km`);
  if (l.merchant_name) bits.push(l.merchant_name);
  void s;
  return bits.join(" · ");
}
