// Xrated Trades — "Trades On Standby" landing-page list.
// Server component. Renders pre-filtered, pre-sorted tradies as a vertical
// stack of clickable cards. Each card links to the tradie's profile at
// /trade/<slug>. The data side (availability, headline_rate) is set by the
// tradie in their edit dashboard; this component only renders.

import { TRADE_OFF_TRADES } from "@/lib/tradeOff";
import { AVAILABILITY_LABELS } from "@/lib/xratedAvailability";
import type { HammerexTradeOffListing } from "@/lib/supabase";
import { tradeIconFor } from "./tradeIcons";

function labelForTrade(slug: string): string {
  return TRADE_OFF_TRADES.find((t) => t.slug === slug)?.label ?? slug;
}

function availabilityToneClass(value: string | null | undefined): string {
  if (value === "now") return "text-emerald-700";
  // Future starts use plain black so the calendar icon + label read as a
  // schedule, not a warning state.
  return "text-neutral-900";
}

export function TradesOnStandby({
  listings
}: {
  listings: HammerexTradeOffListing[];
}) {
  return (
    <section className="mx-auto mt-6 max-w-6xl px-3 sm:mt-8 sm:px-4">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="text-lg font-extrabold tracking-tight text-neutral-900 sm:text-xl">
          Trades On Standby
        </h2>
        <a
          href="/trade-off/search"
          className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-900 transition hover:text-[#FFB300]"
        >
          View All
          <span aria-hidden="true">→</span>
        </a>
      </div>

      {listings.length === 0 ? (
        <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-5 text-center">
          <p className="text-xs text-neutral-500 sm:text-sm">
            No tradies on standby right now — check back soon.
          </p>
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {listings.map((l) => {
            const Icon = tradeIconFor(l.primary_trade);
            const tradeLabel = labelForTrade(l.primary_trade);
            const availabilityLabel = l.availability
              ? AVAILABILITY_LABELS[l.availability] ?? null
              : null;
            const isNow = l.availability === "now";
            const toneClass = availabilityToneClass(l.availability);

            return (
              <li key={l.id}>
                <a
                  href={`/trade/${l.slug}`}
                  aria-label={`${l.display_name} — ${tradeLabel} in ${l.city}`}
                  className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 transition active:scale-[0.997] hover:border-neutral-300 sm:p-4"
                >
                  {/* LEFT — large black square with yellow icon */}
                  <span
                    aria-hidden="true"
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl [&_svg]:h-8 [&_svg]:w-8 sm:h-20 sm:w-20 sm:[&_svg]:h-10 sm:[&_svg]:w-10"
                    style={{ background: "#0a0a0a", color: "#FFB300" }}
                  >
                    <Icon />
                  </span>

                  {/* MIDDLE — trade name, then city under it, then availability */}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-bold text-neutral-900">
                      {tradeLabel}
                    </span>
                    <span className="mt-0.5 inline-flex items-center gap-0.5 text-xs text-neutral-500">
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#EF4444"
                        strokeWidth="2.25"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span className="truncate">{l.city}</span>
                    </span>
                    {availabilityLabel && (
                      <span
                        className={`mt-0.5 inline-flex items-center gap-1.5 text-xs font-semibold ${toneClass}`}
                      >
                        {isNow ? (
                          <span
                            aria-hidden="true"
                            className="relative inline-flex h-2 w-2"
                          >
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                          </span>
                        ) : (
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.25"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                        )}
                        {availabilityLabel}
                      </span>
                    )}
                  </span>

                  {/* RIGHT — headline rate. Always visible: amount on top,
                      unit (per day / per m² / per hour / per contract etc)
                      underneath in muted text. */}
                  {l.headline_rate && l.headline_rate.amount > 0 && (
                    <span className="flex shrink-0 flex-col items-end leading-tight">
                      <span className="text-sm font-extrabold text-neutral-900 sm:text-base">
                        £{l.headline_rate.amount.toLocaleString("en-GB")}
                      </span>
                      <span className="text-[11px] font-semibold text-neutral-500">
                        {l.headline_rate.unit}
                      </span>
                    </span>
                  )}

                  {/* FAR RIGHT — yellow circle with black arrow */}
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{ background: "#FFB300", color: "#0a0a0a" }}
                  >
                    <svg
                      width="14"
                      height="14"
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
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
