// /case-studies/[slug] — case study leaf.
// Renders full Article + CreativeWork JSON-LD. Activates
// automatically when a published entry lands in CASE_STUDIES.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight, Camera, Clock, PoundSterling, ShieldCheck,
  CircleCheck, CircleAlert, ExternalLink, MapPin
} from "lucide-react";
import { BRAND, absolute } from "@/lib/seo";
import { CASE_STUDIES } from "../config";
import { ResourcesBar } from "@/components/seo/ResourcesBar";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic  = "force-static";
export const revalidate = 3600;

export function generateStaticParams() {
  return CASE_STUDIES.filter((c) => c.status === "published").map((c) => ({ slug: c.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const c = CASE_STUDIES.find((x) => x.slug === slug && x.status === "published");
  if (!c) return { title: "Case study not found" };
  return {
    title:       `${c.title} — Case study — ${BRAND.name}`,
    description: c.standfirst,
    alternates:  { canonical: `/case-studies/${c.slug}` },
    openGraph:   {
      type:     "article",
      siteName: BRAND.name,
      title:    c.title,
      description: c.standfirst,
      url:      absolute(`/case-studies/${c.slug}`),
      ...(c.media[0] ? { images: [c.media[0].imageUrl] } : {})
    },
    robots: { index: true, follow: true }
  };
}

export default async function CaseStudyLeaf(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const c = CASE_STUDIES.find((x) => x.slug === slug && x.status === "published");
  if (!c) notFound();

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Case Studies", item: absolute("/case-studies") },
      { "@type": "ListItem", position: 2, name: c.title,        item: absolute(`/case-studies/${c.slug}`) }
    ]
  };
  const articleLd = {
    "@context":       "https://schema.org",
    "@type":          "Article",
    headline:         c.title,
    description:      c.standfirst,
    datePublished:    c.publishedAt,
    dateModified:     c.lastReviewedAt,
    author:           { "@type": "Organization", name: BRAND.name, url: absolute("/") },
    publisher:        { "@type": "Organization", name: BRAND.name, url: absolute("/") },
    mainEntityOfPage: absolute(`/case-studies/${c.slug}`),
    articleSection:   "UK Trade Case Studies",
    ...(c.media.length ? { image: c.media.map((m) => m.imageUrl) } : {})
  };

  return (
    <main className="min-h-screen bg-[#FBF6EC]">
      <SeoSiteHeader/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}/>

      <div className="mx-auto max-w-[1000px] px-4 py-8 md:px-6 md:py-12">
        <nav aria-label="Breadcrumbs" className="mb-4 flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
          <Link href="/" className="hover:text-neutral-900">Home</Link>
          <span aria-hidden>/</span>
          <Link href="/case-studies" className="hover:text-neutral-900">Case Studies</Link>
          <span aria-hidden>/</span>
          <span className="font-black text-neutral-900 line-clamp-1">{c.title}</span>
        </nav>

        {/* Header */}
        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
            Case study · Real project · Real invoice
          </p>
          <h1 className="mt-1 text-[32px] font-black leading-tight text-neutral-900 md:text-[44px]">
            {c.title}
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-neutral-700 md:text-[15px]">
            {c.standfirst}
          </p>
          <p className="mt-4 inline-flex flex-wrap items-center gap-3 text-[11px] font-black uppercase tracking-wider text-neutral-500">
            <span className="inline-flex items-center gap-0.5">
              <MapPin size={11}/>
              {c.citySlug}
            </span>
            <span>·</span>
            <Link href={`/trades/${c.tradeSlug}`} className="hover:text-neutral-900 hover:underline">
              {c.tradeSlug.replace(/-/g, " ")}
            </Link>
            <span>·</span>
            <span className="inline-flex items-center gap-0.5">
              <PoundSterling size={11}/>
              {c.finalCost.total.toLocaleString("en-GB")}
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-0.5">
              <Clock size={11}/>
              {c.timeline.length} weeks
            </span>
          </p>
        </header>

        {/* Cover image */}
        {c.media[0] && (
          <div className="mt-6 overflow-hidden rounded-2xl border-2 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#0A0A0A" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.media[0].imageUrl}
              alt={c.media[0].caption}
              className="block h-auto w-full object-contain"
              loading="eager"
            />
          </div>
        )}

        {/* Timeline */}
        {c.timeline.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Timeline</h2>
            <ol className="mt-3 space-y-3">
              {c.timeline.map((t) => (
                <li key={t.week} className="flex items-start gap-3 rounded-2xl border bg-white p-4" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10.5px] font-black text-white" style={{ backgroundColor: "#0A0A0A" }}>
                    {t.week}
                  </span>
                  <p className="text-[13px] leading-relaxed text-neutral-800">{t.summary}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Cost breakdown */}
        <section className="mt-8">
          <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Final invoice</h2>
          <div className="mt-3 overflow-hidden rounded-2xl border-2 bg-white shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
            <table className="w-full text-[12.5px]">
              <tbody>
                {c.finalCost.breakdown.map((b) => (
                  <tr key={b.label} className="border-b last:border-b-0" style={{ borderColor: "rgba(139,69,19,0.06)" }}>
                    <td className="px-3 py-3 text-neutral-700">{b.label}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-neutral-900">£{b.amount.toLocaleString("en-GB")}</td>
                  </tr>
                ))}
                <tr className="bg-[#FBF6EC]">
                  <td className="px-3 py-3 font-black text-neutral-900">Total</td>
                  <td className="px-3 py-3 text-right font-black tabular-nums text-neutral-900">£{c.finalCost.total.toLocaleString("en-GB")}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {c.finalCost.variances && (
            <p className="mt-3 text-[12px] italic text-neutral-600">Variances: {c.finalCost.variances}</p>
          )}
        </section>

        {/* Went well / Went wrong */}
        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border-2 p-5" style={{ borderColor: "rgba(34,197,94,0.30)", backgroundColor: "#F0FDF4" }}>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-green-800">What went well</p>
            <ul className="mt-3 space-y-1.5">
              {c.wentWell.map((line, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-neutral-800">
                  <CircleCheck size={13} strokeWidth={2.4} className="mt-0.5 shrink-0 text-green-700"/>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border-2 p-5" style={{ borderColor: "rgba(245,158,11,0.30)", backgroundColor: "#FEF3C7" }}>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-yellow-800">What went wrong / what we'd change</p>
            <ul className="mt-3 space-y-1.5">
              {c.wentWrong.map((line, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-neutral-800">
                  <CircleAlert size={13} strokeWidth={2.4} className="mt-0.5 shrink-0 text-yellow-700"/>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Gallery */}
        {c.media.length > 1 && (
          <section className="mt-8">
            <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
              <Camera size={11} className="mb-0.5 inline"/> Project gallery
            </h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {c.media.slice(1).map((m) => (
                <li key={m.imageUrl}>
                  <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#0A0A0A" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.imageUrl} alt={m.caption} className="block h-auto w-full object-contain" loading="lazy"/>
                  </div>
                  <p className="mt-1 text-[11px] text-neutral-500">
                    <span className="mr-1 font-black uppercase tracking-wider text-neutral-700">{m.phase}</span>
                    {m.caption}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Trade credit */}
        <section className="mt-10 rounded-2xl border-2 bg-white p-5 shadow-sm md:p-6" style={{ borderColor: "#FFB300" }}>
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                Delivered by
              </p>
              <h3 className="mt-1 text-[18px] font-black leading-tight text-neutral-900">
                <Link href={`/${c.tradeProfileSlug}`} className="hover:underline">
                  {c.tradeProfileSlug.replace(/-/g, " ")}
                </Link>
              </h3>
              <p className="mt-1 text-[12px] text-neutral-600">
                Homeowner attribution: {c.homeownerCredit}
              </p>
            </div>
            <Link
              href={`/${c.tradeProfileSlug}`}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-[11.5px] font-black uppercase tracking-wider text-neutral-900 shadow-sm active:scale-[0.97]"
              style={{ backgroundColor: "#FFB300" }}
            >
              View trade profile
              <ArrowUpRight size={12} strokeWidth={2.6}/>
            </Link>
          </div>
        </section>

        <ResourcesBar active="toolbox" className="mt-8"/>

        <footer className="mt-8 flex flex-wrap items-center gap-4 border-t pt-6 text-[11px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <span className="inline-flex items-center gap-1"><ShieldCheck size={12}/> Homeowner + trade both approved this write-up before publication</span>
          <Link href="/case-studies" className="inline-flex items-center gap-0.5 hover:text-neutral-900">
            All case studies <ExternalLink size={11}/>
          </Link>
        </footer>
      </div>
    </main>
  );
}
