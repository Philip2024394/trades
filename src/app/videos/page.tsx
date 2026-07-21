// /videos — Sitecast public hub. Toolbox pillar.
//
// v0.5 skeleton — no live uploads yet. Renders:
//   • Sitecast brand hero + tagline
//   • The three-class explainer (Feed / Portfolio / Knowledge Base)
//   • Seed category grid (linking to /videos/[category] once populated)
//   • Live-video grid (when videos exist)
//   • Editorial FAQs
//   • Toolbox resource bar
//
// Auto-switches from empty state to grid layout once published
// videos land in hammerex_videos.

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight, Video, ShieldCheck, Zap, Clock, Sparkles, Wrench, BookOpen
} from "lucide-react";
import { BRAND, absolute } from "@/lib/seo";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ResourcesBar } from "@/components/seo/ResourcesBar";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";
import {
  PLATFORM_NAME, PLATFORM_TAGLINE, PLATFORM_STRAPLINE, PLATFORM_INTRO,
  PLACEHOLDER_FRAME_URL, PLAY_BUTTON_URL,
  SEED_CATEGORIES, HUB_FAQS,
  VIDEO_CLASS_LABEL, VIDEO_CLASS_DESCRIPTION
} from "./config";

export const dynamic  = "force-dynamic";
export const revalidate = 300;

export const metadata: Metadata = {
  title:       `${PLATFORM_NAME} — ${PLATFORM_TAGLINE} · ${BRAND.name}`,
  description: `${PLATFORM_NAME} — UK trade video knowledge platform. Real project portfolios, install tutorials, product demos. Organised around jobs not creators. Free to browse; verified UK trades upload their work.`,
  alternates:  { canonical: `/videos` },
  openGraph:   {
    type:     "website",
    siteName: BRAND.name,
    title:    `${PLATFORM_NAME} · ${PLATFORM_TAGLINE}`,
    description: PLATFORM_INTRO,
    url:      absolute(`/videos`)
  },
  robots: { index: true, follow: true }
};

type LiveVideo = {
  id:              string;
  title:           string;
  description:     string | null;
  thumbnail_url:   string | null;
  merchant_slug:   string;
  category_slug:   string | null;
  duration_seconds: number | null;
  view_count:      number;
  published_at:    string | null;
};

