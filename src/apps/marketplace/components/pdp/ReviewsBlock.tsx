// Reviews summary + top reviews. Compact port of Hammerex ReviewsBlock —
// star bars + first 3 reviews + "read more".

import { Star } from "lucide-react";
import type { ProductReview } from "../../data/productDetails";

type Props = {
  reviews: ProductReview[];
  productAvgStars: number;
  productReviewCount: number;
};

export function ReviewsBlock({ reviews, productAvgStars, productReviewCount }: Props) {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of reviews) {
    const key = Math.round(r.starRating) as 1 | 2 | 3 | 4 | 5;
    distribution[key] = (distribution[key] ?? 0) + 1;
  }
  const totalCounted = reviews.length || 1;

  return (
    <section className="border-t py-8" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-[16px] font-black text-neutral-900">Reviews</h2>

        <div className="mt-4 grid gap-6 md:grid-cols-[240px_1fr]">
          {/* Summary */}
          <div
            className="rounded-xl border bg-white p-4 shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <div className="text-[32px] font-black leading-none text-neutral-900">
              {productAvgStars.toFixed(1)}
            </div>
            <div className="mt-1 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={13}
                  className="text-amber-500"
                  fill={n <= Math.round(productAvgStars) ? "currentColor" : "transparent"}
                />
              ))}
            </div>
            <div className="mt-1 text-[11.5px] text-neutral-500">
              {productReviewCount.toLocaleString()} verified reviews
            </div>

            {/* Distribution bars */}
            <ul className="mt-3 flex flex-col gap-1.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = distribution[star as 1 | 2 | 3 | 4 | 5];
                const pct = (count / totalCounted) * 100;
                return (
                  <li key={star} className="flex items-center gap-2 text-[10.5px]">
                    <span className="w-4 text-right font-bold text-neutral-600">{star}</span>
                    <Star size={9} className="text-amber-500" fill="currentColor"/>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: "#F5F0E4" }}>
                      <div className="h-full" style={{ width: `${pct}%`, backgroundColor: "#F59E0B" }}/>
                    </div>
                    <span className="w-6 text-right text-neutral-500">{count}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Review list */}
          <ul className="flex flex-col gap-3">
            {reviews.slice(0, 3).map((r) => (
              <li
                key={r.id}
                className="rounded-xl border bg-white p-4 shadow-sm"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        size={12}
                        className="text-amber-500"
                        fill={n <= r.starRating ? "currentColor" : "transparent"}
                      />
                    ))}
                  </div>
                  <span className="text-[11.5px] font-bold text-neutral-800">{r.authorName}</span>
                  {r.authorRole && (
                    <span className="text-[10.5px] text-neutral-500">· {r.authorRole}</span>
                  )}
                  <span className="ml-auto text-[10.5px] text-neutral-500">
                    {new Date(r.createdAtIso).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                  </span>
                </div>
                <div className="mt-2 text-[12.5px] font-black text-neutral-900">{r.title}</div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-neutral-700">{r.body}</p>
              </li>
            ))}
            {reviews.length > 3 && (
              <button
                type="button"
                className="inline-flex min-h-[44px] items-center justify-center gap-1 self-start rounded-full border bg-white px-5 text-[11.5px] font-black uppercase tracking-wider text-neutral-800 shadow-sm"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                Read all {reviews.length} reviews
              </button>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
