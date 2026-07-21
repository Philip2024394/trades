// /videos/c/[category] — Networkers TV category browse.
//
// One page per top-level category (plumbing, electrical, etc). Lists
// every live portfolio + KB video tagged to that category. Feed-class
// videos never appear here — they belong on the Yard, not the SEO
// browse surface.
//
// URL structure: /videos/c/[category] — the /c/ prefix keeps
// categories out of the /videos/[id] namespace so word-slugs never
// collide with UUID video IDs.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Video, ShieldCheck, PlayCircle, Clock } from "lucide-react";
import { BRAND, absolute } from "@/lib/seo";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";
import { ResourcesBar } from "@/components/seo/ResourcesBar";
import { PLATFORM_NAME, PLATFORM_STRAPLINE, PLACEHOLDER_FRAME_URL, PLAY_BUTTON_URL } from "../../config";

export const dynamic = "force-dynamic";
export const revalidate = 300;

type Category = {
  slug:         string;
  display_name: string;
  description:  string | null;
  trade_slugs:  string[];
  video_count:  number;
};

type VideoRow = {
  id:               string;
  title:            string;
  description:      string | null;
  thumbnail_url:    string | null;
  duration_seconds: number | null;
  merchant_slug:    string;
  view_count:       number;
  published_at:     string | null;
};

export async function generateMetadata(
  { params }: { params: Promise<{ category: string }> }
): Promise<Metadata> {
  const { category } = await params;
  const { data } = await supabaseAdmin
    .from("hammerex_video_categories")
    .select("display_name, description")
    .eq("slug", category)
    .maybeSingle();
  if (!data) return { title: "Category not found" };
  return {
    title:       `${data.display_name} videos — ${PLATFORM_NAME}`,
    description: `${data.description ?? ""} · ${PLATFORM_STRAPLINE}`,
    alternates:  { canonical: `/videos/c/${category}` },
    openGraph:   {
      type:     "website",
      siteName: BRAND.name,
      title:    `${data.display_name} · ${PLATFORM_NAME}`,
      description: data.description ?? undefined,
      url:      absolute(`/videos/c/${category}`)
    },
    robots: { index: true, follow: true }
  };
}

