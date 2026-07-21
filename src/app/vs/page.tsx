// /vs — Compare UK Trade Platforms hub.

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, ShieldCheck, Scale, ExternalLink } from "lucide-react";
import { BRAND, absolute } from "@/lib/seo";
import { COMPETITORS, NETWORK_MODEL, HUB_FAQS } from "./config";
import { ResourcesBar } from "@/components/seo/ResourcesBar";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic  = "force-static";
export const revalidate = 86400;

export const metadata: Metadata = {
  title:       `Compare UK Trade Platforms · The Networkers vs Checkatrade, MyBuilder, Rated People, Bark, TrustATrader — ${BRAND.name}`,
  description: `Side-by-side comparison of the UK's biggest trade platforms. Business model, trade pricing, homeowner cost, public reviews. Every fact sourced + dated.`,
  alternates:  { canonical: `/vs` },
  openGraph:   {
    type:     "website",
    siteName: BRAND.name,
    title:    `Compare UK Trade Platforms`,
    description: `The Networkers vs the UK's biggest trade platforms — every fact sourced.`,
    url:      absolute(`/vs`)
  },
  robots: { index: true, follow: true }
};

export default function VsHubPage() {
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Compare UK Trade Platforms", item: absolute("/vs") }
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
          <span className="font-black text-neutral-900">Compare UK Trade Platforms</span>
        </nav>

        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
            Evidence-first · Every fact linked to source
          </p>
          <h1 className="mt-1 text-[36px] font-black leading-tight text-neutral-900 md:text-[52px]">
            Compare UK trade platforms
          </h1>
          <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-neutral-700 md:text-[15px]">
            Side-by-side comparison of the UK's largest trade platforms — business model, trade costs, homeowner cost, and public review score. Every claim linked to a primary source (competitor site, Companies House, Trustpilot) with an accessed-on date.
          </p>
        </header>

        {/* At-a-glance model summary */}
        <section className="mt-8 overflow-x-auto rounded-2xl border-2 bg-white shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b bg-[#FBF6EC] text-left text-[10px] font-black uppercase tracking-[0.14em] text-neutral-600" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                <th className="px-3 py-3">Platform</th>
                <th className="px-3 py-3">Model class</th>
                <th className="px-3 py-3">Homeowner cost</th>
                <th className="px-3 py-3">Public review (Trustpilot)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b" style={{ borderColor: "rgba(139,69,19,0.08)", backgroundColor: "#FFFDF6" }}>
                <td className="px-3 py-3 font-black text-neutral-900">
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "#FFB300" }}/>
                    The Networkers
                  </span>
                </td>
                <td className="px-3 py-3 text-neutral-700">Fixed subscription (£9.99-£39.99/mo)</td>
                <td className="px-3 py-3 text-neutral-700">£0 · Direct WhatsApp</td>
                <td className="px-3 py-3 text-neutral-500">(building)</td>
              </tr>
              {COMPETITORS.map((c) => (
                <tr key={c.slug} className="border-b last:border-b-0" style={{ borderColor: "rgba(139,69,19,0.08)" }}>
                  <td className="px-3 py-3 font-black text-neutral-900">
                    <Link href={`/vs/${c.slug}`} className="hover:underline">
                      {c.displayName}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-neutral-700">{c.businessModel.split(".")[0]}</td>
                  <td className="px-3 py-3 text-neutral-700">{c.homeownerCosts[0]?.value}</td>
                  <td className="px-3 py-3 text-neutral-700 tabular-nums">
                    {c.publicReview.score} · {c.publicReview.sampleSize}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Per-competitor cards */}
        <section className="mt-10">
          <h2 className="text-[20px] font-black leading-tight text-neutral-900 md:text-[26px]">
            The Networkers vs ...
          </h2>
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COMPETITORS.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/vs/${c.slug}`}
                  className="group flex h-full flex-col rounded-2xl border-2 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                  style={{ borderColor: "rgba(139,69,19,0.10)" }}
                >
                  <div className="flex items-start gap-2">
                    <Scale size={16} strokeWidth={2.4} className="mt-0.5 shrink-0 text-[#FFB300]"/>
                    <h3 className="text-[17px] font-black leading-tight text-neutral-900">
                      The Networkers vs {c.displayName}
                    </h3>
                  </div>
                  <p className="mt-2 line-clamp-3 text-[12px] leading-snug text-neutral-600">
                    {c.positioning}
                  </p>
                  <p className="mt-3 inline-flex items-center gap-0.5 text-[10.5px] font-black uppercase tracking-wider text-neutral-500 group-hover:text-neutral-900">
                    Full comparison <ArrowUpRight size={11} strokeWidth={2.6}/>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Hub FAQs */}
        <section className="mt-12">
          <h2 className="text-[20px] font-black leading-tight text-neutral-900 md:text-[26px]">
            Common questions
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

        <ResourcesBar active="toolbox" className="mt-8"/>

        {/* Legal footer — mandatory on every /vs page for BPRs + DMCCA compliance */}
        <footer className="mt-8 rounded-2xl border-2 bg-white p-4 text-[10.5px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <p className="font-black uppercase tracking-wider text-neutral-600">
            Comparison methodology + compliance
          </p>
          <p className="mt-1.5">
            Every fact on the per-competitor pages links to a primary public source (competitor's own marketing page, Companies House registration, or Trustpilot review page) with an accessed-on date. Facts are drawn from public record only — no unverifiable service-quality claims. Framework follows UK Business Protection from Misleading Marketing Regulations 2008 + Digital Markets, Competition and Consumers Act 2024 comparative-advertising provisions. If any information is inaccurate please email
            {" "}<a href="mailto:legal@thenetworkers.app" className="font-black underline hover:text-neutral-900">legal@thenetworkers.app</a>
            {" "}with a correction; verified issues are resolved within 48 hours.
          </p>
        </footer>
      </div>
    </main>
  );
}
