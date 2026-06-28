// StarsRating — server-safe star-rating display.
//
// Renders 5 SVG star outlines filled proportionally to `rating` using a
// width-based overlay (cheaper than per-star clip-paths, works in every
// modern browser without JS). Next to the stars it prints the one-decimal
// rating + the pluralised review count.
//
// rating === null OR reviewCount === 0 ⇒ "No reviews yet" with hollow
// stars. Used on the PDP buy column under the product title.
//
// All text is held at 13px — matches the Hammerex 13px floor.

import type { ReactElement } from "react";

const STAR_PATH =
  "M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z";

function StarRow({ filled }: { filled: boolean }): ReactElement {
  // 5 stars in a row. `filled` controls fill colour — solid gold for the
  // active layer, hollow neutral for the base layer.
  return (
    <div aria-hidden="true" className="flex shrink-0 gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg
          key={i}
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill={filled ? "#FFB300" : "none"}
          stroke={filled ? "#FFB300" : "#D4D4D4"}
          strokeWidth={1.6}
          strokeLinejoin="round"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d={STAR_PATH} />
        </svg>
      ))}
    </div>
  );
}

export function StarsRating({
  rating,
  reviewCount
}: {
  rating: number | null;
  reviewCount: number;
}) {
  const hasReviews =
    rating !== null && Number.isFinite(rating) && reviewCount > 0;
  if (!hasReviews) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-neutral-500">
        <StarRow filled={false} />
        <span>No reviews yet</span>
      </div>
    );
  }
  const clamped = Math.max(0, Math.min(5, rating as number));
  const pct = (clamped / 5) * 100;
  const fixed = clamped.toFixed(1);
  const noun = reviewCount === 1 ? "review" : "reviews";
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <div
        className="relative shrink-0"
        role="img"
        aria-label={`Rated ${fixed} out of 5 from ${reviewCount} ${noun}`}
      >
        {/* Hollow base layer. */}
        <StarRow filled={false} />
        {/* Filled overlay clipped to `pct%` of the row width. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ width: `${pct}%` }}
        >
          <StarRow filled={true} />
        </div>
      </div>
      <span className="font-extrabold text-neutral-900">{fixed}</span>
      <span className="text-neutral-500">
        · {reviewCount} {noun}
      </span>
    </div>
  );
}
