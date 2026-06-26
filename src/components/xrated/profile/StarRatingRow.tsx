// Xrated Trades — premium-tier rating row.
// Server component. Renders a "Newly listed" pill when no rating yet,
// otherwise 5 stars (filled by rating_avg) + numeric avg + count.
// Visual-only — admin curates the values until reviews ship.

export function StarRatingRow({
  rating_avg,
  rating_count
}: {
  rating_avg: number | null;
  rating_count: number;
}) {
  const avg = rating_avg ?? 0;
  if (avg <= 0 && rating_count === 0) {
    return (
      <span className="inline-flex h-7 items-center rounded-full border border-brand-line bg-brand-surface px-2.5 text-[11px] font-semibold text-brand-muted">
        Newly listed
      </span>
    );
  }

  // Render 5 stars; fill `floor(avg)` solid, half-star at `.5`, rest empty.
  const full = Math.floor(avg);
  const hasHalf = avg - full >= 0.25 && avg - full < 0.75;
  const filled = hasHalf ? full : Math.round(avg);

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-text"
      aria-label={`Rated ${avg.toFixed(1)} out of 5 from ${rating_count} review${rating_count === 1 ? "" : "s"}`}
    >
      <span className="inline-flex items-center" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => {
          const isFilled = i < filled;
          return (
            <span
              key={i}
              className="text-[15px] leading-none"
              style={{ color: isFilled ? "#FACC15" : "rgba(0,0,0,0.18)" }}
            >
              {isFilled ? "★" : "☆"}
            </span>
          );
        })}
      </span>
      <span>{avg.toFixed(1)}</span>
      <span className="text-brand-muted">({rating_count})</span>
    </span>
  );
}

export default StarRatingRow;
