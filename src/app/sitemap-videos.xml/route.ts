// /sitemap-videos.xml — Google Video Sitemap
//
// Google's Video Sitemap protocol
// (https://developers.google.com/search/docs/crawling-indexing/sitemaps/video-sitemaps)
// lets us tell Google exactly where our video content lives with
// duration + thumbnail + player URL, boosting eligibility for
// video-rich SERP features (thumbnails in results, Key Moments,
// dedicated Video tab).
//
// Emits ONE <url> entry per live video with a <video:video>
// child block. Referenced from robots.txt.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { absolute, BRAND } from "@/lib/seo";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";
export const revalidate = 3600;   // regenerate at most every hour

const MAX_VIDEOS = 50_000;   // Google's sitemap limit

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isoDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `PT${m}M${s}S`;
}

export async function GET(): Promise<Response> {
  const { data: videos } = await supabaseAdmin
    .from("hammerex_videos")
    .select("id, title, description, video_url, thumbnail_url, duration_seconds, published_at, updated_at, keywords, category_slug, city")
    .eq("status", "live")
    .in("video_class", ["portfolio", "kb"])
    .order("published_at", { ascending: false })
    .limit(MAX_VIDEOS);

  const rows = videos ?? [];

  const urlEntries = rows.map((v: any) => {
    const pageUrl     = absolute(`/videos/${v.id}`);
    const contentLoc  = v.video_url;
    const thumbLoc    = v.thumbnail_url ?? absolute("/og-default-video.jpg");
    const rawDesc     = (v.description ?? v.title ?? "").slice(0, 2048);
    const duration    = v.duration_seconds
      ? `<video:duration>${v.duration_seconds}</video:duration>`
      : "";
    const publish     = v.published_at ?? v.updated_at ?? new Date().toISOString();
    const tagsXml     = (v.keywords ?? []).slice(0, 32)
      .map((k: string) => `<video:tag>${xmlEscape(k)}</video:tag>`)
      .join("");
    const catXml      = v.category_slug ? `<video:category>${xmlEscape(v.category_slug)}</video:category>` : "";

    return `  <url>
    <loc>${xmlEscape(pageUrl)}</loc>
    <lastmod>${publish}</lastmod>
    <video:video>
      <video:thumbnail_loc>${xmlEscape(thumbLoc)}</video:thumbnail_loc>
      <video:title>${xmlEscape(v.title)}</video:title>
      <video:description>${xmlEscape(rawDesc)}</video:description>
      <video:content_loc>${xmlEscape(contentLoc)}</video:content_loc>
      <video:player_loc allow_embed="yes" autoplay="ap=1">${xmlEscape(pageUrl)}</video:player_loc>
      ${duration}
      <video:publication_date>${publish}</video:publication_date>
      <video:family_friendly>yes</video:family_friendly>
      <video:live>no</video:live>
      <video:requires_subscription>no</video:requires_subscription>
      <video:uploader info="${xmlEscape(absolute("/"))}">${xmlEscape(BRAND.name)}</video:uploader>
      <video:restriction relationship="allow">GB IE</video:restriction>
      ${catXml}
      ${tagsXml}
    </video:video>
  </url>`;
  }).join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${urlEntries}
</urlset>`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type":  "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600"
    }
  });
}
