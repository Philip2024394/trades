"use client";

// Templates gallery — 5-section grouping (Service / Installation /
// Manufacture / Sales / Hire) with a sticky search bar + section
// filter chips at the top. Trades that belong to multiple sections
// (Stairs, Kitchens, Windows, etc.) render in each one — that's by
// design so a merchant browsing "Sales" sees Kitchen Showroom even
// though Kitchen Fitter also lives in Installation + Manufacture.

import { useMemo, useState } from "react";
import {
  SECTION_META,
  SECTION_ORDER,
  sectionsForTrade,
  type TemplateSection
} from "@/lib/tradeTemplateSections";
import { BusinessCardButton } from "@/components/xrated/profile/BusinessCardButton";

const ACCENT = "#FFB300";

/** Subset of the demo seed shape needed to render the BusinessCardButton
 *  modal on a gallery card. Built in page.tsx from DEMO_TRADE_SEEDS and
 *  keyed by trade_slug. Cards whose trade_slug has no entry in the map
 *  render WITHOUT the share button — by design, we never show a
 *  half-empty card. Phone is intentionally null (seeds carry WhatsApp
 *  + email only) and phoneCallsEnabled is false, so the vCard download
 *  emits a WhatsApp TEL row but no callable cell number. */
export type GalleryDemoCard = {
  displayName: string;
  tradeLabel: string;
  whatsapp: string;
  email: string;
  /** Absolute or root-relative URL of the live demo profile. Powers
   *  the QR code + share links inside the BusinessCardButton modal so
   *  the scanned code lands the holder on the real demo. */
  profileUrl: string;
};

export type GalleryTrade = {
  slug: string;
  label: string;
  /** One-line plain-English summary of what this app is FOR — drives
   *  the description line under the card title. Built per-trade in
   *  page.tsx using the section + topic so it always reads sensibly. */
  description: string;
  bannerUrl: string | null;
  /** Live-demo profile URL if a seeded demo exists. New trades without
   *  a seeded demo render the card without the "See live demo" link. */
  liveDemoHref: string | null;
};

const POPULAR_SLUGS = [
  "plumber",
  "electrician",
  "carpenter",
  "kitchen-fitter",
  "building-merchant",
  "tool-hire",
  "window-fitter",
  "roofer"
];

