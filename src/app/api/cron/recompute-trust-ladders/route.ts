// Cron · nightly 02:30 UTC — recomputes trust tier + score for
// every live merchant.
//
// Why nightly (not just on-demand): most criteria change slowly
// (review count, days_active, subscription status). This ensures
// the cached trust_tier + trust_score on the listing stay in sync
// with reality even when a merchant hasn't opened the dashboard
// in weeks — so yard sort and public canteen badges keep working.
//
// Fast path — every merchant handled in a single query, no reviews
// join thanks to the denormalised rating_avg + rating_count columns
// on the listing.
//
// The route is safe to re-trigger — the persist step is idempotent.

import { NextResponse } from "next/server";
import { isCronAuthorised } from "@/lib/cron/authorise";
import { supabaseAdmin }   from "@/lib/supabaseAdmin";
import { evaluateListing, persistTrustEvaluation, type ListingRow } from "@/lib/trustLadderEval";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const { data: listings, error } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("slug, tier, created_at, whatsapp, bio, avatar_url, photos, primary_trade, city, insurance_verified, trade_body_verified, trust_skip_queue_paid_at, rating_avg, rating_count, trust_tier, trust_score")
    .eq("status", "live");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (listings ?? []) as ListingRow[];
  let promoted = 0;
  let demoted  = 0;
  let same     = 0;
  const failures: Array<{ slug: string; reason: string }> = [];

  for (const listing of rows) {
    try {
      const { criteria, tier, score } = evaluateListing(listing);
      const prevTier = listing.trust_tier ?? null;
      const { tierChanged } = await persistTrustEvaluation(
        listing.slug,
        tier,
        score,
        criteria,
        prevTier,
        listing.trust_score ?? null,
        "nightly_recompute"
      );
      if (!tierChanged) {
        same++;
      } else {
        const order = ["bronze", "silver", "gold", "platinum"];
        if (order.indexOf(tier) > order.indexOf(prevTier ?? "bronze")) promoted++;
        else demoted++;
      }
    } catch (e) {
      failures.push({ slug: listing.slug, reason: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({
    ok:         true,
    ran_at:     new Date().toISOString(),
    evaluated:  rows.length,
    promoted,
    demoted,
    same,
    failures
  });
}
