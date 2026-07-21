// /cost/[project] — programmatic cost calculator pages.
//
// Phase 1 seed: 5 UK construction projects. Each page delivers:
//   • Trade-authored expert answer (AI-search snippet-tuned)
//   • 3-4 cost tier tiles with typical duration
//   • Materials vs Labour split
//   • Planning / Building Regs guidance
//   • 6 FAQs (mirror the FAQPage schema)
//   • Trades-needed cross-links (drives traffic INTO /find pages)
//   • Related project cross-links (internal linking graph)
//   • Rich schema: FAQPage + BreadcrumbList
//
// City variants live at /cost/[project]/[city] — applies a regional
// multiplier from CITY_MULTIPLIER to every cost tier.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Calculator, Clock, MapPin, Info } from "lucide-react";
import { BRAND, absolute } from "@/lib/seo";
import { pickHeroForTrade } from "@/lib/heroLibrary";
import {
  PROJECTS, PROJECT_CONTENT,
  isValidProject,
  type ProjectSlug
} from "./config";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic  = "force-static";
export const revalidate = 86400;   // ISR: refresh daily

export async function generateStaticParams() {
  return PROJECTS.map((project) => ({ project }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ project: string }>;
}): Promise<Metadata> {
  const { project } = await params;
  if (!isValidProject(project)) return { title: "Not found" };
  const c = PROJECT_CONTENT[project];
  const title = `${c.headline} · UK 2026 Costs — ${BRAND.name}`;
  const description = c.aiAnswer;
  return {
    title,
    description,
    alternates: { canonical: `/cost/${project}` },
    openGraph: {
      type:     "website",
      siteName: BRAND.name,
      title,
      description,
      url:      absolute(`/cost/${project}`)
    },
    robots: { index: true, follow: true }
  };
}

