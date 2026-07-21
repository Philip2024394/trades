// /emergency/[slug] — per-emergency leaf.
// Emits Article + FAQPage + BreadcrumbList JSON-LD. First panel is
// ALWAYS life-safety numbers — never bury them.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight, AlertTriangle, Phone, ShieldCheck, Clock,
  PoundSterling, CircleAlert, CircleCheck, ExternalLink, Wrench
} from "lucide-react";
import { BRAND, absolute } from "@/lib/seo";
import { EMERGENCIES } from "../config";
import { ResourcesBar } from "@/components/seo/ResourcesBar";
import { LifeSafetyBlock } from "@/components/emergency/LifeSafetyBlock";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic  = "force-static";
export const revalidate = 86400;

export function generateStaticParams() {
  return EMERGENCIES.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const e = EMERGENCIES.find((x) => x.slug === slug);
  if (!e) return { title: "Emergency not found" };
  return {
    title:       `${e.displayName} · UK emergency guide + who to call — ${BRAND.name}`,
    description: e.definition,
    alternates:  { canonical: `/emergency/${e.slug}` },
    openGraph:   {
      type:     "article",
      siteName: BRAND.name,
      title:    e.displayName,
      description: e.definition,
      url:      absolute(`/emergency/${e.slug}`)
    },
    robots: { index: true, follow: true }
  };
}

