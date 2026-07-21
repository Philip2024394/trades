// /careers/[trade] — individual career guide.
// Emits Article + FAQPage + BreadcrumbList JSON-LD.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight, GraduationCap, Clock, PoundSterling, TrendingUp,
  ShieldCheck, CircleCheck, Briefcase, ExternalLink
} from "lucide-react";
import { BRAND, absolute } from "@/lib/seo";
import { CAREER_GUIDES } from "../config";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic  = "force-static";
export const revalidate = 86400;

export function generateStaticParams() {
  return CAREER_GUIDES.map((g) => ({ trade: g.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ trade: string }> }
): Promise<Metadata> {
  const { trade } = await params;
  const g = CAREER_GUIDES.find((x) => x.slug === trade);
  if (!g) return { title: "Career guide not found" };
  return {
    title:       `How to Become a ${g.displayName} in the UK 2026 · Free Guide — ${BRAND.name}`,
    description: `Complete UK ${g.displayName} career guide 2026 — qualifications, apprenticeships, earnings £${g.earningsRange.qualified.split("£")[1]?.split("/")[0] ?? ""}+, ${g.routes.length} training routes. IfATE-sourced.`,
    alternates:  { canonical: `/careers/${g.slug}` },
    openGraph:   {
      type:     "article",
      siteName: BRAND.name,
      title:    `How to become a ${g.displayName} in the UK`,
      description: g.overview.slice(0, 160),
      url:      absolute(`/careers/${g.slug}`)
    },
    robots: { index: true, follow: true }
  };
}

export default async function CareerGuidePage(
  { params }: { params: Promise<{ trade: string }> }
) {
  const { trade } = await params;
  const g = CAREER_GUIDES.find((x) => x.slug === trade);
  if (!g) notFound();

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Career Guides",           item: absolute("/careers") },
      { "@type": "ListItem", position: 2, name: `Become a ${g.displayName}`, item: absolute(`/careers/${g.slug}`) }
    ]
  };
  const articleLd = {
    "@context":       "https://schema.org",
    "@type":          "Article",
    headline:         `How to become a ${g.displayName} in the UK`,
    datePublished:    g.lastReviewed,
    dateModified:     g.lastReviewed,
    author:           { "@type": "Organization", name: BRAND.name, url: absolute("/") },
    publisher:        { "@type": "Organization", name: BRAND.name, url: absolute("/") },
    mainEntityOfPage: absolute(`/careers/${g.slug}`),
    articleSection:   "UK Trade Careers"
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type":    "FAQPage",
    mainEntity: g.faqs.map((f) => ({
      "@type": "Question",
      name:    f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a }
    }))
  };

  return (
    <main className="min-h-screen bg-[#FBF6EC]">
      <SeoSiteHeader/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}/>

      <div className="mx-auto max-w-[1000px] px-4 py-8 md:px-6 md:py-12">
        <nav aria-label="Breadcrumbs" className="mb-4 flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
          <Link href="/" className="hover:text-neutral-900">Home</Link>
          <span aria-hidden>/</span>
          <Link href="/careers" className="hover:text-neutral-900">Careers</Link>
          <span aria-hidden>/</span>
          <span className="font-black text-neutral-900">Become a {g.displayName}</span>
        </nav>

        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
            UK Trade Career Guide · Reviewed {new Date(g.lastReviewed).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </p>
          <h1 className="mt-1 text-[32px] font-black leading-tight text-neutral-900 md:text-[44px]">
            How to become a {g.displayName} in the UK
          </h1>
          <p className="mt-3 text-[13.5px] leading-relaxed text-neutral-700 md:text-[15px]">
            {g.overview}
          </p>
        </header>

        {/* Intent nav — what-is / careers / trades trio */}
        <nav className="mt-5 flex flex-wrap gap-2 text-[10.5px] font-black uppercase tracking-wider">
          <Link href={`/what-is/${g.slug}`} className="rounded-full border-2 bg-white px-3 py-1 text-neutral-700 hover:text-neutral-900" style={{ borderColor: "rgba(139,69,19,0.20)" }}>What is a {g.displayName.toLowerCase()}?</Link>
          <span className="rounded-full bg-neutral-900 px-3 py-1 text-white">Become one (this page)</span>
          <Link href={`/trades/${g.slug}`} className="rounded-full border-2 bg-white px-3 py-1 text-neutral-700 hover:text-neutral-900" style={{ borderColor: "rgba(139,69,19,0.20)" }}>Hire a {g.displayName.toLowerCase()}</Link>
        </nav>

        {/* At-a-glance stats */}
        <section className="mt-6 grid gap-3 md:grid-cols-3">
          <StatChip icon={<Clock size={14}/>}          label="Training time" value={g.routes[0]?.duration ?? "—"}/>
          <StatChip icon={<PoundSterling size={14}/>}  label="Qualified pay" value={g.earningsRange.qualified}/>
          <StatChip icon={<TrendingUp size={14}/>}     label="Self-employed" value={g.earningsRange.selfEmployed.split("·")[0]?.trim() ?? ""}/>
        </section>

        {/* Ask-a-trade CTA (apprenticeship) — moved to top for young-people intent */}
        <section className="mt-8 rounded-2xl border-2 p-5 md:p-6" style={{ borderColor: "#FFB300", backgroundColor: "#FFFDF6" }}>
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                Looking for a {g.displayName.toLowerCase()} apprenticeship?
              </p>
              <h3 className="mt-1 text-[16px] font-black leading-tight text-neutral-900 md:text-[18px]">
                Post to The Yard — verified local {g.plural} see it
              </h3>
              <p className="mt-1 text-[12px] text-neutral-600">
                Free · No CV required · Trades in your postcode area get notified.
              </p>
            </div>
            <Link
              href={`/apprenticeships/apply?trade=${g.slug}`}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-[11.5px] font-black uppercase tracking-wider text-neutral-900 shadow-sm active:scale-[0.97]"
              style={{ backgroundColor: "#FFB300" }}
            >
              Apply for {g.displayName.toLowerCase()} apprenticeship
              <ArrowUpRight size={12} strokeWidth={2.6}/>
            </Link>
          </div>
        </section>

        {/* Qualifications */}
        <Section title="Qualifications you'll need">
          <ul className="space-y-1.5 text-[13px] text-neutral-800">
            {g.qualifications.map((q) => (
              <li key={q} className="flex items-start gap-2">
                <CircleCheck size={14} strokeWidth={2.4} className="mt-0.5 shrink-0 text-green-700"/>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Routes */}
        <Section title="Training routes">
          <div className="space-y-3">
            {g.routes.map((r) => (
              <div key={r.name} className="rounded-2xl border-2 bg-white p-4 md:p-5" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-[15px] font-black text-neutral-900">{r.name}</h3>
                    <p className="mt-0.5 text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
                      {r.duration} · {r.cost}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-[12.5px] text-neutral-700">
                  <strong className="text-neutral-900">Suits:</strong> {r.suits}
                </p>
                <p className="mt-1 text-[12.5px] text-neutral-700">
                  <strong className="text-neutral-900">Outcome:</strong> {r.outcome}
                </p>
              </div>
            ))}
          </div>
        </Section>

        {/* Earnings */}
        <Section title="What you can earn">
          <p className="text-[13.5px] leading-relaxed text-neutral-800">{g.earningsSummary}</p>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            <EarningRow label="Apprentice"    value={g.earningsRange.apprentice}/>
            <EarningRow label="Qualified"     value={g.earningsRange.qualified}/>
            <EarningRow label="Experienced"   value={g.earningsRange.experienced}/>
            <EarningRow label="Self-employed" value={g.earningsRange.selfEmployed}/>
          </div>
          <p className="mt-3 text-[11.5px] text-neutral-500">
            Source: <Link href="/price-index" className="underline hover:text-neutral-900">UK Trade Price Index</Link> · Reviewed monthly
          </p>
        </Section>

        {/* Job outlook */}
        <Section title="Job outlook">
          <p className="text-[13.5px] leading-relaxed text-neutral-800">{g.jobOutlook}</p>
        </Section>

        {/* Day in the life */}
        <Section title="Day in the life">
          <ul className="space-y-1.5 text-[13px] text-neutral-800">
            {g.dayInLife.map((line, i) => (
              <li key={i} className="tabular-nums">{line}</li>
            ))}
          </ul>
        </Section>

        {/* Traits */}
        <Section title="Traits that matter">
          <ul className="space-y-1.5 text-[13px] text-neutral-800">
            {g.requiredTraits.map((t) => (
              <li key={t} className="flex items-start gap-2">
                <CircleCheck size={14} strokeWidth={2.4} className="mt-0.5 shrink-0 text-green-700"/>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* FAQs */}
        <Section title="Common questions">
          <div className="space-y-3">
            {g.faqs.map((f) => (
              <details key={f.q} className="group rounded-2xl border bg-white p-4" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                <summary className="cursor-pointer list-none text-[13.5px] font-black text-neutral-900 marker:hidden">
                  <span className="mr-2 inline-block text-[#FFB300] group-open:rotate-90 transition">▶</span>
                  {f.q}
                </summary>
                <p className="mt-2 pl-4 text-[13px] leading-relaxed text-neutral-700">{f.a}</p>
              </details>
            ))}
          </div>
        </Section>

        {/* Already qualified CTA */}
        <section className="mt-10 rounded-2xl border-2 p-6 md:p-8" style={{ borderColor: "#0A0A0A", backgroundColor: "#FFFFFF" }}>
          <div className="grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: "#0A0A0A" }}>
              <Briefcase size={20} strokeWidth={2.4} className="text-white"/>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                Already a qualified {g.displayName.toLowerCase()}?
              </p>
              <h3 className="mt-1 text-[16px] font-black text-neutral-900">
                Set up on The Networkers — no lead broker, no commission
              </h3>
              <p className="mt-1 text-[12px] text-neutral-600">
                Homeowners find you directly via /trades/{g.slug}/[city].
              </p>
            </div>
            <Link
              href="/trade-off/pricing"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-[11.5px] font-black uppercase tracking-wider text-white shadow-sm active:scale-[0.97]"
              style={{ backgroundColor: "#0A0A0A" }}
            >
              Join free
              <ArrowUpRight size={12} strokeWidth={2.6}/>
            </Link>
          </div>
        </section>

        {/* Source attribution */}
        <footer className="mt-10 flex flex-wrap items-center gap-4 border-t pt-6 text-[11px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <span className="inline-flex items-center gap-1"><GraduationCap size={12}/> {g.regulatoryBody}</span>
          <span>Sources: {g.citation}</span>
          <Link href="/careers" className="inline-flex items-center gap-0.5 hover:text-neutral-900">
            All career guides <ExternalLink size={11}/>
          </Link>
        </footer>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function StatChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-3 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
      <div className="flex items-center gap-1.5 text-neutral-500">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-[0.22em]">{label}</span>
      </div>
      <p className="mt-1 text-[13.5px] font-black tabular-nums text-neutral-900">{value}</p>
    </div>
  );
}

function EarningRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white px-3 py-2.5" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
      <p className="text-[9.5px] font-black uppercase tracking-[0.22em] text-neutral-500">{label}</p>
      <p className="mt-0.5 text-[12.5px] font-black tabular-nums text-neutral-900">{value}</p>
    </div>
  );
}
