// /apprenticeships — public hub for live apprenticeship requests.
//
// Two audiences on one page:
//   1. Young people — big "Apply now" CTA at the top
//   2. Verified trades — browse live requests + reveal contact (1 washer)
//
// Also a real SEO surface — ranks for "UK apprenticeship request",
// "plumber apprentice looking for job", city + trade permutations.

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight, GraduationCap, MapPin, Sparkles, ShieldCheck, Clock
} from "lucide-react";
import { BRAND, absolute } from "@/lib/seo";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CAREER_GUIDES } from "@/app/careers/config";
import { ApprenticeshipBanner } from "@/components/apprenticeships/ApprenticeshipBanner";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic  = "force-dynamic";
export const revalidate = 300;

export const metadata: Metadata = {
  title:       `UK Trade Apprenticeship Requests — ${BRAND.name}`,
  description: `Live UK apprenticeship requests from 16+ young people looking to learn plumbing, electrical, carpentry, plastering, and roofing trades. The Networkers supports UK trade youth.`,
  alternates:  { canonical: `/apprenticeships` },
  robots:      { index: true, follow: true },
  openGraph:   {
    type:     "website",
    siteName: BRAND.name,
    title:    `UK Trade Apprenticeship Requests`,
    description: `Local trade youth looking for apprenticeships in your area.`,
    url:      absolute(`/apprenticeships`)
  }
};

type LiveRequest = {
  id:            string;
  trade_slug:    string;
  full_name:     string;
  age:           number;
  city:          string | null;
  about_me:      string | null;
  worked_before: boolean;
  leaving_school: boolean;
  created_at:    string;
};

export default async function ApprenticeshipsHubPage() {
  const { data } = await supabaseAdmin
    .from("hammerex_apprenticeship_requests")
    .select("id, trade_slug, full_name, age, city, about_me, worked_before, leaving_school, created_at")
    .eq("status", "live")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(120);
  const requests: LiveRequest[] = (data ?? []) as LiveRequest[];

  const tradeLabel = (slug: string) =>
    CAREER_GUIDES.find((g) => g.slug === slug)?.displayName ?? slug.replace(/-/g, " ");

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Apprenticeships", item: absolute("/apprenticeships") }
    ]
  };

  return (
    <main className="min-h-screen bg-[#FBF6EC]">
      <SeoSiteHeader/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}/>

      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-6 md:py-12">
        <nav aria-label="Breadcrumbs" className="mb-4 flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
          <Link href="/" className="hover:text-neutral-900">Home</Link>
          <span aria-hidden>/</span>
          <span className="font-black text-neutral-900">Apprenticeships</span>
        </nav>

        {/* Recruitment banner — right-side CTA overlay */}
        <ApprenticeshipBanner
          variant="right-cta"
          ctaLabel="Apply today"
          href="/apprenticeships/apply"
          className="mb-6"
        />

        {/* Hero — commitment statement */}
        <header className="rounded-2xl border-2 p-6 md:p-8" style={{ borderColor: "#FFB300", backgroundColor: "#FFFDF6" }}>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-neutral-900">
            The Networkers supports UK trade youth
          </p>
          <h1 className="mt-2 text-[32px] font-black leading-tight text-neutral-900 md:text-[48px]">
            Live UK apprenticeship requests
          </h1>
          <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-neutral-700 md:text-[15px]">
            Young people (16+) applying to learn a trade in your area. Every request goes free to verified local trades. Employers pay 1 washer to reveal contact — that puts a small friction on speculative outreach so the young person only hears from serious employers.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/apprenticeships/apply"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-[11.5px] font-black uppercase tracking-wider text-neutral-900 shadow-md active:scale-[0.97]"
              style={{ backgroundColor: "#FFB300" }}
            >
              <Sparkles size={12} strokeWidth={2.6}/>
              Apply as an apprentice (16+)
              <ArrowUpRight size={12} strokeWidth={2.6}/>
            </Link>
            <Link
              href="/careers"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border-2 px-5 text-[11.5px] font-black uppercase tracking-wider text-neutral-900"
              style={{ borderColor: "rgba(139,69,19,0.20)" }}
            >
              <GraduationCap size={12} strokeWidth={2.6}/>
              Career guides
            </Link>
          </div>
        </header>

        {/* Live requests */}
        <section className="mt-10">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-[20px] font-black leading-tight text-neutral-900 md:text-[26px]">
                Live requests
              </h2>
              <p className="mt-1 text-[12px] text-neutral-500">
                {requests.length} apprenticeship{requests.length === 1 ? "" : "s"} looking for a trade employer right now
              </p>
            </div>
          </div>

          {requests.length === 0 ? (
            <div className="mt-4 rounded-2xl border-2 border-dashed bg-white p-8 text-center" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
              <p className="text-[13px] text-neutral-700">
                No live requests right now. If you're 16+ and want to learn a trade, you'll be the first —
                {" "}<Link href="/apprenticeships/apply" className="font-black text-neutral-900 underline">apply here</Link>.
              </p>
            </div>
          ) : (
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {requests.map((r) => {
                const firstName = r.full_name.split(/\s+/)[0] ?? r.full_name;
                return (
                  <li key={r.id}>
                    <Link
                      href={`/apprenticeships/${r.id}`}
                      className="group flex h-full flex-col rounded-2xl border-2 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                      style={{ borderColor: "rgba(139,69,19,0.10)" }}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "#FFB300" }}>
                          <GraduationCap size={16} strokeWidth={2.6} className="text-neutral-900"/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13.5px] font-black text-neutral-900">
                            {firstName}, {r.age}
                          </p>
                          <p className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
                            Wants to learn: {tradeLabel(r.trade_slug)}
                          </p>
                        </div>
                      </div>

                      {r.about_me && (
                        <p className="mt-3 line-clamp-3 text-[12px] leading-snug text-neutral-700">
                          {r.about_me}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
                        {r.city && <span className="inline-flex items-center gap-0.5"><MapPin size={10}/>{r.city}</span>}
                        {r.worked_before  && <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-2 py-0.5 text-green-800">Some experience</span>}
                        {r.leaving_school && <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 px-2 py-0.5 text-blue-800">Leaving school</span>}
                        <span className="inline-flex items-center gap-0.5"><Clock size={10}/>{timeAgo(r.created_at)}</span>
                      </div>

                      <p className="mt-3 inline-flex items-center gap-0.5 text-[10.5px] font-black uppercase tracking-wider text-neutral-500 group-hover:text-neutral-900">
                        View + contact (1 washer) <ArrowUpRight size={11} strokeWidth={2.6}/>
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <footer className="mt-12 flex flex-wrap items-center gap-4 border-t pt-6 text-[11px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <span className="inline-flex items-center gap-1"><ShieldCheck size={12}/> 16+ only · Address stays private · WhatsApp revealed only after 1-washer contact fee</span>
        </footer>
      </div>
    </main>
  );
}

function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "just now";
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
