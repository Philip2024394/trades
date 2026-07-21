// /vs/[competitor] — comparison leaf.
// Every claim on this page carries a primary source. See config.ts
// legal-posture comment.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight, Scale, ShieldCheck, CircleCheck, CircleAlert,
  ExternalLink, Info, Building, PoundSterling, Star, Users
} from "lucide-react";
import { BRAND, absolute } from "@/lib/seo";
import { COMPETITORS, NETWORK_MODEL } from "../config";
import { ResourcesBar } from "@/components/seo/ResourcesBar";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic  = "force-static";
export const revalidate = 86400;

export function generateStaticParams() {
  return COMPETITORS.map((c) => ({ competitor: c.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ competitor: string }> }
): Promise<Metadata> {
  const { competitor } = await params;
  const c = COMPETITORS.find((x) => x.slug === competitor);
  if (!c) return { title: "Comparison not found" };
  return {
    title:       `The Networkers vs ${c.displayName} · UK trade platform comparison — ${BRAND.name}`,
    description: `Side-by-side: The Networkers vs ${c.displayName}. Business model, pricing, homeowner cost, ${c.publicReview.platform} score. Every fact linked to source, verified ${c.lastVerified}.`,
    alternates:  { canonical: `/vs/${c.slug}` },
    openGraph:   {
      type:     "article",
      siteName: BRAND.name,
      title:    `The Networkers vs ${c.displayName}`,
      description: `Side-by-side UK trade platform comparison.`,
      url:      absolute(`/vs/${c.slug}`)
    },
    robots: { index: true, follow: true }
  };
}

export default async function VsLeafPage(
  { params }: { params: Promise<{ competitor: string }> }
) {
  const { competitor } = await params;
  const c = COMPETITORS.find((x) => x.slug === competitor);
  if (!c) notFound();

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Compare UK Trade Platforms",     item: absolute("/vs") },
      { "@type": "ListItem", position: 2, name: `The Networkers vs ${c.displayName}`, item: absolute(`/vs/${c.slug}`) }
    ]
  };
  const articleLd = {
    "@context":       "https://schema.org",
    "@type":          "Article",
    headline:         `The Networkers vs ${c.displayName}`,
    datePublished:    c.lastVerified,
    dateModified:     c.lastVerified,
    author:           { "@type": "Organization", name: BRAND.name, url: absolute("/") },
    publisher:        { "@type": "Organization", name: BRAND.name, url: absolute("/") },
    mainEntityOfPage: absolute(`/vs/${c.slug}`),
    articleSection:   "UK Trade Platform Comparison"
  };
  const faqLd = c.faqs.length ? {
    "@context": "https://schema.org",
    "@type":    "FAQPage",
    mainEntity: c.faqs.map((f) => ({
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

      <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6 md:py-12">
        <nav aria-label="Breadcrumbs" className="mb-4 flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
          <Link href="/" className="hover:text-neutral-900">Home</Link>
          <span aria-hidden>/</span>
          <Link href="/vs" className="hover:text-neutral-900">Compare</Link>
          <span aria-hidden>/</span>
          <span className="font-black text-neutral-900">vs {c.displayName}</span>
        </nav>

        {/* Header */}
        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
            UK Trade Platform Comparison · Verified {new Date(c.lastVerified).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </p>
          <h1 className="mt-1 text-[32px] font-black leading-tight text-neutral-900 md:text-[44px]">
            The Networkers <span className="text-neutral-500">vs</span> {c.displayName}
          </h1>
          <p className="mt-3 text-[13.5px] leading-relaxed text-neutral-700 md:text-[15px]">
            <strong className="text-neutral-900">The Networkers:</strong> {NETWORK_MODEL.positioning}
            <br/>
            <strong className="text-neutral-900">{c.displayName}:</strong> {c.positioning}
          </p>
        </header>

        {/* Symmetric comparison table */}
        <section className="mt-8">
          <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
            Side-by-side comparison
          </h2>

          <div className="mt-4 overflow-x-auto rounded-2xl border-2 bg-white shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b bg-[#FBF6EC] text-left text-[10px] font-black uppercase tracking-[0.14em] text-neutral-600" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                  <th className="w-1/4 px-3 py-3"></th>
                  <th className="w-3/8 px-3 py-3" style={{ backgroundColor: "#FFFDF6" }}>
                    <span className="inline-flex items-center gap-1">
                      <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "#FFB300" }}/>
                      The Networkers
                    </span>
                  </th>
                  <th className="w-3/8 px-3 py-3">{c.displayName}</th>
                </tr>
              </thead>
              <tbody>
                <ComparisonRow
                  label="Business model"
                  network={NETWORK_MODEL.businessModel}
                  competitor={c.businessModel}
                />
                <ComparisonRow
                  label="Homeowner cost"
                  network={NETWORK_MODEL.homeownerCosts[0]?.value ?? "—"}
                  competitor={c.homeownerCosts[0]?.value ?? "—"}
                />
                <ComparisonRow
                  label="Trade cost — main pricing"
                  network={NETWORK_MODEL.tradeCosts.slice(0, 5).map((r) => r.label + ": " + r.value).join(" · ")}
                  competitor={c.tradeCosts.filter((r) => r.label !== "Commission on completed job").map((r) => r.label + ": " + r.value).join(" · ")}
                />
                <ComparisonRow
                  label="Commission on completed job"
                  network="£0 — never charged"
                  competitor={c.tradeCosts.find((r) => r.label.toLowerCase().includes("commission"))?.value ?? "—"}
                />
                <ComparisonRow
                  label={`Public review (${c.publicReview.platform})`}
                  network={"(building — new platform, verified reviews rolling out)"}
                  competitor={`${c.publicReview.score} · ${c.publicReview.sampleSize} · as of ${c.publicReview.asOf}`}
                />
              </tbody>
            </table>
          </div>
        </section>

        {/* When each fits — symmetric, honest, both directions */}
        <section className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border-2 p-5 md:p-6" style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#FFFFFF" }}>
            <div className="flex items-center gap-2">
              <Users size={16} strokeWidth={2.6} className="text-neutral-700"/>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                When to pick {c.displayName}
              </p>
            </div>
            <ul className="mt-3 space-y-1.5">
              {c.whenToPickThem.map((line, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-neutral-800">
                  <CircleCheck size={13} strokeWidth={2.4} className="mt-0.5 shrink-0 text-neutral-500"/>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border-2 p-5 md:p-6" style={{ borderColor: "#FFB300", backgroundColor: "#FFFDF6" }}>
            <div className="flex items-center gap-2">
              <Scale size={16} strokeWidth={2.6} className="text-neutral-900"/>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                When to pick The Networkers
              </p>
            </div>
            <ul className="mt-3 space-y-1.5">
              {c.whenToPickUs.map((line, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-neutral-800">
                  <CircleCheck size={13} strokeWidth={2.4} className="mt-0.5 shrink-0 text-[#FFB300]"/>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Company facts — public record */}
        <section className="mt-10">
          <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
            {c.displayName} — company facts (public record)
          </h2>
          <ul className="mt-3 grid gap-2 md:grid-cols-3">
            {c.companyFacts.map((f) => (
              <li key={f.label} className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">{f.label}</p>
                <p className="mt-1 text-[13px] font-black text-neutral-900">{f.value}</p>
                <p className="mt-1 text-[10.5px] text-neutral-400 line-clamp-1">Source: {f.source}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* FAQs */}
        {c.faqs.length > 0 && (
          <section className="mt-10">
            <h2 className="text-[20px] font-black leading-tight text-neutral-900 md:text-[24px]">
              Common questions
            </h2>
            <div className="mt-4 space-y-3">
              {c.faqs.map((f) => (
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

        {/* Sources — MANDATORY on every /vs page for BPRs + DMCCA compliance */}
        <section className="mt-10 rounded-2xl border-2 p-5 md:p-6" style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#FFFFFF" }}>
          <div className="flex items-center gap-2">
            <ExternalLink size={14} strokeWidth={2.6} className="text-neutral-700"/>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
              Primary sources — every fact on this page
            </p>
          </div>
          <ul className="mt-3 space-y-1.5 text-[12px]">
            {c.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="font-black text-neutral-900 underline hover:no-underline">
                  {s.label}
                </a>
                <span className="text-neutral-500"> · accessed {s.accessed}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-start gap-1.5 text-[11px] text-neutral-500">
            <Info size={12} className="mt-0.5 shrink-0"/>
            <span>
              Comparison framework follows UK Business Protection from Misleading Marketing Regulations 2008 + Digital Markets, Competition and Consumers Act 2024 comparative-advertising provisions. If any information is inaccurate please email{" "}
              <a href="mailto:legal@thenetworkers.app" className="font-black underline hover:text-neutral-900">legal@thenetworkers.app</a>
              {" "}with a correction; verified issues are resolved within 48 hours.
            </span>
          </p>
        </section>

        <ResourcesBar active="toolbox" className="mt-8"/>

        <footer className="mt-8 flex flex-wrap items-center gap-4 border-t pt-6 text-[11px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <span className="inline-flex items-center gap-1"><ShieldCheck size={12}/> Evidence-first · Verified {c.lastVerified}</span>
          <Link href="/vs" className="inline-flex items-center gap-0.5 hover:text-neutral-900">
            All comparisons <ExternalLink size={11}/>
          </Link>
        </footer>
      </div>
    </main>
  );
}

function ComparisonRow({ label, network, competitor }: { label: string; network: string; competitor: string }) {
  return (
    <tr className="border-b last:border-b-0" style={{ borderColor: "rgba(139,69,19,0.08)" }}>
      <td className="px-3 py-3 font-black text-neutral-900">{label}</td>
      <td className="px-3 py-3 text-neutral-700" style={{ backgroundColor: "#FFFDF6" }}>{network}</td>
      <td className="px-3 py-3 text-neutral-700">{competitor}</td>
    </tr>
  );
}