export function TemplatesGallery({
  trades,
  demoBySlug
}: {
  trades: GalleryTrade[];
  /** Map of trade_slug → demo contact details. Cards whose slug is in
   *  this map render the BusinessCardButton share modal (top-right of
   *  the banner). Missing slugs render the card without the button. */
  demoBySlug: Record<string, GalleryDemoCard>;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TemplateSection | "all">("all");
  const [suggestOpen, setSuggestOpen] = useState(false);

  const lower = query.trim().toLowerCase();
  const hasQuery = lower.length > 0;

  const matching = useMemo(
    () =>
      trades.filter((t) => {
        if (!hasQuery) return true;
        return (
          t.label.toLowerCase().includes(lower) ||
          t.slug.toLowerCase().includes(lower)
        );
      }),
    [trades, hasQuery, lower]
  );

  // Type-ahead suggestion list — top 8 matches under the search box
  // when the user is typing. Tapping one jumps straight to that
  // template's signup link, skipping the scroll.
  const suggestions = useMemo(
    () => (hasQuery ? matching.slice(0, 8) : []),
    [hasQuery, matching]
  );

  // Curated "Popular templates" row — only renders when the search is
  // empty AND the filter is "all", so it doesn't compete with active
  // exploration. First-time visitors who don't know which section
  // they belong in land on these 8 well-trodden paths.
  const tradeBySlug = useMemo(
    () => new Map(trades.map((t) => [t.slug, t])),
    [trades]
  );
  const popular = useMemo(
    () =>
      !hasQuery && filter === "all"
        ? POPULAR_SLUGS.map((s) => tradeBySlug.get(s)).filter(
            (t): t is GalleryTrade => !!t
          )
        : [],
    [hasQuery, filter, tradeBySlug]
  );

  // For each section, render only the matches that belong there.
  const sectionsToRender = filter === "all" ? SECTION_ORDER : [filter];

  const totalShown = sectionsToRender.reduce((acc, sec) => {
    return acc + matching.filter((t) => sectionsForTrade(t.slug).includes(sec)).length;
  }, 0);

  return (
    <section className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-10">
      {/* Search + filter row — sticky on scroll so users can keep
          filtering as they browse. */}
      <div className="sticky top-0 z-10 -mx-4 border-b border-neutral-200 bg-white/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="relative">
          <label className="relative block">
            <span className="sr-only">Search templates</span>
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9CA3AF"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute left-3 top-1/2 -translate-y-1/2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSuggestOpen(true);
              }}
              onFocus={() => setSuggestOpen(true)}
              onBlur={() => {
                // Delay close so a tap on a suggestion lands before
                // the dropdown unmounts. 150ms is a forgiving target.
                window.setTimeout(() => setSuggestOpen(false), 150);
              }}
              placeholder={`Search ${trades.length} templates — kitchen, tool hire, ev charger…`}
              className="h-12 w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-3 text-[13px] text-neutral-900 placeholder:text-neutral-500 focus:border-[color:#FFB300] focus:outline-none"
            />
          </label>
          {suggestOpen && suggestions.length > 0 && (
            <ul
              className="absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg"
              onMouseDown={(e) => e.preventDefault()}
            >
              {suggestions.map((t) => (
                <li key={t.slug}>
                  <a
                    href={`/trade-off/signup?trade=${encodeURIComponent(t.slug)}`}
                    className="flex items-center justify-between gap-3 border-b border-neutral-100 px-3 py-2.5 text-left transition hover:bg-neutral-50 last:border-b-0"
                  >
                    <span className="min-w-0">
                      <span className="block text-[13px] font-extrabold text-neutral-900">
                        {t.label}
                      </span>
                      <span className="block truncate text-[11px] text-neutral-500">
                        {t.description}
                      </span>
                    </span>
                    <span
                      className="inline-flex h-6 shrink-0 items-center rounded-full px-2 text-[10px] font-extrabold uppercase tracking-wider"
                      style={{ background: "#FFF8E5", color: "#92400E" }}
                    >
                      {SECTION_META[sectionsForTrade(t.slug)[0]].label}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <FilterChip
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label="All"
            count={matching.length}
          />
          {SECTION_ORDER.map((sec) => {
            const count = matching.filter((t) =>
              sectionsForTrade(t.slug).includes(sec)
            ).length;
            return (
              <FilterChip
                key={sec}
                active={filter === sec}
                onClick={() => setFilter(sec)}
                label={SECTION_META[sec].label}
                count={count}
              />
            );
          })}
        </div>
      </div>

      {popular.length > 0 && (
        <div className="pt-8 sm:pt-10">
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: ACCENT }}
          >
            Where most people start · {popular.length}
          </p>
          <h2 className="mt-1 text-xl font-extrabold text-neutral-900 sm:text-2xl">
            Popular templates
          </h2>
          <p className="mt-1 max-w-3xl text-[13px] leading-snug text-neutral-500">
            The eight templates most tradespeople pick first. Not sure
            which section you belong in? Start here.
          </p>
          <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {popular.map((t) => (
              <li key={`popular-${t.slug}`} className="h-full">
                <TemplateCard trade={t} demo={demoBySlug[t.slug] ?? null} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {totalShown === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
          <p className="text-[14px] font-extrabold text-neutral-900">
            No templates match &ldquo;{query}&rdquo;.
          </p>
          <p className="mt-1 text-[12px] text-neutral-500">
            Try a shorter word — &ldquo;kitchen&rdquo; instead of &ldquo;kitchen
            fitter&rdquo;.
          </p>
        </div>
      )}

      {sectionsToRender.map((sec) => {
        const meta = SECTION_META[sec];
        const list = matching.filter((t) => sectionsForTrade(t.slug).includes(sec));
        if (list.length === 0) return null;
        return (
          <div key={sec} className="pt-10 sm:pt-14">
            <p
              className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
              style={{ color: ACCENT }}
            >
              {meta.eyebrow} · {list.length}
            </p>
            <h2 className="mt-1 text-xl font-extrabold text-neutral-900 sm:text-2xl">
              {meta.label}
            </h2>
            <p className="mt-1 max-w-3xl text-[13px] leading-snug text-neutral-500">
              {meta.blurb}
            </p>
            <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {list.map((t) => (
                <li key={`${sec}-${t.slug}`} className="h-full">
                  <TemplateCard trade={t} demo={demoBySlug[t.slug] ?? null} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="inline-flex h-9 items-center gap-1.5 rounded-full border-2 px-3 text-[12px] font-extrabold transition active:scale-[0.97]"
      style={
        active
          ? { background: ACCENT, borderColor: ACCENT, color: "#0A0A0A" }
          : {
              background: "#FFFFFF",
              borderColor: "#E5E7EB",
              color: "#0A0A0A"
            }
      }
    >
      {label}
      <span
        className="rounded-full px-1.5 text-[10px] font-extrabold"
        style={{
          background: active ? "rgba(0,0,0,0.15)" : "#F3F4F6",
          color: "#0A0A0A"
        }}
      >
        {count}
      </span>
    </button>
  );
}

function TemplateCard({
  trade,
  demo
}: {
  trade: GalleryTrade;
  demo: GalleryDemoCard | null;
}) {
  const href =
    trade.liveDemoHref ??
    `/trade-off/signup?trade=${encodeURIComponent(trade.slug)}`;
  return (
    // Stretched-link pattern: the root is a div so the BusinessCardButton
    // can sit as a sibling (not a descendant) of the card-wide anchor.
    // A button-inside-anchor would be invalid HTML AND fire the link's
    // navigation when the share button is tapped. The invisible <a>
    // below covers the whole card via `absolute inset-0` and keeps full
    // keyboard accessibility — Tab still focuses the link, Enter still
    // navigates, screen readers still announce the trade label.
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-lg focus-within:border-neutral-300 focus-within:shadow-lg">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-100">
        {trade.bannerUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={trade.bannerUrl}
            alt={`Xrated profile banner for ${trade.label}`}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: ACCENT }}
          >
            <span className="px-4 text-center text-[18px] font-extrabold leading-tight text-neutral-900">
              {trade.label}
            </span>
          </div>
        )}
        {/* Share Business Card — top-right of the banner, mirroring the
            placement convention used on PremiumHero (BusinessCardButton
            sits alongside the WhatsApp/contact CTAs). Sibling of the
            stretched <a>, with z-20 + stopPropagation so a tap on the
            button (or anywhere inside the modal it opens) never
            triggers the card-wide link. Only rendered when a demo
            seed exists for this trade. */}
        {demo && (
          <div
            className="absolute right-2 top-2 z-20"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <BusinessCardButton
              displayName={demo.displayName}
              tradeLabel={demo.tradeLabel}
              phone={null}
              email={demo.email}
              whatsapp={demo.whatsapp}
              phoneCallsEnabled={false}
              bannerUrl={trade.bannerUrl}
              profileUrl={demo.profileUrl}
            />
          </div>
        )}
      </div>
      {/* Trade label sits OUTSIDE the banner in a clean white strip so
          any baked-in text on the inherited artwork doesn't conflict
          with the actual template name. */}
      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        <h3 className="text-[18px] font-extrabold leading-tight text-neutral-900 sm:text-[20px]">
          {trade.label}
        </h3>
        <p className="text-[13px] leading-snug text-neutral-500">
          {trade.description}
        </p>
        <span
          className="mt-auto inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-[13px] font-extrabold uppercase tracking-wider text-neutral-900 shadow-sm transition group-hover:shadow-md sm:text-sm"
          style={{ background: ACCENT, boxShadow: `0 4px 14px ${ACCENT}55` }}
        >
          Use this template
          <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
            →
          </span>
        </span>
      </div>
      {/* Stretched link — sits BEHIND the share button (z-10 vs z-20) so
          it covers card body + banner art for click/keyboard nav, but
          never intercepts taps on the BusinessCardButton trigger. */}
      <a
        href={href}
        aria-label={`Use ${trade.label} template`}
        className="absolute inset-0 z-10 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{ ['--tw-ring-color' as never]: ACCENT }}
      >
        <span className="sr-only">Use {trade.label} template</span>
      </a>
    </div>
  );
}
