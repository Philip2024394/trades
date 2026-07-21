// /cost/[project]/[city] — city-specific cost calculator pages.
//
// 5 projects × 10 cities = 50 static pages generated. Each applies
// CITY_MULTIPLIER to the project's national cost tiers so numbers
// reflect regional reality: London +35%, North East -10%, etc.
//
// Every other section (body, regs, FAQs, materials/labour) inherits
// from the national /cost/[project] page — no duplicate authoring.
// This is the SEO template payoff — one config change = 10 new pages.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Calculator, Clock, Info } from "lucide-react";
import { BRAND, absolute } from "@/lib/seo";
import {
  PROJECTS, PROJECT_CONTENT, CITY_MULTIPLIER,
  isValidProject,
  type ProjectSlug
} from "../config";
import {
  CITIES, CITY_CONTENT,
  isValidCity,
  type CitySlug
} from "@/app/trades/[trade]/[city]/config";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic  = "force-static";
export const revalidate = 86400;

export async function generateStaticParams() {
  return PROJECTS.flatMap((project) => CITIES.map((city) => ({ project, city })));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ project: string; city: string }>;
}): Promise<Metadata> {
  const { project, city } = await params;
  if (!isValidProject(project) || !isValidCity(city)) return { title: "Not found" };
  const p = PROJECT_CONTENT[project];
  const c = CITY_CONTENT[city];
  const title = `${p.headline.replace(/\?$/, "")} in ${c.displayName}? UK 2026 Costs — ${BRAND.name}`;
  const description = adjustAiAnswer(p.aiAnswer, city, CITY_MULTIPLIER[city] ?? 1) +
    ` Local ${c.displayName} pricing based on 2026 UK data.`;
  return {
    title,
    description,
    alternates: { canonical: `/cost/${project}/${city}` },
    openGraph: {
      type:     "website",
      siteName: BRAND.name,
      title,
      description,
      url:      absolute(`/cost/${project}/${city}`)
    },
    robots: { index: true, follow: true }
  };
}