export default async function ProjectCostPage({
  params
}: {
  params: Promise<{ project: string }>;
}) {
  const { project } = await params;
  if (!isValidProject(project)) notFound();
  const c = PROJECT_CONTENT[project];
  // Pick a hero image from the library — map project → dominant trade
  // (e.g. kitchen-extension → carpenter). Cost pages get a visual anchor.
  const heroTradeMap: Record<ProjectSlug, string> = {
    "kitchen-extension": "carpenter",
    "loft-conversion":   "carpenter",
    "bathroom-refit":    "plumber",
    "house-rewire":      "electrician",
    "new-boiler":        "plumber"
  };
  // Per-project heroOverride wins over the trade-based hero library
  // lookup — lets us pin an authored cover per project when we have one.
  const hero = c.heroOverride
    ? {
        image_url:  c.heroOverride.imageUrl,
        subject:    c.heroOverride.subject,
        width_px:   c.heroOverride.widthPx,
        height_px:  c.heroOverride.heightPx
      }
    : pickHeroForTrade(heroTradeMap[project]);

  // JSON-LD
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Costs",     item: absolute("/cost") },
      { "@type": "ListItem", position: 2, name: cap(c.singular), item: absolute(`/cost/${project}`) }
    ]
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type":    "FAQPage",
    mainEntity: c.faqs.map((f) => ({
      "@type": "Question",
      name:    f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a }
    }))
  };

  // Aggregate cost range for the schema headline
  const totalLow  = Math.min(...c.sizes.map((s) => s.lowGbp));
  const totalHigh = Math.max(...c.sizes.map((s) => s.highGbp));

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
          <span className="font-black text-neutral-900">{cap(c.singular)}</span>
        </nav>

        {/* Hero — image + copy split */}
        <header className={hero ? "grid gap-6 md:grid-cols-[1fr_minmax(280px,400px)] md:items-center" : ""}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
              Cost guide · UK 2026
            </p>
            <h1 className="mt-1 text-[32px] font-black leading-tight text-neutral-900 md:text-[44px]">
              {c.headline}
            </h1>
            <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-neutral-600 md:text-[15px]">
              {c.aiAnswer}
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] font-black shadow-sm" style={{ border: "1px solid rgba(139,69,19,0.10)" }}>
              <Calculator size={12}/>
              Typical range: <span className="tabular-nums text-neutral-900">£{fmt(totalLow)} - £{fmt(totalHigh)}</span>
            </div>
          </div>
          {hero && (
            <div className="relative w-full overflow-hidden rounded-2xl shadow-md" style={{ backgroundColor: "#F0EDE8" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hero.image_url}
                alt={`${c.singular} — ${hero.subject}`}
                loading="eager"
                width={hero.width_px ?? 1200}
                height={hero.height_px ?? 900}
                className="h-auto w-full object-contain"
              />
            </div>
          )}
        </header>

        {/* Cost tiers */}
        <section className="mt-10">
          <h2 className="text-[16px] font-black text-neutral-900 md:text-[20px]">
            {cap(c.singular)} cost breakdown
          </h2>
          <ul className={`mt-4 grid grid-cols-1 gap-3 ${c.sizes.length === 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3"}`}>
            {c.sizes.map((s) => (
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
        </section>

        {/* Materials vs Labour split */}
        <section className="mt-10 rounded-2xl border bg-white p-5" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <h2 className="text-[13px] font-black uppercase tracking-[0.16em] text-neutral-500">
            Where the money goes
          </h2>
          <div className="mt-3 flex overflow-hidden rounded-lg border" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
            <div className="flex items-center justify-center py-2 text-[11px] font-black text-white" style={{ width: `${c.materialsPct}%`, backgroundColor: "#B8860B" }}>
              Materials · {c.materialsPct}%
            </div>
            <div className="flex items-center justify-center py-2 text-[11px] font-black text-white" style={{ width: `${c.labourPct}%`, backgroundColor: "#166534" }}>
              Labour · {c.labourPct}%
            </div>
          </div>
          <p className="mt-2 text-[10.5px] text-neutral-500">
            Split is typical for UK 2026. Actual varies by project — heritage buildings + bespoke finishes push materials %; extensive alterations push labour %.
          </p>
        </section>

        {/* Body */}
        <section className="mt-10">
          <h2 className="text-[16px] font-black text-neutral-900 md:text-[18px]">
            What's included in the cost
          </h2>
          <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-neutral-700">
            {c.bodyIntro}
          </p>
        </section>

        {/* Planning / Regs */}
        <section className="mt-10 rounded-2xl border-l-4 bg-white p-5" style={{ borderLeftColor: "#FFB300", border: "1px solid rgba(139,69,19,0.10)", borderLeftWidth: "4px" }}>
          <h2 className="inline-flex items-center gap-1.5 text-[13px] font-black uppercase tracking-[0.16em] text-neutral-500">
            <Info size={13}/> Planning + Building Regs
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-neutral-700">
            {c.regsNote}
          </p>
        </section>

        {/* FAQs */}
        <section className="mt-10">
          <h2 className="text-[16px] font-black text-neutral-900 md:text-[18px]">
            {cap(c.singular)} FAQs
          </h2>
          <div className="mt-4 space-y-3">
            {c.faqs.map((f) => (
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

        {/* Trades needed cross-links */}
        <section className="mt-10">
          <h2 className="text-[13px] font-black uppercase tracking-[0.16em] text-neutral-500">
            Trades you'll need
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {c.relatedTrades.map((r) => (
              <li key={r}>
                <Link
                  href={`/trades/${r}`}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-black text-neutral-800 shadow-sm hover:-translate-y-0.5 transition"
                  style={{ border: "1px solid rgba(139,69,19,0.10)" }}
                >
                  Find {r === r ? plural(r) : r}
                  <ArrowUpRight size={11} strokeWidth={2.4}/>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Related projects cross-links */}
        <section className="mt-10">
          <h2 className="text-[13px] font-black uppercase tracking-[0.16em] text-neutral-500">
            Other UK 2026 cost guides
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {PROJECTS.filter((p) => p !== project).map((p) => (
              <li key={p}>
                <Link
                  href={`/cost/${p}`}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-black text-neutral-800 shadow-sm hover:-translate-y-0.5 transition"
                  style={{ border: "1px solid rgba(139,69,19,0.10)" }}
                >
                  {PROJECT_CONTENT[p].headline.replace(/^How much does a?n? |cost\?$/g, "")}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* City variants — internal linking to /cost/[project]/[city] */}
        <section className="mt-10">
          <h2 className="text-[13px] font-black uppercase tracking-[0.16em] text-neutral-500">
            <MapPin size={12} className="mb-0.5 inline"/> {cap(c.singular)} costs by city
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {["london", "manchester", "birmingham", "leeds", "bristol", "glasgow", "edinburgh", "liverpool", "sheffield", "newcastle"].map((city) => (
              <li key={city}>
                <Link
                  href={`/cost/${project}/${city}`}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-black text-neutral-800 shadow-sm hover:-translate-y-0.5 transition"
                  style={{ border: "1px solid rgba(139,69,19,0.10)" }}
                >
                  {cap(city)}
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
                Get exact quotes
              </p>
              <h3 className="mt-1 text-[20px] font-black leading-tight text-neutral-900 md:text-[24px]">
                Post one job — reach every verified trade you need
              </h3>
              <p className="mt-2 text-[12.5px] text-neutral-600 md:text-[13.5px]">
                No lead broker. No commission. You message the trades directly. Free for homeowners.
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
