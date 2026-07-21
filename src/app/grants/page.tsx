// /grants — UK Home Improvement Grants + Schemes Tracker.
//
// Phase 2 SEO data-authority surface (second after /price-index).
// Same discipline: every scheme attributed to its operating body,
// monthly refresh, "last verified" date shown per row.
//
// Search intent this page satisfies:
//   • "boiler grant UK 2026"
//   • "ECO4 eligibility"
//   • "great british insulation scheme"
//   • "home upgrade grant"
//   • "heat pump grant UK"
//   • "insulation grant UK"
//   • "0% VAT heat pump"
//
// Cross-benefits: trades on the platform can filter by
// worksWithTrades[] — a plumber landing here sees exactly which
// grants they can install under.

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight, TrendingUp, ShieldCheck, MapPin, ExternalLink,
  CircleCheck, CircleAlert, CircleX, Mail, Calculator, FileText, HelpCircle
} from "lucide-react";
import { BRAND, absolute } from "@/lib/seo";
import { SCHEMES, FAQS, REPORT_MONTH, REPORT_ISO, NEXT_REFRESH } from "./config";
import { ResourcesBar } from "@/components/seo/ResourcesBar";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic  = "force-static";
export const revalidate = 86400;

export const metadata: Metadata = {
  title:       `UK Home Improvement Grants ${REPORT_MONTH} — ${BRAND.name}`,
  description: `Live UK grant + scheme tracker for boiler upgrade, heat pump, insulation, ECO4, HUG2, Warmer Homes Scotland, Nest Wales, 0% VAT. Verified monthly. Free to cite.`,
  alternates:  { canonical: `/grants` },
  openGraph:   {
    type:     "article",
    siteName: BRAND.name,
    title:    `UK Home Improvement Grants ${REPORT_MONTH}`,
    description: `Every live UK grant + scheme for boilers, heat pumps, insulation. Updated monthly.`,
    url:      absolute(`/grants`)
  },
  robots: { index: true, follow: true }
};

