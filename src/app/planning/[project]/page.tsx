// /planning/[project] — Planning Permission Checker.
//
// UK-specific decision-tree pages for the highest-volume planning
// permission queries. Every page covers:
//   • Expert 40-word answer (AI-search snippet ready)
//   • Verdict chip (PD / sometimes PD / usually needs planning)
//   • When PD applies (bullet list)
//   • When full planning is needed (bullet list)
//   • Building Regs applicability
//   • Party Wall + Heritage overrides
//   • 6 FAQs (FAQPage schema)
//   • Cross-links to related cost page + trades

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, ShieldCheck, AlertTriangle, Info } from "lucide-react";
import { BRAND, absolute } from "@/lib/seo";
import {
  PLANNING_PROJECTS, PLANNING_CONTENT,
  isValidPlanningProject, verdictInfo,
  type PlanningProject
} from "./config";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic  = "force-static";
export const revalidate = 86400;

export async function generateStaticParams() {
  return PLANNING_PROJECTS.map((project) => ({ project }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ project: string }>;
}): Promise<Metadata> {
  const { project } = await params;
  if (!isValidPlanningProject(project)) return { title: "Not found" };
  const c = PLANNING_CONTENT[project];
  const title = `${c.headline} · UK 2026 Rules — ${BRAND.name}`;
  return {
    title,
    description: c.aiAnswer,
    alternates:  { canonical: `/planning/${project}` },
    openGraph:   {
      type:     "website",
      siteName: BRAND.name,
      title,
      description: c.aiAnswer,
      url:         absolute(`/planning/${project}`)
    },
    robots: { index: true, follow: true }
  };
}

