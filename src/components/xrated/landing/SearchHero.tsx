// Xrated Trades — prominent search hero.
// Sits immediately under the XratedHeader on the landing page. Replaces the
// old in-header search input — search is now the primary CTA on the landing
// because "find a tradesperson, fast" is the core user job.
// Server component, no client JS — the form posts straight to /trade-off/search.

import { XRATED_BRAND } from "@/lib/xratedTrades";

export function SearchHero({ defaultQuery = "" }: { defaultQuery?: string } = {}) {
  return (
    <section className="bg-white py-8 sm:py-12">
      <div className="mx-auto max-w-3xl px-4">
        <p
          className="text-xs font-bold uppercase tracking-[0.18em]"
          style={{ color: XRATED_BRAND.accent }}
        >
          Find a tradesperson
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-[1.05] tracking-tight text-neutral-900 sm:text-5xl">
          Find a verified tradesperson, fast.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-700 sm:text-base">
          Search by trade, city, or job. WhatsApp them direct. Free.
        </p>

        <form
          action="/trade-off/search"
          method="get"
          role="search"
          className="mt-5"
        >
          <label htmlFor="xrated-hero-search" className="sr-only">
            Search Xrated Trades
          </label>
          <div className="relative flex w-full items-stretch overflow-hidden rounded-2xl border border-neutral-300 bg-white focus-within:border-[#FFB300]">
            <input
              id="xrated-hero-search"
              type="search"
              name="q"
              defaultValue={defaultQuery}
              placeholder="drywaller in Manchester · plumber London · electrician Liverpool…"
              autoComplete="off"
              maxLength={120}
              className="min-w-0 flex-1 bg-transparent px-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none sm:text-base"
              style={{ minHeight: 56 }}
            />
            <button
              type="submit"
              aria-label="Search Xrated Trades"
              className="flex shrink-0 items-center justify-center bg-[#FFB300] px-5 text-white transition hover:bg-[#E5A500] active:scale-[0.98] sm:px-7"
              style={{ minHeight: 56, minWidth: 56 }}
            >
              {/* Hammer icon — inline SVG, 24x24, clean stroke. */}
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 12 6.5 20.5a2.121 2.121 0 1 1-3-3L12 9" />
                <path d="m17.64 15 3.07-3.07a1.5 1.5 0 0 0 0-2.12l-4.5-4.5a1.5 1.5 0 0 0-2.12 0L11 8.41" />
                <path d="m9 11 4 4" />
              </svg>
              <span className="ml-2 hidden text-sm font-bold sm:inline">Search</span>
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default SearchHero;
