// /videos/[id] — Sitefix video leaf.
//
// Renders a single video with VideoObject JSON-LD (for Google video
// search + rich snippets). Business-metric tracking hooked into the
// view event. AI-assistant-per-video slot reserved for Phase 4-5.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Video, ShieldCheck, Sparkles, Clock, PlayCircle } from "lucide-react";
import { BRAND, absolute } from "@/lib/seo";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";
import { ResourcesBar } from "@/components/seo/ResourcesBar";
import { PLATFORM_NAME, PLATFORM_TAGLINE, PLATFORM_STRAPLINE, PLACEHOLDER_FRAME_URL } from "../config";
import { VideoPlayerWithPoster } from "./VideoPlayerWithPoster";
import { AskAiPanel } from "./AskAiPanel";
import { JobBuilderCard } from "./JobBuilderCard";
import { VideoGallery, type GalleryImage, type FinishTopic } from "./VideoGallery";

export const dynamic = "force-dynamic";
export const revalidate = 300;

type VideoRow = {
  id:                   string;
  merchant_slug:        string;
  title:                string;
  description:          string | null;
  video_url:            string;
  thumbnail_url:        string | null;
  duration_seconds:     number | null;
  video_class:          "feed" | "portfolio" | "kb";
  category_slug:        string | null;
  trade_slug:           string | null;
  city:                 string | null;
  transcript:           string | null;
  keywords:             string[] | null;
  chapters:             Array<{ start_s: number; title: string }> | null;
  faqs:                 Array<{ q: string; a: string }> | null;
  view_count:           number;
  published_at:         string | null;
};

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const { data } = await supabaseAdmin
    .from("hammerex_videos")
    .select("title, description, thumbnail_url, video_url, duration_seconds, keywords, hashtags, city, trade_slug, category_slug, published_at")
    .eq("id", id)
    .eq("status", "live")
    .maybeSingle();
  if (!data) return { title: "Video not found" };

  const canonical  = absolute(`/videos/${id}`);
  const pageDesc   = data.description?.slice(0, 155) ?? `${PLATFORM_NAME} · ${PLATFORM_TAGLINE}`;
  const kwFromAI   = Array.isArray(data.keywords) ? data.keywords : [];
  const hashtags   = Array.isArray(data.hashtags) ? data.hashtags : [];
  const derived    = [
    data.category_slug, data.trade_slug, data.city,
    "UK trade video", "how-to", BRAND.name.toLowerCase()
  ].filter(Boolean) as string[];
  const keywords   = [...new Set([...kwFromAI, ...hashtags.map((h: string) => h.replace(/^#/, "")), ...derived])].slice(0, 20);
  const thumb      = data.thumbnail_url;

  return {
    title:       `${data.title} — ${PLATFORM_NAME}`,
    description: pageDesc,
    keywords:    keywords.length > 0 ? keywords.join(", ") : undefined,
    alternates:  { canonical },
    openGraph:   {
      type:      "video.other",
      siteName:  BRAND.name,
      title:     data.title,
      description: pageDesc,
      url:       canonical,
      locale:    "en_GB",
      publishedTime: data.published_at ?? undefined,
      images:    thumb ? [{ url: thumb, width: 1280, height: 720, alt: data.title }] : undefined,
      videos:    [{
        url:         data.video_url,
        secureUrl:   data.video_url,
        type:        "video/mp4",
        width:       1280,
        height:      720
      }]
    },
    twitter: {
      card:        "player",
      site:        "@networkersapp",
      title:       data.title,
      description: pageDesc,
      images:      thumb ? [thumb] : undefined,
      players:     [{ playerUrl: canonical, streamUrl: data.video_url, width: 1280, height: 720 }]
    },
    other: {
      "og:video:tag":               keywords.slice(0, 10).join(","),
      "video:duration":              data.duration_seconds ? String(data.duration_seconds) : "",
      "article:published_time":     data.published_at ?? "",
      "article:section":            data.category_slug ?? ""
    },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1 } }
  };
}

export default async function VideoLeafPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [{ data }, { data: gallery }] = await Promise.all([
    supabaseAdmin
      .from("hammerex_videos")
      .select("id, merchant_slug, title, description, video_url, thumbnail_url, duration_seconds, video_class, category_slug, trade_slug, city, transcript, keywords, chapters, faqs, view_count, published_at, knowledge_pack_trade")
      .eq("id", id)
      .eq("status", "live")
      .maybeSingle(),
    supabaseAdmin
      .from("hammerex_video_gallery")
      .select("id, image_url, caption, alt_text, credit, disclaimer, sort_order, position")
      .eq("video_id", id)
      .order("sort_order", { ascending: true })
  ]);

  const video = data as (VideoRow & { knowledge_pack_trade?: string | null }) | null;
  if (!video) notFound();
  const galleryImages = (gallery ?? []) as GalleryImage[];

  // Finish-type topics for the right-hand side of the gallery.
  // Pulled from the video's linked KB pack (e.g. decorative-rendering)
  // and filtered to topics that represent actual finish variations
  // (excludes generic topics like fundamentals/tools/safety).
  let finishTopics: FinishTopic[] = [];
  if (video.knowledge_pack_trade) {
    const NON_FINISH_TOPICS = new Set([
      "fundamentals","materials","tools","preparation","safety",
      "regulations","failure","curing","testing","joints"
    ]);
    const { data: topics } = await supabaseAdmin
      .from("hammerex_knowledge_topics")
      .select("slug, display_name, description")
      .eq("trade_slug", video.knowledge_pack_trade)
      .order("sort_order", { ascending: true });
    finishTopics = (topics ?? [])
      .filter((t: any) => !NON_FINISH_TOPICS.has(t.slug))
      .slice(0, 14);
  }

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: PLATFORM_NAME, item: absolute("/videos") },
      { "@type": "ListItem", position: 2, name: video.title,   item: absolute(`/videos/${video.id}`) }
    ]
  };
  // Chapters → Clip[] for Google Key Moments SERP feature.
  // Each Clip needs startOffset + endOffset + url with #t=start.
  const clips = (video.chapters ?? []).map((c, idx, arr) => {
    const end = arr[idx + 1]?.start_s ?? video.duration_seconds ?? c.start_s + 30;
    return {
      "@type":      "Clip",
      name:         c.title,
      startOffset:  c.start_s,
      endOffset:    end,
      url:          absolute(`/videos/${video.id}#t=${c.start_s}`)
    };
  });

  const videoLd: Record<string, unknown> = {
    "@context":       "https://schema.org",
    "@type":          "VideoObject",
    "@id":            absolute(`/videos/${video.id}#video`),
    name:             video.title,
    description:      video.description ?? video.title,
    thumbnailUrl:     video.thumbnail_url
      ? [video.thumbnail_url]
      : [absolute("/og-default-video.jpg")],   // fallback OG image
    uploadDate:       video.published_at ?? new Date().toISOString(),
    duration:         video.duration_seconds ? `PT${Math.floor(video.duration_seconds/60)}M${video.duration_seconds%60}S` : undefined,
    contentUrl:       video.video_url,
    embedUrl:         absolute(`/videos/${video.id}`),
    inLanguage:       "en-GB",
    isFamilyFriendly: true,
    regionsAllowed:   "GB,IE",
    keywords:         video.keywords && video.keywords.length > 0 ? video.keywords.join(", ") : undefined,
    genre:            video.category_slug ? `${video.category_slug} · UK trades` : "UK trades",
    ...(video.transcript ? { transcript: video.transcript.slice(0, 5000) } : {}),
    ...(clips.length > 0 ? { hasPart: clips } : {}),
    publisher: {
      "@type":  "Organization",
      "@id":    absolute("/#org"),
      name:     BRAND.name,
      url:      absolute("/"),
      logo: {
        "@type": "ImageObject",
        url:     BRAND.logo,
        width:   600,
        height:  60
      }
    },
    ...(video.merchant_slug ? {
      creator: {
        "@type": "Person",
        name:    video.merchant_slug.replace(/-/g, " "),
        url:     absolute(`/${video.merchant_slug}`)
      }
    } : {}),
    interactionStatistic: {
      "@type":              "InteractionCounter",
      interactionType:      { "@type": "WatchAction" },
      userInteractionCount: video.view_count
    },
    potentialAction: clips.length > 0 ? {
      "@type":       "SeekToAction",
      target:        absolute(`/videos/${video.id}?t={seek_to_second_number}`),
      "startOffset-input": "required name=seek_to_second_number"
    } : undefined
  };
  const faqLd = (video.faqs && video.faqs.length > 0) ? {
    "@context": "https://schema.org",
    "@type":    "FAQPage",
    mainEntity: video.faqs.map((f) => ({
      "@type": "Question",
      name:    f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a }
    }))
  } : null;

  return (
    <main className="min-h-screen bg-[#FBF6EC]">
      <SeoSiteHeader/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(videoLd) }}/>
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}/>}

      {/* Breadcrumbs — narrow container above the full-bleed player */}
      <div className="mx-auto max-w-[1200px] px-4 pt-6 md:px-6 md:pt-8">
        <nav aria-label="Breadcrumbs" className="flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
          <Link href="/" className="hover:text-neutral-900">Home</Link>
          <span aria-hidden>/</span>
          <Link href="/videos" className="hover:text-neutral-900">{PLATFORM_NAME}</Link>
          <span aria-hidden>/</span>
          <span className="font-black text-neutral-900 line-clamp-1">{video.title}</span>
        </nav>
      </div>

      {/* Video player — max 1200px wide, all 4 corners rounded, centred */}
      <div className="mx-auto mt-4 max-w-[1200px] px-4 md:px-6">
        <VideoPlayerWithPoster
          videoId={video.id}
          videoUrl={video.video_url}
          posterUrl={video.thumbnail_url ?? PLACEHOLDER_FRAME_URL}
          title={video.title}
          merchantSlug={video.merchant_slug}
          viewCount={video.view_count}
          saveCount={video.save_count}
          publishedAt={video.published_at}
          durationSeconds={video.duration_seconds}
        />
      </div>

      {/* Rest of leaf content — narrow max container with proper padding */}
      <div className="mx-auto max-w-[1000px] px-4 py-8 md:px-6 md:py-12">

        {/* Title + description container — padded card below the video */}
        <header className="rounded-2xl border-2 bg-white p-6 shadow-sm md:p-8" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider" style={{ backgroundColor: "#0A0A0A", color: "#FFFFFF" }}>
              {video.video_class}
            </span>
            {video.category_slug && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider" style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}>
                {video.category_slug}
              </span>
            )}
            <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
              {PLATFORM_NAME}
            </p>
          </div>
          <h1 className="mt-3 text-[24px] font-black leading-tight text-neutral-900 md:text-[36px]">
            {video.title}
          </h1>
          <p className="mt-2 inline-flex flex-wrap items-center gap-3 text-[11px] font-black uppercase tracking-wider text-neutral-500">
            <Link href={`/${video.merchant_slug}`} className="hover:text-neutral-900 hover:underline">
              {video.merchant_slug.replace(/-/g, " ")}
            </Link>
            {video.city && <><span>·</span><span>{video.city}</span></>}
            {video.published_at && (
              <><span>·</span><span>Uploaded {new Date(video.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span></>
            )}
          </p>
          {video.description && (
            <p className="mt-4 text-[14px] leading-relaxed text-neutral-700 md:text-[15.5px]">
              {video.description}
            </p>
          )}

          {/* Keywords / tags — visible for SEO signal + Google understanding.
              Also helps user scannability. Rendered as tag chips. */}
          {video.keywords && video.keywords.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Topics">
              {video.keywords.slice(0, 15).map((kw) => (
                <li key={kw}>
                  <span
                    className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-black text-neutral-700"
                    style={{ borderColor: "rgba(139,69,19,0.20)", backgroundColor: "#FBF6EC" }}
                  >
                    {kw}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {/* Save button now lives OVER the video (top-right corner)
              via OverVideoSaveButton — see VideoPlayerWithPoster. */}
        </header>

        {/* Reference gallery — enlarge-on-click images in a black
            container on the left, finish-type chips list on the right.
            Fully client-side via VideoGallery for the lightbox. */}
        {galleryImages.length > 0 && (
          <VideoGallery
            images={galleryImages}
            finishes={finishTopics}
            tradeSlug={video.knowledge_pack_trade ?? video.trade_slug}
          />
        )}

        {/* AI container — Job Builder on top, Ask AI below */}
        <div className="mt-8 space-y-3">
          <JobBuilderCard videoId={video.id}/>
          <AskAiPanel videoId={video.id}/>
        </div>

        {/* Chapters — populates from AI (Phase 2) */}
        {video.chapters && video.chapters.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Chapters</h2>
            <ol className="mt-3 space-y-1.5">
              {video.chapters.map((c, i) => (
                <li key={i} className="rounded-lg border bg-white px-3 py-2 text-[13px]" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                  <span className="mr-2 font-black tabular-nums text-neutral-500">
                    {Math.floor(c.start_s / 60)}:{String(c.start_s % 60).padStart(2, "0")}
                  </span>
                  <span className="text-neutral-800">{c.title}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Transcript — populates from Whisper (Phase 2) */}
        {video.transcript && (
          <section className="mt-8">
            <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Transcript</h2>
            <div className="mt-3 rounded-2xl border bg-white p-4 text-[13px] leading-relaxed text-neutral-700 whitespace-pre-wrap" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
              {video.transcript}
            </div>
          </section>
        )}

        {/* FAQs — populates from AI (Phase 2) */}
        {video.faqs && video.faqs.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Common questions</h2>
            <div className="mt-3 space-y-3">
              {video.faqs.map((f) => (
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
        )}

        {/* Trade credit */}
        <section
          className="mt-10 rounded-2xl border-2 p-5 shadow-sm md:p-6"
          style={{ borderColor: "#FFB300", backgroundColor: "#FFFDF6" }}
        >
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                {PLATFORM_STRAPLINE}
              </p>
              <h3 className="mt-1 text-[16px] font-black leading-tight text-neutral-900 md:text-[18px]">
                Delivered by{" "}
                <Link href={`/${video.merchant_slug}`} className="hover:underline">
                  {video.merchant_slug.replace(/-/g, " ")}
                </Link>
              </h3>
              <p className="mt-1 text-[12px] text-neutral-600">
                Direct WhatsApp contact via their Networkers profile.
              </p>
            </div>
            <Link
              href={`/${video.merchant_slug}`}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-[11.5px] font-black uppercase tracking-wider text-neutral-900 shadow-sm active:scale-[0.97]"
              style={{ backgroundColor: "#FFB300" }}
            >
              View trade profile
              <ArrowUpRight size={12} strokeWidth={2.6}/>
            </Link>
          </div>
        </section>

        <ResourcesBar active="toolbox" className="mt-8"/>

        <footer className="mt-8 flex flex-wrap items-center gap-4 border-t pt-6 text-[11px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <span className="inline-flex items-center gap-1"><ShieldCheck size={12}/> {PLATFORM_NAME} · Real UK trade work, moderated + verified</span>
          <Link href="/videos" className="inline-flex items-center gap-0.5 hover:text-neutral-900">
            <Video size={11}/> All {PLATFORM_NAME} videos
          </Link>
        </footer>
      </div>
    </main>
  );
}
