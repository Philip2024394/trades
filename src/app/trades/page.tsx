// /trades — hub landing page for the whole /trades/* SEO surface.
//
// Top of the funnel for "find a UK trade" queries. Surfaces:
//   • Every trade as a big visual card (hero image + AI-answer)
//   • Cross-links to /planning and /cost tools
//   • Top UK cities row
// Priority target keywords: "find a trade UK", "UK trade directory".

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Calculator, ShieldCheck, MapPin, TrendingUp } from "lucide-react";
import { BRAND, absolute } from "@/lib/seo";
import {
  TRADES, CITIES, TRADE_CONTENT, CITY_CONTENT, TRADE_HUB_COVER
} from "./[trade]/[city]/config";
import { PLANNING_PROJECTS, PLANNING_CONTENT } from "@/app/planning/[project]/config";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic  = "force-static";
export const revalidate = 3600;

export const metadata: Metadata = {
  title:       `Find a UK Trade · Verified Tradespeople — ${BRAND.name}`,
  description: `Find verified UK plumbers, electricians, carpenters, plasterers, and roofers. Real reviews, direct WhatsApp contact, no lead broker fees. Browse by trade or by UK city.`,
  alternates:  { canonical: `/trades` },
  robots:      { index: true, follow: true },
  openGraph:   {
    type:     "website",
    siteName: BRAND.name,
    title:    `Find a UK Trade · Verified Tradespeople`,
    description: `Verified UK tradespeople. No lead broker. No commission.`,
    url:      absolute(`/trades`)
  }
};

