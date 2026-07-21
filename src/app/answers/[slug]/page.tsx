// /answers/[slug] — individual Q&A page.
//
// The workhorse of the Q&A hub. Emits QAPage JSON-LD schema so
// Google (and AI-search extractors) treat the answer as an
// authoritative response — surfaced directly in the SERP.
//
// Every page cross-links to:
//   • /trades/[trade] — the trade that would take this job
//   • /cost/[project] — the related cost calculator
//   • /grants — funding that offsets the cost
//   • /answers/[other] — related follow-up questions
//
// Together this creates an internal-link web that concentrates
// authority across all three data-authority pillars.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, HelpCircle, MessageSquare, ShieldCheck, TrendingUp, Wrench, PoundSterling, ExternalLink } from "lucide-react";
import { BRAND, absolute } from "@/lib/seo";
import { ANSWERS, HUB_FAQS, CATEGORY_LABEL } from "../config";
import { SCHEMES as GRANT_SCHEMES } from "../../grants/config";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic  = "force-static";
export const revalidate = 86400;

export function generateStaticParams() {
  return ANSWERS.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const a = ANSWERS.find((x) => x.slug === slug);
  if (!a) return { title: "Answer not found" };
  return {
    title:       `${a.question} — ${BRAND.name}`,
    description: a.shortAnswer,
    alternates:  { canonical: `/answers/${a.slug}` },
    openGraph:   {
      type:     "article",
      siteName: BRAND.name,
      title:    a.question,
      description: a.shortAnswer,
      url:      absolute(`/answers/${a.slug}`),
      ...(a.heroImage ? { images: [a.heroImage] } : {})
    },
    robots: { index: true, follow: true }
  };
}

