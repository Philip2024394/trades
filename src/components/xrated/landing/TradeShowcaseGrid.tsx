// Xrated Trades — landscape "tap a trade" cards.
// Wide horizontal cards (image left, trade label + tradie count right). Single
// column on mobile, two columns on desktop. Each card links to /trade-off/<slug>.
// Server component, no client JS. Counts come from the parent landing page.

import { TRADE_OFF_HERO_IMAGES } from "@/lib/tradeOffHeroes";
import { tradeLabel } from "@/lib/tradeOff";
import { XRATED_BRAND } from "@/lib/xratedTrades";

type Props = {
  countsBySlug: Record<string, number>;
};

export function TradeShowcaseGrid({ countsBySlug }: Props) {
  const tiles = Object.keys(TRADE_OFF_HERO_IMAGES);

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-4 md:py-16">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p
            className="text-xs font-bold uppercase tracking-[0.18em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            Pick your trade
          </p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl md:text-4xl">
            Pick your trade — tap to browse.
          </h2>
        </div>
      </div>

      <ul className="mt-6 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
        {tiles.map((slug) => {
          const img = TRADE_OFF_HERO_IMAGES[slug];
          const label = tradeLabel(slug);
          const count = countsBySlug[slug] ?? 0;
          return (
            <li key={slug}>
              <a
                href={`/trade-off/${slug}`}
                aria-label={`Browse ${label} — ${count} ${count === 1 ? "tradie" : "tradies"} on Xrated`}
                className="group flex flex-row items-stretch overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:border-[#FFB300]"
              >
                <div className="relative aspect-[4/3] w-[38%] shrink-0 overflow-hidden bg-neutral-100 sm:w-[34%]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img}
                    alt={label}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3 p-4 sm:p-5">
                  <div className="min-w-0">
                    <p className="text-base font-extrabold leading-tight text-neutral-900 sm:text-xl">
                      {label}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-brand-muted">
                      {count} {count === 1 ? "tradie" : "tradies"} on Xrated
                    </p>
                  </div>
                  <span
                    aria-hidden="true"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFB300] text-white transition group-hover:bg-[#E5A500]"
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
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </span>
                </div>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default TradeShowcaseGrid;
