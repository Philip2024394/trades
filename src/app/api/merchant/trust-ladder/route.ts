// GET /api/merchant/trust-ladder
//
// Returns the merchant's current trust tier, score, every criterion
// (met/unmet + snapshot value), and the missing criteria to reach
// the next tier. Powers TrustLadderPanel on the dashboard + the
// dedicated /trust-ladder page.
//
// Compute is on-demand — each read re-evaluates criteria against
// live listing data. Fast enough (< 200ms) because it's ~4 parallel
// count queries.
//
// Snapshot is also written back to hammerex_merchant_trust_criteria
// on every read so cron + admin can inspect state without recomputing.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";
import {
  CRITERIA,
  TRUST_TIER_META,
  TRUST_TIER_ORDER,
  computeTier,
  computeScore,
  nextTierGap,
  tierProgress,
  type Criterion,
  type CriterionState,
  type TrustTier
} from "@/lib/trustLadder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Evaluate every criterion for a merchant given live data. */
async function evaluate(slug: string): Promise<{
  criteria: CriterionState[];
  listing:  { tier: string; created_at: string; whatsapp: string | null; bio: string | null; avatar_url: string | null; photos: string[] | null; primary_trade: string | null; city: string | null; insurance_verified: boolean; trade_body_verified: boolean; trust_skip_queue_paid_at: string | null };
}> {
  // Read the listing — denormalised rating_count + rating_avg give
  // us everything the trust rules need without a separate reviews
  // table query. Kept as a Promise.all pattern so future readers
  // (e.g. subscription state) can be added in parallel without
  // touching the call site.
  const [listingRes] = await Promise.all([
    supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("tier, created_at, whatsapp, bio, avatar_url, photos, primary_trade, city, insurance_verified, trade_body_verified, trust_skip_queue_paid_at, rating_avg, rating_count")
      .eq("slug", slug)
      .maybeSingle()
  ]);

  const listing = listingRes.data as {
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
  } | null;

  if (!listing) {
    return { criteria: [], listing: { tier: "app_free", created_at: new Date().toISOString(), whatsapp: null, bio: null, avatar_url: null, photos: null, primary_trade: null, city: null, insurance_verified: false, trade_body_verified: false, trust_skip_queue_paid_at: null } };
  }

  // Use listing's denormalised rating_count + rating_avg — kept up
  // to date by the reviews subsystem's post-insert triggers.
  const reviewCount = listing.rating_count ?? 0;
  const reviewAvg   = listing.rating_avg   ?? 0;

  const daysActive = Math.floor((Date.now() - new Date(listing.created_at).getTime()) / (24 * 60 * 60 * 1000));
  const profileComplete =
    !!listing.bio && listing.bio.length >= 30 &&
    !!listing.avatar_url &&
    !!listing.primary_trade &&
    !!listing.city;
  const photosCount = Array.isArray(listing.photos) ? listing.photos.length : 0;
  const paidSkipQueue = !!listing.trust_skip_queue_paid_at;

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
    listing: {
      tier:                     listing.tier,
      created_at:               listing.created_at,
      whatsapp:                 listing.whatsapp,
      bio:                      listing.bio,
      avatar_url:               listing.avatar_url,
      photos:                   listing.photos,
      primary_trade:            listing.primary_trade,
      city:                     listing.city,
      insurance_verified:       !!listing.insurance_verified,
      trade_body_verified:      !!listing.trade_body_verified,
      trust_skip_queue_paid_at: listing.trust_skip_queue_paid_at
    }
  };
}

export async function GET(): Promise<NextResponse> {
  const slug = await getMerchantSlug();
  if (!slug) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  const { criteria, listing } = await evaluate(slug);
  const currentTier: TrustTier = computeTier(criteria);
  const score                  = computeScore(criteria);
  const gap                    = nextTierGap(currentTier, criteria);

  // Cache the tier + score back on the listing so public surfaces
  // (canteen page, yard sort) can read the badge in one query.
  const existingTier = (await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("trust_tier, trust_score, trust_badge_color")
    .eq("slug", slug)
    .maybeSingle()).data as { trust_tier?: string; trust_score?: number; trust_badge_color?: string | null } | null;

  if (existingTier?.trust_tier !== currentTier || existingTier?.trust_score !== score) {
    await Promise.all([
      supabaseAdmin
        .from("hammerex_trade_off_listings")
        .update({
          trust_tier:       currentTier,
          trust_score:      score,
          trust_updated_at: new Date().toISOString()
        })
        .eq("slug", slug),
      existingTier?.trust_tier && existingTier.trust_tier !== currentTier
        ? supabaseAdmin
            .from("hammerex_merchant_trust_history")
            .insert({
              merchant_slug: slug,
              from_tier:     existingTier.trust_tier,
              to_tier:       currentTier,
              reason:        "on_demand_recompute",
              score_before:  existingTier.trust_score ?? 0,
              score_after:   score
            })
        : Promise.resolve()
    ]);
  }

  // Write the criteria snapshot in bulk (upsert). Non-critical if
  // it fails — the compute above is authoritative.
  await supabaseAdmin
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
    );

  return NextResponse.json({
    ok: true,
    tier:  currentTier,
    score,
    tierMeta:     TRUST_TIER_META[currentTier],
    allTiers:     TRUST_TIER_ORDER.map((t) => ({ slug: t, ...TRUST_TIER_META[t] })),
    criteria:     criteria.map((c) => ({
      slug:          c.slug,
      label:         c.label,
      hint:          c.hint,
      requiredFor:   c.requiredFor,
      points:        c.points,
      met:           c.met,
      valueSnapshot: c.valueSnapshot,
      payToSkip:     c.payToSkip
    })),
    nextGap:      gap,
    progress: {
      silver:   tierProgress(criteria, "silver"),
      gold:     tierProgress(criteria, "gold"),
      platinum: tierProgress(criteria, "platinum")
    },
    badgeColor:   existingTier?.trust_badge_color ?? TRUST_TIER_META[currentTier].color,
    listing: {
      tier:               listing.tier,
      days_active:        Math.floor((Date.now() - new Date(listing.created_at).getTime()) / (24 * 60 * 60 * 1000)),
      insurance_verified: listing.insurance_verified,
      trade_body_verified: listing.trade_body_verified,
      skip_queue_paid:    !!listing.trust_skip_queue_paid_at
    }
  });
}
