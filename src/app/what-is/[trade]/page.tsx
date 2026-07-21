// /what-is/[trade] — trade encyclopaedia leaf.
// DefinedTerm + Article + BreadcrumbList JSON-LD.
// Cross-links to /trades/[trade] (hire), /careers/[trade] (become),
// /vault/[article] (deeper reading).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight, Wrench, GraduationCap, ShieldCheck, BookOpen,
  Layers, CircleDot, Users, Split
} from "lucide-react";
import { BRAND, absolute } from "@/lib/seo";
import { WHAT_IS, careerGuideForSlug } from "../config";
import { ARTICLES as VAULT_ARTICLES } from "@/app/vault/config";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic  = "force-static";
export const revalidate = 86400;

export function generateStaticParams() {
  return WHAT_IS.map((w) => ({ trade: w.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ trade: string }> }
): Promise<Metadata> {
  const { trade } = await params;
  const w = WHAT_IS.find((x) => x.slug === trade);
  if (!w) return { title: "Trade encyclopaedia entry not found" };
  return {
    title:       `What is a ${w.displayName} in the UK? · Definition + scope — ${BRAND.name}`,
    description: w.definition,
    alternates:  { canonical: `/what-is/${w.slug}` },
    openGraph:   {
      type:     "article",
      siteName: BRAND.name,
      title:    `What is a ${w.displayName}?`,
      description: w.definition,
      url:      absolute(`/what-is/${w.slug}`)
    },
    robots: { index: true, follow: true }
  };
}

export default async function WhatIsLeafPage(
  { params }: { params: Promise<{ trade: string }> }
) {
  const { trade } = await params;
  const w = WHAT_IS.find((x) => x.slug === trade);
  if (!w) notFound();

  const career = careerGuideForSlug(w.slug);
  const vaultArticle = w.vaultArticle
    ? VAULT_ARTICLES.find((a) => a.slug === w.vaultArticle)
    : undefined;

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Trade Encyclopaedia",         item: absolute("/what-is") },
      { "@type": "ListItem", position: 2, name: `What is a ${w.displayName}`,  item: absolute(`/what-is/${w.slug}`) }
    ]
  };
  // DefinedTerm — the schema Google uses for glossary + encyclopaedia
  // pages. Pairs with Article to give it both editorial + reference
  // signals.
  const definedTermLd = {
    "@context":  "https://schema.org",
    "@type":     "DefinedTerm",
    name:        w.displayName,
    description: w.definition,
    inDefinedTermSet: absolute("/what-is"),
    url:         absolute(`/what-is/${w.slug}`)
  };
  const articleLd = {
    "@context":       "https://schema.org",
    "@type":          "Article",
    headline:         `What is a ${w.displayName} in the UK?`,
    datePublished:    w.lastReviewed,
    dateModified:     w.lastReviewed,
    author:           { "@type": "Organization", name: BRAND.name, url: absolute("/") },
    publisher:        { "@type": "Organization", name: BRAND.name, url: absolute("/") },
    mainEntityOfPage: absolute(`/what-is/${w.slug}`),
    articleSection:   "UK Trade Encyclopaedia"
  };

  return (
    <main className="min-h-screen bg-[#FBF6EC]">
      <SeoSiteHeader/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(definedTermLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}/>

      <div className="mx-auto max-w-[1000px] px-4 py-8 md:px-6 md:py-12">
        <nav aria-label="Breadcrumbs" className="mb-4 flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
          <Link href="/" className="hover:text-neutral-900">Home</Link>
          <span aria-hidden>/</span>
          <Link href="/what-is" className="hover:text-neutral-900">Trade Encyclopaedia</Link>
          <span aria-hidden>/</span>
          <span className="font-black text-neutral-900">What is a {w.displayName}</span>
        </nav>

        {/* Header */}
        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
            Trade Encyclopaedia · Reviewed {new Date(w.lastReviewed).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </p>
          <h1 className="mt-1 text-[32px] font-black leading-tight text-neutral-900 md:text-[44px]">
            What is a {w.displayName}?
          </h1>
          <p className="mt-3 text-[15px] font-black leading-relaxed text-neutral-800 md:text-[17px]">
            {w.definition}
          </p>
        </header>

        {/* Intent-triangle nav — mirrors /careers + /trades leaves */}
        <nav className="mt-5 flex flex-wrap gap-2 text-[10.5px] font-black uppercase tracking-wider">
          <span className="rounded-full bg-neutral-900 px-3 py-1 text-white">What is a {w.displayName.toLowerCase()} (this page)</span>
          <Link href={`/careers/${w.slug}`} className="rounded-full border-2 bg-white px-3 py-1 text-neutral-700 hover:text-neutral-900" style={{ borderColor: "rgba(139,69,19,0.20)" }}>Become a {w.displayName.toLowerCase()}</Link>
          <Link href={`/trades/${w.slug}`} className="rounded-full border-2 bg-white px-3 py-1 text-neutral-700 hover:text-neutral-900" style={{ borderColor: "rgba(139,69,19,0.20)" }}>Hire a {w.displayName.toLowerCase()}</Link>
        </nav>

        {/* Intent-triangle CTAs (unique to /what-is — pushes to hire OR become) */}
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <IntentCTA
            href={`/trades/${w.slug}`}
            icon={<Wrench size={14} strokeWidth={2.6}/>}
            eyebrow="Hire one"
            title={`Find a verified UK ${w.displayName.toLowerCase()}`}
          />
          <IntentCTA
            href={`/careers/${w.slug}`}
            icon={<GraduationCap size={14} strokeWidth={2.6}/>}
            eyebrow="Become one"
            title={`How to become a ${w.displayName.toLowerCase()} in the UK`}
          />
          {vaultArticle ? (
            <IntentCTA
              href={`/vault/${vaultArticle.slug}`}
              icon={<BookOpen size={14} strokeWidth={2.6}/>}
              eyebrow="Deeper read"
              title={vaultArticle.title}
            />
          ) : (
            <IntentCTA
              href="/vault"
              icon={<BookOpen size={14} strokeWidth={2.6}/>}
              eyebrow="Deeper read"
              title="The Vault — long-form UK trade guides"
            />
          )}
        </div>

        {/* Scope */}
        <Section title="Scope of the trade" icon={<Layers size={14}/>}>
          {w.scope.map((p, i) => (
            <p key={i} className="text-[14px] leading-relaxed text-neutral-800 md:text-[15px]">
              {p}
            </p>
          ))}
        </Section>

        {/* Typical jobs */}
        <Section title="Typical jobs a homeowner calls a {name} for" icon={<CircleDot size={14}/>} name={w.displayName.toLowerCase()}>
          <ul className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
            {w.typicalJobs.map((j) => (
              <li key={j} className="flex items-start gap-2 text-[13px] text-neutral-800">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: "#FFB300" }}/>
                {j}
              </li>
            ))}
          </ul>
        </Section>

        {/* Tools */}
        <Section title="Tools of the trade" icon={<Wrench size={14}/>}>
          <ul className="flex flex-wrap gap-1.5">
            {w.toolsOfTrade.map((t) => (
              <li
                key={t}
                className="rounded-full px-3 py-1 text-[11.5px] font-black text-neutral-800"
                style={{ backgroundColor: "#FBF6EC", border: "1px solid rgba(139,69,19,0.10)" }}
              >
                {t}
              </li>
            ))}
          </ul>
        </Section>

        {/* Works alongside */}
        <Section title="Trades a {name} works alongside" icon={<Users size={14}/>} name={w.displayName.toLowerCase()}>
          <ul className="flex flex-wrap gap-1.5">
            {w.worksAlongside.map((slug) => {
              const other = WHAT_IS.find((x) => x.slug === slug);
              const label = other?.displayName ?? slug.replace(/-/g, " ");
              return (
                <li key={slug}>
                  <Link
                    href={other ? `/what-is/${slug}` : `/trades/${slug}`}
                    className="inline-flex items-center gap-0.5 rounded-full bg-neutral-900 px-3 py-1 text-[10.5px] font-black uppercase tracking-wider text-white hover:opacity-90"
                  >
                    {label}
                    <ArrowUpRight size={10} strokeWidth={2.6}/>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>

        {/* Often confused with */}
        {w.oftenConfusedWith.length > 0 && (
          <Section title="Often confused with" icon={<Split size={14}/>}>
            <div className="space-y-3">
              {w.oftenConfusedWith.map((c) => (
                <div
                  key={c.otherName}
                  className="rounded-2xl border-2 p-4"
                  style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#FFFFFF" }}
                >
                  <p className="text-[13px] font-black text-neutral-900">
                    {w.displayName} <span className="text-neutral-500">vs.</span> {c.otherName}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-700">
                    {c.difference}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Earnings preview (from career config) */}
        {career && (
          <section className="mt-8 rounded-2xl border-2 p-5 md:p-6" style={{ borderColor: "#FFB300", backgroundColor: "#FFFDF6" }}>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
              Earnings snapshot (UK 2026)
            </p>
            <p className="mt-1 text-[15px] font-black text-neutral-900 md:text-[17px]">
              Self-employed: {career.earningsRange.selfEmployed}
            </p>
            <p className="mt-1 text-[12.5px] text-neutral-700">
              Full breakdown at <Link href={`/careers/${w.slug}`} className="font-black underline">careers/{w.slug}</Link> · underlying data at <Link href="/price-index" className="font-black underline">UK Trade Price Index</Link>.
            </p>
          </section>
        )}

        {/* Footer */}
        <footer className="mt-12 flex flex-wrap items-center gap-4 border-t pt-6 text-[11px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <span className="inline-flex items-center gap-1"><ShieldCheck size={12}/> Reviewed quarterly against UK Trade Price Index + regulators</span>
          <Link href="/what-is" className="inline-flex items-center gap-0.5 hover:text-neutral-900">
            All trades <ArrowUpRight size={11}/>
          </Link>
        </footer>
      </div>
    </main>
  );
}

function Section({ title, icon, children, name }: { title: string; icon?: React.ReactNode; children: React.ReactNode; name?: string }) {
  const displayTitle = name ? title.replace("{name}", name) : title;
  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
        {icon}
        {displayTitle}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function IntentCTA({ href, icon, eyebrow, title }: { href: string; icon: React.ReactNode; eyebrow: string; title: string }) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border-2 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
      style={{ borderColor: "rgba(139,69,19,0.10)" }}
    >
      <div className="flex items-center gap-1.5 text-neutral-900">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">{eyebrow}</span>
      </div>
      <p className="mt-1.5 text-[13.5px] font-black leading-snug text-neutral-900 group-hover:text-neutral-700">
        {title}
      </p>
      <p className="mt-2 inline-flex items-center gap-0.5 text-[10.5px] font-black uppercase tracking-wider text-neutral-500 group-hover:text-neutral-900">
        Open <ArrowUpRight size={10} strokeWidth={2.6}/>
      </p>
    </Link>
  );
}
