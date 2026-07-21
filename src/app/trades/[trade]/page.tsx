// /trades/[trade] — national UK landing per trade.
//
// Catches un-targeted queries: "plumber UK", "find electrician",
// "carpenter near me" (Google intent-parses to national). Feeds
// traffic into the city-specific /trades/[trade]/[city] variants and
// the /cost/[project] pages.
//
// Content strategy: same TRADE_CONTENT as city variants, but:
//   • H1 references UK-wide, not a city
//   • Listing grid pulls from all cities (up to 20)
//   • Prominent "By city" section — 10 city cards, each linked to
//     /trades/[trade]/[city]
//   • Cost-cross-link section — points at the matching /cost/[project]
//     when a mapping exists (kitchen fitter → kitchen extension etc.)

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, MapPin, ShieldCheck, Star, Calculator } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { BRAND, absolute } from "@/lib/seo";
import { pickHeroForTrade } from "@/lib/heroLibrary";
import {
  TRADES, CITIES, TRADE_CONTENT, CITY_CONTENT,
  isValidTrade,
  type TradeSlug
} from "./[city]/config";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic  = "force-static";
export const revalidate = 3600;

// TRADE → matching /cost/[project] slug (when applicable). Not every
// trade maps 1-to-1 to a project; empty string when no mapping.
const TRADE_TO_COST: Record<TradeSlug, string> = {
  plumber:             "new-boiler",
  electrician:         "house-rewire",
  carpenter:           "kitchen-extension",
  plasterer:           "",
  roofer:              "",
  bricklayer:          "kitchen-extension",
  "gas-safe-engineer": "new-boiler",
  tiler:               "bathroom-refit",
  landscaper:          "",
  painter:             ""
};

export async function generateStaticParams() {
  return TRADES.map((trade) => ({ trade }));
}

async function loadTradesNational(trade: TradeSlug): Promise<Listing[]> {
  const content = TRADE_CONTENT[trade];
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("slug, display_name, primary_trade, city, avatar_url, postcode_prefix, tier")
    .in("primary_trade", content.dbSlugs)
    .not("slug", "is", null)
    .limit(20);
  return (res.data as Listing[] | null) ?? [];
}

type Listing = {
  slug:            string;
  display_name:    string | null;
  primary_trade:   string | null;
  city:            string | null;
  avatar_url:      string | null;
  postcode_prefix: string | null;
  tier:            string | null;
};

export async function generateMetadata({
  params
}: {
  params: Promise<{ trade: string }>;
}): Promise<Metadata> {
  const { trade } = await params;
  if (!isValidTrade(trade)) return { title: "Not found" };
  const t = TRADE_CONTENT[trade];
  const title = `UK ${cap(t.plural)} · Find Verified ${cap(t.plural)} — ${BRAND.name}`;
  const description = `Find a rated ${t.singular} anywhere in the UK. ${t.costHeadline} Verified credentials, real reviews, direct WhatsApp contact. Search by city below.`;
  return {
    title,
    description,
    alternates: { canonical: `/trades/${trade}` },
    openGraph: {
      type:     "website",
      siteName: BRAND.name,
      title,
      description,
      url:      absolute(`/trades/${trade}`)
    },
    robots: { index: true, follow: true }
  };
}

