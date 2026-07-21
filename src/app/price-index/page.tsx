// /price-index — UK Trade Price Index.
//
// Data-authority page. Every construction cost query on Google
// ("uk plumber day rate", "electrician cost per hour", "how much has
// kitchen extension gone up") points at pages like this. Ranks
// because it's:
//   • Structured Dataset schema (Google Dataset Search)
//   • Evidence-first (every number attributed to source)
//   • Updated monthly (freshness signal)
//   • Comprehensive (10 trades × 10 cities × 5 projects)
//   • Media-citable (press-quote format)
//
// The moat: no competitor has the UK-wide live trade data feed. As
// The Networkers grows, more rows flip from industry benchmark to
// network live data — the moat compounds.

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, TrendingUp, TrendingDown, Minus, ShieldCheck, FileText, Calculator, Mail, Sparkles } from "lucide-react";
import { BRAND, absolute } from "@/lib/seo";
import {
  TRADE_ROWS, CITY_ROWS, PROJECT_MOVEMENTS, HEADLINE_STATS, METHODOLOGY_FAQS,
  REPORT_MONTH, REPORT_ISO, NEXT_REFRESH
} from "./config";
import { ResourcesBar } from "@/components/seo/ResourcesBar";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic  = "force-static";
export const revalidate = 86400;

export const metadata: Metadata = {
  title:       `UK Trade Price Index · ${REPORT_MONTH} — ${BRAND.name}`,
  description: `Live UK trade day rates, hourly rates, emergency callouts, and regional multipliers. Monthly index from The Networkers. Published ${REPORT_MONTH}. Free for public + press use with attribution.`,
  alternates:  { canonical: `/price-index` },
  openGraph:   {
    type:     "article",
    siteName: BRAND.name,
    title:    `UK Trade Price Index · ${REPORT_MONTH}`,
    description: `Verified UK trade day rates + regional pricing. Published monthly.`,
    url:      absolute(`/price-index`)
  },
  robots: { index: true, follow: true }
};

