// /news/feed.xml — RSS 2.0 feed of the Newsroom.
//
// Editorial pickup + Feedly discovery + Google News eligibility.
// Emits latest 50 live news posts with title, description,
// canonical link, publish date, and (when present) an <enclosure>
// pointing at the hero image so aggregators can show a thumbnail.
//
// Content type is `application/rss+xml`. Root layout registers the
// feed via a <link rel="alternate"> tag so browser feed readers +
// bots can auto-discover it.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { absolute } from "@/lib/seo";

export const runtime    = "nodejs";
export const dynamic    = "force-dynamic";
export const revalidate = 900;   // regenerate every 15 minutes

const MAX_ITEMS = 50;

function xmlEscape(s: string): string {
  return s
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toRfc822(d: Date): string {
  // RSS spec requires RFC-822 timestamps.
  return d.toUTCString();
}

export async function GET(): Promise<Response> {
  const feedUrl = absolute("/news/feed.xml");
  const siteUrl = absolute("/news");
  const now     = new Date();

  const { data } = await supabaseAdmin
    .from("hammerex_xrated_news_posts")
    .select("slug, title, excerpt, hero_url, published_at, author_name")
    .eq("status", "live")
    .order("published_at", { ascending: false })
    .limit(MAX_ITEMS);

  const items = (data ?? []).map((row) => {
    const link  = absolute(`/news/${row.slug}`);
    const pub   = row.published_at ? new Date(row.published_at as string) : now;
    const title = xmlEscape((row.title as string) ?? row.slug);
    const desc  = xmlEscape((row.excerpt as string) ?? "");
    const hero  = row.hero_url as string | null;
    const author = xmlEscape((row.author_name as string) ?? "The Networkers");
    const enclosure = hero
      ? `\n      <enclosure url="${xmlEscape(hero)}" type="image/jpeg" length="0"/>`
      : "";
    return `    <item>
      <title>${title}</title>
      <link>${xmlEscape(link)}</link>
      <guid isPermaLink="true">${xmlEscape(link)}</guid>
      <description>${desc}</description>
      <author>press@thenetworkers.app (${author})</author>
      <pubDate>${toRfc822(pub)}</pubDate>${enclosure}
    </item>`;
  });

  const xml =
`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>The Networkers — Newsroom</title>
    <link>${xmlEscape(siteUrl)}</link>
    <atom:link href="${xmlEscape(feedUrl)}" rel="self" type="application/rss+xml"/>
    <description>Newsroom of The Networkers — of the construction trades. Product updates, industry moves, and stories from UK trades.</description>
    <language>en-GB</language>
    <lastBuildDate>${toRfc822(now)}</lastBuildDate>
    <generator>thenetworkers.app/news/feed.xml</generator>
    <ttl>15</ttl>
${items.join("\n")}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type":  "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600"
    }
  });
}
