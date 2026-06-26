"use client";

// Xrated Shop Mode — the flipped face of the ProductModal.
//
// Shows the product's per-axis review breakdown:
//   - Big overall average (e.g. 4.7) with 5 stars + total count
//   - 5 horizontal axis bars (Overall, Quality, Communication,
//     Value for money, Delivery time) — the schema axes
//     `overall_rating / workmanship_rating / communication_rating /
//     value_rating / timeliness_rating` relabelled for product context.
//   - Most-recent live review excerpt (when present).
//   - "Back to product" button up top to flip back.
//
// All data is passed in by the parent (ProductModal owns the fetch +
// caches the response across flips so re-tapping View reviews is free).

import type { HammerexXratedProduct } from "@/lib/supabase";
import { formatGbp } from "@/lib/xratedCart";

export type ProductStats = {
  ok: boolean;
  total: number;
  overall_avg: number | null;
  quality_avg: number | null;
  communication_avg: number | null;
  value_avg: number | null;
  delivery_avg: number | null;
  top_excerpt: string | null;
};

export function ProductReviewsChart({
  product,
  stats,
  onBack
}: {
  product: HammerexXratedProduct;
  stats: ProductStats | null;
  onBack: () => void;
}) {
  const total = stats?.total ?? 0;
  const overall = stats?.overall_avg ?? 0;

  const axes: Array<{ label: string; value: number | null }> = [
    { label: "Overall", value: stats?.overall_avg ?? null },
    { label: "Quality", value: stats?.quality_avg ?? null },
    { label: "Communication", value: stats?.communication_avg ?? null },
    { label: "Value for money", value: stats?.value_avg ?? null },
    { label: "Delivery time", value: stats?.delivery_avg ?? null }
  ];

  return (
    <div className="flex flex-col gap-5 p-5 sm:p-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex h-11 w-fit items-center gap-1.5 rounded-xl border-2 border-neutral-300 bg-white px-4 text-[13px] font-extrabold uppercase tracking-wider text-neutral-700 transition active:scale-[0.98]"
        aria-label="Back to product"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to product
      </button>

      <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-neutral-200">
          {product.cover_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={product.cover_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-extrabold text-neutral-900">
            {product.name}
          </p>
          <p className="text-[13px] font-bold text-neutral-700">
            {formatGbp(product.price_pence)}
          </p>
        </div>
      </div>

      {total === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-neutral-200 p-6 text-center">
          <p className="text-[13px] font-bold text-neutral-700">
            No reviews yet
          </p>
          <p className="mt-1 text-[13px] text-neutral-500">
            Be the first customer to review this product.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-neutral-900 px-4 py-5 text-center">
            <p className="text-4xl font-extrabold leading-none text-white sm:text-5xl">
              {overall.toFixed(1)}
            </p>
            <StarRow rating={overall} size={18} />
            <p className="text-[13px] text-neutral-400">
              ({total} {total === 1 ? "review" : "reviews"})
            </p>
          </div>

          <ul className="flex flex-col gap-3">
            {axes.map((axis) => (
              <li key={axis.label} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-bold text-neutral-700">
                    {axis.label}
                  </span>
                  <span className="text-[13px] font-extrabold tabular-nums text-neutral-900">
                    {axis.value === null ? "—" : axis.value.toFixed(1)}
                  </span>
                </div>
                <AxisBar value={axis.value} />
              </li>
            ))}
          </ul>

          {stats?.top_excerpt && (
            <blockquote className="rounded-2xl border border-neutral-200 bg-white p-4">
              <p className="text-[13px] italic leading-relaxed text-neutral-700">
                “{stats.top_excerpt}”
              </p>
            </blockquote>
          )}
        </>
      )}
    </div>
  );
}

function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  // Renders 5 stars filled in proportion to `rating` (0-5). Each star
  // is either fully filled or empty — half-stars stay out of scope for
  // v1 to keep the SVG count low.
  const rounded = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={i <= rounded ? "#FFB300" : "none"}
          stroke="#FFB300"
          strokeWidth="1.75"
        >
          <path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

function AxisBar({ value }: { value: number | null }) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <div
      className="relative h-2.5 w-full overflow-hidden rounded-full bg-neutral-200"
      role="progressbar"
      aria-valuenow={value ?? 0}
      aria-valuemin={0}
      aria-valuemax={5}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${pct}%`, background: "#FFB300" }}
      />
    </div>
  );
}
