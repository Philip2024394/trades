"use client";

// SiblingsWithCompare — bottom-of-PDP "You might also like / More from
// {appName}" section with an in-place Compare toggle. Replaces the two
// separate sections that used to live on the product page (standalone
// compare-3 strip + siblings rail).
//
// Two views, swapped in place via a small button on the H2 row:
//   - "siblings" (default): 2/3/4-col grid of ProductCardLink siblings.
//   - "compare":            3-col grid showing the current product (yellow
//                            ring + "This product" pill) + up to 2 compare
//                            targets. Reuses CompareCell.
//
// Section is suppressed entirely when there are zero siblings AND zero
// compare targets. The Compare button only renders when at least 1
// compare target is passed (the PDP passes [] when the Compare addon is
// off, so the button auto-hides in that case).

import { useState } from "react";
import type { HammerexXratedProduct } from "@/lib/supabase";
import { ProductCardLink } from "@/components/xrated/profile/ProductCardLink";
import { CompareCell } from "@/components/xrated/profile/CompareCell";

export function SiblingsWithCompare({
  current,
  siblings,
  compareTargets,
  appName,
  listingSlug,
  siblingStats
}: {
  current: HammerexXratedProduct;
  siblings: HammerexXratedProduct[];
  compareTargets: HammerexXratedProduct[];
  appName: string;
  listingSlug: string;
  /** Batch-fetched review aggregates keyed by product ID. The PDP page
   *  (server component) does the single round-trip and passes the map
   *  in; client cards just look themselves up. Missing keys mean "no
   *  reviews live" — the card hides the stars row in that case. */
  siblingStats?: Record<string, { rating: number | null; count: number }>;
}) {
  const lookupStats = (id: string) => siblingStats?.[id];
  const [view, setView] = useState<"siblings" | "compare">("siblings");

  if (siblings.length === 0 && compareTargets.length === 0) return null;

  const canCompare = compareTargets.length >= 1;
  const targets = compareTargets.slice(0, 2);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: "#FFB300" }}
          >
            You might also like
          </p>
          <h2 className="mt-1 text-xl font-extrabold text-neutral-900 sm:text-2xl">
            More from {appName}
          </h2>
        </div>
        {view === "siblings" && canCompare && (
          <button
            type="button"
            onClick={() => setView("compare")}
            className="inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-[13px] font-extrabold uppercase tracking-wider text-neutral-900 transition hover:opacity-90"
            style={{ background: "#FFB300" }}
            aria-label="Compare this product side by side"
          >
            Compare
          </button>
        )}
        {view === "compare" && (
          <button
            type="button"
            onClick={() => setView("siblings")}
            className="inline-flex h-9 shrink-0 items-center rounded-full border border-neutral-300 bg-white px-3.5 text-[13px] font-extrabold uppercase tracking-wider text-neutral-700 transition hover:bg-neutral-50"
            aria-label="Back to siblings"
          >
            ← Back
          </button>
        )}
      </div>

      {view === "siblings" ? (
        siblings.length > 0 ? (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {siblings.map((s) => (
              <li key={s.id}>
                <ProductCardLink
                  product={s}
                  slug={listingSlug}
                  stats={lookupStats(s.id)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[13px] text-neutral-500">
            No other products from {appName} yet.
          </p>
        )
      ) : (
        <>
          <p className="mt-3 text-[13px] text-neutral-500">
            Compare {1 + targets.length} products from {appName}
          </p>
          <ul className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            <li
              className="rounded-2xl border-2 bg-white p-3 sm:p-4"
              style={{ borderColor: "#FFB300" }}
            >
              <CompareCell product={current} current />
            </li>
            {targets.map((c) => (
              <li
                key={c.id}
                className="rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4"
              >
                <CompareCell product={c} slug={listingSlug} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
