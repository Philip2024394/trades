/**
 * @fileoverview MERCHANT-ONLY component.
 * @merchantOnly Only renders when isStorefrontOn(listing) === true.
 * Importing this from a service-trade context is a code smell — use
 * the service/ siblings instead.
 */

// ProductReviewsBlock — Hammerex-style PDP reviews section.
//
// Reads every live review row from `hammerex_xrated_reviews` for a
// product, then aggregates four pillars + an overall:
//   Quality   = workmanship_rating
//   Delivery  = timeliness_rating
//   Service   = communication_rating
//   Value     = value_rating
//   Overall   = overall_rating
//
// Empty state renders dashes for every pillar plus a helper paragraph
// explaining the percentage maths so a brand-new product page doesn't
// look broken. When reviews exist, the big number reads "X.X · NN% avg"
// and the pillar rows render as percentages with one decimal, e.g.
// "Quality   92.0%". Up to 5 latest review cards render beneath.
//
// Server component; performs the query inline using `supabase` from
// `@/lib/supabase`.

import { supabase } from "@/lib/supabase";
import {
  ProductReviewsCompact,
  type CompactReview,
  type CompactPillar
} from "./ProductReviewsCompact";

type ReviewRow = {
  id: string;
  customer_name: string | null;
  customer_avatar_url: string | null;
  overall_rating: number | null;
  workmanship_rating: number | null;
  timeliness_rating: number | null;
  communication_rating: number | null;
  value_rating: number | null;
  body: string | null;
  submitted_at: string | null;
  created_at: string;
  status: string;
};

async function loadReviews(productId: string): Promise<ReviewRow[]> {
  const res = await supabase
    .from("hammerex_xrated_reviews")
    .select(
      "id, customer_name, customer_avatar_url, overall_rating, workmanship_rating, timeliness_rating, communication_rating, value_rating, body, submitted_at, created_at, status"
    )
    .eq("product_id", productId)
    .eq("status", "live")
    // 24h cool-down + admin-Hide gate. Goes_live_at <= now() is the
    // canonical "publicly visible" filter post-migration.
    .lte("goes_live_at", new Date().toISOString())
    .order("submitted_at", { ascending: false });
  if (res.error) return [];
  return (res.data ?? []) as ReviewRow[];
}

function avg(values: Array<number | null>): number | null {
  const nums = values
    .map((v) => (typeof v === "number" ? v : null))
    .filter((v): v is number => v !== null && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export async function ProductReviewsBlock({
  productId,
  listingSlug
}: {
  productId: string;
  listingSlug: string;
}) {
  const reviews = await loadReviews(productId);
  const count = reviews.length;

  const overallAvg = avg(reviews.map((r) => r.overall_rating));
  const qualityAvg = avg(reviews.map((r) => r.workmanship_rating));
  const deliveryAvg = avg(reviews.map((r) => r.timeliness_rating));
  const serviceAvg = avg(reviews.map((r) => r.communication_rating));
  const valueAvg = avg(reviews.map((r) => r.value_rating));

  const pct = (v: number | null) =>
    v === null ? null : Math.round((v / 5) * 100);
  const pillars: CompactPillar[] = [
    { label: "Quality", pct: pct(qualityAvg) },
    { label: "Delivery", pct: pct(deliveryAvg) },
    { label: "Service", pct: pct(serviceAvg) },
    { label: "Value", pct: pct(valueAvg) }
  ];
  const recent: CompactReview[] = reviews.slice(0, 5).map((r) => {
    const name =
      typeof r.customer_name === "string" &&
      r.customer_name.trim().length > 0
        ? r.customer_name.trim()
        : "Verified buyer";
    const avatarUrl =
      typeof r.customer_avatar_url === "string" &&
      r.customer_avatar_url.trim().length > 0
        ? r.customer_avatar_url.trim()
        : null;
    const body = (r.body ?? "").trim();
    return {
      id: r.id,
      name,
      avatarUrl,
      overallRating: r.overall_rating,
      body,
      date: formatDate(r.submitted_at ?? r.created_at)
    };
  });

  return (
    <ProductReviewsCompact
      overallAvg={overallAvg}
      count={count}
      pillars={pillars}
      recent={recent}
      writeReviewHref={`/${listingSlug}/review`}
    />
  );
}

export default ProductReviewsBlock;
