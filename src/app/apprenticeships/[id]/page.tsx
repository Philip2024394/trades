// /apprenticeships/[id] — apprenticeship request detail (trade-facing).
//
// Public-viewable fields only. WhatsApp + address are hidden behind
// the 1-washer contact gate — revealed by the ContactGate client
// component after a successful POST /api/apprenticeships/[id]/contact.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  GraduationCap, MapPin, Clock, CircleCheck, ShieldCheck,
  ArrowUpRight, User, FileText, Camera
} from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { BRAND, absolute } from "@/lib/seo";
import { CAREER_GUIDES } from "@/app/careers/config";
import { ContactGate } from "./contact-gate";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const { data } = await supabaseAdmin
    .from("hammerex_apprenticeship_requests")
    .select("trade_slug, full_name, city, age, about_me")
    .eq("id", id)
    .maybeSingle();
  if (!data) return { title: "Apprenticeship request not found" };
  const trade = CAREER_GUIDES.find((g) => g.slug === data.trade_slug)?.displayName ?? data.trade_slug;
  const firstName = data.full_name.split(/\s+/)[0] ?? "";
  return {
    title:       `${firstName} (${data.age}) — ${trade} apprenticeship in ${data.city ?? "the UK"} — ${BRAND.name}`,
    description: data.about_me?.slice(0, 160) ?? `Young person applying for a ${trade.toLowerCase()} apprenticeship.`,
    alternates:  { canonical: `/apprenticeships/${id}` },
    robots:      { index: false, follow: true }
  };
}

export default async function ApprenticeshipDetailPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data } = await supabaseAdmin
    .from("hammerex_apprenticeship_requests")
    .select("id, trade_slug, full_name, age, city, postcode, about_me, experience_summary, worked_before, leaving_school, cv_url, photo_url, created_at, contact_count, status, expires_at")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  if (data.status !== "live") notFound();

  const trade = CAREER_GUIDES.find((g) => g.slug === data.trade_slug)?.displayName ?? data.trade_slug;
  const firstName = data.full_name.split(/\s+/)[0] ?? data.full_name;

  return (
    <main className="min-h-screen bg-[#FBF6EC]">
      <SeoSiteHeader/>
      <div className="mx-auto max-w-[900px] px-4 py-8 md:px-6 md:py-12">
        <nav aria-label="Breadcrumbs" className="mb-4 flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
          <Link href="/" className="hover:text-neutral-900">Home</Link>
          <span aria-hidden>/</span>
          <Link href="/apprenticeships" className="hover:text-neutral-900">Apprenticeships</Link>
          <span aria-hidden>/</span>
          <span className="font-black text-neutral-900">{firstName}, {data.age}</span>
        </nav>

        <header className="rounded-2xl border-2 bg-white p-6 shadow-sm md:p-8" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <div className="flex items-start gap-4">
            {data.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.photo_url} alt={firstName} className="h-16 w-16 shrink-0 rounded-full object-cover"/>
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "#FFB300" }}>
                <User size={26} strokeWidth={2.4} className="text-neutral-900"/>
              </div>
            )}
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
                {timeAgo(data.created_at)} · {data.contact_count} employer{data.contact_count === 1 ? "" : "s"} already interested
              </p>
              <h1 className="mt-1 text-[28px] font-black leading-tight text-neutral-900 md:text-[36px]">
                {firstName}, {data.age}
              </h1>
              <p className="mt-1 text-[13px] font-black text-neutral-700">
                Wants to learn: <span className="text-neutral-900">{trade}</span>
              </p>
              {data.city && (
                <p className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-black uppercase tracking-wider text-neutral-500">
                  <MapPin size={11}/> {data.city}
                </p>
              )}
            </div>
          </div>

          {/* Status chips */}
          <div className="mt-4 flex flex-wrap gap-2 text-[10.5px] font-black uppercase tracking-wider">
            {data.worked_before  && <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-green-800"><CircleCheck size={10}/> Some experience</span>}
            {data.leaving_school && <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-blue-800"><Clock size={10}/> Leaving school</span>}
          </div>
        </header>

        {data.about_me && (
          <Section title="About them">
            <p className="text-[13.5px] leading-relaxed text-neutral-800">{data.about_me}</p>
          </Section>
        )}

        {data.experience_summary && (
          <Section title="Experience so far">
            <p className="text-[13.5px] leading-relaxed text-neutral-800">{data.experience_summary}</p>
          </Section>
        )}

        {(data.cv_url || data.photo_url) && (
          <Section title="Attachments">
            <div className="flex flex-wrap gap-2">
              {data.cv_url && (
                <a
                  href={data.cv_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border-2 bg-white px-3 py-2 text-[11.5px] font-black uppercase tracking-wider text-neutral-900"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                >
                  <FileText size={12}/> View CV <ArrowUpRight size={11}/>
                </a>
              )}
              {data.photo_url && (
                <a
                  href={data.photo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border-2 bg-white px-3 py-2 text-[11.5px] font-black uppercase tracking-wider text-neutral-900"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                >
                  <Camera size={12}/> View photo <ArrowUpRight size={11}/>
                </a>
              )}
            </div>
          </Section>
        )}

        {/* Contact gate — trade-facing */}
        <section className="mt-6">
          <ContactGate requestId={data.id} firstName={firstName}/>
        </section>

        <footer className="mt-8 rounded-2xl border-2 p-5" style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#FFFFFF" }}>
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
            <ShieldCheck size={11} className="mb-0.5 inline"/> The Networkers commitment
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-neutral-700">
            Every apprenticeship we route to a verified trade is one more UK trade youth on the path to becoming the next networker. We charge 1 washer for contact — that's it. No commission on wages. No lead-broker fees. No repeat charges.
          </p>
        </footer>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-2xl border-2 bg-white p-5 md:p-6" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
      <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
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