export default async function ProjectCostByCityPage({
  params
}: {
  params: Promise<{ project: string; city: string }>;
}) {
  const { project, city } = await params;
  if (!isValidProject(project) || !isValidCity(city)) notFound();
  const p    = PROJECT_CONTENT[project];
  const c    = CITY_CONTENT[city];
  const mult = CITY_MULTIPLIER[city] ?? 1;

  // Apply regional multiplier to every tier
  const adjustedSizes = p.sizes.map((s) => ({
    ...s,
    lowGbp:  Math.round((s.lowGbp * mult) / 100) * 100,
    highGbp: Math.round((s.highGbp * mult) / 100) * 100
  }));
  const totalLow  = Math.min(...adjustedSizes.map((s) => s.lowGbp));
  const totalHigh = Math.max(...adjustedSizes.map((s) => s.highGbp));

  // Multiplier label for the trust-signal banner
  const multPct = Math.round((mult - 1) * 100);
  const multLabel = multPct === 0
    ? "at UK national average"
    : multPct > 0
      ? `${multPct}% above UK average`
      : `${Math.abs(multPct)}% below UK average`;

  // JSON-LD
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Costs",         item: absolute("/cost") },
      { "@type": "ListItem", position: 2, name: cap(p.singular), item: absolute(`/cost/${project}`) },
      { "@type": "ListItem", position: 3, name: c.displayName,   item: absolute(`/cost/${project}/${city}`) }
    ]
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type":    "FAQPage",
    mainEntity: p.faqs.map((f) => ({
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
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumbs" className="mb-4 flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
          <Link href="/cost" className="hover:text-neutral-900">Costs</Link>
          <span aria-hidden>/</span>
          <Link href={`/cost/${project}`} className="hover:text-neutral-900">{cap(p.singular)}</Link>
          <span aria-hidden>/</span>
          <span className="font-black text-neutral-900">{c.displayName}</span>
        </nav>

        {/* Hero */}
        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
            Cost guide · {c.displayName} · {c.region}
          </p>
          <h1 className="mt-1 text-[32px] font-black leading-tight text-neutral-900 md:text-[44px]">
            {p.headline.replace(/\?$/, "")} in {c.displayName}?
          </h1>
          <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-neutral-600 md:text-[15px]">
            {adjustAiAnswer(p.aiAnswer, city, mult)}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] font-black shadow-sm" style={{ border: "1px solid rgba(139,69,19,0.10)" }}>
              <Calculator size={12}/>
              {c.displayName} range: <span className="tabular-nums text-neutral-900">£{fmt(totalLow)} - £{fmt(totalHigh)}</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10.5px] font-black uppercase tracking-wider" style={{ backgroundColor: multPct === 0 ? "#F5F5F5" : multPct > 0 ? "#FEE2E2" : "#DCFCE7", color: multPct === 0 ? "#525252" : multPct > 0 ? "#B91C1C" : "#166534" }}>
              {multLabel}
            </span>
          </div>
        </header>

        {/* Cost tiers (city-adjusted) */}
        <section className="mt-10">
          <h2 className="text-[16px] font-black text-neutral-900 md:text-[20px]">
            {cap(p.singular)} costs in {c.displayName}
          </h2>
          <ul className={`mt-4 grid grid-cols-1 gap-3 ${adjustedSizes.length === 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3"}`}>
            {adjustedSizes.map((s) => (
              <li key={s.slug} className="rounded-2xl border bg-white p-4" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">{s.label}</p>
                <p className="mt-1 text-[24px] font-black leading-none tabular-nums text-neutral-900">
                  £{fmt(s.lowGbp)}<span className="text-neutral-500"> - </span>£{fmt(s.highGbp)}
                </p>
                <p className="mt-2 text-[11.5px] leading-snug text-neutral-600">{s.scope}</p>
                <p className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-bold text-neutral-500">
                  <Clock size={11}/> {s.weeksLow}-{s.weeksHigh} weeks
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[10.5px] text-neutral-500">
            Prices adjusted from UK national average by regional multiplier for {c.displayName} ({multLabel}). Actual quotes vary — post your job for firm pricing.
          </p>
        </section>

        {/* Materials vs Labour split */}
        <section className="mt-10 rounded-2xl border bg-white p-5" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <h2 className="text-[13px] font-black uppercase tracking-[0.16em] text-neutral-500">
            Where the money goes
          </h2>
          <div className="mt-3 flex overflow-hidden rounded-lg border" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
            <div className="flex items-center justify-center py-2 text-[11px] font-black text-white" style={{ width: `${p.materialsPct}%`, backgroundColor: "#B8860B" }}>
              Materials · {p.materialsPct}%
            </div>
            <div className="flex items-center justify-center py-2 text-[11px] font-black text-white" style={{ width: `${p.labourPct}%`, backgroundColor: "#166534" }}>
              Labour · {p.labourPct}%
            </div>
          </div>
        </section>

        {/* Body */}
        <section className="mt-10">
          <h2 className="text-[16px] font-black text-neutral-900 md:text-[18px]">
            What's included in the cost
          </h2>
          <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-neutral-700">
            {p.bodyIntro}
          </p>
        </section>

        {/* Planning / Regs */}
        <section className="mt-10 rounded-2xl border-l-4 bg-white p-5" style={{ borderLeftColor: "#FFB300", border: "1px solid rgba(139,69,19,0.10)", borderLeftWidth: "4px" }}>
          <h2 className="inline-flex items-center gap-1.5 text-[13px] font-black uppercase tracking-[0.16em] text-neutral-500">
            <Info size={13}/> Planning + Building Regs
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-neutral-700">
            {p.regsNote}
          </p>
        </section>

        {/* FAQs */}
        <section className="mt-10">
          <h2 className="text-[16px] font-black text-neutral-900 md:text-[18px]">
            {cap(p.singular)} FAQs
          </h2>
          <div className="mt-4 space-y-3">
            {p.faqs.map((f) => (
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

        {/* Trades needed in this city — deep cross-linking */}
        <section className="mt-10">
          <h2 className="text-[13px] font-black uppercase tracking-[0.16em] text-neutral-500">
            {cap(p.singular)} trades in {c.displayName}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {p.relatedTrades.map((r) => (
              <li key={r}>
                <Link
                  href={`/trades/${r}/${city}`}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-black text-neutral-800 shadow-sm hover:-translate-y-0.5 transition"
                  style={{ border: "1px solid rgba(139,69,19,0.10)" }}
                >
                  Find {plural(r)} in {c.displayName}
                  <ArrowUpRight size={11} strokeWidth={2.4}/>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Compare with other cities */}
        <section className="mt-10">
          <h2 className="text-[13px] font-black uppercase tracking-[0.16em] text-neutral-500">
            Compare {p.singular} costs in other cities
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {CITIES.filter((cc) => cc !== city).map((cc) => (
              <li key={cc}>
                <Link
                  href={`/cost/${project}/${cc}`}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-black text-neutral-800 shadow-sm hover:-translate-y-0.5 transition"
                  style={{ border: "1px solid rgba(139,69,19,0.10)" }}
                >
                  {CITY_CONTENT[cc].displayName}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <section className="mt-12 rounded-2xl border-2 p-6 md:p-8" style={{ borderColor: "#FFB300", backgroundColor: "#FFFDF6" }}>
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                Get exact {c.displayName} quotes
              </p>
              <h3 className="mt-1 text-[20px] font-black leading-tight text-neutral-900 md:text-[24px]">
                Post one job — reach every verified trade in {c.displayName}
              </h3>
              <p className="mt-2 text-[12.5px] text-neutral-600 md:text-[13.5px]">
                No lead broker. No commission. Free for homeowners.
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
      </div>
    </main>
  );
}

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
function fmt(n: number): string { return n.toLocaleString("en-GB"); }
function plural(t: string): string {
  if (t.endsWith("er"))     return t + "s";
  if (t.endsWith("ician"))  return t + "s";
  if (t.endsWith("smith"))  return t + "s";
  if (t.endsWith("man"))    return t.slice(0, -3) + "men";
  return t + "s";
}
function adjustAiAnswer(base: string, _city: string, mult: number): string {
  // Very light adjustment — preserves the base sentence but appends
  // a city context so the meta description isn't identical across
  // 10 city variants (Google penalises duplicate meta).
  const pct = Math.round((mult - 1) * 100);
  if (pct === 0) return base;
  const dir = pct > 0 ? "above" : "below";
  return `${base} Costs in ${_city} typically run ~${Math.abs(pct)}% ${dir} UK national average.`;
}
