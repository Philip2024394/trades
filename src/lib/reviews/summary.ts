// Reviews summary — used by any public-facing surface that needs the
// merchant's rating, verified count, and a handful of recent testimonials
// (trade-off directory profile, storefront hero, Studio section, etc.).
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ReviewsSummary = {
  totalCount: number;
  verifiedCount: number;
  averageRating: number;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
  recent: Array<{
    id: string;
    reviewerDisplayName: string;
    rating: number;
    headline: string;
    body: string;
    mediaUrls: string[];
    verified: boolean;
    createdAt: string;
    response?: {
      body: string;
      responderDisplayName: string;
    };
  }>;
};

export async function loadMerchantReviewsSummary(
  merchantId: string,
  opts: { recentLimit?: number; verifiedOnly?: boolean } = {}
): Promise<ReviewsSummary> {
  const recentLimit = opts.recentLimit ?? 6;
  const verifiedOnly = opts.verifiedOnly !== false;

  const base = supabaseAdmin
    .from("app_reviews_reviews")
    .select("id, rating, verified", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .eq("visibility", "public");
  const { count: totalCount } = await base;

  const { count: verifiedCount } = await supabaseAdmin
    .from("app_reviews_reviews")
    .select("id", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .eq("visibility", "public")
    .eq("verified", true);

  // Distribution + average — one pass across ratings
  const { data: allRatings } = await supabaseAdmin
    .from("app_reviews_reviews")
    .select("rating")
    .eq("merchant_id", merchantId)
    .eq("visibility", "public")
    .eq(verifiedOnly ? "verified" : "id", verifiedOnly ? true : "id");

  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0
  };
  let sum = 0;
  (allRatings || []).forEach((r) => {
    const n = r.rating as 1 | 2 | 3 | 4 | 5;
    distribution[n] = (distribution[n] || 0) + 1;
    sum += n;
  });
  const averageRating =
    (allRatings?.length ?? 0) > 0 ? sum / (allRatings?.length ?? 1) : 0;

  // Recent — pull recent reviews + their responses in a join
  const { data: recentRows } = await supabaseAdmin
    .from("app_reviews_reviews")
    .select(
      "id, reviewer_display_name, rating, headline, body, media_urls, verified, created_at, app_reviews_responses!left(body, responder_display_name)"
    )
    .eq("merchant_id", merchantId)
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(recentLimit);

  type ResponseJoin = { body: string; responder_display_name: string };

  const recent = (recentRows || []).map((row) => {
    const rawResp = (
      row as unknown as { app_reviews_responses?: ResponseJoin | ResponseJoin[] }
    ).app_reviews_responses;
    const resp = Array.isArray(rawResp) ? rawResp[0] : rawResp;
    return {
      id: row.id as string,
      reviewerDisplayName: row.reviewer_display_name as string,
      rating: row.rating as number,
      headline: row.headline as string,
      body: row.body as string,
      mediaUrls: (row.media_urls as string[]) || [],
      verified: Boolean(row.verified),
      createdAt: row.created_at as string,
      response: resp
        ? {
            body: resp.body,
            responderDisplayName: resp.responder_display_name
          }
        : undefined
    };
  });

  return {
    totalCount: totalCount ?? 0,
    verifiedCount: verifiedCount ?? 0,
    averageRating,
    ratingDistribution: distribution,
    recent
  };
}