export default function PriceIndexPage() {
  // ─── JSON-LD ──────────────────────────────────────────────────
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "UK Trade Price Index", item: absolute("/price-index") }
    ]
  };
  // Dataset schema — surfaces in Google Dataset Search + AI-search
  // extraction as an authoritative pricing source.
  const datasetLd = {
    "@context":   "https://schema.org",
    "@type":      "Dataset",
    name:         "UK Trade Price Index",
    description:  `Monthly UK trade pricing dataset covering day rates, hourly rates, and regional multipliers for ${TRADE_ROWS.length} trades across ${CITY_ROWS.length} UK cities. Sourced from live network data + industry benchmarks (BCIS, Gas Safe Register, RICS, FMB).`,
    url:          absolute("/price-index"),
    keywords:     ["UK trade rates", "day rate", "hourly rate", "construction cost", "plumber cost", "electrician cost"],
    creator:      { "@type": "Organization", name: BRAND.name, url: absolute("/") },
    license:      "https://creativecommons.org/licenses/by/4.0/",
    dateModified: REPORT_ISO,
    temporalCoverage: `2025-08/${REPORT_ISO}`,
    spatialCoverage: "United Kingdom",
    variableMeasured: TRADE_ROWS.map((r) => `${r.displayName} day rate`)
  };
  // Article schema — treats each monthly index as a citable article
  const articleLd = {
    "@context":     "https://schema.org",
    "@type":        "Article",
    headline:       `UK Trade Price Index · ${REPORT_MONTH}`,
    datePublished:  REPORT_ISO,
    dateModified:   REPORT_ISO,
    author:         { "@type": "Organization", name: BRAND.name, url: absolute("/") },
    publisher:      { "@type": "Organization", name: BRAND.name, url: absolute("/") },
    mainEntityOfPage: absolute("/price-index"),
    articleSection: "UK Construction Data"
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type":    "FAQPage",
    mainEntity: METHODOLOGY_FAQS.map((f) => ({
      "@type": "Question",
      name:    f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a }
    }))
  };

  return (
    <main className="min-h-screen bg-[#FBF6EC]">
      <SeoSiteHeader/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}/>

      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-6 md:py-12">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumbs" className="mb-4 flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
          <Link href="/" className="hover:text-neutral-900">Home</Link>
          <span aria-hidden>/</span>
          <span className="font-black text-neutral-900">UK Trade Price Index</span>
        </nav>

        {/* Hero */}
        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
            Monthly data report · Free to cite with attribution
          </p>
          <h1 className="mt-1 text-[36px] font-black leading-tight text-neutral-900 md:text-[52px]">
            UK Trade Price Index
          </h1>
          <p className="mt-2 text-[13px] font-black text-neutral-500 uppercase tracking-wider">
            {REPORT_MONTH} edition
          </p>
          <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-neutral-600 md:text-[15px]">
            Live UK trade day rates, hourly rates, emergency callouts and regional multipliers.
            {" "}Aggregated from live network pricing + industry benchmarks (BCIS, Gas Safe Register, RICS 2026, FMB State of Trade).
          </p>
        </header>

        {/* Headline stats */}
        <section className="mt-8">
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {HEADLINE_STATS.map((s) => (
              <li key={s.label} className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">{s.label}</p>
                <p className="mt-1 text-[28px] font-black leading-none tabular-nums text-neutral-900">{s.value}</p>
                <div className="mt-2 flex items-center gap-1 text-[11px] font-black">
                  {s.deltaDirection === "up"   && <TrendingUp   size={11} className="text-red-700"/>}
                  {s.deltaDirection === "down" && <TrendingDown size={11} className="text-green-700"/>}
                  {s.deltaDirection === "flat" && <Minus        size={11} className="text-neutral-500"/>}
                  <span style={{ color: s.deltaDirection === "up" ? "#B91C1C" : s.deltaDirection === "down" ? "#166534" : "#525252" }}>
                    {s.delta}
                  </span>
                  <span className="text-neutral-400">· {s.note}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Trade rates table */}
        <section className="mt-12">
          <h2 className="text-[20px] font-black leading-tight text-neutral-900 md:text-[26px]">
            UK trade rates · {REPORT_MONTH}
          </h2>
          <p className="mt-1 text-[12px] text-neutral-500">
            Day rates + hourly rates + emergency callouts by trade. Source flag on every row.
          </p>
          <div className="mt-4 overflow-x-auto rounded-2xl border bg-white shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b bg-[#FBF6EC] text-left text-[10px] font-black uppercase tracking-[0.14em] text-neutral-600" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                  <th className="px-3 py-3">Trade</th>
                  <th className="px-3 py-3 text-right">Hourly</th>
                  <th className="px-3 py-3 text-right">Day rate</th>
                  <th className="px-3 py-3 text-right">London day rate</th>
                  <th className="px-3 py-3 text-right">Emergency callout</th>
                  <th className="px-3 py-3">Source</th>
                </tr>
              </thead>
              <tbody>
                {TRADE_ROWS.map((r) => (
                  <tr key={r.tradeSlug} className="border-b last:border-b-0" style={{ borderColor: "rgba(139,69,19,0.06)" }}>
                    <td className="px-3 py-3 font-black text-neutral-900">
                      <Link href={`/trades/${r.tradeSlug}`} className="hover:underline">
                        {r.displayName}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-neutral-700">£{r.hourlyLow}-£{r.hourlyHigh}/hr</td>
                    <td className="px-3 py-3 text-right tabular-nums text-neutral-700">£{r.dayRateLow}-£{r.dayRateHigh}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-neutral-700">£{r.londonDayRateLow}-£{r.londonDayRateHigh}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-neutral-700">£{r.emergencyCalloutLow}-£{r.emergencyCalloutHigh}</td>
                    <td className="px-3 py-3">
                      <SourceBadge source={r.source} sampleSize={r.sampleSize}/>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Regional multipliers */}
        <section className="mt-12">
          <h2 className="text-[20px] font-black leading-tight text-neutral-900 md:text-[26px]">
            Regional pricing · UK cities
          </h2>
          <p className="mt-1 text-[12px] text-neutral-500">
            Multiplier applied to national trade rates. London is the ceiling, North East + Wales are the floor.
          </p>
          <div className="mt-4 overflow-x-auto rounded-2xl border bg-white shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b bg-[#FBF6EC] text-left text-[10px] font-black uppercase tracking-[0.14em] text-neutral-600" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                  <th className="px-3 py-3">City</th>
                  <th className="px-3 py-3">Region</th>
                  <th className="px-3 py-3 text-right">Multiplier</th>
                  <th className="px-3 py-3 text-right">vs UK avg</th>
                </tr>
              </thead>
              <tbody>
                {CITY_ROWS.map((r) => {
                  const pct = Math.round((r.multiplier - 1) * 100);
                  return (
                    <tr key={r.citySlug} className="border-b last:border-b-0" style={{ borderColor: "rgba(139,69,19,0.06)" }}>
                      <td className="px-3 py-3 font-black text-neutral-900">
                        <Link href={`/trades/plumber/${r.citySlug}`} className="hover:underline">
                          {r.displayName}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-neutral-600">{r.region}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-neutral-700">{r.multiplier.toFixed(2)}×</td>
                      <td className="px-3 py-3 text-right">
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-black tabular-nums"
                          style={{
                            backgroundColor: pct === 0 ? "#F5F5F5" : pct > 0 ? "#FEE2E2" : "#DCFCE7",
                            color:           pct === 0 ? "#525252" : pct > 0 ? "#B91C1C" : "#166534"
                          }}
                        >
                          {pct > 0 ? "+" : ""}{pct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Project cost movements */}
        <section className="mt-12">
          <h2 className="text-[20px] font-black leading-tight text-neutral-900 md:text-[26px]">
            Project cost movements · 12 months
          </h2>
          <p className="mt-1 text-[12px] text-neutral-500">
            Year-on-year change for the UK's most common home improvement projects.
          </p>
          <div className="mt-4 overflow-x-auto rounded-2xl border bg-white shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b bg-[#FBF6EC] text-left text-[10px] font-black uppercase tracking-[0.14em] text-neutral-600" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                  <th className="px-3 py-3">Project</th>
                  <th className="px-3 py-3 text-right">Last year</th>
                  <th className="px-3 py-3 text-right">Current ({REPORT_MONTH})</th>
                  <th className="px-3 py-3 text-right">Change</th>
                  <th className="px-3 py-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {PROJECT_MOVEMENTS.map((r) => (
                  <tr key={r.projectSlug} className="border-b last:border-b-0" style={{ borderColor: "rgba(139,69,19,0.06)" }}>
                    <td className="px-3 py-3 font-black text-neutral-900">{r.displayName}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-neutral-500">£{fmt(r.lastYearLow)}-£{fmt(r.lastYearHigh)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-neutral-900">£{fmt(r.currentLow)}-£{fmt(r.currentHigh)}</td>
                    <td className="px-3 py-3 text-right">
                      <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10.5px] font-black tabular-nums" style={{ backgroundColor: r.pctChange >= 0 ? "#FEE2E2" : "#DCFCE7", color: r.pctChange >= 0 ? "#B91C1C" : "#166534" }}>
                        {r.pctChange >= 0 ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
                        {r.pctChange >= 0 ? "+" : ""}{r.pctChange}%
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/cost/${r.projectSlug}`}
                        className="inline-flex items-center gap-0.5 text-[10.5px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
                      >
                        Cost guide <ArrowUpRight size={10} strokeWidth={2.6}/>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Methodology + FAQs */}
        <section className="mt-12">
          <h2 className="text-[20px] font-black leading-tight text-neutral-900 md:text-[26px]">
            Methodology + sources
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Refresh cadence</p>
              <p className="mt-1 text-[14px] font-black text-neutral-900">Monthly</p>
              <p className="mt-1 text-[11px] text-neutral-500">Next: {NEXT_REFRESH}</p>
            </div>
            <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Trades tracked</p>
              <p className="mt-1 text-[14px] font-black text-neutral-900">{TRADE_ROWS.length} trades</p>
              <p className="mt-1 text-[11px] text-neutral-500">Expanding monthly</p>
            </div>
            <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Regional coverage</p>
              <p className="mt-1 text-[14px] font-black text-neutral-900">{CITY_ROWS.length} UK cities</p>
              <p className="mt-1 text-[11px] text-neutral-500">Scaling to 100+ Q4 2026</p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {METHODOLOGY_FAQS.map((f) => (
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

        {/* Press / citation */}
        <section className="mt-12 rounded-2xl border-2 p-6 md:p-8" style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#FFFFFF" }}>
          <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-start">
            <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: "#0A0A0A" }}>
              <FileText size={20} strokeWidth={2.4} className="text-white"/>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                Press + research
              </p>
              <h3 className="mt-1 text-[18px] font-black text-neutral-900">Free to cite with attribution</h3>
              <p className="mt-2 text-[13px] text-neutral-700">
                Preferred citation format:
              </p>
              <blockquote className="mt-2 rounded-lg border-l-4 bg-[#FBF6EC] p-3 text-[12.5px] italic text-neutral-700" style={{ borderLeftColor: "#FFB300" }}>
                "The UK Trade Price Index by {BRAND.name}, published {REPORT_MONTH}. Available at thenetworkers.app/price-index"
              </blockquote>
              <p className="mt-3 text-[12px] text-neutral-600">
                Journalists + researchers can request the underlying dataset:
              </p>
              <a
                href={`mailto:press@thenetworkers.app?subject=Price Index Dataset Request&body=Hi — I'd like to request the underlying UK Trade Price Index dataset for ${REPORT_MONTH}. Publication: [your publication]. Deadline: [your deadline].`}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11.5px] font-black uppercase tracking-wider text-white shadow-sm"
                style={{ backgroundColor: "#0A0A0A" }}
              >
                <Mail size={12} strokeWidth={2.6}/>
                Request dataset (press@)
              </a>
              <p className="mt-3 text-[10.5px] text-neutral-500">
                Data licensed under CC BY 4.0. Attribution + link back required.
              </p>
            </div>
          </div>
        </section>

        {/* Related tools */}
        <section className="mt-12">
          <h2 className="text-[13px] font-black uppercase tracking-[0.16em] text-neutral-500">
            Use this data in a calculator
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {PROJECT_MOVEMENTS.map((r) => (
              <li key={r.projectSlug}>
                <Link
                  href={`/cost/${r.projectSlug}`}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-black text-neutral-800 shadow-sm hover:-translate-y-0.5 transition"
                  style={{ border: "1px solid rgba(139,69,19,0.10)" }}
                >
                  <Calculator size={11}/> {r.displayName}
                  <ArrowUpRight size={11} strokeWidth={2.4}/>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Quote Checker cross-link — puts the data directly to work */}
        <section className="mt-8 rounded-2xl border-2 p-5 md:p-6" style={{ borderColor: "#FFB300", backgroundColor: "#FFFDF6" }}>
          <div className="grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: "#FFB300" }}>
              <Sparkles size={20} strokeWidth={2.4} className="text-neutral-900"/>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                Put this data to work
              </p>
              <h3 className="mt-1 text-[16px] font-black text-neutral-900">
                Free UK Trade Quote Checker
              </h3>
              <p className="mt-1 text-[12px] text-neutral-600">
                Paste any UK quote — get an instant fair / high / low verdict against this index.
              </p>
            </div>
            <Link
              href="/check-quote"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-[11.5px] font-black uppercase tracking-wider text-neutral-900 shadow-sm active:scale-[0.97]"
              style={{ backgroundColor: "#FFB300" }}
            >
              Check a quote
              <ArrowUpRight size={12} strokeWidth={2.6}/>
            </Link>
          </div>
        </section>

        {/* Grants cross-link */}
        <section className="mt-6 rounded-2xl border-2 p-5 md:p-6" style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#FFFFFF" }}>
          <div className="grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: "#166534" }}>
              <ShieldCheck size={20} strokeWidth={2.4} className="text-white"/>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                Combine pricing + funding
              </p>
              <h3 className="mt-1 text-[16px] font-black text-neutral-900">
                UK Home Improvement Grants Tracker
              </h3>
              <p className="mt-1 text-[12px] text-neutral-600">
                8 live UK schemes — boiler upgrade £7,500 · ECO4 full retrofit · HUG2 · 0% VAT.
              </p>
            </div>
            <Link
              href="/grants"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-[11.5px] font-black uppercase tracking-wider text-white shadow-sm active:scale-[0.97]"
              style={{ backgroundColor: "#166534" }}
            >
              View grants
              <ArrowUpRight size={12} strokeWidth={2.6}/>
            </Link>
          </div>
        </section>

        {/* Cross-pillar discovery bar */}
        <ResourcesBar active="price-index" className="mt-8"/>

        {/* Trust footer */}
        <footer className="mt-12 flex flex-wrap items-center gap-4 border-t pt-6 text-[11px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <span className="inline-flex items-center gap-1"><ShieldCheck size={12}/> Evidence-first — every number attributed</span>
          <span>Next refresh: {NEXT_REFRESH} · Licensed CC BY 4.0</span>
        </footer>
      </div>
    </main>
  );
}

function SourceBadge({ source, sampleSize }: { source: "network-live" | "industry-2026"; sampleSize?: number }) {
  if (source === "network-live") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-green-800">
        <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-green-600 animate-pulse"/>
        Network live · {sampleSize ?? "?"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-neutral-600">
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-400"/>
      Industry 2026
    </span>
  );
}

function fmt(n: number): string { return n.toLocaleString("en-GB"); }
