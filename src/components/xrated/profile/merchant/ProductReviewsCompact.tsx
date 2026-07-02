"use client";

// ProductReviewsCompact — client-side expand/collapse wrapper around the
// reviews data the server-side `ProductReviewsBlock` queries from
// Supabase. Default collapsed view is a single bordered row: stars +
// big-number average + count + "Read reviews ▼" toggle. Tapping expands
// to reveal the 4-pillar score bars and the 5 most recent reviews as a
// static stacked list (no marquee, no auto-scroll).
//
// Reasoning — heavy reviews UI was previously eating the slot above the
// Trade Connections rail on every PDP. This compact pattern keeps social
// proof in-line at the conversion moment while restoring vertical space
// for the next decision (which trade installs this?).

import { useState } from "react";
import { StarsRating } from "../StarsRating";

export type CompactReview = {
  id: string;
  name: string;
  avatarUrl: string | null;
  overallRating: number | null;
  body: string;
  date: string;
};

export type CompactPillar = {
  label: string;
  pct: number | null;
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

export function ProductReviewsCompact({
  overallAvg,
  count,
  pillars,
  recent,
  writeReviewHref
}: {
  overallAvg: number | null;
  count: number;
  pillars: CompactPillar[];
  recent: CompactReview[];
  writeReviewHref: string;
}) {
  const [open, setOpen] = useState(false);
  const bigNumber = overallAvg === null ? "—" : overallAvg.toFixed(1);
  const overallPct =
    overallAvg === null ? null : Math.round((overallAvg / 5) * 100);

  return (
    <div className="w-full">
      <div>
        {/* Collapsed header — StarsRating already prints "4.8 · N
         *  reviews" so we don't duplicate it here. Read-reviews toggle
         *  pushed to the far right via ml-auto and styled yellow to
         *  match the brand-accent CTAs elsewhere in the buy column. */}
        <div className="flex flex-wrap items-center gap-3 px-4 pt-3 pb-3">
          <StarsRating rating={overallAvg} reviewCount={count} />
          {count > 0 && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="reviews-panel"
              className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[12px] font-extrabold uppercase tracking-wider text-black transition hover:opacity-90 active:scale-95"
              style={{ background: "#FFB300" }}
            >
              {open ? "Hide" : "Read"} reviews
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: open ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 200ms"
                }}
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          )}
        </div>

        {/* Empty state — no expand toggle, just an inline nudge. */}
        {count === 0 && (
          <p className="px-4 pb-3 text-[13px] font-bold text-neutral-500">
            No reviews yet —{" "}
            <a
              href={writeReviewHref}
              className="text-[#FFB300] underline-offset-2 hover:underline"
            >
              be the first to review this product
            </a>
            .
          </p>
        )}

        {/* Expanded panel — pillar bars + recent review cards. */}
        {open && count > 0 && (
          <div
            id="reviews-panel"
            className="border-t border-neutral-200 px-4 py-4"
          >
            {/* Overall progress bar at the top of the expanded area for
             *  a quick visual cue of the headline score. */}
            <div
              className="mb-4 h-2 w-full overflow-hidden rounded-full bg-neutral-200"
              role="progressbar"
              aria-label="Overall review score"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={overallPct ?? 0}
            >
              {overallPct !== null && overallPct > 0 && (
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${Math.min(100, Math.max(0, overallPct))}%`,
                    background: "#FFB300"
                  }}
                />
              )}
            </div>

            {/* Pillars — 2-column grid on tablet+, single column on phone. */}
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-x-6">
              {pillars.map((p) => (
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
                    aria-valuenow={p.pct ?? 0}
                  >
                    {p.pct !== null && p.pct > 0 && (
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, Math.max(0, p.pct))}%`,
                          background: "#FFB300"
                        }}
                      />
                    )}
                  </div>
                  <span className="w-10 shrink-0 text-right font-extrabold text-neutral-900">
                    {p.pct === null ? "—" : `${p.pct}%`}
                  </span>
                </li>
              ))}
            </ul>

            {/* Recent reviews — 5 most-recent, stacked, no marquee.
             *  A "Write a review" CTA closes the panel — placed AFTER the
             *  list so the buyer reads existing proof before being asked
             *  to add their own (classic Amazon / Trustpilot pattern). */}
            {recent.length > 0 && (
              <ul className="mt-5 space-y-3">
                {recent.slice(0, 5).map((r) => (
                  <li
                    key={r.id}
                    className="rounded-xl border border-neutral-200 bg-neutral-50 p-3"
                  >
                    <div className="flex items-start gap-3">
                      {r.avatarUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={r.avatarUrl}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neutral-200 text-[12px] font-extrabold text-neutral-700">
                          {initials(r.name)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-[13px] font-extrabold text-neutral-900">
                            {r.name}
                          </span>
                          {r.overallRating !== null && (
                            <span className="text-[12px] font-bold text-[#FFB300]">
                              {"★".repeat(Math.round(r.overallRating))}
                            </span>
                          )}
                          <span className="text-[11px] text-neutral-500">
                            · {r.date}
                          </span>
                        </div>
                        <p className="mt-1 text-[13px] leading-relaxed text-neutral-700">
                          {r.body}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-5 flex justify-center border-t border-neutral-200 pt-4">
              <a
                href={writeReviewHref}
                className="inline-flex h-9 items-center rounded-lg px-3 text-[12px] font-extrabold uppercase tracking-wider transition hover:opacity-90"
                style={{ background: "#FFB300", color: "#0A0A0A" }}
              >
                Write a review
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
