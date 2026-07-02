// Xrated Trades — /showcase
//
// Public hub page listing the 6 lead case studies as large cards.
// Each card pulls live data from hammerex_trade_off_listings so the
// rating, photo and city are always current. The page is the canonical
// "see it in action" surface — linked from the burger menu, the header,
// the sitemap (priority 0.9), and every tip guide via CaseStudyCallout.
//
// Honest: the SEO blurb under the cards calls out each profile's real
// search target ("kitchen installer Bath", "drywaller Manchester") so
// readers know exactly what the case study is built to rank for.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { LEAD_CASE_STUDIES, type LeadCaseStudy } from "@/lib/leadCaseStudies";
import { TRADE_OFF_HERO_IMAGES } from "@/lib/tradeOffHeroes";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { absolute, BRAND } from "@/lib/seo";
import {
  supabase,
  type HammerexTradeOffListing
} from "@/lib/supabase";

export const revalidate = 300;

const TITLE = "See it in action — xratedtrade.com showcase";
const DESCRIPTION =
  "Seven real-world xratedtrade.com profiles built across the main trade types. Each is a live, indexable app — explore what yours could look like.";
const HERO =
  TRADE_OFF_HERO_IMAGES["building-merchant"] ?? BRAND.logo;

export const metadata: Metadata = {
  title: `${TITLE} | ${BRAND.name}`,
  description: DESCRIPTION,
  alternates: { canonical: "/showcase" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    locale: "en_GB",
    title: TITLE,
    description: DESCRIPTION,
    url: absolute("/showcase"),
    images: [{ url: HERO, alt: TITLE }]
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [HERO]
  }
};

type CardListing = Pick<
  HammerexTradeOffListing,
  | "id"
  | "slug"
  | "display_name"
  | "primary_trade"
  | "city"
  | "rating_avg"
  | "rating_count"
  | "avatar_url"
  | "photos"
  | "custom_app_hero_url"
>;

async function loadCardListings(): Promise<CardListing[]> {
  const slugs = LEAD_CASE_STUDIES.map((c) => c.slug);
  const res = await supabase
    .from("hammerex_trade_off_listings")
    .select(
      "id, slug, display_name, primary_trade, city, rating_avg, rating_count, avatar_url, photos, custom_app_hero_url"
    )
    .in("slug", slugs);
  return (res.data ?? []) as CardListing[];
}

function bannerFor(study: LeadCaseStudy, row?: CardListing): string {
  if (row?.custom_app_hero_url) return row.custom_app_hero_url;
  if (row?.photos && row.photos[0]) return row.photos[0];
  if (row?.avatar_url) return row.avatar_url;
  const tradeKey = row?.primary_trade ?? "";
  return TRADE_OFF_HERO_IMAGES[tradeKey] ?? HERO;
}

export default async function ShowcasePage() {
  const rows = await loadCardListings();
  const byslug = new Map(rows.map((r) => [r.slug, r]));

  // ItemList JSON-LD — flat, indexable list of the 6 case-study URLs.
  // This is the rich-result shape Google looks for on "hub" pages so
  // each profile inherits some authority from the hub. Article JSON-LD
  // sits alongside so the hub also reads as a piece of content.
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: TITLE,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: LEAD_CASE_STUDIES.length,
    itemListElement: LEAD_CASE_STUDIES.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absolute(`/trade/${c.slug}`),
      name: `${c.name} — ${c.tradeLabel} in ${c.city}`
    }))
  };
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: TITLE,
    description: DESCRIPTION,
    author: { "@type": "Organization", name: BRAND.name },
    publisher: {
      "@type": "Organization",
      name: BRAND.name,
      logo: { "@type": "ImageObject", url: BRAND.logo }
    },
    image: HERO,
    datePublished: "2026-06-29",
    dateModified: "2026-06-29",
    mainEntityOfPage: { "@type": "WebPage", "@id": absolute("/showcase") }
  };

  return (
    <main className="bg-white pb-24 md:pb-0">
      <XratedHeader />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      {/* Full-bleed hero */}
      <section
        className="relative isolate overflow-hidden"
        style={{ background: "#0A0A0A" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-25"
        />
        <div className="relative mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <p
            className="text-[11px] font-extrabold uppercase tracking-[0.28em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            Real xratedtrade.com apps
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white sm:text-5xl">
            See it in action
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[13px] leading-relaxed text-white/80 sm:text-base">
            Seven real-world xratedtrade.com profiles built across the main trade types.
            Each is a live, indexable app — explore what yours could
            look like.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {LEAD_CASE_STUDIES.map((c) => {
            const row = byslug.get(c.slug);
            const banner = bannerFor(c, row);
            const rating = row?.rating_avg ? Number(row.rating_avg) : null;
            const reviewCount = row?.rating_count ?? 0;
            return (
              <li key={c.slug}>
                <a
                  href={`/trade/${c.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:border-neutral-400 hover:shadow-lg"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={banner}
                      alt={`${c.name} — ${c.tradeLabel} in ${c.city}`}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                    />
                    <span
                      className="absolute left-3 top-3 inline-flex h-6 items-center rounded-full px-2.5 text-[13px] font-extrabold uppercase tracking-wider text-neutral-900"
                      style={{ background: XRATED_BRAND.accent }}
                    >
                      {c.bucket}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h2 className="text-base font-extrabold leading-tight text-neutral-900 sm:text-lg">
                      {c.name}
                    </h2>
                    <p className="mt-1 text-[13px] font-semibold text-neutral-500">
                      {c.tradeLabel} · {c.city}
                    </p>
                    {rating !== null && reviewCount > 0 && (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-neutral-700">
                        <span aria-hidden="true" style={{ color: XRATED_BRAND.accent }}>
                          ★
                        </span>
                        {rating.toFixed(1)} · {reviewCount} reviews
                      </p>
                    )}
                    <p className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-neutral-600">
                      {c.pullQuote}
                    </p>
                    <p className="mt-4 inline-flex items-center gap-1 text-[13px] font-extrabold text-neutral-900">
                      Open the live profile
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </p>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>

        {/* SEO blurb — explicitly states the real search target each
            case study is built to rank for. Honest framing: these are
            demos, but they're crafted to compete for live queries. */}
        <section className="mt-14 rounded-2xl border border-neutral-200 bg-neutral-50 p-6 sm:p-8">
          <p
            className="text-[11px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: "#7a5a00" }}
          >
            What each profile targets
          </p>
          <h2 className="mt-2 text-xl font-extrabold leading-tight text-neutral-900 sm:text-2xl">
            Built to rank for real searches
          </h2>
          <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-neutral-700 sm:text-[15px]">
            Each case study is a working example of how an xratedtrade.com
            profile ranks for the search a customer would actually type. The
            profiles below are demos, but the underlying app, JSON-LD, FAQ
            schema and review structure are exactly what you get on a paid
            xratedtrade.com plan.
          </p>
          <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {LEAD_CASE_STUDIES.map((c) => (
              <li
                key={c.slug}
                className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3 sm:p-4"
              >
                <span
                  className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-neutral-900"
                  style={{ background: XRATED_BRAND.accent }}
                  aria-hidden="true"
                >
                  ★
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-extrabold text-neutral-900 sm:text-sm">
                    {c.name}
                  </p>
                  <p className="text-[13px] text-neutral-600">
                    Targets “{c.searchTarget}”
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </section>

      <XratedFooter />
    </main>
  );
}
