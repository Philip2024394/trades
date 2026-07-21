// /vault/[slug] — individual article page.
//
// Emits Article + FAQPage + BreadcrumbList JSON-LD. Body sections
// render with dangerouslySetInnerHTML because the config allows
// inline <strong> + <a> — the content is authored, not user input.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight, Clock, User, ShieldCheck, ChevronRight,
  BookOpen, Wrench, TrendingUp, HelpCircle, ExternalLink, Sparkles
} from "lucide-react";
import { BRAND, absolute } from "@/lib/seo";
import { ARTICLES, CATEGORY_LABEL, AUTHOR_DEFAULT } from "../config";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic  = "force-static";
export const revalidate = 3600;

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const a = ARTICLES.find((x) => x.slug === slug);
  if (!a) return { title: "Article not found" };
  return {
    title:       `${a.title} — ${BRAND.name}`,
    description: a.standfirst,
    alternates:  { canonical: `/vault/${a.slug}` },
    openGraph:   {
      type:     "article",
      siteName: BRAND.name,
      title:    a.title,
      description: a.standfirst,
      url:      absolute(`/vault/${a.slug}`),
      ...(a.heroImage ? { images: [a.heroImage] } : {})
    },
    robots: { index: true, follow: true }
  };
}

export default async function ArticlePage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const article = ARTICLES.find((x) => x.slug === slug);
  if (!article) notFound();

  const related = article.relatedArticles
    .map((s) => ARTICLES.find((x) => x.slug === s))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "The Vault",          item: absolute("/vault") },
      { "@type": "ListItem", position: 2, name: article.title,        item: absolute(`/vault/${article.slug}`) }
    ]
  };
  const articleLd = {
    "@context":       "https://schema.org",
    "@type":          "Article",
    headline:         article.title,
    description:      article.standfirst,
    ...(article.heroImage ? { image: [article.heroImage] } : {}),
    datePublished:    article.publishedAt,
    dateModified:     article.lastReviewedAt,
    author:           { "@type": "Organization", name: article.author, url: absolute("/") },
    publisher:        { "@type": "Organization", name: BRAND.name, url: absolute("/") },
    mainEntityOfPage: absolute(`/vault/${article.slug}`),
    articleSection:   CATEGORY_LABEL[article.category]
  };
  const faqLd = article.faqs.length ? {
    "@context": "https://schema.org",
    "@type":    "FAQPage",
    mainEntity: article.faqs.map((f) => ({
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
          <Link href="/vault" className="hover:text-neutral-900">Vault</Link>
          <span aria-hidden>/</span>
          <span className="font-black text-neutral-900 line-clamp-1">{article.title}</span>
        </nav>

        {/* Header */}
        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
            {CATEGORY_LABEL[article.category]}
          </p>
          <h1 className="mt-1 text-[32px] font-black leading-tight text-neutral-900 md:text-[44px]">
            {article.title}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-neutral-700 md:text-[17px]">
            {article.standfirst}
          </p>
          <p className="mt-4 inline-flex flex-wrap items-center gap-3 text-[11px] font-black uppercase tracking-wider text-neutral-500">
            <span className="inline-flex items-center gap-0.5"><User size={11}/>{article.author}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-0.5"><Clock size={11}/>{article.readingMinutes} min read</span>
            <span>·</span>
            <span>Reviewed {new Date(article.lastReviewedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
          </p>
        </header>

        {/* Hero image — natural aspect, no crop. Optional; articles
            ship without a cover until authored one lands. */}
        {article.heroImage && (
          <div className="mt-6 overflow-hidden rounded-2xl border-2 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.heroImage}
              alt={article.heroAlt ?? article.title}
              className="block h-auto w-full"
            />
          </div>
        )}

        {/* TOC */}
        <nav className="mt-8 rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)" }} aria-label="Contents">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Contents</p>
          <ol className="mt-2 space-y-1">
            {article.sections.map((s, i) => (
              <li key={i}>
                <a
                  href={`#s-${i}`}
                  className="inline-flex items-baseline gap-1 text-[12.5px] font-black text-neutral-800 hover:text-neutral-900 hover:underline"
                >
                  <ChevronRight size={11} strokeWidth={2.6} className="translate-y-[1px] text-[#FFB300]"/>
                  {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Sections */}
        <article className="prose prose-neutral mt-8 max-w-none">
          {article.sections.map((s, i) => (
            <section key={i} id={`s-${i}`} className="scroll-mt-20 mt-8 first:mt-4">
              <h2 className="text-[20px] font-black leading-tight text-neutral-900 md:text-[24px]">
                {s.heading}
              </h2>
              <div
                className="mt-3 space-y-3 text-[14.5px] leading-relaxed text-neutral-800 md:text-[15px] [&_a]:underline [&_a]:text-neutral-900 [&_a]:font-black [&_strong]:font-black [&_strong]:text-neutral-900"
                dangerouslySetInnerHTML={{ __html: paraWrap(s.body) }}
              />
            </section>
          ))}
        </article>

        {/* FAQs */}
        {article.faqs.length > 0 && (
          <section className="mt-10">
            <h2 className="text-[20px] font-black leading-tight text-neutral-900 md:text-[24px]">
              Common questions
            </h2>
            <div className="mt-4 space-y-3">
              {article.faqs.map((f) => (
                <details key={f.q} className="group rounded-2xl border bg-white p-4" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                  <summary className="cursor-pointer list-none text-[13.5px] font-black text-neutral-900 marker:hidden">
                    <span className="mr-2 inline-block text-[#FFB300] group-open:rotate-90 transition">▶</span>
                    {f.q}
                  </summary>
                  <div
                    className="mt-2 pl-4 text-[13px] leading-relaxed text-neutral-700 [&_a]:underline [&_a]:font-black [&_a]:text-neutral-900"
                    dangerouslySetInnerHTML={{ __html: f.a }}
                  />
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Related trades + tools */}
        {(article.relatedTrades.length > 0 || article.relatedTools.length > 0) && (
          <section className="mt-10 rounded-2xl border-2 bg-white p-5 shadow-sm md:p-6" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
            {article.relatedTrades.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Find a verified trade</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {article.relatedTrades.map((t) => (
                    <li key={t}>
                      <Link
                        href={`/trades/${t}`}
                        className="inline-flex items-center gap-0.5 rounded-full bg-neutral-900 px-3 py-1 text-[10.5px] font-black uppercase tracking-wider text-white hover:opacity-90"
                      >
                        <Wrench size={10}/> {t.replace(/-/g, " ")}
                        <ArrowUpRight size={10} strokeWidth={2.6}/>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {article.relatedTools.length > 0 && (
              <div className={article.relatedTrades.length > 0 ? "mt-4" : ""}>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Related tools</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {article.relatedTools.map((t) => {
                    const map: Record<string, { href: string; label: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }> }> = {
                      "price-index": { href: "/price-index", label: "UK Trade Price Index", Icon: TrendingUp },
                      "check-quote": { href: "/check-quote", label: "Quote Checker",         Icon: Sparkles },
                      "grants":      { href: "/grants",      label: "UK Grants Tracker",    Icon: ShieldCheck },
                      "answers":     { href: "/answers",     label: "Q&A Hub",              Icon: HelpCircle },
                      "careers":     { href: "/careers",     label: "Career Guides",        Icon: BookOpen },
                      "planning":    { href: "/planning/rear-extension", label: "Planning Checkers", Icon: ShieldCheck },
                      "cost":        { href: "/cost/kitchen-extension",  label: "Cost Calculators",  Icon: TrendingUp },
                      "trades":      { href: "/trades", label: "Trade Directory", Icon: Wrench }
                    };
                    const item = map[t];
                    if (!item) return null;
                    const { Icon } = item;
                    return (
                      <li key={t}>
                        <Link
                          href={item.href}
                          className="inline-flex items-center gap-0.5 rounded-full border-2 bg-white px-3 py-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-900"
                          style={{ borderColor: "rgba(139,69,19,0.20)" }}
                        >
                          <Icon size={10} strokeWidth={2.6}/> {item.label}
                          <ArrowUpRight size={10} strokeWidth={2.6}/>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Related articles */}
        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="text-[16px] font-black leading-tight text-neutral-900 md:text-[20px]">
              Keep reading
            </h2>
            <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/vault/${r.slug}`}
                    className="group flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-sm hover:-translate-y-0.5 transition"
                    style={{ borderColor: "rgba(139,69,19,0.10)" }}
                  >
                    <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg" style={{ backgroundColor: "#0A0A0A" }}>
                      {r.heroImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.heroImage} alt={r.heroAlt ?? r.title} className="h-full w-full object-contain"/>
                      ) : (
                        <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: "#FFB300" }}>Vault</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                        {CATEGORY_LABEL[r.category]}
                      </p>
                      <p className="mt-0.5 text-[13.5px] font-black leading-snug text-neutral-900 group-hover:text-neutral-700">
                        {r.title}
                      </p>
                    </div>
                    <ArrowUpRight size={13} strokeWidth={2.6} className="mt-1 shrink-0 text-neutral-400 group-hover:text-neutral-900"/>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-12 flex flex-wrap items-center gap-4 border-t pt-6 text-[11px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <span className="inline-flex items-center gap-1"><ShieldCheck size={12}/> {AUTHOR_DEFAULT} · Reviewed quarterly · Cross-checked against UK Trade Price Index + regulators</span>
          <Link href="/vault" className="inline-flex items-center gap-0.5 hover:text-neutral-900">
            All articles <ExternalLink size={11}/>
          </Link>
        </footer>
      </div>
    </main>
  );
}

/** Wrap raw config body into <p> paragraphs on blank-line boundaries.
 *  Content allows inline <strong> and <a> already, so this only
 *  splits + wraps. Keeps articles readable without a full MDX toolchain. */
function paraWrap(raw: string): string {
  return raw
    .trim()
    .split(/\n\s*\n/)
    .map((p) => `<p>${p.trim().replace(/\n/g, "<br/>")}</p>`)
    .join("");
}