export default async function CategoryBrowsePage(
  { params }: { params: Promise<{ category: string }> }
) {
  const { category } = await params;

  const { data: catData } = await supabaseAdmin
    .from("hammerex_video_categories")
    .select("slug, display_name, description, trade_slugs, video_count")
    .eq("slug", category)
    .maybeSingle();
  const cat = catData as Category | null;
  if (!cat) notFound();

  const { data: videosData } = await supabaseAdmin
    .from("hammerex_videos")
    .select("id, title, description, thumbnail_url, duration_seconds, merchant_slug, view_count, published_at")
    .eq("category_slug", category)
    .eq("status", "live")
    .in("video_class", ["portfolio", "kb"])
    .order("published_at", { ascending: false })
    .limit(60);
  const videos = (videosData ?? []) as VideoRow[];

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: PLATFORM_NAME,   item: absolute("/videos") },
      { "@type": "ListItem", position: 2, name: cat.display_name, item: absolute(`/videos/c/${category}`) }
    ]
  };
  // CollectionPage — Google understands this is a category grouping
  const collectionLd = {
    "@context":   "https://schema.org",
    "@type":      "CollectionPage",
    name:         `${cat.display_name} videos — ${PLATFORM_NAME}`,
    description:  cat.description ?? undefined,
    url:          absolute(`/videos/c/${category}`),
    isPartOf:     { "@type": "WebSite", name: PLATFORM_NAME, url: absolute("/videos") }
  };

  return (
    <main className="min-h-screen bg-[#FBF6EC]">
      <SeoSiteHeader/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }}/>

      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-6 md:py-12">
        <nav aria-label="Breadcrumbs" className="mb-4 flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
          <Link href="/" className="hover:text-neutral-900">Home</Link>
          <span aria-hidden>/</span>
          <Link href="/videos" className="hover:text-neutral-900">{PLATFORM_NAME}</Link>
          <span aria-hidden>/</span>
          <span className="font-black text-neutral-900">{cat.display_name}</span>
        </nav>

        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
            {PLATFORM_NAME} category
          </p>
          <h1 className="mt-1 text-[32px] font-black leading-tight text-neutral-900 md:text-[44px]">
            {cat.display_name} videos
          </h1>
          {cat.description && (
            <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-neutral-700 md:text-[15px]">
              {cat.description}
            </p>
          )}
          <p className="mt-3 text-[11px] font-black uppercase tracking-wider text-neutral-500">
            {videos.length} live video{videos.length === 1 ? "" : "s"} · {PLATFORM_STRAPLINE}
          </p>
        </header>

        {/* Cross-link to /trades/[trade] for hire intent */}
        {cat.trade_slugs.length > 0 && (
          <section className="mt-6 rounded-2xl border-2 bg-white p-4 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
              Hire a verified UK trade in this category
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {cat.trade_slugs.map((slug) => (
                <li key={slug}>
                  <Link
                    href={`/trades/${slug}`}
                    className="inline-flex items-center gap-0.5 rounded-full bg-neutral-900 px-3 py-1 text-[10.5px] font-black uppercase tracking-wider text-white hover:opacity-90"
                  >
                    {slug.replace(/-/g, " ")}
                    <ArrowUpRight size={10} strokeWidth={2.6}/>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Video grid */}
        <section className="mt-8">
          {videos.length === 0 ? (
            <div
              className="rounded-2xl border-2 border-dashed p-8 text-center md:p-12"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: "#FFB300" }}>
                <Video size={24} strokeWidth={2.6} className="text-neutral-900"/>
              </div>
              <h2 className="mt-4 text-[18px] font-black text-neutral-900 md:text-[22px]">
                No {cat.display_name.toLowerCase()} videos yet
              </h2>
              <p className="mt-2 max-w-xl mx-auto text-[13px] text-neutral-600">
                Verified UK trades in this category haven't uploaded to {PLATFORM_NAME} yet. Once they do, their work appears here.
              </p>
              <Link
                href="/videos"
                className="mt-4 inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-[11.5px] font-black uppercase tracking-wider text-neutral-900 shadow-sm active:scale-[0.97]"
                style={{ backgroundColor: "#FFB300" }}
              >
                Browse all {PLATFORM_NAME}
                <ArrowUpRight size={12} strokeWidth={2.6}/>
              </Link>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((v) => (
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
                      {/* Centered play-button overlay */}
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.25) 100%)" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={PLAY_BUTTON_URL} alt="" aria-hidden="true" className="drop-shadow-lg h-14 w-14 md:h-16 md:w-16"/>
                      </div>
                      {/* Title overlay — top-anchored inside the frame's
                          dark left ~⅓ zone. Frame's own watermark stays
                          visible in the bottom-left corner. */}
                      <div className="pointer-events-none absolute top-0 left-0 flex w-[38%] flex-col justify-start p-2.5 md:p-3">
                        <p className="text-[11px] font-black leading-tight text-white line-clamp-3 md:text-[12.5px]" style={{ textShadow: "0 2px 6px rgba(0,0,0,0.85)" }}>
                          {v.title}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="text-[14px] font-black leading-snug text-neutral-900">{v.title}</h3>
                      {v.description && (
                        <p className="mt-1 line-clamp-2 text-[12px] text-neutral-600">{v.description}</p>
                      )}
                      <div className="mt-auto flex items-center justify-between pt-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
                        <span>{v.merchant_slug.replace(/-/g, " ")}</span>
                        <span className="inline-flex items-center gap-2">
                          {v.duration_seconds && (
                            <span className="inline-flex items-center gap-0.5">
                              <Clock size={10}/>
                              {Math.floor(v.duration_seconds / 60)}:{String(v.duration_seconds % 60).padStart(2, "0")}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-0.5">
                            <PlayCircle size={10}/>{v.view_count.toLocaleString("en-GB")}
                          </span>
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <ResourcesBar active="toolbox" className="mt-8"/>

        <footer className="mt-8 flex flex-wrap items-center gap-4 border-t pt-6 text-[11px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <span className="inline-flex items-center gap-1"><ShieldCheck size={12}/> {PLATFORM_NAME} · Real UK trade work</span>
          <Link href="/videos" className="inline-flex items-center gap-0.5 hover:text-neutral-900">
            All {PLATFORM_NAME} <ArrowUpRight size={11}/>
          </Link>
        </footer>
      </div>
    </main>
  );
}