export default async function VideosHubPage() {
  // Live videos (empty in v0.5 — table just created)
  let liveVideos: LiveVideo[] = [];
  try {
    const { data } = await supabaseAdmin
      .from("hammerex_videos")
      .select("id, title, description, thumbnail_url, merchant_slug, category_slug, duration_seconds, view_count, published_at")
      .eq("status", "live")
      .in("video_class", ["portfolio", "kb"])
      .order("published_at", { ascending: false })
      .limit(24);
    liveVideos = (data ?? []) as LiveVideo[];
  } catch {
    liveVideos = [];
  }

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: PLATFORM_NAME, item: absolute("/videos") }
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
          <span className="font-black text-neutral-900">{PLATFORM_NAME}</span>
        </nav>

        {/* Brand hero — full-bleed background image + dark scrim + white overlay copy */}
        <header
          className="relative overflow-hidden rounded-2xl border-2 shadow-sm"
          style={{ borderColor: "#FFB300", backgroundColor: "#0A0A0A" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2020,%202026,%2010_19_46%20AM.png"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
          />
          {/* Left-heavy dark scrim — copy sits on the left; keeps AA contrast on white text */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.58) 55%, rgba(0,0,0,0.25) 100%)" }}
          />
          <div className="relative p-6 md:p-12">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: "#FFB300" }}>
                <Video size={16} strokeWidth={2.6} className="text-neutral-900"/>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
                {PLATFORM_TAGLINE}
              </p>
            </div>
            <h1 className="mt-3 text-[40px] font-black leading-tight text-white md:text-[64px]" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.35)" }}>
              {PLATFORM_NAME}
            </h1>
            <p className="mt-2 text-[13px] font-black uppercase tracking-wider text-neutral-100 md:text-[14px]">
              {PLATFORM_STRAPLINE}
            </p>
            <p className="mt-4 max-w-3xl text-[13.5px] leading-relaxed text-neutral-100 md:text-[16px]">
              {PLATFORM_INTRO}
            </p>
          </div>
        </header>

        {/* Three-class explainer */}
        <section className="mt-8">
          <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
            How {PLATFORM_NAME} works — 3 video classes
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <ClassCard eyebrow={VIDEO_CLASS_LABEL.feed}      title="30-day lifespan"     description={VIDEO_CLASS_DESCRIPTION.feed}      Icon={Zap}    tint="#F59E0B"/>
            <ClassCard eyebrow={VIDEO_CLASS_LABEL.portfolio} title="Permanent showcase"  description={VIDEO_CLASS_DESCRIPTION.portfolio} Icon={Wrench} tint="#0A0A0A"/>
            <ClassCard eyebrow={VIDEO_CLASS_LABEL.kb}        title="Admin-curated · SEO" description={VIDEO_CLASS_DESCRIPTION.kb}        Icon={BookOpen} tint="#166534"/>
          </ul>
        </section>

        {/* Categories */}
        <section className="mt-10">
          <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
            Browse by trade category
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {SEED_CATEGORIES.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/videos/c/${c.slug}`}
                  className="group flex h-full flex-col rounded-2xl border-2 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                  style={{ borderColor: "rgba(139,69,19,0.10)" }}
                >
                  <p className="text-[13px] font-black text-neutral-900">{c.displayName}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] text-neutral-500">{c.description}</p>
                  <p className="mt-auto inline-flex items-center gap-0.5 pt-3 text-[9.5px] font-black uppercase tracking-wider text-neutral-500 group-hover:text-neutral-900">
                    Browse <ArrowUpRight size={10} strokeWidth={2.6}/>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-neutral-500">
            Category browse pages activate as verified trades start uploading. Every upload lands in one or more of these categories via AI auto-classification (Phase 2).
          </p>
        </section>

        {/* Live videos or empty state */}
        <section className="mt-10">
          {liveVideos.length === 0 ? (
            <div
              className="rounded-2xl border-2 border-dashed bg-white p-8 text-center md:p-12"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: "#FFB300" }}>
                <Video size={24} strokeWidth={2.6} className="text-neutral-900"/>
              </div>
              <h2 className="mt-4 text-[20px] font-black text-neutral-900 md:text-[24px]">
                {PLATFORM_NAME} launches the day the first verified trade uploads
              </h2>
              <p className="mt-2 max-w-2xl mx-auto text-[13px] text-neutral-600">
                We refuse to seed with stock footage or fabricated portfolios. Every video on {PLATFORM_NAME} is a real UK trade's own work. Verified Networkers members can upload from their profile.
              </p>
              <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-neutral-900 px-3 py-1 text-[10.5px] font-black uppercase tracking-wider text-white">
                <ShieldCheck size={11} strokeWidth={2.6}/>
                Evidence-first · No fabricated content
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                Latest · {liveVideos.length} videos
              </h2>
              <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {liveVideos.map((v) => (
                  <li key={v.id}>
                    <Link
                      href={`/videos/${v.id}`}
                      className="group flex h-full flex-col overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                      style={{ borderColor: "rgba(139,69,19,0.10)" }}
                    >
                      <div className="relative aspect-video w-full overflow-hidden bg-neutral-900">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={v.thumbnail_url ?? PLACEHOLDER_FRAME_URL}
                          alt={v.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                        {/* Centered play-button overlay — decorative signal */}
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.25) 100%)" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={PLAY_BUTTON_URL} alt="" aria-hidden="true" className="drop-shadow-lg h-14 w-14 md:h-16 md:w-16"/>
                        </div>
                        {/* Title overlay — top-anchored inside the frame's
                            dark left ~⅓ zone. Watermark in bottom-left of
                            frame stays visible + uncovered. Title only —
                            merchant name lives below the thumbnail. */}
                        <div className="pointer-events-none absolute top-0 left-0 flex w-[38%] flex-col justify-start p-2.5 md:p-3">
                          <p className="text-[11px] font-black leading-tight text-white line-clamp-3 md:text-[12.5px]" style={{ textShadow: "0 2px 6px rgba(0,0,0,0.85)" }}>
                            {v.title}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col p-4">
                        <h3 className="text-[14px] font-black leading-snug text-neutral-900">{v.title}</h3>
                        <p className="mt-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
                          {v.merchant_slug.replace(/-/g, " ")}
                          {v.duration_seconds ? ` · ${formatDuration(v.duration_seconds)}` : ""}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* AI Assistant per video — vision teaser (Phase 4-5) */}
        <section
          className="mt-10 rounded-2xl border-2 p-6 shadow-sm md:p-8"
          style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#FFFFFF" }}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={16} strokeWidth={2.6} className="text-[#FFB300]"/>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
              Coming to every {PLATFORM_NAME} video
            </p>
          </div>
          <h2 className="mt-2 text-[20px] font-black leading-tight text-neutral-900 md:text-[26px]">
            Every video becomes an AI assistant
          </h2>
          <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-neutral-700 md:text-[14.5px]">
            The AI already knows the transcript, products used, measurements, regulations, the company, tools, and supplier info. A homeowner asks "how much for my house?" — real answer, sourced from the video. A joiner asks "what router cutter did he use?" — exact product + link to buy. An apprentice asks "explain step 7" — plain-English breakdown. Every {PLATFORM_NAME} video becomes an interactive learning + sales asset.
          </p>
        </section>

        {/* Hub FAQs */}
        <section className="mt-10">
          <h2 className="text-[20px] font-black leading-tight text-neutral-900 md:text-[26px]">
            About {PLATFORM_NAME}
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
          <span className="inline-flex items-center gap-1"><ShieldCheck size={12}/> Every video is a real UK trade's own work · Evidence-first</span>
          <Link href="/toolbox" className="inline-flex items-center gap-0.5 hover:text-neutral-900">
            The Toolbox <ArrowUpRight size={11}/>
          </Link>
        </footer>
      </div>
    </main>
  );
}

function ClassCard({ eyebrow, title, description, Icon, tint }: { eyebrow: string; title: string; description: string; Icon: typeof Zap; tint: string }) {
  return (
    <li className="rounded-2xl border-2 bg-white p-5 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: tint }}>
          <Icon size={14} strokeWidth={2.6} className={tint === "#0A0A0A" || tint === "#166534" ? "text-white" : "text-neutral-900"}/>
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">{eyebrow}</p>
      </div>
      <p className="mt-2 text-[15px] font-black text-neutral-900">{title}</p>
      <p className="mt-1 text-[12px] leading-snug text-neutral-600">{description}</p>
    </li>
  );
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
