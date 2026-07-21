// /vault — Content Vault hub.
//
// Long-form editorial across 4 categories. Ranks for informational-
// intent queries the programmatic surfaces don't serve.

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BookOpen, ShieldCheck, Clock, User } from "lucide-react";
import { BRAND, absolute } from "@/lib/seo";
import { ARTICLES, CATEGORY_LABEL, HUB_FAQS, VAULT_HUB_HERO } from "./config";
import { ResourcesBar } from "@/components/seo/ResourcesBar";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic  = "force-static";
export const revalidate = 3600;

export const metadata: Metadata = {
  title:       `The Vault · UK trade + home project guides — ${BRAND.name}`,
  description: `Long-form UK trade guides — how to hire, spot cowboys, structure payments, understand quotes. Every article verified quarterly against The Networkers' UK Trade Price Index.`,
  alternates:  { canonical: `/vault` },
  openGraph:   {
    type:     "website",
    siteName: BRAND.name,
    title:    `The Vault · UK trade + home project guides`,
    description: `Evidence-first UK trade + home project guides. Free, verified quarterly.`,
    url:      absolute(`/vault`)
  },
  robots: { index: true, follow: true }
};

export default function VaultHubPage() {
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "The Vault", item: absolute("/vault") }
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
          <span className="font-black text-neutral-900">The Vault</span>
        </nav>

        {/* Hero banner — burned-in branding, no text overlay per image spec */}
        <div
          className="overflow-hidden rounded-2xl border-2 shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.10)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={VAULT_HUB_HERO}
            alt="The Vault — long-form UK trade + construction guides from The Networkers"
            className="h-auto w-full object-cover"
            width={1920}
            height={720}
            loading="eager"
          />
        </div>

        {/* Header — H1 kept for SEO; visual weight handled by hero banner above */}
        <header className="mt-6">
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
            Long-form editorial · Reviewed quarterly
          </p>
          <h1 className="mt-1 text-[28px] font-black leading-tight text-neutral-900 md:text-[36px]">
            The Vault
          </h1>
          <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-neutral-600 md:text-[15px]">
            Straight guides on hiring UK trades, reading quotes, structuring payments, and getting projects right. Every article verified against the UK Trade Price Index + industry regulators.
          </p>
        </header>

        {/* Featured — first article */}
        {ARTICLES[0] && (
          <Link
            href={`/vault/${ARTICLES[0].slug}`}
            className="mt-8 grid gap-0 overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
            style={{ borderColor: "rgba(139,69,19,0.10)" }}
          >
            <div className="aspect-[3/2] w-full overflow-hidden md:aspect-auto md:self-stretch" style={{ backgroundColor: "#0A0A0A" }}>
              {ARTICLES[0].heroImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ARTICLES[0].heroImage}
                  alt={ARTICLES[0].heroAlt ?? ARTICLES[0].title}
                  className="h-full w-full object-contain"
                />
              )}
            </div>
            <div className="flex flex-col justify-center p-6 md:p-8">
              <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: "#FFB300" }}>
                Featured · {CATEGORY_LABEL[ARTICLES[0].category]}
              </p>
              <h2 className="mt-2 text-[24px] font-black leading-tight text-neutral-900 md:text-[32px]">
                {ARTICLES[0].title}
              </h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-neutral-700">
                {ARTICLES[0].standfirst}
              </p>
              <p className="mt-4 inline-flex items-center gap-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
                <span className="inline-flex items-center gap-0.5"><User size={11}/>{ARTICLES[0].author}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-0.5"><Clock size={11}/>{ARTICLES[0].readingMinutes} min read</span>
              </p>
            </div>
          </Link>
        )}

        {/* All articles — single grid, category shown as chip on each card.
            At current library size (8) this fills 3-per-row on desktop
            immediately; per-category sub-headers can return when the
            library grows past ~4-5 articles per category. */}
        <section className="mt-10">
          <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
            All articles · {ARTICLES.length}
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ARTICLES.map((a) => (
                  <li key={a.slug}>
                    <Link
                      href={`/vault/${a.slug}`}
                      className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                      style={{ borderColor: "rgba(139,69,19,0.10)" }}
                    >
                      {a.heroImage ? (
                        <div className="aspect-[3/2] w-full overflow-hidden" style={{ backgroundColor: "#0A0A0A" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={a.heroImage}
                            alt={a.heroAlt ?? a.title}
                            loading="lazy"
                            className="h-full w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="flex aspect-[3/2] w-full items-end p-5" style={{ background: "linear-gradient(135deg, #0A0A0A 0%, #1F2937 100%)" }}>
                          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
                            {CATEGORY_LABEL[a.category]}
                          </p>
                        </div>
                      )}
                      <div className="flex flex-1 flex-col p-4">
                        <p className="text-[9.5px] font-black uppercase tracking-[0.22em]" style={{ color: "#FFB300" }}>
                          {CATEGORY_LABEL[a.category]}
                        </p>
                        <h3 className="mt-1 text-[15px] font-black leading-snug text-neutral-900">
                          {a.title}
                        </h3>
                        <p className="mt-2 line-clamp-3 text-[12px] leading-snug text-neutral-600">
                          {a.standfirst}
                        </p>
                        <p className="mt-3 inline-flex items-center gap-2 text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
                          <span className="inline-flex items-center gap-0.5"><Clock size={10}/>{a.readingMinutes} min</span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-0.5 group-hover:text-neutral-900">
                            Read <ArrowUpRight size={10} strokeWidth={2.6}/>
                          </span>
                        </p>
                      </div>
                    </Link>
                  </li>
            ))}
          </ul>
        </section>

        {/* Hub FAQs */}
        <section className="mt-12">
          <h2 className="text-[20px] font-black leading-tight text-neutral-900 md:text-[26px]">
            About The Vault
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

        <ResourcesBar active="vault" className="mt-8"/>

        <footer className="mt-12 flex flex-wrap items-center gap-4 border-t pt-6 text-[11px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <span className="inline-flex items-center gap-1"><BookOpen size={12}/> Editorial team · Reviewed quarterly</span>
          <span className="inline-flex items-center gap-1"><ShieldCheck size={12}/> Every fact cross-checked against UK Trade Price Index + regulators</span>
        </footer>
      </div>
    </main>
  );
}
