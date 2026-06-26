// Xrated Trades — featured tradies rail.
// Horizontal snap-scroll, server-rendered. Prioritises app_paid + Standard.
// Receives a pre-filtered listings array from the page.

import type { HammerexTradeOffListing } from "@/lib/supabase";
import { tradeLabel, whatsappQuoteUrl } from "@/lib/tradeOff";
import { XRATED_BRAND } from "@/lib/xratedTrades";

type Props = {
  tradies: HammerexTradeOffListing[];
};

export function FeaturedTradiesRail({ tradies }: Props) {
  if (tradies.length === 0) return null;

  return (
    <section className="border-y border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-16">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p
              className="text-xs font-bold uppercase tracking-[0.18em]"
              style={{ color: XRATED_BRAND.accent }}
            >
              Featured tradies
            </p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl md:text-4xl">
              Vetted, kitted, working today.
            </h2>
          </div>
          <a
            href="/trade-off/jobs"
            className="hidden h-11 items-center rounded-lg border border-neutral-300 bg-white px-4 text-xs font-semibold text-neutral-900 transition hover:border-[#FFB300] hover:text-[#FFB300] sm:inline-flex"
          >
            See all →
          </a>
        </div>

        <div className="mt-6 -mx-4 overflow-x-auto px-4 [scrollbar-width:thin] snap-x snap-mandatory">
          <ul className="flex w-max gap-4">
            {tradies.map((t) => {
              const cover = t.photos[0] ?? t.avatar_url ?? XRATED_BRAND.heroImageUrl;
              const trade = tradeLabel(t.primary_trade);
              const initial = (t.display_name.charAt(0) || "?").toUpperCase();
              const waHref = whatsappQuoteUrl(t.whatsapp, t.display_name, trade);
              return (
                <li
                  key={t.id}
                  className="w-[78vw] max-w-[320px] shrink-0 snap-start sm:w-[300px] sm:max-w-none"
                >
                  <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:border-[#FFB300]">
                    <a
                      href={`/trade/${t.slug}`}
                      className="group relative block aspect-[4/3] overflow-hidden bg-neutral-100"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cover}
                        alt={t.display_name}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      />
                      {t.hammerex_standard_verified && (
                        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#FFB300] px-2.5 py-1 text-xs font-bold text-white shadow-lg">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
                          </svg>
                          Standard
                        </span>
                      )}
                      <div className="absolute bottom-3 left-3 h-12 w-12 overflow-hidden rounded-full border-2 border-white bg-white shadow-lg">
                        {t.avatar_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={t.avatar_url}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-[#FFB300] text-base font-bold text-white">
                            {initial}
                          </div>
                        )}
                      </div>
                    </a>
                    <div className="flex flex-1 flex-col p-4">
                      <a href={`/trade/${t.slug}`} className="block">
                        <p className="text-sm font-bold text-neutral-900">
                          {t.display_name}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {trade} · {t.city}
                        </p>
                      </a>
                      <div className="mt-auto pt-3">
                        <a
                          href={waHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#22c55e] px-4 text-xs font-bold text-white transition hover:bg-[#16a34a] active:scale-[0.98]"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M20.52 3.48A11.94 11.94 0 0 0 12.04.05C5.46.05.13 5.38.13 11.96c0 2.1.55 4.15 1.6 5.96L0 24l6.27-1.64a11.93 11.93 0 0 0 5.77 1.47h.01c6.58 0 11.91-5.33 11.91-11.91 0-3.18-1.24-6.17-3.44-8.44ZM12.04 21.8h-.01a9.86 9.86 0 0 1-5.03-1.38l-.36-.21-3.72.97 1-3.63-.24-.37a9.84 9.84 0 0 1-1.51-5.21c0-5.47 4.46-9.92 9.93-9.92 2.65 0 5.14 1.03 7.01 2.91a9.84 9.84 0 0 1 2.9 7.02c0 5.47-4.45 9.92-9.97 9.92Z" />
                          </svg>
                          WhatsApp direct
                        </a>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default FeaturedTradiesRail;
