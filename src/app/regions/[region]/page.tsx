// /regions/[region] — regional leaf.
// Emits Place + FAQPage + BreadcrumbList JSON-LD.
// Cross-references cities + trades + grants + Vault articles.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight, MapPin, TrendingUp, ShieldCheck, Wrench, ExternalLink
} from "lucide-react";
import { BRAND, absolute } from "@/lib/seo";
import { REGIONS, isValidRegion } from "../config";
import { CITY_CONTENT, TRADES, TRADE_CONTENT } from "@/app/trades/[trade]/[city]/config";
import { ResourcesBar } from "@/components/seo/ResourcesBar";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic  = "force-static";
export const revalidate = 86400;

export function generateStaticParams() {
  return REGIONS.map((r) => ({ region: r.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ region: string }> }
): Promise<Metadata> {
  const { region } = await params;
  const r = REGIONS.find((x) => x.slug === region);
  if (!r) return { title: "Region not found" };
  return {
    title:       `${r.displayName} verified UK trades · pricing + cities + grants — ${BRAND.name}`,
    description: `${r.overview.slice(0, 155)}`,
    alternates:  { canonical: `/regions/${r.slug}` },
    openGraph:   {
      type:     "article",
      siteName: BRAND.name,
      title:    `${r.displayName} — UK trades`,
      description: r.overview.slice(0, 200),
      url:      absolute(`/regions/${r.slug}`)
    },
    robots: { index: true, follow: true }
  };
}

export default async function RegionLeafPage(
  { params }: { params: Promise<{ region: string }> }
) {
  const { region } = await params;
  if (!isValidRegion(region)) notFound();
  const r = REGIONS.find((x) => x.slug === region)!;

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "UK Regions",     item: absolute("/regions") },
      { "@type": "ListItem", position: 2, name: r.displayName,   item: absolute(`/regions/${r.slug}`) }
    ]
  };
  // Place — Schema.org type for a bounded geographic area
  const placeLd = {
    "@context": "https://schema.org",
    "@type":    "Place",
    name:       r.displayName,
    url:        absolute(`/regions/${r.slug}`),
    containedInPlace: {
      "@type": "Country",
      name:    "United Kingdom"
    },
    containsPlace: r.cities.map((c) => ({
      "@type":  "City",
      name:     CITY_CONTENT[c]?.displayName ?? c,
      url:      absolute(`/trades/plumber/${c}`)
    }))
  };

  return (
    <main className="min-h-screen bg-[#FBF6EC]">
      <SeoSiteHeader/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(placeLd) }}/>

      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-6 md:py-12">
        <nav aria-label="Breadcrumbs" className="mb-4 flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
          <Link href="/" className="hover:text-neutral-900">Home</Link>
          <span aria-hidden>/</span>
          <Link href="/regions" className="hover:text-neutral-900">UK Regions</Link>
          <span aria-hidden>/</span>
          <span className="font-black text-neutral-900">{r.displayName}</span>
        </nav>

        {/* Header */}
        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
            UK Region · {r.cities.length} {r.cities.length === 1 ? "city" : "cities"} covered
          </p>
          <h1 className="mt-1 text-[36px] font-black leading-tight text-neutral-900 md:text-[52px]">
            {r.displayName} verified UK trades
          </h1>
          <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-neutral-700 md:text-[15px]">
            {r.overview}
          </p>
        </header>

        {/* At-a-glance market facts */}
        <section className="mt-6 grid gap-3 md:grid-cols-3">
          {r.marketFacts.map((f, i) => (
            <div key={i} className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Market fact</p>
              <p className="mt-1 text-[12.5px] leading-snug text-neutral-800">{f}</p>
            </div>
          ))}
        </section>

        {/* Cities in region */}
        <section className="mt-10">
          <h2 className="text-[20px] font-black leading-tight text-neutral-900 md:text-[26px]">
            Cities in {r.displayName}
          </h2>
          <p className="mt-1 text-[12px] text-neutral-500">
            Every verified trade slug we serve, in every {r.demonym.toLowerCase()} city.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {r.cities.map((c) => {
              const cityContent = CITY_CONTENT[c];
              if (!cityContent) return null;
              return (
                <article key={c} className="rounded-2xl border-2 bg-white p-5 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                  <div className="flex items-center gap-2">
                    <MapPin size={14} strokeWidth={2.6} className="text-[#FFB300]"/>
                    <h3 className="text-[16px] font-black text-neutral-900">{cityContent.displayName}</h3>
                  </div>
                  <ul className="mt-3 space-y-1">
                    {TRADES.map((trade) => (
                      <li key={trade}>
                        <Link
                          href={`/trades/${trade}/${c}`}
                          className="inline-flex items-center gap-0.5 text-[12px] font-black text-neutral-700 hover:text-neutral-900 hover:underline"
                        >
                          {cityContent.displayName} {TRADE_CONTENT[trade].plural}
                          <ArrowUpRight size={10} strokeWidth={2.6}/>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        {/* Trades hub — full national coverage */}
        <section className="mt-10">
          <h2 className="text-[20px] font-black leading-tight text-neutral-900 md:text-[26px]">
            All verified trades — nationwide + {r.displayName}
          </h2>
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {TRADES.map((trade) => (
              <li key={trade}>
                <Link
                  href={`/trades/${trade}`}
                  className="inline-flex items-center gap-0.5 rounded-full bg-neutral-900 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white hover:opacity-90"
                >
                  <Wrench size={10}/>
                  {TRADE_CONTENT[trade].singular}
                  <ArrowUpRight size={10} strokeWidth={2.6}/>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Pricing note */}
        <section className="mt-8 rounded-2xl border-2 p-5 md:p-6" style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#FFFFFF" }}>
          <div className="flex items-center gap-2">
            <TrendingUp size={14} strokeWidth={2.6} className="text-neutral-900"/>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
              Regional pricing snapshot
            </p>
          </div>
          <p className="mt-2 text-[13.5px] leading-relaxed text-neutral-800">
            {r.pricingNote}
          </p>
          <Link href="/price-index" className="mt-3 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-900 hover:underline">
            Full UK Trade Price Index <ArrowUpRight size={11} strokeWidth={2.6}/>
          </Link>
        </section>

        {/* Regional grant highlight, when one exists */}
        {r.grantHighlight && (
          <section className="mt-6 rounded-2xl border-2 p-5 md:p-6" style={{ borderColor: "#166534", backgroundColor: "#F0FDF4" }}>
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} strokeWidth={2.6} className="text-green-800"/>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-green-800">
                Region-specific funding
              </p>
            </div>
            <p className="mt-2 text-[15px] font-black text-neutral-900">
              {r.grantHighlight.label}
            </p>
            <p className="mt-1 text-[12.5px] text-neutral-700">
              Only available to {r.displayName} residents. Eligibility, amounts + how to apply →
            </p>
            <Link
              href={`/grants#${r.grantHighlight.slug}`}
              className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-[11.5px] font-black uppercase tracking-wider text-white shadow-sm"
              style={{ backgroundColor: "#166534" }}
            >
              View {r.grantHighlight.label}
              <ArrowUpRight size={12} strokeWidth={2.6}/>
            </Link>
          </section>
        )}

        {/* Cross-pillar bar */}
        <ResourcesBar active="regions" className="mt-8"/>

        <footer className="mt-12 flex flex-wrap items-center gap-4 border-t pt-6 text-[11px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <span className="inline-flex items-center gap-1"><ShieldCheck size={12}/> Regional pricing sourced monthly from the UK Trade Price Index</span>
          <Link href="/regions" className="inline-flex items-center gap-0.5 hover:text-neutral-900">
            All regions <ExternalLink size={11}/>
          </Link>
        </footer>
      </div>
    </main>
  );
}
