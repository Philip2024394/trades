"use client";

// Client paginator for the "My Trusted Trades" grid.
//
// Receives the full ordered card array from the server-component parent
// (RecommendedTrades), slices into 6-per-page pages, and renders yellow
// back/forward arrow controls at the bottom when there are more than 6
// trades to show. Page count + "Page X of Y" sits between the arrows.

import { useState } from "react";
import { tradeLabel } from "@/lib/tradeOff";

const PAGE_SIZE = 6;

export type TrustedTradeCard = {
  slug: string;
  display_name: string;
  primary_trade: string;
  city: string;
  avatar_url: string | null;
  rating_avg: number | null;
  rating_count: number;
  hammerex_standard_verified: boolean;
  note: string | null;
};

export function TrustedTradesGrid({ cards }: { cards: TrustedTradeCard[] }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(cards.length / PAGE_SIZE));
  const showPagination = cards.length > PAGE_SIZE;
  const visible = cards.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((r) => {
          const rating =
            typeof r.rating_avg === "number" && r.rating_avg > 0
              ? r.rating_avg.toFixed(1)
              : null;
          const trade = tradeLabel(r.primary_trade);
          return (
            <li key={r.slug}>
              <a
                href={`/${r.slug}`}
                className="group flex h-full items-stretch gap-3 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-[#FFB300] hover:shadow-md"
              >
                <span className="relative inline-block shrink-0">
                  <span
                    className="block h-14 w-14 overflow-hidden rounded-full bg-neutral-200 ring-2 ring-white shadow-sm"
                    style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                  >
                    {r.avatar_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={r.avatar_url}
                        alt={r.display_name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-black text-base font-extrabold text-[#FFB300]">
                        {r.display_name
                          .split(/\s+/)
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((w) => w[0]?.toUpperCase() ?? "")
                          .join("")}
                      </span>
                    )}
                  </span>
                  {r.hammerex_standard_verified && (
                    <span
                      className="absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-white"
                      style={{ background: "#FFB300" }}
                      aria-label="Verified by Xrated"
                      title="Verified by Xrated"
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  )}
                </span>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="inline-flex min-w-0 items-center gap-1 truncate rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-neutral-900 sm:text-[11px]"
                      style={{ background: "#FFB300" }}
                    >
                      {trade}
                    </span>
                    {rating && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-bold text-neutral-900">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="#FFB300" aria-hidden="true">
                          <path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
                        </svg>
                        {rating}
                        <span className="font-semibold text-neutral-500">
                          ({r.rating_count})
                        </span>
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 truncate text-sm font-extrabold text-neutral-900 sm:text-base">
                    {r.display_name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-neutral-500 sm:text-sm">
                    {r.city}
                  </p>
                  {r.note && (
                    <p className="mt-2 line-clamp-3 text-xs italic leading-relaxed text-neutral-600 sm:text-[13px]">
                      &ldquo;{r.note}&rdquo;
                    </p>
                  )}
                  <div className="mt-auto pt-3">
                    <span
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-wider text-neutral-900 shadow-sm transition group-hover:shadow-md sm:text-[13px]"
                      style={{
                        background: "#FFB300",
                        boxShadow: "0 4px 14px rgba(255,179,0,0.35)"
                      }}
                    >
                      View profile
                      <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
                        &rarr;
                      </span>
                    </span>
                  </div>
                </div>
              </a>
            </li>
          );
        })}
      </ul>

      {showPagination && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-neutral-900 shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "#FFB300" }}
            aria-label="Previous page of trusted trades"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <span className="text-[13px] font-bold text-neutral-700 sm:text-sm">
            Page {page + 1} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-neutral-900 shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "#FFB300" }}
            aria-label="Next page of trusted trades"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
