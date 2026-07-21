// /case-studies — hub landing.
//
// Ships with a strong empty-state today; automatically switches to a
// grid layout the moment the first published case study lands in
// CASE_STUDIES.

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight, ShieldCheck, Camera, ClipboardList,
  Sparkles, MessageSquare
} from "lucide-react";
import { BRAND, absolute } from "@/lib/seo";
import { CASE_STUDIES, HUB_FAQS, SUBMISSION_CHECKLIST } from "./config";
import { ResourcesBar } from "@/components/seo/ResourcesBar";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic  = "force-static";
export const revalidate = 3600;

export const metadata: Metadata = {
  title:       `UK Trade Case Studies · Real Projects, Real Costs — ${BRAND.name}`,
  description: `Real UK trade project case studies — kitchen extensions, loft conversions, bathroom refits + more. Every project features a verified Networkers member, real costs, real photos.`,
  alternates:  { canonical: `/case-studies` },
  openGraph:   {
    type:     "website",
    siteName: BRAND.name,
    title:    `UK Trade Case Studies`,
    description: `Real UK trade projects — verified trade, real cost, real photos.`,
    url:      absolute(`/case-studies`)
  },
  robots: { index: true, follow: true }
};

export default function CaseStudiesHubPage() {
  const published = CASE_STUDIES.filter((c) => c.status === "published");

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Case Studies", item: absolute("/case-studies") }
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
          <span className="font-black text-neutral-900">Case Studies</span>
        </nav>

        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
            Real UK projects · Real trades · Real invoices
          </p>
          <h1 className="mt-1 text-[36px] font-black leading-tight text-neutral-900 md:text-[52px]">
            Trade Case Studies
          </h1>
          <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-neutral-600 md:text-[15px]">
            Real UK trade project write-ups — every study features a verified Networkers member, real photos, and the real final invoice. No fabricated content, ever.
          </p>
        </header>

        {published.length === 0 ? (
          // Empty state — genuinely honest about why + strong submission CTA
          <section className="mt-8 grid gap-6 md:grid-cols-[1fr_1fr]">
            <div className="rounded-2xl border-2 p-6 shadow-sm md:p-8" style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#FFFFFF" }}>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Why this page is quiet</p>
              <h2 className="mt-2 text-[20px] font-black leading-tight text-neutral-900 md:text-[24px]">
                We're waiting for our first published submission
              </h2>
              <p className="mt-3 text-[13.5px] leading-relaxed text-neutral-700">
                Every case study on The Networkers features a real project — real trade, real homeowner, real photos, real invoice total. We refuse to publish fabricated case studies to bulk up the section.
              </p>
              <p className="mt-3 text-[13.5px] leading-relaxed text-neutral-700">
                When our first submission clears editorial review, this page fills up. Until then — <strong className="text-neutral-900">evidence or silence</strong>.
              </p>
              <div className="mt-5 flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-neutral-500">
                <ShieldCheck size={12} className="text-[#FFB300]"/>
                <span>Editorial standard applies equally regardless of subscription tier</span>
              </div>
            </div>

            {/* Submission CTA */}
            <div className="rounded-2xl border-2 p-6 shadow-sm md:p-8" style={{ borderColor: "#FFB300", backgroundColor: "#FFFDF6" }}>
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-neutral-900"/>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-900">
                  Networkers members
                </p>
              </div>
              <h2 className="mt-2 text-[20px] font-black leading-tight text-neutral-900 md:text-[24px]">
                Submit a project — get featured
              </h2>
              <p className="mt-3 text-[13.5px] leading-relaxed text-neutral-800">
                Free PR + a permanent backlink to your trade profile. If your project fits the editorial checklist (verified member, homeowner consent, real photos + costs), we work with you to publish a full write-up.
              </p>
              <Link
                href="/case-studies/submit"
                className="mt-5 inline-flex h-12 items-center justify-center gap-1.5 rounded-lg px-6 text-[12.5px] font-black uppercase tracking-wider text-neutral-900 shadow-md active:scale-[0.97]"
                style={{ backgroundColor: "#FFB300" }}
              >
                <ClipboardList size={14} strokeWidth={2.6}/>
                Submit your project
                <ArrowUpRight size={14} strokeWidth={2.6}/>
              </Link>
            </div>
          </section>
        ) : (
          // Grid layout — auto-activates when the first case study lands
          <section className="mt-8">
            <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
              Published · {published.length}
            </h2>
            <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {published.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/case-studies/${c.slug}`}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                    style={{ borderColor: "rgba(139,69,19,0.10)" }}
                  >
                    {c.media[0] && (
                      <div className="aspect-[3/2] w-full overflow-hidden" style={{ backgroundColor: "#0A0A0A" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={c.media[0].imageUrl}
                          alt={c.media[0].caption}
                          loading="lazy"
                          className="h-full w-full object-contain"
                        />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="text-[15px] font-black leading-snug text-neutral-900">
                        {c.title}
                      </h3>
                      <p className="mt-2 line-clamp-3 text-[12px] leading-snug text-neutral-600">
                        {c.standfirst}
                      </p>
                      <div className="mt-auto flex items-center justify-between pt-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
                        <span>{c.citySlug}</span>
                        <span className="tabular-nums">£{c.finalCost.total.toLocaleString("en-GB")}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Editorial standards */}
        <section className="mt-12 rounded-2xl border-2 bg-white p-6 shadow-sm md:p-8" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <div className="flex items-center gap-2">
            <Camera size={16} className="text-neutral-700"/>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
              Editorial checklist — what a submission needs
            </p>
          </div>
          <ul className="mt-3 space-y-1.5">
            {SUBMISSION_CHECKLIST.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[13px] text-neutral-800">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: "#FFB300" }}/>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Hub FAQs */}
        <section className="mt-8">
          <h2 className="text-[20px] font-black leading-tight text-neutral-900 md:text-[26px]">
            About the case studies
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

        {/* Yard CTA — capturing users who wanted to browse case studies but landed on empty */}
        <section className="mt-8 rounded-2xl border-2 p-5 md:p-6" style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#FFFFFF" }}>
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                In the meantime
              </p>
              <h3 className="mt-1 text-[16px] font-black leading-tight text-neutral-900 md:text-[18px]">
                Ask a real UK trade about their recent projects on The Yard
              </h3>
              <p className="mt-1 text-[12px] text-neutral-600">
                Free · Trades reply directly · No lead broker.
              </p>
            </div>
            <Link
              href="/trade-off/yard"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-[11.5px] font-black uppercase tracking-wider text-neutral-900 shadow-sm active:scale-[0.97]"
              style={{ backgroundColor: "#FFB300" }}
            >
              <MessageSquare size={12} strokeWidth={2.6}/>
              Post to The Yard
              <ArrowUpRight size={12} strokeWidth={2.6}/>
            </Link>
          </div>
        </section>

        <ResourcesBar active="toolbox" className="mt-8"/>

        <footer className="mt-8 flex flex-wrap items-center gap-4 border-t pt-6 text-[11px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <span className="inline-flex items-center gap-1"><ShieldCheck size={12}/> Every case study features a real Networkers trade + verified project + written homeowner consent</span>
        </footer>
      </div>
    </main>
  );
}
