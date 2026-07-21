// /answers — UK Trade Q&A hub landing.
//
// Phase 2 SEO third pillar. Ranks for "trade questions UK" +
// "construction questions" head terms. Individual /answers/[slug]
// pages capture the long-tail volume.

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, HelpCircle, ShieldCheck, TrendingUp, MessageSquare } from "lucide-react";
import { BRAND, absolute } from "@/lib/seo";
import { ANSWERS, HUB_FAQS, CATEGORY_LABEL, type AnswerCategory } from "./config";
import { ResourcesBar } from "@/components/seo/ResourcesBar";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic  = "force-static";
export const revalidate = 86400;

export const metadata: Metadata = {
  title:       `UK Trade Questions & Answers — ${BRAND.name}`,
  description: `Straight answers to the UK's most-asked trade + construction questions. Prices, timings, regulations. Every answer cross-checked against The Networkers' UK Trade Price Index.`,
  alternates:  { canonical: `/answers` },
  openGraph:   {
    type:     "website",
    siteName: BRAND.name,
    title:    `UK Trade Questions & Answers`,
    description: `Evidence-first answers to UK trade + construction questions.`,
    url:      absolute(`/answers`)
  },
  robots: { index: true, follow: true }
};

export default function AnswersHubPage() {
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Questions & Answers", item: absolute("/answers") }
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

  // Group answers by category for the hub layout.
  const byCategory = new Map<AnswerCategory, typeof ANSWERS>();
  for (const a of ANSWERS) {
    if (!byCategory.has(a.category)) byCategory.set(a.category, []);
    byCategory.get(a.category)!.push(a);
  }

  return (
    <main className="min-h-screen bg-[#FBF6EC]">
      <SeoSiteHeader/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}/>

      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-6 md:py-12">
        <nav aria-label="Breadcrumbs" className="mb-4 flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
          <Link href="/" className="hover:text-neutral-900">Home</Link>
          <span aria-hidden>/</span>
          <span className="font-black text-neutral-900">Q&amp;A</span>
        </nav>

        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
            Straight answers · Evidence-first
          </p>
          <h1 className="mt-1 text-[36px] font-black leading-tight text-neutral-900 md:text-[52px]">
            UK trade + construction questions
          </h1>
          <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-neutral-600 md:text-[15px]">
            Prices. Timings. Regulations. Every answer cross-checked against The Networkers' UK Trade Price Index, live grant data,
            {" "}and gov.uk / Gas Safe / IET Wiring Regs guidance. Reviewed quarterly.
          </p>
        </header>

        {/* Categories */}
        <section className="mt-10 space-y-8">
          {[...byCategory.entries()].map(([category, answers]) => (
            <div key={category}>
              <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                {CATEGORY_LABEL[category]}
              </h2>
              <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {answers.map((a) => (
                  <li key={a.slug}>
                    <Link
                      href={`/answers/${a.slug}`}
                      className="group flex h-full flex-col rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                      style={{ borderColor: "rgba(139,69,19,0.10)" }}
                    >
                      <div className="flex items-start gap-2">
                        <HelpCircle size={16} strokeWidth={2.4} className="mt-0.5 shrink-0 text-[#FFB300]"/>
                        <h3 className="text-[14px] font-black leading-snug text-neutral-900">
                          {a.question}
                        </h3>
                      </div>
                      <p className="mt-2 line-clamp-3 text-[12px] leading-snug text-neutral-600">
                        {a.shortAnswer}
                      </p>
                      <p className="mt-3 inline-flex items-center gap-0.5 text-[10.5px] font-black uppercase tracking-wider text-neutral-500 group-hover:text-neutral-900">
                        Read answer
                        <ArrowUpRight size={11} strokeWidth={2.6}/>
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {/* Hub FAQs */}
        <section className="mt-12">
          <h2 className="text-[20px] font-black leading-tight text-neutral-900 md:text-[26px]">
            About the Q&amp;A hub
          </h2>
          <div className="mt-4 space-y-3">
            {HUB_FAQS.map((f) => (
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

        {/* Ask-a-trade CTA */}
        <section className="mt-8 rounded-2xl border-2 p-6 md:p-8" style={{ borderColor: "#FFB300", backgroundColor: "#FFFDF6" }}>
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                Question not answered here?
              </p>
              <h3 className="mt-1 text-[20px] font-black leading-tight text-neutral-900 md:text-[24px]">
                Ask a verified UK trade
              </h3>
              <p className="mt-2 text-[12.5px] text-neutral-600 md:text-[13.5px]">
                Post your question free on The Yard. Verified trades on The Networkers reply directly.
              </p>
            </div>
            <Link
              href="/trade-off/yard"
              className="inline-flex h-12 items-center justify-center gap-1.5 rounded-lg px-6 text-[12.5px] font-black uppercase tracking-wider text-neutral-900 shadow-md active:scale-[0.97]"
              style={{ backgroundColor: "#FFB300" }}
            >
              <MessageSquare size={14} strokeWidth={2.6}/>
              Post to The Yard
              <ArrowUpRight size={14} strokeWidth={2.6}/>
            </Link>
          </div>
        </section>

        {/* Cross-sell tools */}
        <section className="mt-8 grid gap-3 md:grid-cols-3">
          <Link href="/price-index" className="rounded-2xl border-2 bg-white p-4 shadow-sm hover:-translate-y-1 transition" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
            <div className="flex items-center gap-2">
              <TrendingUp size={14} strokeWidth={2.6} className="text-neutral-900"/>
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Price data</span>
            </div>
            <p className="mt-2 text-[14px] font-black text-neutral-900">UK Trade Price Index →</p>
            <p className="mt-1 text-[11.5px] text-neutral-600">Day rates + regional pricing</p>
          </Link>
          <Link href="/grants" className="rounded-2xl border-2 bg-white p-4 shadow-sm hover:-translate-y-1 transition" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} strokeWidth={2.6} className="text-neutral-900"/>
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Funding</span>
            </div>
            <p className="mt-2 text-[14px] font-black text-neutral-900">UK Grants Tracker →</p>
            <p className="mt-1 text-[11.5px] text-neutral-600">Boiler + insulation + heat pump grants</p>
          </Link>
          <Link href="/trades" className="rounded-2xl border-2 bg-white p-4 shadow-sm hover:-translate-y-1 transition" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} strokeWidth={2.6} className="text-neutral-900"/>
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Directory</span>
            </div>
            <p className="mt-2 text-[14px] font-black text-neutral-900">Find a verified trade →</p>
            <p className="mt-1 text-[11.5px] text-neutral-600">UK trades. Direct WhatsApp.</p>
          </Link>
        </section>

        <ResourcesBar active="answers" className="mt-8"/>

        <footer className="mt-12 flex flex-wrap items-center gap-4 border-t pt-6 text-[11px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <span className="inline-flex items-center gap-1"><ShieldCheck size={12}/> Evidence-first — every fact cross-checked</span>
          <span>Reviewed quarterly · Not financial or legal advice</span>
        </footer>
      </div>
    </main>
  );
}
