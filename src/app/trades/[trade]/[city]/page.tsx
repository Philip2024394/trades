// /trades/[trade]/[city] — programmatic SEO landing pages.
//
// Phase 1 seed: 5 trades × 10 UK cities = 50 static pages.
// Every page:
//   • Real trade listings from hammerex_trade_off_listings (matching
//     the trade + city, silent empty state when zero found).
//   • Trade-authored content per trade (TRADE_CONTENT).
//   • Rich JSON-LD schema: LocalBusiness per listing, FAQPage,
//     BreadcrumbList — for Google + Bing + AI-search snippets.
//   • FAQ block visible on the page (matches the schema for consistency).
//   • Related trades cross-links + related cities to build the internal-
//     linking graph Google needs to crawl the network.
//
// Prove-the-template plan (Philip 2026-07-20 SEO roadmap):
//   1. Ship this route with 50 URLs.
//   2. Submit to Google Search Console.
//   3. Watch impressions build over 2-3 weeks.
//   4. If ranks → scale to 100 trades × 500 cities = 50,000 pages.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Star, MessageCircle, ArrowUpRight, ShieldCheck } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { BRAND, absolute } from "@/lib/seo";
import { pickHeroForTrade } from "@/lib/heroLibrary";
import {
  TRADES, CITIES, TRADE_CONTENT, CITY_CONTENT,
  isValidTrade, isValidCity,
  type TradeSlug, type CitySlug
} from "./config";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic = "force-static";
export const revalidate = 3600;   // ISR: refresh listings hourly

// Pre-render every trade × city at build time.
export async function generateStaticParams() {
  return TRADES.flatMap((trade) => CITIES.map((city) => ({ trade, city })));
}

// Fetch real trade listings matching this (trade × city).
async function loadTradesForCity(trade: TradeSlug, city: CitySlug): Promise<Listing[]> {
  const content = TRADE_CONTENT[trade];
  const cityContent = CITY_CONTENT[city];
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("slug, display_name, primary_trade, city, avatar_url, whatsapp, postcode_prefix, tier")
    .in("primary_trade", content.dbSlugs)
    .in("city", cityContent.dbCityVariants)
    .not("slug", "is", null)
    .limit(12);
  return (res.data as Listing[] | null) ?? [];
}

type Listing = {
  slug:            string;
  display_name:    string | null;
  primary_trade:   string | null;
  city:            string | null;
  avatar_url:      string | null;
  whatsapp:        string | null;
  postcode_prefix: string | null;
  tier:            string | null;
};

// ─── Metadata ────────────────────────────────────────────────────

export async function generateMetadata({
  params
}: {
  params: Promise<{ trade: string; city: string }>;
}): Promise<Metadata> {
  const { trade, city } = await params;
  if (!isValidTrade(trade) || !isValidCity(city)) return { title: "Not found" };
  const t = TRADE_CONTENT[trade];
  const c = CITY_CONTENT[city];
  const title = `${cap(t.plural)} in ${c.displayName} · Verified Trades — ${BRAND.name}`;
  const description = `Find a rated ${t.singular} in ${c.displayName}. ${t.costHeadline} Real reviews, verified credentials, direct WhatsApp contact.`;
  return {
    title,
    description,
    alternates: { canonical: `/trades/${trade}/${city}` },
    openGraph: {
      type:        "website",
      siteName:    BRAND.name,
      title,
      description,
      url:         absolute(`/trades/${trade}/${city}`)
    },
    robots: { index: true, follow: true }
  };
}

// ─── Page ────────────────────────────────────────────────────────

