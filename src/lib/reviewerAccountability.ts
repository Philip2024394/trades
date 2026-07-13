// Reviewer accountability — the game-theoretic layer that keeps
// serial 1-star trolls from crushing merchants over time.
//
// Every reviewer has a `weight_multiplier` that scales their vote in
// the Bayesian aggregate. Baseline 1.0; drops as their submitted-vs-
// disputed / submitted-vs-removed ratio rises; bumps to 1.5 for
// verified job-tag reviewers.
//
// Weights (matches the design brainstorm):
//   0-5%   disputed → 1.5× (only when at least one review verified)
//   5-15%  disputed → 1.0× (default)
//   15-25% disputed → 0.75× (yellow flag)
//   25%+   disputed → 0.5× (amber/red — "contested reviewer history")
//
// Called from:
//   - src/app/api/admin/reviews/[id]/action/route.ts on remove
//   - future dispute-resolution endpoints
//   - a periodic housekeeping job when we ship one

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function recalculateReviewerWeight(reviewerId: string): Promise<number> {
  // Aggregate the reviewer's submitted / disputed / removed counts
  // from the reviews table in one query.
  const res = await supabaseAdmin
    .from("hammerex_network_reviews")
    .select("status, admin_action")
    .or(`reviewer_slug.eq.${reviewerId},reviewer_cookie.eq.${reviewerId}`);

  if (res.error) {
    // eslint-disable-next-line no-console
    console.error("[reviewerAccountability] read failed", res.error);
    return 1.0;
  }

  const rows = res.data ?? [];
  const submitted = rows.length;
  const removed = rows.filter((r) => r.status === "removed").length;
  // Disputed counts as "review had merchant push back" — approximated
  // for now by "row that got frozen at some point". Real dispute
  // events land when the merchant dispute flow ships.
  const disputed = rows.filter((r) => r.admin_action === "frozen" || r.admin_action === "removed").length;

  let weight = 1.0;
  if (submitted >= 3) {
    const disputedRatio = disputed / submitted;
    if (disputedRatio >= 0.25) weight = 0.5;
    else if (disputedRatio >= 0.15) weight = 0.75;
  }

  // Upsert the accountability row so the aggregate can pull it.
  await supabaseAdmin
    .from("hammerex_network_reviewer_accountability")
    .upsert({
      reviewer_slug: reviewerId,
      reviews_submitted: submitted,
      reviews_disputed: disputed,
      reviews_removed: removed,
      weight_multiplier: weight,
      updated_at: new Date().toISOString()
    });

  return weight;
}

/** Read the current weight multiplier for a reviewer. Falls back to
 *  1.0 when the accountability row doesn't exist yet. */
export async function reviewerWeight(reviewerId: string): Promise<number> {
  const res = await supabaseAdmin
    .from("hammerex_network_reviewer_accountability")
    .select("weight_multiplier")
    .eq("reviewer_slug", reviewerId)
    .maybeSingle();
  if (res.error || !res.data) return 1.0;
  return Number(res.data.weight_multiplier);
}
