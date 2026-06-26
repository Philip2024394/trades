"use client";

import { useEffect, useState } from "react";

type Trade = { slug: string; label: string };

type Props = {
  trades: Trade[];
  activeTradeSlug: string | null;
  activeCity: string | null;
};

// Hamburger filter button + slide-up drawer for the /trade-off/jobs feed.
// Selecting a trade or applying a city navigates to the same page with the
// matching query string — same UX surface as the old inline chips, just
// tucked behind a single tap target.
export function JobsFiltersDrawer({ trades, activeTradeSlug, activeCity }: Props) {
  const [open, setOpen] = useState(false);
  const [cityInput, setCityInput] = useState(activeCity ?? "");

  // ESC closes the drawer; body scroll locked while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const activeCount = (activeTradeSlug ? 1 : 0) + (activeCity ? 1 : 0);

  function urlForTrade(slug: string | null): string {
    const q = new URLSearchParams();
    if (slug) q.set("trade", slug);
    if (activeCity) q.set("city", activeCity);
    const qs = q.toString();
    return qs ? `/trade-off/jobs?${qs}` : "/trade-off/jobs";
  }

  function applyCity() {
    const q = new URLSearchParams();
    if (activeTradeSlug) q.set("trade", activeTradeSlug);
    if (cityInput.trim()) q.set("city", cityInput.trim());
    const qs = q.toString();
    window.location.href = qs ? `/trade-off/jobs?${qs}` : "/trade-off/jobs";
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open filters"
        aria-expanded={open}
        className={`inline-flex h-11 items-center gap-2 rounded-full border px-4 text-xs font-semibold transition ${
          activeCount > 0
            ? "border-[#FFB300] bg-[#FFB300] text-white"
            : "border-brand-line bg-brand-surface text-brand-text hover:border-[#FFB300]"
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
        Filter
        {activeCount > 0 && (
          <span className="rounded-full bg-black/30 px-1.5 text-[11px] font-bold">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Jobs filters"
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-full max-w-2xl rounded-t-2xl border border-brand-line bg-brand-bg p-5 sm:rounded-2xl sm:p-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-[#FFB300]">
                Filter live jobs
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close filters"
                className="-mr-1 inline-flex h-10 w-10 items-center justify-center rounded-full text-brand-muted transition hover:bg-brand-surface hover:text-brand-text"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="6" y1="18" x2="18" y2="6" />
                </svg>
              </button>
            </div>

            <p className="mt-4 text-xs font-bold uppercase tracking-widest text-brand-muted">
              Trade
            </p>
            <ul className="mt-2 flex max-h-56 flex-wrap gap-2 overflow-y-auto pr-1">
              <li>
                <a
                  href={urlForTrade(null)}
                  className={`inline-flex h-10 items-center rounded-full border px-3 text-xs font-semibold transition ${
                    activeTradeSlug === null
                      ? "border-[#FFB300] bg-[#FFB300] text-white"
                      : "border-brand-line bg-brand-surface text-brand-text hover:border-[#FFB300] hover:text-[#FFB300]"
                  }`}
                >
                  All trades
                </a>
              </li>
              {trades.map((t) => {
                const on = activeTradeSlug === t.slug;
                return (
                  <li key={t.slug}>
                    <a
                      href={urlForTrade(t.slug)}
                      className={`inline-flex h-10 items-center rounded-full border px-3 text-xs font-semibold transition ${
                        on
                          ? "border-[#FFB300] bg-[#FFB300] text-white"
                          : "border-brand-line bg-brand-surface text-brand-text hover:border-[#FFB300] hover:text-[#FFB300]"
                      }`}
                    >
                      {t.label}
                    </a>
                  </li>
                );
              })}
            </ul>

            <p className="mt-5 text-xs font-bold uppercase tracking-widest text-brand-muted">
              City
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyCity();
                  }
                }}
                placeholder="e.g. Manchester"
                maxLength={80}
                className="h-11 flex-1 rounded-lg border border-brand-line bg-brand-surface px-3 text-xs text-brand-text placeholder:text-brand-muted focus:border-[#FFB300] focus:outline-none"
              />
              <button
                type="button"
                onClick={applyCity}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-[#FFB300] px-5 text-xs font-bold text-white transition hover:bg-[#E5A500]"
              >
                Apply city
              </button>
            </div>

            {activeCount > 0 && (
              <div className="mt-5 border-t border-brand-line pt-4">
                <a
                  href="/trade-off/jobs"
                  className="inline-flex h-10 items-center justify-center rounded-lg px-3 text-xs font-semibold text-brand-muted transition hover:text-brand-text"
                >
                  Clear all filters
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