export default async function EmergencyLeafPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const e = EMERGENCIES.find((x) => x.slug === slug);
  if (!e) notFound();

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "UK Trade Emergency", item: absolute("/emergency") },
      { "@type": "ListItem", position: 2, name: e.displayName,        item: absolute(`/emergency/${e.slug}`) }
    ]
  };
  const articleLd = {
    "@context":       "https://schema.org",
    "@type":          "Article",
    headline:         `${e.displayName} — UK emergency guide`,
    description:      e.definition,
    datePublished:    e.lastReviewed,
    dateModified:     e.lastReviewed,
    author:           { "@type": "Organization", name: BRAND.name, url: absolute("/") },
    publisher:        { "@type": "Organization", name: BRAND.name, url: absolute("/") },
    mainEntityOfPage: absolute(`/emergency/${e.slug}`),
    articleSection:   "UK Trade Emergency"
  };
  const faqLd = e.faqs.length ? {
    "@context": "https://schema.org",
    "@type":    "FAQPage",
    mainEntity: e.faqs.map((f) => ({
      "@type": "Question",
      name:    f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a }
    }))
  } : null;

  return (
    <main className="min-h-screen bg-[#FBF6EC]">
      <SeoSiteHeader/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}/>
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}/>}

      <div className="mx-auto max-w-[1000px] px-4 py-8 md:px-6 md:py-12">
        <nav aria-label="Breadcrumbs" className="mb-4 flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
          <Link href="/" className="hover:text-neutral-900">Home</Link>
          <span aria-hidden>/</span>
          <Link href="/emergency" className="hover:text-neutral-900">Emergency</Link>
          <span aria-hidden>/</span>
          <span className="font-black text-neutral-900">{e.displayName}</span>
        </nav>

        {/* Universal life-safety banner + 999 / 0800 111 999 / 105 with copy-to-clipboard */}
        <LifeSafetyBlock/>

        {/* Header */}
        <header className="mt-8">
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#DC2626" }}>
            UK Trade Emergency Guide · Reviewed {new Date(e.lastReviewed).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </p>
          <h1 className="mt-1 text-[32px] font-black leading-tight text-neutral-900 md:text-[44px]">
            {e.displayName}
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-neutral-700 md:text-[15px]">
            {e.definition}
          </p>
        </header>

        {/* Life-safety — ALWAYS the first substantive section */}
        <section
          className="mt-6 rounded-2xl border-2 p-6 shadow-sm md:p-8"
          style={{ borderColor: "#DC2626", backgroundColor: "#FEF2F2" }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} strokeWidth={2.6} className="text-red-700"/>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-red-800">
              Life-safety first — do these BEFORE anything else
            </p>
          </div>
          <ul className="mt-3 space-y-2">
            {e.callFirstIfLifeSafety.map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-[13.5px] text-neutral-900">
                <Phone size={13} strokeWidth={2.6} className="mt-0.5 shrink-0 text-red-700"/>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* What counts as emergency */}
        <section className="mt-8">
          <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
            What counts as this emergency
          </h2>
          <ul className="mt-3 space-y-1.5">
            {e.whatCountsAsEmergency.map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-neutral-800">
                <CircleAlert size={13} strokeWidth={2.4} className="mt-0.5 shrink-0 text-[#FFB300]"/>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* First steps */}
        <section className="mt-8">
          <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
            Damage-limitation steps you can take NOW
          </h2>
          <ol className="mt-3 space-y-2">
            {e.firstSteps.map((line, i) => (
              <li key={i} className="flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10.5px] font-black text-white" style={{ backgroundColor: "#0A0A0A" }}>
                  {i + 1}
                </span>
                <p className="text-[13px] leading-relaxed text-neutral-800">{line}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Expectations table */}
        <section className="mt-8">
          <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
            What to expect (UK 2026)
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <ExpectCard icon={<Clock size={14}/>}         label="Response time"    value={e.expectations.responseTime}/>
            <ExpectCard icon={<PoundSterling size={14}/>} label="First-hour cost"   value={e.expectations.firstHourCost}/>
            <ExpectCard icon={<PoundSterling size={14}/>} label="Hourly rate"       value={e.expectations.hourlyRate}/>
            <ExpectCard icon={<PoundSterling size={14}/>} label="Minimum spend"     value={e.expectations.minimumSpend}/>
          </div>
        </section>

        {/* Find a trade CTA */}
        <section
          className="mt-8 rounded-2xl border-2 p-5 shadow-sm md:p-6"
          style={{ borderColor: "#FFB300", backgroundColor: "#FFFDF6" }}
        >
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                After life-safety, get a written quote
              </p>
              <h3 className="mt-1 text-[16px] font-black leading-tight text-neutral-900 md:text-[18px]">
                Find a verified UK {e.tradeSlug.replace(/-/g, " ")} — direct WhatsApp
              </h3>
              <p className="mt-1 text-[12px] text-neutral-600">
                Always get a total-cost quote by phone/WhatsApp before the trade travels.
              </p>
            </div>
            <Link
              href={`/trades/${e.tradeSlug}`}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-[11.5px] font-black uppercase tracking-wider text-neutral-900 shadow-sm active:scale-[0.97]"
              style={{ backgroundColor: "#FFB300" }}
            >
              <Wrench size={12} strokeWidth={2.6}/>
              Find a {e.tradeSlug.replace(/-/g, " ")}
              <ArrowUpRight size={12} strokeWidth={2.6}/>
            </Link>
          </div>
        </section>

        {/* FAQs */}
        {e.faqs.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[20px] font-black leading-tight text-neutral-900 md:text-[24px]">
              Anti-panic questions
            </h2>
            <div className="mt-4 space-y-3">
              {e.faqs.map((f) => (
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
        )}

        <ResourcesBar active="toolbox" className="mt-8"/>

        <footer className="mt-8 flex flex-wrap items-center gap-4 border-t pt-6 text-[11px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <span className="inline-flex items-center gap-1"><ShieldCheck size={12}/> Pricing sourced from UK Trade Price Index · Reviewed {e.lastReviewed}</span>
          <Link href="/emergency" className="inline-flex items-center gap-0.5 hover:text-neutral-900">
            All emergencies <ExternalLink size={11}/>
          </Link>
          <span>Not a substitute for professional advice · If in doubt call 999</span>
        </footer>
      </div>
    </main>
  );
}

function ExpectCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
      <div className="flex items-center gap-1.5 text-neutral-500">
        {icon}
        <p className="text-[10px] font-black uppercase tracking-[0.22em]">{label}</p>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-snug text-neutral-800">{value}</p>
    </div>
  );
}
