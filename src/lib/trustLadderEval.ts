// Trust-ladder evaluation — one call per merchant, returns the
// criteria snapshot + computed tier. Shared by:
//   • /api/merchant/trust-ladder   (single-merchant on-demand read)
//   • /api/cron/recompute-trust-ladders (nightly batch fan-out)

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  CRITERIA,
  computeTier,
  computeScore,
  type Criterion,
  type CriterionState,
  type TrustTier
} from "@/lib/trustLadder";

export type ListingRow = {
  slug:                     string;
  tier:                     string;
  created_at:               string;
  whatsapp:                 string | null;
  bio:                      string | null;
  avatar_url:               string | null;
  photos:                   string[] | null;
  primary_trade:            string | null;
  city:                     string | null;
  insurance_verified:       boolean | null;
  trade_body_verified:      boolean | null;
  trust_skip_queue_paid_at: string | null;
  rating_avg:               number | null;
  rating_count:             number | null;
  trust_tier?:              string | null;
  trust_score?:             number | null;
};

export function evaluateListing(listing: ListingRow): {
  criteria: CriterionState[];
  tier:     TrustTier;
  score:    number;
} {
  const reviewCount     = listing.rating_count ?? 0;
  const reviewAvg       = listing.rating_avg   ?? 0;
  const daysActive      = Math.floor((Date.now() - new Date(listing.created_at).getTime()) / (24 * 60 * 60 * 1000));
  const profileComplete =
    !!listing.bio && listing.bio.length >= 30 &&
    !!listing.avatar_url &&
    !!listing.primary_trade &&
    !!listing.city;
  const photosCount     = Array.isArray(listing.photos) ? listing.photos.length : 0;
  const paidSkipQueue   = !!listing.trust_skip_queue_paid_at;

  const check = (slug: string): boolean => {
    switch (slug) {
      case "profile_complete":    return profileComplete;
      case "whatsapp_verified":   return !!listing.whatsapp && listing.whatsapp.replace(/\D/g, "").length >= 10;
      case "min_photos_3":        return photosCount >= 3;
      case "min_reviews_1":       return reviewCount >= 1;
      case "days_active_30":      return daysActive >= 30;
      case "min_reviews_10":      return reviewCount >= 10;
      case "min_avg_rating_4_0":  return reviewAvg >= 4.0 && reviewCount >= 3;
      case "tier_pro_sub":        return ["app_paid", "verified", "works"].includes(listing.tier);
      case "insurance_verified":  return !!listing.insurance_verified || paidSkipQueue;
      case "min_reviews_25":      return reviewCount >= 25;
      case "min_avg_rating_4_5":  return reviewAvg >= 4.5 && reviewCount >= 10;
      case "trade_body_verified": return !!listing.trade_body_verified;
      case "tier_business_sub":   return ["verified", "works"].includes(listing.tier);
      default:                     return false;
    }
  };

  const snapshotFor = (slug: string): unknown => {
    switch (slug) {
      case "min_photos_3":        return { count: photosCount };
      case "min_reviews_1":
      case "min_reviews_10":
      case "min_reviews_25":      return { count: reviewCount };
      case "min_avg_rating_4_0":
      case "min_avg_rating_4_5":  return { avg: Number(reviewAvg.toFixed(2)), count: reviewCount };
      case "days_active_30":      return { days: daysActive };
      case "tier_pro_sub":
      case "tier_business_sub":   return { current_tier: listing.tier };
      case "insurance_verified":  return { verified: !!listing.insurance_verified, paid_skip: paidSkipQueue };
      default:                     return undefined;
    }
  };

  const criteria: CriterionState[] = CRITERIA.map((c: Criterion) => ({
    ...c,
    met:           check(c.slug),
    valueSnapshot: snapshotFor(c.slug)
  }));

  return {
    criteria,
    tier:  computeTier(criteria),
    score: computeScore(criteria)
  };
}

/** Persist tier + score to the listing; write a history row if the
 *  tier changed; upsert the criteria snapshot. Idempotent. */
export async function persistTrustEvaluation(
  slug: string,
  currentTier: TrustTier,
  score: number,
  criteria: CriterionState[],
  previousTier: string | null,
  previousScore: number | null,
  reason: string
): Promise<{ tierChanged: boolean }> {
  const tierChanged = previousTier !== null && previousTier !== currentTier;

  await Promise.all([
    supabaseAdmin
      .from("hammerex_trade_off_listings")
      .update({
        trust_tier:       currentTier,
        trust_score:      score,
        trust_updated_at: new Date().toISOString()
      })
      .eq("slug", slug),

    tierChanged
      ? supabaseAdmin
          .from("hammerex_merchant_trust_history")
          .insert({
            merchant_slug: slug,
            from_tier:     previousTier,
            to_tier:       currentTier,
            reason,
            score_before:  previousScore ?? 0,
            score_after:   score
          })
      : Promise.resolve(),

    supabaseAdmin
      .from("hammerex_merchant_trust_criteria")
      .upsert(
        criteria.map((c) => ({
          merchant_slug:  slug,
          criterion_slug: c.slug,
          met:            c.met,
          value_snapshot: c.valueSnapshot ?? null,
          updated_at:     new Date().toISOString()
        })),
        { onConflict: "merchant_slug,criterion_slug" }
      )
  ]);

  return { tierChanged };
}
