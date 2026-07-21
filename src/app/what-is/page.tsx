// /what-is — Trade Encyclopaedia hub.

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BookOpen, ShieldCheck } from "lucide-react";
import { BRAND, absolute } from "@/lib/seo";
import { WHAT_IS } from "./config";
import { ResourcesBar } from "@/components/seo/ResourcesBar";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic  = "force-static";
export const revalidate = 86400;

export const metadata: Metadata = {
  title:       `UK Trade Encyclopaedia · what each trade actually does — ${BRAND.name}`,
  description: `Plain-English UK trade encyclopaedia. What plumbers, electricians, carpenters, plasterers, and roofers actually do — scope, typical jobs, tools, and common confusions.`,
  alternates:  { canonical: `/what-is` },
  openGraph:   {
    type:     "website",
    siteName: BRAND.name,
    title:    `UK Trade Encyclopaedia`,
    description: `What each UK trade actually does. Scope, typical jobs, tools, common confusions.`,
    url:      absolute(`/what-is`)
  },
  robots: { index: true, follow: true }
};

export default function WhatIsHubPage() {
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Trade Encyclopaedia", item: absolute("/what-is") }
    ]
  };

  return (
    <main className="min-h-screen bg-[#FBF6EC]">
      <SeoSiteHeader/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}/>

      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-6 md:py-12">
        <nav aria-label="Breadcrumbs" className="mb-4 flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
          <Link href="/" className="hover:text-neutral-900">Home</Link>
          <span aria-hidden>/</span>
          <span className="font-black text-neutral-900">Trade Encyclopaedia</span>
        </nav>

        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
            Plain-English · Evidence-first
          </p>
          <h1 className="mt-1 text-[36px] font-black leading-tight text-neutral-900 md:text-[52px]">
            UK Trade Encyclopaedia
          </h1>
          <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-neutral-600 md:text-[15px]">
            What each UK trade actually does. Scope, typical jobs, tools, and the common confusions — plumber vs Gas Safe engineer, carpenter vs kitchen fitter, plasterer vs decorator.
          </p>
        </header>

        <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WHAT_IS.map((w) => (
            <li key={w.slug}>
              <Link
                href={`/what-is/${w.slug}`}
                className="group flex h-full flex-col rounded-2xl border-2 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                style={{ borderColor: "rgba(139,69,19,0.10)" }}
              >
                <div className="flex items-start gap-2">
                  <BookOpen size={18} strokeWidth={2.4} className="mt-0.5 shrink-0 text-[#FFB300]"/>
                  <h2 className="text-[18px] font-black leading-tight text-neutral-900">
                    What is a {w.displayName}?
                  </h2>
                </div>
                <p className="mt-2 line-clamp-4 text-[12.5px] leading-snug text-neutral-600">
                  {w.definition}
                </p>
                <p className="mt-3 inline-flex items-center gap-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-500 group-hover:text-neutral-900">
                  Read the definition
                  <ArrowUpRight size={11} strokeWidth={2.6}/>
                </p>
              </Link>
            </li>
          ))}
        </ul>

        <section className="mt-10 rounded-2xl border-2 p-6 md:p-8" style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#FFFFFF" }}>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">The three intents per trade</p>
          <h2 className="mt-1 text-[16px] font-black text-neutral-900 md:text-[18px]">
            Three surfaces per trade slug — pick your intent
          </h2>
          <ul className="mt-3 space-y-1.5 text-[13px] text-neutral-700">
            <li><strong className="text-neutral-900">/what-is/[trade]</strong> — understand what they do (this hub)</li>
            <li><strong className="text-neutral-900">/careers/[trade]</strong> — become one yourself (qualifications, earnings, apprenticeship routes)</li>
            <li><strong className="text-neutral-900">/trades/[trade]</strong> — hire one (verified UK trades near you)</li>
          </ul>
        </section>

        <ResourcesBar active="what-is" className="mt-8"/>

        <footer className="mt-12 flex flex-wrap items-center gap-4 border-t pt-6 text-[11px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <span className="inline-flex items-center gap-1"><ShieldCheck size={12}/> Reviewed quarterly against UK Trade Price Index + industry regulators</span>
        </footer>
      </div>
    </main>
  );
}