export default function GrantsPage() {
  const openCount     = SCHEMES.filter((s) => s.status === "open").length;
  const closingCount  = SCHEMES.filter((s) => s.status === "closing-soon").length;

  // ─── JSON-LD ──────────────────────────────────────────────────
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "UK Grants Tracker", item: absolute("/grants") }
    ]
  };
  // Dataset schema — surfaces in Google Dataset Search
  const datasetLd = {
    "@context":       "https://schema.org",
    "@type":          "Dataset",
    name:             "UK Home Improvement Grants Tracker",
    description:      `Monthly-verified tracker of ${SCHEMES.length} UK government + Ofgem-administered home improvement grants covering boilers, heat pumps, insulation, and energy-efficiency measures.`,
    url:              absolute("/grants"),
    keywords:         ["UK grants", "ECO4", "boiler upgrade scheme", "insulation grant", "heat pump grant", "HUG2", "Nest Wales", "Warmer Homes Scotland"],
    creator:          { "@type": "Organization", name: BRAND.name, url: absolute("/") },
    license:          "https://creativecommons.org/licenses/by/4.0/",
    dateModified:     REPORT_ISO,
    spatialCoverage:  "United Kingdom",
    variableMeasured: SCHEMES.map((s) => s.displayName)
  };
  // ItemList schema — helps Google render this as a listicle
  const itemListLd = {
    "@context":       "https://schema.org",
    "@type":          "ItemList",
    numberOfItems:    SCHEMES.length,
    itemListElement:  SCHEMES.map((s, i) => ({
      "@type":    "ListItem",
      position:   i + 1,
      name:       s.displayName,
      url:        `${absolute("/grants")}#${s.slug}`
    }))
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type":    "FAQPage",
    mainEntity: FAQS.map((f) => ({
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}/>

      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-6 md:py-12">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumbs" className="mb-4 flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
          <Link href="/" className="hover:text-neutral-900">Home</Link>
          <span aria-hidden>/</span>
          <span className="font-black text-neutral-900">UK Grants Tracker</span>
        </nav>

        {/* Hero */}
        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
            Monthly data report · Verified {REPORT_MONTH}
          </p>
          <h1 className="mt-1 text-[36px] font-black leading-tight text-neutral-900 md:text-[52px]">
            UK Home Improvement Grants
          </h1>
          <p className="mt-2 text-[13px] font-black text-neutral-500 uppercase tracking-wider">
            {REPORT_MONTH} · {SCHEMES.length} schemes tracked
          </p>
          <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-neutral-600 md:text-[15px]">
            Live UK government + Ofgem-administered grants for boilers, heat pumps, insulation, and energy efficiency. Every scheme
            {" "}<strong className="text-neutral-900">verified this month</strong>, linked to source, updated monthly.
          </p>
        </header>

        {/* Headline stats */}
        <section className="mt-8">
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Schemes open"        value={String(openCount)}          note="Live + accepting applications" tone="ok"/>
            <StatCard label="Closing soon"        value={String(closingCount)}       note="Apply now" tone="warn"/>
            <StatCard label="Max funded package"  value="£38,000"                     note="HUG2 whole-house retrofit" tone="dark"/>
            <StatCard label="Automatic saving"    value="20% VAT"                     note="On qualifying installs (0% ESM)" tone="dark"/>
          </ul>
        </section>

        {/* Quick jump nav */}
        <section className="mt-8">
          <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Jump to a scheme</h2>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {SCHEMES.map((s) => (
              <li key={s.slug}>
                <a
                  href={`#${s.slug}`}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[11px] font-black text-neutral-800 shadow-sm hover:-translate-y-0.5 transition"
                  style={{ border: "1px solid rgba(139,69,19,0.10)" }}
                >
                  <StatusDot status={s.status}/>
                  {s.shortName}
                </a>
              </li>
            ))}
          </ul>
        </section>

        {/* Scheme cards */}
        <section className="mt-10 space-y-5">
          {SCHEMES.map((s) => (
            <article
              key={s.slug}
              id={s.slug}
              className="scroll-mt-24 rounded-2xl border-2 bg-white p-5 md:p-6 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.10)" }}
            >
              {/* header */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[20px] font-black leading-tight text-neutral-900 md:text-[24px]">
                      {s.displayName}
                    </h3>
                    <StatusBadge status={s.status}/>
                  </div>
                  <p className="mt-1.5 flex flex-wrap items-center gap-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
                    <span className="inline-flex items-center gap-1"><MapPin size={11}/>{s.region.map(regionLabel).join(" · ")}</span>
                    <span>·</span>
                    <span>{s.operatingBody}</span>
                    <span>·</span>
                    <span>Last verified {new Date(s.lastVerified).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Amount</p>
                  <p className="text-[24px] font-black tabular-nums text-neutral-900">
                    {s.amountHigh === 0
                      ? "0% VAT"
                      : s.amountLow === 0
                        ? `Up to £${s.amountHigh.toLocaleString("en-GB")}`
                        : `£${s.amountLow.toLocaleString("en-GB")}-£${s.amountHigh.toLocaleString("en-GB")}`}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-[13px] leading-relaxed text-neutral-700">
                {s.amountNote}
              </p>

              {/* covers */}
              <div className="mt-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Covers</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {s.covers.map((c) => (
                    <li
                      key={c}
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-black text-neutral-700"
                      style={{ backgroundColor: "#FBF6EC", border: "1px solid rgba(139,69,19,0.10)" }}
                    >
                      {c}
                    </li>
                  ))}
                </ul>
              </div>

              {/* eligibility */}
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Eligibility</p>
                  <p className="mt-1.5 text-[12.5px] text-neutral-700">{s.eligibilitySummary}</p>
                  <ul className="mt-2 space-y-1 text-[12px] text-neutral-700">
                    {s.eligibilityCriteria.map((c, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <CircleCheck size={12} strokeWidth={2.4} className="mt-0.5 shrink-0 text-green-700"/>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">How to apply</p>
                  <ol className="mt-1.5 space-y-1.5 text-[12px] text-neutral-700">
                    {s.howToApply.map((step, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span
                          className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9.5px] font-black text-white"
                          style={{ backgroundColor: "#0A0A0A" }}
                        >
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* footer */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: "rgba(139,69,19,0.08)" }}>
                <a
                  href={s.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11.5px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
                >
                  <ExternalLink size={11} strokeWidth={2.4}/>
                  Source: {s.sourceLabel}
                </a>
                {s.worksWithTrades.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Find installer:</span>
                    {s.worksWithTrades.slice(0, 3).map((trade) => (
                      <Link
                        key={trade}
                        href={`/trades/${trade}`}
                        className="inline-flex items-center gap-0.5 rounded-full bg-neutral-900 px-2.5 py-0.5 text-[10.5px] font-black uppercase tracking-wider text-white hover:opacity-90"
                      >
                        {trade.replace(/-/g, " ")}
                        <ArrowUpRight size={10} strokeWidth={2.6}/>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
        </section>

        {/* FAQ */}
        <section className="mt-12">
          <h2 className="text-[20px] font-black leading-tight text-neutral-900 md:text-[26px]">
            Questions + methodology
          </h2>
          <div className="mt-4 space-y-3">
            {FAQS.map((f) => (
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

        {/* Press citation */}
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
              <blockquote className="mt-2 rounded-lg border-l-4 bg-[#FBF6EC] p-3 text-[12.5px] italic text-neutral-700" style={{ borderLeftColor: "#FFB300" }}>
                "UK Home Improvement Grants Tracker by {BRAND.name}, published {REPORT_MONTH}. Available at thenetworkers.app/grants"
              </blockquote>
              <a
                href={`mailto:press@thenetworkers.app?subject=Grants Tracker Dataset Request&body=Hi — I'd like to request the underlying UK Grants Tracker dataset for ${REPORT_MONTH}. Publication: [your publication]. Deadline: [your deadline].`}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11.5px] font-black uppercase tracking-wider text-white shadow-sm"
                style={{ backgroundColor: "#0A0A0A" }}
              >
                <Mail size={12} strokeWidth={2.6}/>
                Request dataset
              </a>
              <p className="mt-3 text-[10.5px] text-neutral-500">
                Data licensed CC BY 4.0 · Next refresh: {NEXT_REFRESH}
              </p>
            </div>
          </div>
        </section>

        {/* Cross-sell tools */}
        <section className="mt-6 grid gap-3 md:grid-cols-4">
          <Link
            href="/price-index"
            className="rounded-2xl border-2 bg-white p-4 shadow-sm hover:-translate-y-1 transition"
            style={{ borderColor: "rgba(139,69,19,0.10)" }}
          >
            <div className="flex items-center gap-2">
              <TrendingUp size={14} strokeWidth={2.6} className="text-neutral-900"/>
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Price data</span>
            </div>
            <p className="mt-2 text-[14px] font-black text-neutral-900">UK Trade Price Index →</p>
            <p className="mt-1 text-[11.5px] text-neutral-600">Day rates + regional pricing</p>
          </Link>
          <Link
            href="/cost/new-boiler"
            className="rounded-2xl border-2 bg-white p-4 shadow-sm hover:-translate-y-1 transition"
            style={{ borderColor: "rgba(139,69,19,0.10)" }}
          >
            <div className="flex items-center gap-2">
              <Calculator size={14} strokeWidth={2.6} className="text-neutral-900"/>
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Calculators</span>
            </div>
            <p className="mt-2 text-[14px] font-black text-neutral-900">Cost of a new boiler →</p>
            <p className="mt-1 text-[11.5px] text-neutral-600">£1,650-£2,500 typical UK 2026</p>
          </Link>
          <Link
            href="/trades"
            className="rounded-2xl border-2 bg-white p-4 shadow-sm hover:-translate-y-1 transition"
            style={{ borderColor: "rgba(139,69,19,0.10)" }}
          >
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} strokeWidth={2.6} className="text-neutral-900"/>
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Directory</span>
            </div>
            <p className="mt-2 text-[14px] font-black text-neutral-900">Find a verified trade →</p>
            <p className="mt-1 text-[11.5px] text-neutral-600">UK trades. Direct WhatsApp.</p>
          </Link>
          <Link
            href="/answers"
            className="rounded-2xl border-2 bg-white p-4 shadow-sm hover:-translate-y-1 transition"
            style={{ borderColor: "rgba(139,69,19,0.10)" }}
          >
            <div className="flex items-center gap-2">
              <HelpCircle size={14} strokeWidth={2.6} className="text-neutral-900"/>
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Q&amp;A</span>
            </div>
            <p className="mt-2 text-[14px] font-black text-neutral-900">Trade Q&amp;A hub →</p>
            <p className="mt-1 text-[11.5px] text-neutral-600">Straight answers, evidence-first</p>
          </Link>
        </section>

        {/* Cross-pillar discovery bar */}
        <ResourcesBar active="grants" className="mt-8"/>

        {/* Trust footer */}
        <footer className="mt-12 flex flex-wrap items-center gap-4 border-t pt-6 text-[11px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <span className="inline-flex items-center gap-1"><ShieldCheck size={12}/> Evidence-first — every scheme linked to source</span>
          <span>Not affiliated with any scheme operator · Not financial advice</span>
        </footer>
      </div>
    </main>
  );
}

function StatCard({ label, value, note, tone }: { label: string; value: string; note: string; tone: "ok" | "warn" | "dark" }) {
  const bg = tone === "ok" ? "#DCFCE7" : tone === "warn" ? "#FEF3C7" : "#FFFFFF";
  const fg = tone === "ok" ? "#166534" : tone === "warn" ? "#92400E" : "#0A0A0A";
  return (
    <li className="rounded-2xl border p-5 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: bg }}>
      <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: fg, opacity: 0.7 }}>{label}</p>
      <p className="mt-1 text-[28px] font-black leading-none tabular-nums" style={{ color: fg }}>{value}</p>
      <p className="mt-2 text-[11px]" style={{ color: fg, opacity: 0.75 }}>{note}</p>
    </li>
  );
}

function StatusBadge({ status }: { status: "open" | "closing-soon" | "closed" | "opening-soon" }) {
  const map = {
    "open":          { bg: "#DCFCE7", fg: "#166534", label: "Open", Icon: CircleCheck },
    "closing-soon":  { bg: "#FEF3C7", fg: "#92400E", label: "Closing soon", Icon: CircleAlert },
    "closed":        { bg: "#F5F5F5", fg: "#525252", label: "Closed", Icon: CircleX },
    "opening-soon":  { bg: "#DBEAFE", fg: "#1E40AF", label: "Opening soon", Icon: CircleAlert }
  } as const;
  const { bg, fg, label, Icon } = map[status];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-black uppercase tracking-wider" style={{ backgroundColor: bg, color: fg }}>
      <Icon size={11} strokeWidth={2.6}/>
      {label}
    </span>
  );
}

function StatusDot({ status }: { status: "open" | "closing-soon" | "closed" | "opening-soon" }) {
  const color = status === "open" ? "#16A34A" : status === "closing-soon" ? "#F59E0B" : status === "opening-soon" ? "#2563EB" : "#A3A3A3";
  return <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }}/>;
}

function regionLabel(r: string): string {
  return r === "uk" ? "UK-wide"
       : r === "england" ? "England"
       : r === "scotland" ? "Scotland"
       : r === "wales" ? "Wales"
       : r === "n-ireland" ? "N. Ireland"
       : r;
}
