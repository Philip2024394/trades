// /regions — UK regional hub.

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, MapPin, ShieldCheck } from "lucide-react";
import { BRAND, absolute } from "@/lib/seo";
import { REGIONS, HUB_FAQS } from "./config";
import { CITY_CONTENT } from "@/app/trades/[trade]/[city]/config";
import { ResourcesBar } from "@/components/seo/ResourcesBar";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic  = "force-static";
export const revalidate = 86400;

export const metadata: Metadata = {
  title:       `UK Trade Regions · find verified trades by region — ${BRAND.name}`,
  description: `Browse verified UK trades by region — North West, Yorkshire, Scotland, Greater London, and more. Regional pricing, city coverage, region-specific grants.`,
  alternates:  { canonical: `/regions` },
  openGraph:   {
    type:     "website",
    siteName: BRAND.name,
    title:    `UK Trade Regions`,
    description: `Verified UK trades by region — pricing, cities, grants.`,
    url:      absolute(`/regions`)
  },
  robots: { index: true, follow: true }
};

export default function RegionsHubPage() {
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "UK Regions", item: absolute("/regions") }
    ]
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type":    "FAQPage",
    mainEntity: HUB_FAQS.map((f) => ({
      "@type": "Question",
      name:    f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a }
    }))
  };

  return (
    <main className="min-h-screen bg-[#FBF6EC]">
      <SeoSiteHeader/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}/>

      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-6 md:py-12">
        <nav aria-label="Breadcrumbs" className="mb-4 flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
          <Link href="/" className="hover:text-neutral-900">Home</Link>
          <span aria-hidden>/</span>
          <span className="font-black text-neutral-900">UK Regions</span>
        </nav>

        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
            UK-wide · Verified trades
          </p>
          <h1 className="mt-1 text-[36px] font-black leading-tight text-neutral-900 md:text-[52px]">
            Find UK trades by region
          </h1>
          <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-neutral-600 md:text-[15px]">
            {REGIONS.length} UK regions — each with regional pricing, city coverage, region-specific grants, and every verified trade slug we serve.
          </p>
        </header>

        {/* Regional cards */}
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {REGIONS.map((r) => (
            <li key={r.slug}>
              <Link
                href={`/regions/${r.slug}`}
                className="group flex h-full flex-col rounded-2xl border-2 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                style={{ borderColor: "rgba(139,69,19,0.10)" }}
              >
                <div className="flex items-start gap-2">
                  <MapPin size={18} strokeWidth={2.4} className="mt-0.5 shrink-0 text-[#FFB300]"/>
                  <h2 className="text-[18px] font-black leading-tight text-neutral-900">
                    {r.displayName}
                  </h2>
                </div>
                <p className="mt-2 text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
                  {r.cities.length} {r.cities.length === 1 ? "city" : "cities"}
                  {" · "}
                  {r.cities.map((c) => CITY_CONTENT[c]?.displayName ?? c).join(" · ")}
                </p>
                <p className="mt-3 line-clamp-3 text-[12.5px] leading-snug text-neutral-600">
                  {r.overview}
                </p>
                <p className="mt-3 inline-flex items-center gap-0.5 text-[10.5px] font-black uppercase tracking-wider text-neutral-500 group-hover:text-neutral-900">
                  Region page <ArrowUpRight size={11} strokeWidth={2.6}/>
                </p>
              </Link>
            </li>
          ))}
        </ul>

        {/* Hub FAQs */}
        <section className="mt-12">
          <h2 className="text-[20px] font-black leading-tight text-neutral-900 md:text-[26px]">
            About the regional pages
          </h2>
          <div className="mt-4 space-y-3">
            {HUB_FAQS.map((f) => (
              <details key={f.q} className="group rounded-2xl border bg-white p-4" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                <summary className="cursor-pointer list-none text-[13.5px] font-black text-neutral-900 marker:hidden">
                  <span className="mr-2 inline-block text-[#FFB300] group-open:rotate-90 transition">▶</span>
                  {f.q}
                </summary>
                <p className="mt-2 pl-4 text-[13px] leading-relaxed text-neutral-700">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <ResourcesBar active="regions" className="mt-8"/>

        <footer className="mt-12 flex flex-wrap items-center gap-4 border-t pt-6 text-[11px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <span className="inline-flex items-center gap-1"><ShieldCheck size={12}/> Regional pricing sourced monthly from the UK Trade Price Index</span>
        </footer>
      </div>
    </main>
  );
}