export default async function FindTradeInCityPage({
  params
}: {
  params: Promise<{ trade: string; city: string }>;
}) {
  const { trade, city } = await params;
  if (!isValidTrade(trade) || !isValidCity(city)) notFound();
  const t = TRADE_CONTENT[trade];
  const c = CITY_CONTENT[city];
  const listings = await loadTradesForCity(trade, city);
  // Pick a hero image from the 350-image library — matched on the
  // trade's keywords_strict. Renders at the top of the page + emitted
  // as ImageObject schema so Google Images indexes it.
  const hero = pickHeroForTrade(trade);

  // ── JSON-LD structured data ──
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Find trades", item: absolute("/find") },
      { "@type": "ListItem", position: 2, name: cap(t.plural), item: absolute(`/trades/${trade}`) },
      { "@type": "ListItem", position: 3, name: c.displayName, item: absolute(`/trades/${trade}/${city}`) }
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
  const businessLd = listings.map((l) => ({
    "@context": "https://schema.org",
    "@type":    "LocalBusiness",
    name:       l.display_name ?? l.slug,
    url:        absolute(`/${l.slug}`),
    address:    { "@type": "PostalAddress", addressLocality: l.city ?? c.displayName, addressRegion: c.region, addressCountry: "GB" }
  }));
  const imageLd = hero ? {
    "@context":   "https://schema.org",
    "@type":      "ImageObject",
    contentUrl:   hero.image_url,
    description:  hero.subject,
    representativeOfPage: true,
    creditText:   BRAND.name
  } : null;

  return (
    <main className="min-h-screen bg-[#FBF6EC]">
      <SeoSiteHeader/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}/>
      {businessLd.map((ld, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}/>
      ))}
      {imageLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(imageLd) }}/>
      )}

      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-6 md:py-12">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumbs" className="mb-4 flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
          <Link href="/find" className="hover:text-neutral-900">Find trades</Link>
          <span aria-hidden>/</span>
          <Link href={`/trades/${trade}`} className="hover:text-neutral-900">{cap(t.plural)}</Link>
          <span aria-hidden>/</span>
          <span className="font-black text-neutral-900">{c.displayName}</span>
        </nav>

        {/* Hero — image + copy split. Image indexed via ImageObject
            schema above + rendered here for SERP CTR + Google Images
            surface. Uses next/image only when we have a hero from
            the library; falls back to text-only if no image match. */}
        <header className={hero ? "grid gap-6 md:grid-cols-[1fr_minmax(280px,400px)] md:items-center" : ""}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
              {t.singular} · {c.region}
            </p>
            <h1 className="mt-1 text-[32px] font-black leading-tight text-neutral-900 md:text-[44px]">
              {cap(t.plural)} in {c.displayName}
            </h1>
            <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-neutral-600 md:text-[15px]">
              {t.aiAnswer}
            </p>
          </div>
          {hero && (
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-md" style={{ backgroundColor: "#F0EDE8" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hero.image_url}
                alt={`${cap(t.plural)} in ${c.displayName} — ${hero.subject}`}
                loading="eager"
                width={hero.width_px ?? 1200}
                height={hero.height_px ?? 900}
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </header>

        {/* Live trades grid — or "we're recruiting" empty state */}
        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-[16px] font-black text-neutral-900 md:text-[18px]">
              {listings.length > 0
                ? `${listings.length} ${listings.length === 1 ? t.singular : t.plural} in ${c.displayName}`
                : `${cap(t.plural)} coming soon to ${c.displayName}`}
            </h2>
            {listings.length > 0 && (
              <Link
                href="/trade-off/yard/canteens"
                className="text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
              >
                See all trades →
              </Link>
            )}
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
                        {(l.primary_trade ?? t.singular).replace(/-/g, " ")}
                        {l.postcode_prefix && ` · ${l.postcode_prefix}`}
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
              <p className="mt-2 text-[13px] font-black text-neutral-900">
                We're recruiting verified {t.plural} in {c.displayName}
              </p>
              <p className="mx-auto mt-1 max-w-md text-[11.5px] text-neutral-600">
                Are you a {t.singular} covering {c.displayName}? Claim a free canteen page — 10 verified WhatsApp leads on us.
              </p>
              <Link
                href="/trade-off/join"
                className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-md px-4 text-[12px] font-black uppercase tracking-wider text-neutral-900 shadow-sm"
                style={{ backgroundColor: "#FFB300" }}
              >
                Claim your canteen
                <ArrowUpRight size={12} strokeWidth={2.6}/>
              </Link>
            </div>
          )}
        </section>

        {/* Trade description body — SEO body copy */}
        <section className="mt-10">
          <h2 className="text-[16px] font-black text-neutral-900 md:text-[18px]">
            What does a {t.singular} do?
          </h2>
          <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-neutral-700">
            {t.bodyIntro}
          </p>
        </section>

        {/* Cost section */}
        <section className="mt-10">
          <h2 className="text-[16px] font-black text-neutral-900 md:text-[18px]">
            {cap(t.singular)} costs in {c.displayName}
          </h2>
          <p className="mt-2 max-w-3xl text-[13.5px] font-black text-neutral-900">
            {t.costHeadline}
          </p>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {t.costBullets.map((b) => (
              <li key={b.label} className="rounded-2xl border bg-white p-4" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">{b.label}</p>
                <p className="mt-1 text-[20px] font-black tabular-nums text-neutral-900">{b.range}</p>
                <p className="mt-1 text-[11px] leading-snug text-neutral-600">{b.note}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* FAQs — mirrors the FAQPage schema on the page */}
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

        {/* Related trades cross-links */}
        <section className="mt-10">
          <h2 className="text-[13px] font-black uppercase tracking-[0.16em] text-neutral-500">
            Related trades in {c.displayName}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {t.related.map((r) => (
              <li key={r}>
                <Link
                  href={`/trades/${r}/${city}`}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-black text-neutral-800 shadow-sm hover:-translate-y-0.5 transition"
                  style={{ border: "1px solid rgba(139,69,19,0.10)" }}
                >
                  {cap(TRADE_CONTENT[r].plural)} in {c.displayName}
                  <ArrowUpRight size={11} strokeWidth={2.4}/>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Same trade, other cities — internal linking */}
        <section className="mt-10">
          <h2 className="text-[13px] font-black uppercase tracking-[0.16em] text-neutral-500">
            {cap(t.plural)} in other UK cities
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {CITIES.filter((cc) => cc !== city).map((cc) => (
              <li key={cc}>
                <Link
                  href={`/trades/${trade}/${cc}`}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-black text-neutral-800 shadow-sm hover:-translate-y-0.5 transition"
                  style={{ border: "1px solid rgba(139,69,19,0.10)" }}
                >
                  {CITY_CONTENT[cc].displayName}
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
                Post one job — reach every verified {t.singular} in {c.displayName}
              </h3>
              <p className="mt-2 text-[12.5px] text-neutral-600 md:text-[13.5px]">
                No lead broker. No commission. You message the trades directly on WhatsApp. Free for homeowners.
              </p>
            </div>
            <Link
              href="/sitebook"
              className="inline-flex h-12 items-center justify-center gap-1.5 rounded-lg px-6 text-[12.5px] font-black uppercase tracking-wider text-neutral-900 shadow-md active:scale-[0.97]"
              style={{ backgroundColor: "#FFB300" }}
            >
              <MessageCircle size={14} strokeWidth={2.6}/>
              Post your job free
            </Link>
          </div>
        </section>

        {/* Trust footer — light schema-friendly text */}
        <footer className="mt-12 flex flex-wrap items-center gap-4 border-t pt-6 text-[11px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <span className="inline-flex items-center gap-1">
            <ShieldCheck size={12}/> Verified credentials
          </span>
          <span className="inline-flex items-center gap-1">
            <Star size={12}/> Real customer reviews
          </span>
          <span>Never charged a lead fee · No commission on completed jobs</span>
        </footer>
      </div>
    </main>
  );
}

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
