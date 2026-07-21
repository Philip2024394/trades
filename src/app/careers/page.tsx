// /careers — UK Trade Career Guides hub.

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, GraduationCap, TrendingUp, ShieldCheck, Sparkles } from "lucide-react";
import { BRAND, absolute } from "@/lib/seo";
import { CAREER_GUIDES, HUB_FAQS } from "./config";
import { ApprenticeshipBanner } from "@/components/apprenticeships/ApprenticeshipBanner";
import { ResourcesBar } from "@/components/seo/ResourcesBar";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic  = "force-static";
export const revalidate = 86400;

export const metadata: Metadata = {
  title:       `How to Become a UK Trade · Career Guides — ${BRAND.name}`,
  description: `Free UK trade career guides. How to become a plumber, electrician, carpenter, plasterer, or roofer — qualifications, routes, earnings, apprenticeships.`,
  alternates:  { canonical: `/careers` },
  openGraph:   {
    type:     "website",
    siteName: BRAND.name,
    title:    `UK Trade Career Guides`,
    description: `How to become a UK trade — qualifications, apprenticeships, earnings.`,
    url:      absolute(`/careers`)
  },
  robots: { index: true, follow: true }
};

export default function CareersHubPage() {
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Career Guides", item: absolute("/careers") }
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
          <span className="font-black text-neutral-900">Career Guides</span>
        </nav>

        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
            Free · Evidence-first · Reviewed quarterly
          </p>
          <h1 className="mt-1 text-[36px] font-black leading-tight text-neutral-900 md:text-[52px]">
            How to become a UK trade
          </h1>
          <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-neutral-600 md:text-[15px]">
            Qualifications, apprenticeship routes, earning potential, day-in-the-life snapshots. Every guide sourced from IfATE standards + regulatory bodies + The Networkers' UK Trade Price Index.
          </p>
        </header>

        {/* Recruitment banner — pushes visitors to apprenticeship apply form */}
        <ApprenticeshipBanner
          variant="right-cta"
          ctaLabel="Apply today"
          href="/apprenticeships/apply"
          className="mt-6"
        />

        {/* Guides grid */}
        <section className="mt-8">
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAREER_GUIDES.map((g) => (
              <li key={g.slug}>
                <Link
                  href={`/careers/${g.slug}`}
                  className="group flex h-full flex-col rounded-2xl border-2 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                  style={{ borderColor: "rgba(139,69,19,0.10)" }}
                >
                  <div className="flex items-start gap-2">
                    <GraduationCap size={18} strokeWidth={2.4} className="mt-0.5 shrink-0 text-[#FFB300]"/>
                    <h3 className="text-[18px] font-black leading-tight text-neutral-900">
                      Become a {g.displayName}
                    </h3>
                  </div>
                  <p className="mt-2 line-clamp-3 text-[12.5px] leading-snug text-neutral-600">
                    {g.overview}
                  </p>
                  <div className="mt-3 flex items-center gap-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
                    <span>{g.routes.length} routes</span>
                    <span>·</span>
                    <span>Earn {g.earningsRange.qualified.split(" ")[0]}+</span>
                  </div>
                  <p className="mt-3 inline-flex items-center gap-0.5 text-[10.5px] font-black uppercase tracking-wider text-neutral-500 group-hover:text-neutral-900">
                    Read guide <ArrowUpRight size={11} strokeWidth={2.6}/>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Hub FAQs */}
        <section className="mt-12">
          <h2 className="text-[20px] font-black leading-tight text-neutral-900 md:text-[26px]">
            About the career guides
          </h2>
          <div className="mt-4 space-y-3">
            {HUB_FAQS.map((f) => (
              <details key={f.q} className="group rounded-2xl border bg-white p-4" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
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

        {/* Cross-sell */}
        <section className="mt-8 grid gap-3 md:grid-cols-3">
          <Link href="/price-index" className="rounded-2xl border-2 bg-white p-4 shadow-sm hover:-translate-y-1 transition" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
            <div className="flex items-center gap-2">
              <TrendingUp size={14} strokeWidth={2.6} className="text-neutral-900"/>
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Earning potential</span>
            </div>
            <p className="mt-2 text-[14px] font-black text-neutral-900">UK Trade Price Index →</p>
          </Link>
          <Link href="/trades" className="rounded-2xl border-2 bg-white p-4 shadow-sm hover:-translate-y-1 transition" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} strokeWidth={2.6} className="text-neutral-900"/>
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Already qualified?</span>
            </div>
            <p className="mt-2 text-[14px] font-black text-neutral-900">Join The Networkers →</p>
          </Link>
          <Link href="/answers" className="rounded-2xl border-2 bg-white p-4 shadow-sm hover:-translate-y-1 transition" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
            <div className="flex items-center gap-2">
              <Sparkles size={14} strokeWidth={2.6} className="text-neutral-900"/>
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Q&amp;A</span>
            </div>
            <p className="mt-2 text-[14px] font-black text-neutral-900">Trade Q&amp;A hub →</p>
          </Link>
        </section>

        <ResourcesBar active="careers" className="mt-8"/>

        <footer className="mt-12 flex flex-wrap items-center gap-4 border-t pt-6 text-[11px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <span className="inline-flex items-center gap-1"><ShieldCheck size={12}/> IfATE standards · Reviewed quarterly</span>
          <span>Not affiliated with any training provider · Not careers advice</span>
        </footer>
      </div>
    </main>
  );
}
