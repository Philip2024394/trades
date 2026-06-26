"use client";

// Xrated Trades — single-container FAQ slider.
//
// One fixed-size card holds the current Q+A. Customer flips through the
// list with prev / next arrows or the dot indicator below. A tradie can
// stack 20 FAQs without the section sprawling down the page — only the
// active one is rendered, so screen real estate is constant.

import { useState } from "react";

export function FaqAccordion({
  items,
  themeColor
}: {
  items: { q: string; a: string }[];
  themeColor: string;
}) {
  const [index, setIndex] = useState(0);
  if (!items || items.length === 0) return null;
  const safeIndex = Math.min(index, items.length - 1);
  const current = items[safeIndex];
  const hasPrev = safeIndex > 0;
  const hasNext = safeIndex < items.length - 1;
  const total = items.length;

  return (
    <section className="w-full px-4 pb-2 pt-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
            FAQ
          </h2>
          <p className="mt-1 text-xs text-brand-muted">
            The questions customers ask before booking.
          </p>
        </div>
        <span className="text-xs font-bold text-brand-muted">
          {safeIndex + 1} / {total}
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-brand-line bg-brand-surface p-5">
        <p className="flex items-start gap-3 text-[13px] font-bold text-brand-text sm:text-sm">
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-extrabold"
            style={{ background: themeColor, color: "#000" }}
          >
            +
          </span>
          <span>{current.q}</span>
        </p>
        <p className="mt-3 pl-9 text-[13px] leading-relaxed text-brand-muted sm:text-sm">
          {current.a}
        </p>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-brand-line pt-4">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={!hasPrev}
            aria-label="Previous question"
            className="inline-flex h-10 w-28 items-center justify-center gap-1.5 rounded-lg text-xs font-bold text-neutral-900 transition disabled:opacity-30"
            style={{ background: themeColor }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Previous
          </button>

          {/* Dot indicator — capped so 20 FAQs don't blow out the row. */}
          <div className="hidden flex-wrap items-center justify-center gap-1.5 sm:flex">
            {items.slice(0, Math.min(total, 12)).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Question ${i + 1}`}
                aria-current={i === safeIndex ? "true" : "false"}
                className="h-2 rounded-full transition"
                style={{
                  width: i === safeIndex ? "20px" : "8px",
                  background: i === safeIndex ? themeColor : "rgba(0,0,0,0.18)"
                }}
              />
            ))}
            {total > 12 && (
              <span className="ml-1 text-xs font-bold text-brand-muted">
                +{total - 12}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(items.length - 1, i + 1))}
            disabled={!hasNext}
            aria-label="Next question"
            className="inline-flex h-10 w-28 items-center justify-center gap-1.5 rounded-lg text-xs font-bold text-neutral-900 transition disabled:opacity-30"
            style={{ background: themeColor }}
          >
            Next
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
