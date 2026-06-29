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
import { StarsRating } from "../StarsRating";
import { ReviewMarquee, type ReviewMarqueeItem } from "../ReviewMarquee";

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

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((s) => s.length > 0)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function avg(values: Array<number | null>): number | null {
  const nums = values
    .map((v) => (typeof v === "number" ? v : null))
    .filter((v): v is number => v !== null && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function fivePct(value: number | null): string {
  if (value === null) return "—";
  return `${((value / 5) * 100).toFixed(1)}%`;
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

  const bigNumber = overallAvg === null ? "—" : overallAvg.toFixed(1);
  const overallPct =
    overallAvg === null
      ? null
      : Math.round((overallAvg / 5) * 100);

  const pillars: { label: string; value: number | null }[] = [
    { label: "Quality", value: qualityAvg },
    { label: "Delivery", value: deliveryAvg },
    { label: "Service", value: serviceAvg },
    { label: "Value", value: valueAvg }
  ];

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Reviews
        </h2>
        <a
          href={`/${listingSlug}/review`}
          className="inline-flex h-11 items-center rounded-lg px-4 text-[13px] font-extrabold uppercase tracking-wider transition hover:opacity-90"
          style={{ background: "#FFB300", color: "#0A0A0A" }}
        >
          Write a review
        </a>
      </div>

      {/* Clean white summary card. LEFT half = big overall + stars +
          count. RIGHT half = 2-col pillar list with thin progress bars.
          Empty state keeps the bars as grey tracks with em-dashes — looks
          professional without visual noise. */}
      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[auto,1fr] md:items-center">
          <div className="flex flex-col items-start gap-2 md:flex-row md:items-center md:gap-5">
            <div className="text-5xl font-extrabold leading-none text-neutral-900">
              {bigNumber}
            </div>
            <div className="flex flex-col gap-1">
              <StarsRating rating={overallAvg} reviewCount={count} />
              <p className="text-[13px] text-neutral-500">
                {count} {count === 1 ? "review" : "reviews"}
              </p>
              {/* Overall avg bar. Yellow fill scaled to percentage. Empty
                  state (no reviews) renders the neutral track only. */}
              <div
                className="mt-1 h-2 w-full max-w-[200px] overflow-hidden rounded-full bg-neutral-200"
                role="progressbar"
                aria-label="Overall review score"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={overallPct ?? 0}
              >
                {overallPct !== null && overallPct > 0 && (
                  <div
                    className="h-2 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(0, overallPct))}%`, background: "#FFB300" }}
                  />
                )}
              </div>
            </div>
          </div>

          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-x-6">
            {pillars.map((p) => {
              const pct =
                p.value === null
                  ? null
                  : Math.round((p.value / 5) * 100);
              return (
                <li
                  key={p.label}
                  className="flex items-center gap-3 text-[13px]"
                >
                  <span className="w-16 shrink-0 font-bold text-neutral-700">
                    {p.label}
                  </span>
                  <div
                    className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200"
                    role="progressbar"
                    aria-label={`${p.label} score`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct ?? 0}
                  >
                    {pct !== null && pct > 0 && (
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: "#FFB300" }}
                      />
                    )}
                  </div>
                  <span className="w-10 shrink-0 text-right font-extrabold text-neutral-900">
                    {pct === null ? "—" : `${pct}%`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {count === 0 ? (
        <>
          <p className="mt-6 text-center text-[13px] font-bold text-neutral-500">
            No reviews yet — be the first.
          </p>
          <p className="mt-1 text-center text-[13px] text-neutral-400">
            Pillar ratings show as soon as the first verified buyer reviews.
          </p>
        </>
      ) : (
        <ReviewMarquee
          reviews={reviews.slice(0, 12).map((r): ReviewMarqueeItem => {
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
          })}
        />
      )}
    </section>
  );
}

export default ProductReviewsBlock;