export default async function AnswerPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const answer = ANSWERS.find((x) => x.slug === slug);
  if (!answer) notFound();

  // Look up related grants + related answers.
  const relatedGrantData = answer.relatedGrants
    .map((s) => GRANT_SCHEMES.find((g) => g.slug === s))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));
  const relatedAnswers = answer.peopleAlsoAsk
    .map((s) => ANSWERS.find((x) => x.slug === s))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  // ─── JSON-LD ──────────────────────────────────────────────────
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Q&A",                item: absolute("/answers") },
      { "@type": "ListItem", position: 2, name: answer.question,     item: absolute(`/answers/${answer.slug}`) }
    ]
  };
  // QAPage — the schema Google uses to surface the answer directly.
  // When an authored hero image exists, attach it as the primaryImageOfPage
  // so Google can render it in the SERP alongside the answer text.
  const qaPageLd: Record<string, unknown> = {
    "@context":  "https://schema.org",
    "@type":     "QAPage",
    mainEntity: {
      "@type":       "Question",
      name:          answer.question,
      text:          answer.question,
      dateCreated:   answer.lastReviewed,
      answerCount:   1,
      acceptedAnswer: {
        "@type":        "Answer",
        text:           [answer.shortAnswer, ...answer.longAnswer].join(" "),
        dateCreated:    answer.lastReviewed,
        upvoteCount:    0,
        author:         { "@type": "Organization", name: BRAND.name, url: absolute("/") }
      }
    }
  };
  if (answer.heroImage) {
    qaPageLd.primaryImageOfPage = {
      "@type":      "ImageObject",
      contentUrl:   answer.heroImage,
      caption:      answer.heroAlt ?? answer.question
    };
  }
  const faqLd = relatedAnswers.length ? {
    "@context": "https://schema.org",
    "@type":    "FAQPage",
    mainEntity: relatedAnswers.map((r) => ({
      "@type": "Question",
      name:    r.question,
      acceptedAnswer: { "@type": "Answer", text: r.shortAnswer }
    }))
  } : null;

  return (
    <main className="min-h-screen bg-[#FBF6EC]">
      <SeoSiteHeader/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(qaPageLd) }}/>
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}/>}

      <div className="mx-auto max-w-[1000px] px-4 py-8 md:px-6 md:py-12">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumbs" className="mb-4 flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
          <Link href="/" className="hover:text-neutral-900">Home</Link>
          <span aria-hidden>/</span>
          <Link href="/answers" className="hover:text-neutral-900">Q&amp;A</Link>
          <span aria-hidden>/</span>
          <span className="font-black text-neutral-900 line-clamp-1">{answer.question}</span>
        </nav>

        {/* Header */}
        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
            {CATEGORY_LABEL[answer.category]}
          </p>
          <h1 className="mt-1 text-[28px] font-black leading-tight text-neutral-900 md:text-[40px]">
            {answer.question}
          </h1>
          <p className="mt-2 text-[11px] font-black uppercase tracking-wider text-neutral-500">
            Last reviewed {new Date(answer.lastReviewed).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </header>

        {/* Optional hero image — only when the answer has an authored cover */}
        {answer.heroImage && (
          <div
            className="mt-6 overflow-hidden rounded-2xl border-2 shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#0A0A0A" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={answer.heroImage}
              alt={answer.heroAlt ?? answer.question}
              className="block h-auto w-full object-contain"
              loading="eager"
            />
          </div>
        )}

        {/* Short answer — highlighted for SERP featured-snippet + AI extraction */}
        <section
          className="mt-6 rounded-2xl border-2 p-5 md:p-6"
          style={{ borderColor: "#FFB300", backgroundColor: "#FFFDF6" }}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Short answer</p>
          <p className="mt-2 text-[15px] font-black leading-relaxed text-neutral-900 md:text-[17px]">
            {answer.shortAnswer}
          </p>
        </section>

        {/* Long answer */}
        <section className="mt-8 space-y-4">
          <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Full answer</h2>
          {answer.longAnswer.map((para, i) => (
            <p key={i} className="text-[14px] leading-relaxed text-neutral-800 md:text-[15px]">
              {para}
            </p>
          ))}
        </section>

        {/* Related tools + grants — inline callout */}
        <section className="mt-10 space-y-3">
          {answer.relatedTrades.length > 0 && (
            <RelatedCard
              icon={<Wrench size={16} strokeWidth={2.6} className="text-neutral-900"/>}
              label="Find a trade"
              items={answer.relatedTrades.map((t) => ({
                href:  `/trades/${t}`,
                label: t.replace(/-/g, " ")
              }))}
            />
          )}
          {answer.relatedCosts.length > 0 && (
            <RelatedCard
              icon={<PoundSterling size={16} strokeWidth={2.6} className="text-neutral-900"/>}
              label="Cost calculator"
              items={answer.relatedCosts.map((c) => ({
                href:  `/cost/${c}`,
                label: c.replace(/-/g, " ")
              }))}
            />
          )}
          {relatedGrantData.length > 0 && (
            <RelatedCard
              icon={<ShieldCheck size={16} strokeWidth={2.6} className="text-neutral-900"/>}
              label="Funding available"
              items={relatedGrantData.map((g) => ({
                href:  `/grants#${g.slug}`,
                label: g.shortName
              }))}
            />
          )}
        </section>

        {/* People also ask */}
        {relatedAnswers.length > 0 && (
          <section className="mt-10">
            <h2 className="text-[16px] font-black leading-tight text-neutral-900 md:text-[20px]">
              People also ask
            </h2>
            <ul className="mt-3 space-y-2">
              {relatedAnswers.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/answers/${r.slug}`}
                    className="group flex items-start gap-2 rounded-2xl border bg-white p-4 shadow-sm hover:-translate-y-0.5 transition"
                    style={{ borderColor: "rgba(139,69,19,0.10)" }}
                  >
                    <HelpCircle size={14} strokeWidth={2.4} className="mt-0.5 shrink-0 text-[#FFB300]"/>
                    <div className="flex-1">
                      <p className="text-[13.5px] font-black text-neutral-900 group-hover:text-neutral-700">
                        {r.question}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-[11.5px] text-neutral-600">
                        {r.shortAnswer}
                      </p>
                    </div>
                    <ArrowUpRight size={13} strokeWidth={2.6} className="mt-1 shrink-0 text-neutral-400 group-hover:text-neutral-900"/>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Ask-a-trade CTA */}
        <section className="mt-10 rounded-2xl border-2 p-5 md:p-6" style={{ borderColor: "#FFB300", backgroundColor: "#FFFDF6" }}>
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                Need a specific quote?
              </p>
              <h3 className="mt-1 text-[16px] font-black leading-tight text-neutral-900 md:text-[18px]">
                Ask a verified UK trade — free
              </h3>
              <p className="mt-1 text-[12.5px] text-neutral-600">
                Post to The Yard. Verified trades reply directly. No lead broker.
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

        {/* Trust footer */}
        <footer className="mt-10 flex flex-wrap items-center gap-4 border-t pt-6 text-[11px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <span className="inline-flex items-center gap-1"><ShieldCheck size={12}/> Evidence-first · Every price sourced from UK Trade Price Index</span>
          <Link href="/answers" className="inline-flex items-center gap-0.5 hover:text-neutral-900">
            All Q&amp;A <ExternalLink size={11}/>
          </Link>
        </footer>
      </div>
    </main>
  );
}

function RelatedCard({
  icon, label, items
}: {
  icon:  React.ReactNode;
  label: string;
  items: Array<{ href: string; label: string }>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">{label}</span>
      </div>
      <ul className="flex flex-wrap items-center gap-1.5">
        {items.map((it) => (
          <li key={it.href}>
            <Link
              href={it.href}
              className="inline-flex items-center gap-0.5 rounded-full bg-neutral-900 px-3 py-1 text-[10.5px] font-black uppercase tracking-wider text-white hover:opacity-90"
            >
              {it.label}
              <ArrowUpRight size={10} strokeWidth={2.6}/>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
