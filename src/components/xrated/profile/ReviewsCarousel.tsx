"use client";

// Xrated Trades — public reviews carousel rendered on /trade/<slug>.
// One review card visible at a time; previous/next arrows + dot indicator
// step through. Hides workmanship/communication/value/timeliness sub-
// ratings when null (existing reviews from before the structured-rating
// schema landed). "Disputed" badge surfaces when the tradesperson has
// flagged the review for moderation.

import { useState } from "react";

const PROJECT_TYPE_LABEL: Record<string, string> = {
  new_build: "New build",
  renovation: "Renovation",
  repair: "Repair"
};

export type ReviewCard = {
  id: string;
  customer_name: string;
  customer_postcode: string | null;
  customer_avatar_url: string | null;
  project_type: string | null;
  service_name: string | null;
  /** Set when the review is tagged to a specific Shop Mode product.
   *  Mutually exclusive with `service_name` at submission time. */
  product_id?: string | null;
  /** Joined product name + cover (from the listing query). Null when
   *  the joined product is archived/deleted — chip gracefully omits. */
  product_name?: string | null;
  product_cover_url?: string | null;
  overall_rating: number;
  workmanship_rating: number | null;
  communication_rating: number | null;
  value_rating: number | null;
  timeliness_rating: number | null;
  body: string;
  status: "live" | "disputed";
  public_response: string | null;
  submitted_at: string;
};

export function ReviewsCarousel({
  reviews,
  displayName,
  city,
  slug,
  allowAddReview = true
}: {
  reviews: ReviewCard[];
  displayName: string;
  city: string;
  slug: string;
  /** Free-tier — hides the Add review CTA at the bottom of the card.
   *  Reviews stay readable; only the call-to-action is gated. */
  allowAddReview?: boolean;
}) {
  const [index, setIndex] = useState(0);
  if (reviews.length === 0) return null;
  const safe = Math.min(index, reviews.length - 1);
  const r = reviews[safe];
  const hasPrev = safe > 0;
  const hasNext = safe < reviews.length - 1;

  const outcode =
    r.customer_postcode?.split(" ")[0] || null; // public-safe area only
  const projectLabel = r.project_type ? PROJECT_TYPE_LABEL[r.project_type] : null;
  const date = new Date(r.submitted_at).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric"
  });
  // A review is "product-context" when it was tagged to a product. We
  // only flip labels when we have a joined product name to display —
  // archived/deleted products fall back to service-context labels so
  // the row reads consistently.
  const isProductReview = Boolean(r.product_id && r.product_name);
  const subRatings = [
    {
      label: isProductReview ? "Quality" : "Workmanship",
      value: r.workmanship_rating
    },
    { label: "Communication", value: r.communication_rating },
    { label: "Value", value: r.value_rating },
    {
      label: isProductReview ? "Delivery time" : "Timeliness",
      value: r.timeliness_rating
    }
  ].filter((s): s is { label: string; value: number } => typeof s.value === "number");

  return (
    <div className="mt-4 flex items-center gap-2">
      <button
        type="button"
        onClick={() => setIndex(Math.max(0, safe - 1))}
        disabled={!hasPrev}
        aria-label="Previous review"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-900 shadow-sm transition active:scale-[0.97] disabled:opacity-30"
        style={{ background: "#FFB300" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>

      <div className="flex-1 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((i) => (
                <svg
                  key={i}
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill={i <= r.overall_rating ? "#FFB300" : "none"}
                  stroke="#FFB300"
                  strokeWidth="1.75"
                  aria-hidden="true"
                >
                  <path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
                </svg>
              ))}
            </div>
            <span className="text-sm font-bold text-neutral-900">
              {r.overall_rating.toFixed(1)}
            </span>
            {projectLabel && (
              <span className="ml-1 inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-xs font-semibold text-neutral-700">
                {projectLabel}
              </span>
            )}
            {r.service_name && (
              <span
                className="ml-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold text-neutral-900"
                style={{ background: "#FFB300" }}
                title={`Review of: ${r.service_name}`}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {r.service_name}
              </span>
            )}
          </div>
          {r.status === "disputed" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12" y2="17" />
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
              Disputed — under review
            </span>
          )}
        </div>

        {isProductReview && r.product_name && (
          <div className="mt-3 flex items-center gap-2">
            {r.product_cover_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={r.product_cover_url}
                alt=""
                className="h-7 w-7 shrink-0 rounded-md object-cover ring-1 ring-neutral-200"
              />
            ) : null}
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold text-neutral-900"
              style={{ background: "#FFB300" }}
              title={`Review of product: ${r.product_name}`}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M16.5 9.4 7.55 4.24" />
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <path d="M3.27 6.96 12 12.01l8.73-5.05" />
                <path d="M12 22.08V12" />
              </svg>
              Product: {r.product_name}
            </span>
          </div>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr,auto] sm:items-end sm:gap-6">
          <p className="text-sm leading-relaxed text-neutral-700">{r.body}</p>
          <div className="flex flex-col items-end gap-1.5 text-right">
            <span
              className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full ring-2 ring-white"
              style={{ boxShadow: "0 4px 10px rgba(0,0,0,0.10)" }}
            >
              {r.customer_avatar_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={r.customer_avatar_url}
                  alt={r.customer_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span
                  className="flex h-full w-full items-center justify-center text-sm font-extrabold"
                  style={{ background: "#FFB300", color: "#0A0A0A" }}
                >
                  {r.customer_name
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0]?.toUpperCase() ?? "")
                    .join("")}
                </span>
              )}
            </span>
            <p className="text-sm font-bold text-neutral-900">{r.customer_name}</p>
            <p className="text-xs text-neutral-500">{outcode ? `${outcode} · ${city}` : city}</p>
            <p className="mt-0.5 text-xs text-neutral-400">{date}</p>
          </div>
        </div>

        {subRatings.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-neutral-100 pt-3 sm:grid-cols-4">
            {subRatings.map((s) => (
              <div key={s.label} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-neutral-500">{s.label}</span>
                <span className="font-bold text-neutral-900">{s.value.toFixed(1)}</span>
              </div>
            ))}
          </div>
        )}

        {r.public_response && (
          <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">
              Response from {displayName}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-700">
              {r.public_response}
            </p>
          </div>
        )}

        {reviews.length > 1 && (
          <div className="mt-4 flex items-center justify-center gap-1.5">
            {reviews.slice(0, Math.min(reviews.length, 10)).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Review ${i + 1}`}
                aria-current={i === safe ? "true" : "false"}
                className="h-2 rounded-full transition"
                style={{
                  width: i === safe ? "20px" : "8px",
                  background: i === safe ? "#FFB300" : "rgba(0,0,0,0.18)"
                }}
              />
            ))}
            {reviews.length > 10 && (
              <span className="ml-1 text-xs font-bold text-neutral-400">
                +{reviews.length - 10}
              </span>
            )}
          </div>
        )}

        {/* Add review CTA — only renders on paid profiles. Free
            profiles see no button (reviews stay read-only) so customers
            can't reach the review form, which is paid-only. */}
        {allowAddReview && (
          <div className="mt-4 flex justify-center border-t border-neutral-100 pt-4">
            <a
              href={`/trade/${slug}/review`}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-5 text-xs font-extrabold text-neutral-900 shadow-sm transition active:scale-[0.97]"
              style={{ background: "#FFB300" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add review
            </a>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setIndex(Math.min(reviews.length - 1, safe + 1))}
        disabled={!hasNext}
        aria-label="Next review"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-900 shadow-sm transition active:scale-[0.97] disabled:opacity-30"
        style={{ background: "#FFB300" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}
