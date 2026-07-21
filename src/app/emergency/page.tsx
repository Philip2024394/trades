// /emergency — UK trade emergency hub.

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight, AlertTriangle, ShieldCheck, Zap, Droplet,
  Flame, Home, Key
} from "lucide-react";
import { BRAND, absolute } from "@/lib/seo";
import { EMERGENCIES, HUB_FAQS } from "./config";
import { ResourcesBar } from "@/components/seo/ResourcesBar";
import { LifeSafetyBlock } from "@/components/emergency/LifeSafetyBlock";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic  = "force-static";
export const revalidate = 86400;

export const metadata: Metadata = {
  title:       `UK Trade Emergency · Gas Leak, Burst Pipe, Power Failure — ${BRAND.name}`,
  description: `UK trade emergency guide — what to do first for gas leaks, burst pipes, power failures, roof leaks, lockouts, blocked drains. Life-safety numbers + expected costs + verified trades.`,
  alternates:  { canonical: `/emergency` },
  openGraph:   {
    type:     "website",
    siteName: BRAND.name,
    title:    `UK Trade Emergency`,
    description: `Life-safety numbers + first steps + verified UK emergency trades.`,
    url:      absolute(`/emergency`)
  },
  robots: { index: true, follow: true }
};

const ICON_MAP: Record<string, typeof Zap> = {
  "gas-leak":      Flame,
  "burst-pipe":    Droplet,
  "power-failure": Zap,
  "roof-leak":     Home,
  "locked-out":    Key,
  "blocked-drain": Droplet
};

export default function EmergencyHubPage() {
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "UK Trade Emergency", item: absolute("/emergency") }
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
          <span className="font-black text-neutral-900">UK Trade Emergency</span>
        </nav>

        {/* Emergency hero banner + life-safety numbers with copy-to-clipboard */}
        <LifeSafetyBlock/>

        <header className="mt-8">
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
            UK trade emergency
          </p>
          <h1 className="mt-1 text-[36px] font-black leading-tight text-neutral-900 md:text-[52px]">
            What to do first — then who to call
          </h1>
          <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-neutral-600 md:text-[15px]">
            Six common UK trade emergencies. Each page: life-safety check first, then damage-limitation steps you can do NOW, then expected response time + cost, then a verified local trade.
          </p>
        </header>

        {/* Emergency cards */}
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EMERGENCIES.map((e) => {
            const Icon = ICON_MAP[e.slug] ?? AlertTriangle;
            return (
              <li key={e.slug}>
                <Link
                  href={`/emergency/${e.slug}`}
                  className="group flex h-full flex-col rounded-2xl border-2 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                  style={{ borderColor: "rgba(139,69,19,0.10)" }}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "#DC2626" }}>
                      <Icon size={16} strokeWidth={2.6} className="text-white"/>
                    </div>
                    <h2 className="text-[17px] font-black leading-tight text-neutral-900">
                      {e.displayName}
                    </h2>
                  </div>
                  <p className="mt-3 line-clamp-3 text-[12px] leading-snug text-neutral-600">
                    {e.definition}
                  </p>
                  <p className="mt-3 inline-flex items-center gap-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
                    <span>{e.expectations.responseTime.split(";")[0].trim()}</span>
                  </p>
                  <p className="mt-3 inline-flex items-center gap-0.5 text-[10.5px] font-black uppercase tracking-wider text-neutral-500 group-hover:text-neutral-900">
                    Guide + verified trades <ArrowUpRight size={11} strokeWidth={2.6}/>
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Hub FAQs */}
        <section className="mt-12">
          <h2 className="text-[20px] font-black leading-tight text-neutral-900 md:text-[26px]">
            Emergency questions
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

        <footer className="mt-8 flex flex-wrap items-center gap-4 border-t pt-6 text-[11px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <span className="inline-flex items-center gap-1"><ShieldCheck size={12}/> Pricing sourced from UK Trade Price Index · Refreshed monthly</span>
          <span>Not a substitute for professional advice · If in doubt call 999</span>
        </footer>
      </div>
    </main>
  );
}

