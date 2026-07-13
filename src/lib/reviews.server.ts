// Server-side reviews reader — reads real published reviews from
// hammerex_network_reviews and shapes them into the TradeReview
// contract that ReviewsShell + CanteenProfileFocus already consume.
//
// Fallback: when the merchant has zero real reviews (early lifecycle
// or during the migration window before the DB is seeded), we return
// the MOCK_REVIEWS from src/lib/reviews.ts. This keeps the demo alive
// while real reviews accumulate. Once a merchant has at least one
// real review, the mock never appears for them again.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { TradeReview } from "@/lib/reviews";
import { reviewsForMerchant as reviewsForMerchantMock } from "@/lib/reviews";

/** Returns published reviews for a merchant, real-first with mock
 *  fallback. Filter/sort/aggregate math still runs on the returned
 *  TradeReview[] via the pure functions in src/lib/reviews.ts. */
export async function reviewsForMerchantFromDb(merchantSlug: string): Promise<TradeReview[]> {
  const res = await supabaseAdmin
    .from("hammerex_network_reviews")
    .select("id, merchant_slug, reviewer_slug, reviewer_cookie, reviewer_display_name, reviewer_trade_label, reviewer_city, reviewer_avatar_url, job_verification_kind, job_verification_at, job_verification_label, quality_score, communication_score, punctuality_score, value_score, cleanliness_score, trade_specific_score, body, photo_urls, status, publish_at, owner_response_body, owner_response_at, owner_response_kind, admin_action, admin_action_reason, admin_action_at, helpful_count, created_at")
    .eq("merchant_slug", merchantSlug)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (res.error) {
    // Log and fall through to mocks so a transient DB failure doesn't
    // blank the profile. Never rethrow — the reviews page is public.
    // eslint-disable-next-line no-console
    console.error("[reviews.server] read failed", res.error);
    return reviewsForMerchantMock(merchantSlug);
  }

  const rows = res.data ?? [];
  if (rows.length === 0) {
    // Design fallback — mocks fill the surface until real reviews
    // accumulate. Merchants with any real review get real reviews
    // only; no interleaving.
    return reviewsForMerchantMock(merchantSlug);
  }

  return rows.map((r) => shapeRow(r));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shapeRow(r: any): TradeReview {
  return {
    id: r.id,
    merchantSlug: r.merchant_slug,
    reviewer: {
      slug: r.reviewer_slug ?? r.reviewer_cookie ?? r.id,
      displayName: r.reviewer_display_name,
      tradeLabel: r.reviewer_trade_label ?? "",
      city: r.reviewer_city ?? "",
      avatarUrl: r.reviewer_avatar_url ?? null,
      weight: 1.0 // Real weight lookup lands when accountability table is populated
    },
    jobVerification: {
      kind: r.job_verification_kind,
      when: r.job_verification_at ?? r.created_at,
      label: r.job_verification_label ?? "Verified"
    },
    scores: {
      quality: r.quality_score,
      communication: r.communication_score,
      punctuality: r.punctuality_score,
      value: r.value_score,
      cleanliness: r.cleanliness_score,
      trade_specific: r.trade_specific_score ?? undefined
    },
    body: r.body,
    photoUrls: (r.photo_urls ?? []) as string[],
    status: r.status,
    publishAt: r.publish_at ?? null,
    createdAt: r.created_at,
    ownerResponse: r.owner_response_body
      ? {
          body: r.owner_response_body,
          respondedAt: r.owner_response_at,
          kind: r.owner_response_kind ?? "public-reply"
        }
      : undefined,
    adminAction: r.admin_action
      ? {
          kind: r.admin_action,
          reason: r.admin_action_reason ?? "",
          at: r.admin_action_at
        }
      : undefined,
    helpfulCount: r.helpful_count ?? 0
  };
}