export default function TradesHubPage() {
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Find trades", item: absolute("/trades") }
    ]
  };

  return (
    <main className="min-h-screen bg-[#FBF6EC]">
      <SeoSiteHeader/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}/>

      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-6 md:py-12">
        {/* Hero */}
        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
            The Networkers · UK trades
          </p>
          <h1 className="mt-1 text-[36px] font-black leading-tight text-neutral-900 md:text-[52px]">
            Find a verified UK trade
          </h1>
          <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-neutral-600 md:text-[15px]">
            Real trades. Real reviews. Direct WhatsApp contact. No lead brokers, no commission. Browse by trade or jump to a UK city.
          </p>
        </header>

        {/* Trade cards */}
        <section className="mt-8">
          <h2 className="text-[13px] font-black uppercase tracking-[0.16em] text-neutral-500">
            Browse by trade
          </h2>
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TRADES.map((trade) => {
              const t     = TRADE_CONTENT[trade];
              const cover = TRADE_HUB_COVER[trade];
              return (
                <li key={trade}>
                  <Link
                    href={`/trades/${trade}`}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                    style={{ borderColor: "rgba(139,69,19,0.10)" }}
                  >
                    {cover && (
                      <div className="aspect-[3/2] w-full overflow-hidden" style={{ backgroundColor: "#0A0A0A" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={cover}
                          alt={`UK ${t.plural} — verified via The Networkers`}
                          loading="lazy"
                          className="h-full w-full object-contain"
                        />
                      </div>
                    )}
                    <div className="flex-1 p-4">
                      <h3 className="text-[18px] font-black leading-tight text-neutral-900">
                        UK {cap(t.plural)}
                      </h3>
                      <p className="mt-2 line-clamp-3 text-[12px] leading-snug text-neutral-600">
                        {t.aiAnswer}
                      </p>
                      <p className="mt-3 inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-500 group-hover:text-neutral-900">
                        Find a {t.singular}
                        <ArrowUpRight size={11} strokeWidth={2.6}/>
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* City picker */}
        <section className="mt-12">
          <h2 className="text-[13px] font-black uppercase tracking-[0.16em] text-neutral-500">
            <MapPin size={12} className="mb-0.5 inline"/> Browse by UK city
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
            {CITIES.map((city) => (
              <li key={city}>
                <div
                  className="rounded-xl border bg-white p-3"
                  style={{ borderColor: "rgba(139,69,19,0.10)" }}
                >
                  <p className="text-[12.5px] font-black text-neutral-900">
                    {CITY_CONTENT[city].displayName}
                  </p>
                  <p className="mt-0.5 text-[9.5px] uppercase tracking-wider text-neutral-500">
                    {CITY_CONTENT[city].region}
                  </p>
                  <ul className="mt-2 space-y-0.5">
                    {TRADES.map((trade) => (
                      <li key={`${city}-${trade}`}>
                        <Link
                          href={`/trades/${trade}/${city}`}
                          className="text-[10.5px] text-neutral-600 hover:text-neutral-900 hover:underline"
                        >
                          {cap(TRADE_CONTENT[trade].plural)} →
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Cost tools cross-link */}
        <section className="mt-12 rounded-2xl border-2 p-5 md:p-6" style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#FFFFFF" }}>
          <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: "#FFB300" }}>
              <Calculator size={20} strokeWidth={2.4} className="text-neutral-900"/>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                Cost + planning tools
              </p>
              <h3 className="mt-1 text-[16px] font-black text-neutral-900">
                Before you hire — get honest UK 2026 pricing
              </h3>
              <p className="mt-1 text-[12px] text-neutral-600">
                Kitchen extension £30k+ · Loft conversion £30-65k · Bathroom refit £3.5k+ · Boiler swap £1.6k+ · Full rewire £3.5k+
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {["kitchen-extension", "loft-conversion", "bathroom-refit", "house-rewire", "new-boiler"].map((p) => (
                  <Link
                    key={p}
                    href={`/cost/${p}`}
                    className="inline-flex items-center gap-1 rounded-full bg-[#FBF6EC] px-3 py-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-800 hover:-translate-y-0.5 transition"
                    style={{ border: "1px solid rgba(139,69,19,0.10)" }}
                  >
                    {p.replace(/-/g, " ")}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Planning tools cross-link */}
        <section className="mt-6 rounded-2xl border-2 p-5 md:p-6" style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#FFFFFF" }}>
          <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: "#166534" }}>
              <ShieldCheck size={20} strokeWidth={2.4} className="text-white"/>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                Planning + building regs
              </p>
              <h3 className="mt-1 text-[16px] font-black text-neutral-900">
                Do you need planning permission?
              </h3>
              <p className="mt-1 text-[12px] text-neutral-600">
                Check UK Permitted Development rights before you start.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {PLANNING_PROJECTS.slice(0, 6).map((p) => (
                  <Link
                    key={p}
                    href={`/planning/${p}`}
                    className="inline-flex items-center gap-1 rounded-full bg-[#FBF6EC] px-3 py-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-800 hover:-translate-y-0.5 transition"
                    style={{ border: "1px solid rgba(139,69,19,0.10)" }}
                  >
                    {PLANNING_CONTENT[p].singular}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Price Index cross-link */}
        <section className="mt-6 rounded-2xl border-2 p-5 md:p-6" style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#FFFFFF" }}>
          <div className="grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: "#0A0A0A" }}>
              <TrendingUp size={20} strokeWidth={2.4} className="text-white"/>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                UK Trade Price Index · Updated monthly
              </p>
              <h3 className="mt-1 text-[16px] font-black text-neutral-900">
                Day rates, hourly rates, regional pricing
              </h3>
              <p className="mt-1 text-[12px] text-neutral-600">
                Live UK rates for 10 trades. Free to cite. Refreshed monthly.
              </p>
            </div>
            <Link
              href="/price-index"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-[11.5px] font-black uppercase tracking-wider text-white shadow-sm active:scale-[0.97]"
              style={{ backgroundColor: "#0A0A0A" }}
            >
              View Price Index
              <ArrowUpRight size={12} strokeWidth={2.6}/>
            </Link>
          </div>
        </section>

        {/* CTA — background image behind, dark scrim over so copy stays legible */}
        <section
          className="relative mt-12 overflow-hidden rounded-2xl border-2"
          style={{ borderColor: "#FFB300" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2020,%202026,%2006_50_23%20AM.png"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
          {/* Dark scrim + amber warmth so headline copy has AA-level contrast */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.30) 100%)" }}
          />
          <div className="relative grid gap-4 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: "#FFB300" }}>
                Faster route
              </p>
              <h3 className="mt-1 text-[20px] font-black leading-tight text-white md:text-[24px]">
                Post one job — reach every verified trade you need
              </h3>
              <p className="mt-2 text-[12.5px] text-neutral-100 md:text-[13.5px]">
                Free for homeowners. Trades message you directly on WhatsApp. No lead broker in the middle.
              </p>
            </div>
            <Link
              href="/sitebook"
              className="inline-flex h-12 items-center justify-center gap-1.5 rounded-lg px-6 text-[12.5px] font-black uppercase tracking-wider text-neutral-900 shadow-md active:scale-[0.97]"
              style={{ backgroundColor: "#FFB300" }}
            >
              Post your job free
              <ArrowUpRight size={14} strokeWidth={2.6}/>
            </Link>
          </div>
        </section>

        {/* Trust footer */}
        <footer className="mt-12 flex flex-wrap items-center gap-4 border-t pt-6 text-[11px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <span className="inline-flex items-center gap-1"><ShieldCheck size={12}/> Verified credentials</span>
          <span>Never charged a lead fee · No commission on completed jobs · Direct WhatsApp contact</span>
        </footer>
      </div>
    </main>
  );
}

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