export default async function PlanningPage({
  params
}: {
  params: Promise<{ project: string }>;
}) {
  const { project } = await params;
  if (!isValidPlanningProject(project)) notFound();
  const c = PLANNING_CONTENT[project];
  const v = verdictInfo(c.verdict);

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Planning",      item: absolute("/planning") },
      { "@type": "ListItem", position: 2, name: cap(c.singular), item: absolute(`/planning/${project}`) }
    ]
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type":    "FAQPage",
    mainEntity: c.faqs.map((f) => ({
      "@type": "Question",
      name:    f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a }
    }))
  };
  // HowTo schema for the decision-tree — helps Google surface the answer
  // as a "how to check" step-by-step in the SERP.
  const howToLd = {
    "@context": "https://schema.org",
    "@type":    "HowTo",
    name:       `How to check if you need planning permission for a ${c.singular}`,
    step: [
      ...c.pdApplies.map((s, i) => ({ "@type": "HowToStep", position: i + 1, text: s })),
      ...c.planningNeeded.map((s, i) => ({ "@type": "HowToStep", position: c.pdApplies.length + i + 1, text: s }))
    ]
  };

  return (
    <main className="min-h-screen bg-[#FBF6EC]">
      <SeoSiteHeader/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToLd) }}/>

      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-6 md:py-12">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumbs" className="mb-4 flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
          <Link href="/planning" className="hover:text-neutral-900">Planning</Link>
          <span aria-hidden>/</span>
          <span className="font-black text-neutral-900">{cap(c.singular)}</span>
        </nav>

        {/* Hero */}
        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
            Planning permission · UK 2026
          </p>
          <h1 className="mt-1 text-[32px] font-black leading-tight text-neutral-900 md:text-[44px]">
            {c.headline}
          </h1>
          <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-neutral-600 md:text-[15px]">
            {c.aiAnswer}
          </p>
          {/* Verdict chip — bold visual signal so viewers know the answer at a glance */}
          <div className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-black uppercase tracking-wider text-white shadow-sm" style={{ backgroundColor: v.color }}>
            <ShieldCheck size={14}/>
            {v.chip}
          </div>
          <p className="mt-2 text-[11.5px] text-neutral-600">{v.body}.</p>
        </header>

        {/* Two-column decision tree */}
        <section className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border bg-white p-5" style={{ borderColor: "rgba(22,101,52,0.20)", borderLeftWidth: "4px", borderLeftColor: "#166534" }}>
            <h2 className="inline-flex items-center gap-1.5 text-[12px] font-black uppercase tracking-[0.16em] text-green-800">
              <ShieldCheck size={13}/> Permitted Development applies
            </h2>
            <ul className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-neutral-700">
              {c.pdApplies.map((s) => (
                <li key={s} className="flex items-start gap-2">
                  <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: "#166534" }}/>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border bg-white p-5" style={{ borderColor: "rgba(185,28,28,0.20)", borderLeftWidth: "4px", borderLeftColor: "#B91C1C" }}>
            <h2 className="inline-flex items-center gap-1.5 text-[12px] font-black uppercase tracking-[0.16em] text-red-800">
              <AlertTriangle size={13}/> Planning permission needed
            </h2>
            <ul className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-neutral-700">
              {c.planningNeeded.map((s) => (
                <li key={s} className="flex items-start gap-2">
                  <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: "#B91C1C" }}/>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Building Regs callout */}
        <section className="mt-10 rounded-2xl border-l-4 bg-white p-5" style={{ borderLeftColor: "#FFB300", border: "1px solid rgba(139,69,19,0.10)", borderLeftWidth: "4px" }}>
          <h2 className="inline-flex items-center gap-1.5 text-[13px] font-black uppercase tracking-[0.16em] text-neutral-500">
            <Info size={13}/> Building Regulations
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-neutral-700">{c.buildingRegs}</p>
        </section>

        {/* Party Wall + Heritage additions (only when present) */}
        {c.partyWall && (
          <section className="mt-4 rounded-2xl border-l-4 bg-white p-5" style={{ borderLeftColor: "#7A4E00", border: "1px solid rgba(139,69,19,0.10)", borderLeftWidth: "4px" }}>
            <h2 className="text-[13px] font-black uppercase tracking-[0.16em] text-neutral-500">
              Party Wall Act 1996
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-neutral-700">{c.partyWall}</p>
          </section>
        )}
        {c.heritageNote && (
          <section className="mt-4 rounded-2xl border-l-4 bg-white p-5" style={{ borderLeftColor: "#B91C1C", border: "1px solid rgba(139,69,19,0.10)", borderLeftWidth: "4px" }}>
            <h2 className="text-[13px] font-black uppercase tracking-[0.16em] text-neutral-500">
              Listed buildings + conservation areas
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-neutral-700">{c.heritageNote}</p>
          </section>
        )}

        {/* FAQs */}
        <section className="mt-10">
          <h2 className="text-[16px] font-black text-neutral-900 md:text-[18px]">
            Planning permission FAQs · {c.singular}
          </h2>
          <div className="mt-4 space-y-3">
            {c.faqs.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl border bg-white p-4"
                style={{ borderColor: "rgba(139,69,19,0.10)" }}
              >
                <summary className="cursor-pointer list-none text-[13.5px] font-black text-neutral-900 marker:hidden">
                  <span className="mr-2 inline-block text-[#FFB300] group-open:rotate-90 transition">▶</span>
                  {f.q}
                </summary>
                <p className="mt-2 pl-4 text-[13px] leading-relaxed text-neutral-700">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Cost cross-link */}
        {c.relatedCost && (
          <section className="mt-10 rounded-2xl border-2 p-5 md:p-6" style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#FFFFFF" }}>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
              Cost guide
            </p>
            <h3 className="mt-1 text-[16px] font-black text-neutral-900">
              How much does a {c.singular} cost?
            </h3>
            <Link
              href={`/cost/${c.relatedCost}`}
              className="mt-3 inline-flex items-center gap-1 text-[12px] font-black uppercase tracking-wider text-neutral-900 hover:underline"
            >
              See UK 2026 cost breakdown → <ArrowUpRight size={12} strokeWidth={2.6}/>
            </Link>
          </section>
        )}

        {/* Trades cross-links */}
        <section className="mt-10">
          <h2 className="text-[13px] font-black uppercase tracking-[0.16em] text-neutral-500">
            Trades you'll need
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {c.relatedTrades.map((r) => (
              <li key={r}>
                <Link
                  href={`/trades/${r}/london`}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-black text-neutral-800 shadow-sm hover:-translate-y-0.5 transition"
                  style={{ border: "1px solid rgba(139,69,19,0.10)" }}
                >
                  Find {plural(r)}
                  <ArrowUpRight size={11} strokeWidth={2.4}/>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Related planning topics */}
        <section className="mt-10">
          <h2 className="text-[13px] font-black uppercase tracking-[0.16em] text-neutral-500">
            Other planning permission checkers
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {PLANNING_PROJECTS.filter((p) => p !== project).map((p) => (
              <li key={p}>
                <Link
                  href={`/planning/${p}`}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-black text-neutral-800 shadow-sm hover:-translate-y-0.5 transition"
                  style={{ border: "1px solid rgba(139,69,19,0.10)" }}
                >
                  {cap(PLANNING_CONTENT[p].singular)}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <section className="mt-12 rounded-2xl border-2 p-6 md:p-8" style={{ borderColor: "#FFB300", backgroundColor: "#FFFDF6" }}>
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                Ready to move ahead?
              </p>
              <h3 className="mt-1 text-[20px] font-black leading-tight text-neutral-900 md:text-[24px]">
                Post one job — reach verified trades who handle planning + build
              </h3>
              <p className="mt-2 text-[12.5px] text-neutral-600 md:text-[13.5px]">
                No lead broker. No commission. Free for homeowners.
              </p>
            </div>
            <Link
              href="/sitebook"
              className="inline-flex h-12 items-center justify-center gap-1.5 rounded-lg px-6 text-[12.5px] font-black uppercase tracking-wider text-neutral-900 shadow-md active:scale-[0.97]"
              style={{ backgroundColor: "#FFB300" }}
            >
              Post your job free
              <ArrowUpRight size={14} strokeWidth={2.6}/>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
function plural(t: string): string {
  if (t.endsWith("er"))     return t + "s";
  if (t.endsWith("ician"))  return t + "s";
  if (t.endsWith("smith"))  return t + "s";
  if (t.endsWith("man"))    return t.slice(0, -3) + "men";
  return t + "s";
}
