// /site-office/apps/reviews — merchant reviews inbox.

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdFromRequest } from "@/lib/os/merchantSession";
import { ReviewsInbox } from "./ReviewsInbox";

export const dynamic = "force-dynamic";

export default async function MerchantReviewsPage({
  searchParams
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const sp = await searchParams;
  const merchantId = await getMerchantIdFromRequest(sp.m || null);
  if (!merchantId) {
    redirect("/site-office?next=/site-office/apps/reviews");
  }

  const [reviewsRes, responsesRes, disputesRes, requestsRes, merchantRes] =
    await Promise.all([
      supabaseAdmin
        .from("app_reviews_reviews")
        .select(
          "id, reviewer_display_name, rating, headline, body, media_urls, verified, visibility, project_id, created_at"
        )
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("app_reviews_responses")
        .select("review_id, body, responder_display_name, updated_at")
        .eq("merchant_id", merchantId),
      supabaseAdmin
        .from("app_reviews_disputes")
        .select("review_id, status, reason, created_at")
        .eq("merchant_id", merchantId)
        .in("status", ["open", "upheld"]),
      supabaseAdmin
        .from("app_reviews_review_requests")
        .select("id, status, created_at, sent_at")
        .eq("merchant_id", merchantId)
        .in("status", ["queued", "sent", "opened"])
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("display_name, trading_name")
        .eq("id", merchantId)
        .maybeSingle()
    ]);

  const responseMap = new Map(
    (responsesRes.data || []).map((r) => [r.review_id, r])
  );
  const disputeMap = new Map(
    (disputesRes.data || []).map((d) => [d.review_id, d])
  );

  const reviews = (reviewsRes.data || []).map((r) => ({
    id: r.id,
    reviewerDisplayName: r.reviewer_display_name,
    rating: r.rating,
    headline: r.headline,
    body: r.body,
    mediaUrls: r.media_urls || [],
    verified: r.verified,
    visibility: r.visibility,
    createdAt: r.created_at,
    projectId: r.project_id,
    response:
      responseMap.get(r.id) as
        | { body: string; responder_display_name: string; updated_at: string }
        | undefined,
    dispute: disputeMap.get(r.id) as
      | { status: string; reason: string; created_at: string }
      | undefined
  }));

  const openRequests = requestsRes.data || [];
  const totalRating = reviews.reduce((acc, r) => acc + r.rating, 0);
  const avgRating = reviews.length > 0 ? totalRating / reviews.length : 0;

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      <header className="mb-6">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          {merchantRes.data?.trading_name ||
            merchantRes.data?.display_name ||
            "Your business"}
        </p>
        <h1 className="mt-1 text-2xl font-bold md:text-3xl">Reviews</h1>
        <div className="mt-2 flex flex-wrap items-baseline gap-3 text-[14px] text-neutral-700">
          <span className="text-2xl font-bold">{avgRating.toFixed(1)}★</span>
          <span>{reviews.length} verified reviews</span>
          <span className="text-neutral-500">
            · {openRequests.length} pending
          </span>
        </div>
      </header>

      <ReviewsInbox reviews={reviews} openRequests={openRequests.length} />
    </div>
  );
}
