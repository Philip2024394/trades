"use client";

// ReviewMarquee — horizontal auto-scrolling marquee of square review
// cards, used at the bottom of the PDP reviews section. Each card holds
// avatar + name + date + StarsRating + truncated body. The track loops
// seamlessly by duplicating the card list twice and animating
// translateX from 0 to -50% over 60s.
//
// Behaviour:
//   - Pause on hover via group-hover state on the track.
//   - Fade left + right edges with a subtle CSS mask so cards melt
//     into the page background rather than hard-clipping.
//   - When fewer than 3 cards arrive, render a static centered row
//     instead of animating — nothing to scroll past.
//   - Cards where the body is empty are skipped before render — they
//     would render as bare star strips and look broken in the rail.

import { StarsRating } from "./StarsRating";

export type ReviewMarqueeItem = {
  id: string;
  name: string;
  avatarUrl: string | null;
  overallRating: number | null;
  body: string;
  date: string;
};

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter((s) => s.length > 0)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function ReviewMarquee({ reviews }: { reviews: ReviewMarqueeItem[] }) {
  const items = reviews.filter((r) => r.body.trim().length > 0);
  if (items.length === 0) return null;

  const animate = items.length >= 3;
  const loop = animate ? [...items, ...items] : items;

  return (
    <div
      className="group relative mt-8 w-full overflow-hidden"
      style={{
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0, black 30px, black calc(100% - 30px), transparent 100%)",
        maskImage:
          "linear-gradient(to right, transparent 0, black 30px, black calc(100% - 30px), transparent 100%)"
      }}
    >
      <div
        className={
          animate
            ? "flex w-max gap-4 group-hover:[animation-play-state:paused]"
            : "flex w-full flex-wrap justify-center gap-4"
        }
        style={
          animate
            ? { animation: "xrated-marquee 60s linear infinite" }
            : undefined
        }
      >
        {loop.map((r, idx) => (
          <article
            key={`${r.id}-${idx}`}
            className="flex h-56 w-56 shrink-0 flex-col rounded-2xl border border-neutral-200 bg-white p-4 sm:h-64 sm:w-64"
          >
            <div className="flex items-start gap-3">
              {r.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={r.avatarUrl}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[13px] font-extrabold text-neutral-900"
                  style={{ background: "#FFB300" }}
                  aria-hidden="true"
                >
                  {initials(r.name)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-extrabold text-neutral-900">
                  {r.name}
                </p>
                <p className="truncate text-[13px] text-neutral-500">
                  {r.date}
                </p>
              </div>
            </div>
            <div className="mt-2">
              <StarsRating rating={r.overallRating} reviewCount={1} />
            </div>
            <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-700">
              {r.body}
            </p>
          </article>
        ))}
      </div>

      <style jsx>{`
        @keyframes xrated-marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}

export default ReviewMarquee;
