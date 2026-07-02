// KeyCuttingCard — hero-adjacent tile that links into the dedicated
// /<slug>/key-cutting sub-page. Renders only when the add-on is on AND
// the merchant has configured at least one category + fulfilment mode.

import Link from "next/link";
import type { HammerexTradeOffListing } from "@/lib/supabase";
import {
  KEY_CATEGORIES,
  isKeyCuttingConfigured,
  normaliseKeyCuttingConfig,
  formatPriceFrom
} from "@/lib/keyCutting";

export function KeyCuttingCard({ listing }: { listing: HammerexTradeOffListing }) {
  const cfg = normaliseKeyCuttingConfig(listing.key_cutting);
  if (!isKeyCuttingConfigured(cfg)) return null;

  // Surface up to 3 enabled category summaries as chips underneath the
  // title so customers see the range at a glance.
  const enabledChips = KEY_CATEGORIES.map((meta) => ({ meta, c: cfg.categories[meta.slug] }))
    .filter((row) => row.c?.enabled)
    .slice(0, 3);

  const modeBadges: string[] = [];
  if (cfg.modes.walk_in) modeBadges.push("Walk-in");
  if (cfg.modes.photo_scan) modeBadges.push("Photo-scan");
  if (cfg.modes.postal) modeBadges.push("Postal");

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6">
      <Link
        href={`/${encodeURIComponent(listing.slug)}/key-cutting`}
        className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:border-[#FFB300] sm:flex-row"
      >
        {/* Banner thumbnail. */}
        {cfg.banner_image_url ? (
          <span
            className="relative block h-40 w-full shrink-0 sm:h-auto sm:w-64"
            aria-hidden="true"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cfg.banner_image_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          </span>
        ) : (
          <span
            className="grid h-40 w-full shrink-0 place-items-center bg-neutral-900 text-[64px] sm:h-auto sm:w-64"
            aria-hidden="true"
          >
            🔑
          </span>
        )}

        <div className="flex flex-1 flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
              Key Cutting
            </p>
          </div>

          {enabledChips.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {enabledChips.map(({ meta, c }) => (
                <li
                  key={meta.slug}
                  className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold text-neutral-800"
                >
                  <span>{meta.emoji}</span>
                  <span>{meta.label}</span>
                  <span className="text-neutral-500">
                    {formatPriceFrom(c?.price_from_pence)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {modeBadges.length > 0 && (
            <p className="text-[12px] text-neutral-500">
              {modeBadges.join(" · ")}
            </p>
          )}

          <span className="mt-auto inline-flex items-center gap-1 self-start text-[12px] font-extrabold uppercase tracking-widest text-[#FFB300] group-hover:underline">
            See all key services →
          </span>
        </div>
      </Link>
    </section>
  );
}