export default async function TradeNationalPage({
  params
}: {
  params: Promise<{ trade: string }>;
}) {
  const { trade } = await params;
  if (!isValidTrade(trade)) notFound();
  const t = TRADE_CONTENT[trade];
  const listings = await loadTradesNational(trade);
  const hero     = pickHeroForTrade(trade);
  const costLink = TRADE_TO_COST[trade];

  // JSON-LD
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Find trades", item: absolute("/trades") },
      { "@type": "ListItem", position: 2, name: cap(t.plural), item: absolute(`/trades/${trade}`) }
    ]
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type":    "FAQPage",
    mainEntity: t.faqs.map((f) => ({
      "@type": "Question",
      name:    f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a }
    }))
  };
  const imageLd = hero ? {
    "@context":  "https://schema.org",
    "@type":     "ImageObject",
    contentUrl:  hero.image_url,
    description: hero.subject,
    representativeOfPage: true,
    creditText:  BRAND.name
  } : null;

  return (
    <main className="min-h-screen bg-[#FBF6EC]">
      <SeoSiteHeader/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}/>
      {imageLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(imageLd) }}/>}

      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-6 md:py-12">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumbs" className="mb-4 flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
          <Link href="/trades" className="hover:text-neutral-900">Find trades</Link>
          <span aria-hidden>/</span>
          <span className="font-black text-neutral-900">{cap(t.plural)}</span>
        </nav>

        {/* Intent-triangle nav — Hire (this page) / Become / What is */}
        <nav className="mb-5 flex flex-wrap gap-2 text-[10.5px] font-black uppercase tracking-wider">
          <span className="rounded-full bg-neutral-900 px-3 py-1 text-white">Hire a {t.singular} (this page)</span>
          <Link href={`/careers/${trade}`} className="rounded-full border-2 bg-white px-3 py-1 text-neutral-700 hover:text-neutral-900" style={{ borderColor: "rgba(139,69,19,0.20)" }}>Become a {t.singular}</Link>
          <Link href={`/what-is/${trade}`} className="rounded-full border-2 bg-white px-3 py-1 text-neutral-700 hover:text-neutral-900" style={{ borderColor: "rgba(139,69,19,0.20)" }}>What is a {t.singular}?</Link>
        </nav>

        {/* Hero */}
        <header className={hero ? "grid gap-6 md:grid-cols-[1fr_minmax(280px,400px)] md:items-center" : ""}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
              Verified UK {t.plural}
            </p>
            <h1 className="mt-1 text-[32px] font-black leading-tight text-neutral-900 md:text-[44px]">
              Find a UK {t.singular}
            </h1>
            <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-neutral-600 md:text-[15px]">
              {t.aiAnswer}
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] font-black shadow-sm" style={{ border: "1px solid rgba(139,69,19,0.10)" }}>
              <Calculator size={12}/>
              <span className="tabular-nums text-neutral-900">{t.costHeadline.split(":")[1]?.trim() ?? t.costHeadline}</span>
            </div>
          </div>
          {hero && (
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-md" style={{ backgroundColor: "#F0EDE8" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hero.image_url}
                alt={`UK ${t.plural} — ${hero.subject}`}
                loading="eager"
                width={hero.width_px ?? 1200}
                height={hero.height_px ?? 900}
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </header>

        {/* Live trades grid — national */}
        <section className="mt-10">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-[16px] font-black text-neutral-900 md:text-[18px]">
              {listings.length > 0 ? `${listings.length} UK ${t.plural} on The Networkers` : `UK ${t.plural} coming soon`}
            </h2>
          </div>
          {listings.length > 0 ? (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((l) => (
                <li key={l.slug}>
                  <Link
                    href={`/${l.slug}`}
                    className="group flex h-full items-start gap-3 rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    style={{ borderColor: "rgba(139,69,19,0.10)" }}
                  >
                    <span
                      className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-[15px] font-black text-neutral-900"
                      style={{
                        backgroundColor: "#FFB300",
                        backgroundImage: l.avatar_url ? `url('${l.avatar_url}')` : undefined,
                        backgroundSize: "cover",
                        backgroundPosition: "center"
                      }}
                    >
                      {!l.avatar_url && (l.display_name ?? l.slug).charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-black text-neutral-900">
                        {l.display_name ?? l.slug}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-neutral-500">
                        {l.city ?? "UK"} {l.postcode_prefix && `· ${l.postcode_prefix}`}
                      </p>
                      <div className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-500 group-hover:text-neutral-900">
                        View profile <ArrowUpRight size={11} strokeWidth={2.6}/>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border-2 border-dashed bg-white p-8 text-center" style={{ borderColor: "rgba(139,69,19,0.20)" }}>
              <MapPin size={20} className="mx-auto text-neutral-400"/>
              <p className="mt-2 text-[13px] font-black text-neutral-900">Recruiting verified {t.plural} across the UK</p>
              <p className="mx-auto mt-1 max-w-md text-[11.5px] text-neutral-600">
                Are you a {t.singular}? Claim a free canteen page — 10 verified WhatsApp leads on us.
              </p>
              <Link
                href="/trade-off/join"
                className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-md px-4 text-[12px] font-black uppercase tracking-wider text-neutral-900 shadow-sm"
                style={{ backgroundColor: "#FFB300" }}
              >
                Claim your canteen <ArrowUpRight size={12} strokeWidth={2.6}/>
              </Link>
            </div>
          )}
        </section>

        {/* By city — 10 city variants, big cards for scanability */}
        <section className="mt-10">
          <h2 className="text-[16px] font-black text-neutral-900 md:text-[18px]">
            {cap(t.plural)} by city
          </h2>
          <p className="mt-1 text-[12px] text-neutral-500">
            Find local {t.plural} in the UK's ten biggest cities.
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
            {CITIES.map((cc) => (
              <li key={cc}>
                <Link
                  href={`/trades/${trade}/${cc}`}
                  className="group flex items-center justify-between gap-1 rounded-xl border bg-white px-3 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-md"
                  style={{ borderColor: "rgba(139,69,19,0.10)" }}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-black text-neutral-900">
                      {CITY_CONTENT[cc].displayName}
                    </p>
                    <p className="mt-0.5 text-[9.5px] uppercase tracking-wider text-neutral-500">
                      {CITY_CONTENT[cc].region}
                    </p>
                  </div>
                  <ArrowUpRight size={12} strokeWidth={2.6} className="text-neutral-400 group-hover:text-neutral-900"/>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Body */}
        <section className="mt-10">
          <h2 className="text-[16px] font-black text-neutral-900 md:text-[18px]">
            What does a {t.singular} do?
          </h2>
          <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-neutral-700">
            {t.bodyIntro}
          </p>
        </section>

        {/* Cost callout cross-link */}
        {costLink && (
          <section className="mt-10 rounded-2xl border-2 p-5 md:p-6" style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#FFFFFF" }}>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
              Cost guide
            </p>
            <h3 className="mt-1 text-[16px] font-black text-neutral-900">
              {cap(t.plural)} cost — UK 2026
            </h3>
            <p className="mt-1 text-[12.5px] text-neutral-700">
              {t.costHeadline}
            </p>
            <Link
              href={`/cost/${costLink}`}
              className="mt-3 inline-flex items-center gap-1 text-[12px] font-black uppercase tracking-wider text-neutral-900 hover:underline"
            >
              See full cost breakdown → <ArrowUpRight size={12} strokeWidth={2.6}/>
            </Link>
          </section>
        )}

        {/* FAQs */}
        <section className="mt-10">
          <h2 className="text-[16px] font-black text-neutral-900 md:text-[18px]">
            {cap(t.singular)} FAQs
          </h2>
          <div className="mt-4 space-y-3">
            {t.faqs.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl border bg-white p-4"
                style={{ borderColor: "rgba(139,69,19,0.10)" }}
              >
                <summary className="cursor-pointer list-none text-[13.5px] font-black text-neutral-900 marker:hidden">
                  <span className="mr-2 inline-block text-[#FFB300] group-open:rotate-90 transition">▶</span>
                  {f.q}
                </summary>
                <p className="mt-2 pl-4 text-[13px] leading-relaxed text-neutral-700">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Related trades */}
        <section className="mt-10">
          <h2 className="text-[13px] font-black uppercase tracking-[0.16em] text-neutral-500">
            Related UK trades
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {t.related.map((r) => (
              <li key={r}>
                <Link
                  href={`/trades/${r}`}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-black text-neutral-800 shadow-sm hover:-translate-y-0.5 transition"
                  style={{ border: "1px solid rgba(139,69,19,0.10)" }}
                >
                  UK {TRADE_CONTENT[r].plural}
                  <ArrowUpRight size={11} strokeWidth={2.4}/>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* CTA — homeowner post-a-job */}
        <section className="mt-12 rounded-2xl border-2 p-6 md:p-8" style={{ borderColor: "#FFB300", backgroundColor: "#FFFDF6" }}>
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                Need a {t.singular} today?
              </p>
              <h3 className="mt-1 text-[20px] font-black leading-tight text-neutral-900 md:text-[24px]">
                Post one job — reach every verified {t.singular} across the UK
              </h3>
              <p className="mt-2 text-[12.5px] text-neutral-600 md:text-[13.5px]">
                No lead broker. No commission. Trades message you directly on WhatsApp. Free for homeowners.
              </p>
            </div>
            <Link
              href="/sitebook"
              className="inline-flex h-12 items-center justify-center gap-1.5 rounded-lg px-6 text-[12.5px] font-black uppercase tracking-wider text-neutral-900 shadow-md active:scale-[0.97]"
              style={{ backgroundColor: "#FFB300" }}
            >
              Post your job free <ArrowUpRight size={14} strokeWidth={2.6}/>
            </Link>
          </div>
        </section>

        {/* Trust footer */}
        <footer className="mt-12 flex flex-wrap items-center gap-4 border-t pt-6 text-[11px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <span className="inline-flex items-center gap-1"><ShieldCheck size={12}/> Verified credentials</span>
          <span className="inline-flex items-center gap-1"><Star size={12}/> Real customer reviews</span>
          <span>Never charged a lead fee · No commission on completed jobs</span>
        </footer>
      </div>
    </main>
  );
}

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
