// /sitemap-images.xml — Google Image Sitemap
//
// Google's Image Sitemap protocol
// (https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps)
// lets us signal image ownership, caption, title and license to
// the crawler so:
//   • our imagery is indexed for Google Images (traffic source)
//   • our authorship is on file if we ever DMCA a scraper
//   • rich results for Images become eligible (people also search)
//
// Emits ONE <url> entry per merchant canteen page listing every
// image visible on that page (hero + up to 8 gallery items), plus
// one <url> per hero-library item that lives on a marketing surface
// (e.g. the Site Interest store).
//
// Referenced from robots.txt sitemap chain.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { absolute } from "@/lib/seo";

export const runtime    = "nodejs";
export const dynamic    = "force-dynamic";
export const revalidate = 3600;   // regenerate at most every hour

const MAX_URLS  = 50_000;    // Google's per-sitemap ceiling
const LICENSE   = absolute("/legal/image-license");

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Build the <image:image> block for a single asset. Every field
 *  Google recognises is included so the sitemap serves as both
 *  crawl signal and provenance record. */
function imageBlock(opts: { url: string; caption?: string | null; title?: string | null }): string {
  const parts: string[] = [`  <image:image>`];
  parts.push(`    <image:loc>${xmlEscape(opts.url)}</image:loc>`);
  if (opts.caption) parts.push(`    <image:caption>${xmlEscape(opts.caption)}</image:caption>`);
  if (opts.title)   parts.push(`    <image:title>${xmlEscape(opts.title)}</image:title>`);
  parts.push(`    <image:license>${xmlEscape(LICENSE)}</image:license>`);
  parts.push(`  </image:image>`);
  return parts.join("\n");
}

/** Build a <url> entry with one or more nested <image:image>
 *  blocks. Google groups images by the page they appear on. */
function urlBlock(pageUrl: string, images: Array<{ url: string; caption?: string | null; title?: string | null }>): string {
  if (images.length === 0) return "";
  return [
    `<url>`,
    `  <loc>${xmlEscape(pageUrl)}</loc>`,
    ...images.map(imageBlock),
    `</url>`
  ].join("\n");
}

export async function GET(): Promise<Response> {
  const urls: string[] = [];

  // ─── Canteen pages ─────────────────────────────────────────────
  // Each canteen page is a merchant profile with a hero image + up
  // to 8 gallery items. Fetch active canteens with photos and
  // group per-slug.
  const { data: canteens } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("slug, display_name, primary_trade, avatar_url, custom_app_hero_url, photos")
    .eq("active", true)
    .not("slug", "is", null)
    .limit(20_000);

  if (canteens) {
    for (const c of canteens) {
      const pageUrl = absolute(`/trade/${c.slug}`);
      const images: Array<{ url: string; caption?: string | null; title?: string | null }> = [];
      // Hero comes first (visual anchor), avatar next, then photos.
      // Dedupe to avoid Google marking the sitemap as noisy.
      const seen = new Set<string>();
      const pushImg = (url: string | null | undefined, caption: string) => {
        if (!url || typeof url !== "string" || seen.has(url)) return;
        seen.add(url);
        images.push({ url, caption, title: c.display_name as string | null });
      };
      pushImg(c.custom_app_hero_url as string | null, `${c.display_name ?? c.slug} — ${c.primary_trade ?? "UK trade"} on The Networkers`);
      pushImg(c.avatar_url as string | null, `${c.display_name ?? c.slug} — profile photo`);
      const photos = (c.photos as string[] | null) ?? [];
      for (const p of photos.slice(0, 8)) {
        pushImg(p, `${c.display_name ?? c.slug} — portfolio image`);
      }
      if (images.length > 0) {
        urls.push(urlBlock(pageUrl, images));
        if (urls.length >= MAX_URLS) break;
      }
    }
  }

  // ─── Hero library images shown on the Site Interest store ─────
  // Curated construction imagery is indexable via the store's
  // browse pages. Each image maps to /store/i/<slug>.
  if (urls.length < MAX_URLS) {
    const { data: tiles } = await supabaseAdmin
      .from("hammerex_feed_tile_library")
      .select("slug, url, alt, trade_slugs")
      .eq("active", true)
      .in("tier", [2, 3])
      .eq("has_brand_marks", false)
      .not("fits_frames", "eq", "{}")
      .limit(5_000);

    if (tiles) {
      for (const t of tiles) {
        if (urls.length >= MAX_URLS) break;
        if (!t.url || !t.slug) continue;
        const pageUrl = absolute(`/store/i/${t.slug}`);
        urls.push(urlBlock(pageUrl, [{
          url:     t.url as string,
          caption: (t.alt as string | null) ?? "The Networkers — UK construction imagery",
          title:   (t.alt as string | null)?.split(" — ")[0] ?? "Networkers image"
        }]));
      }
    }
  }

  const xml =
`<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join("\n")}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type":  "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400"
    }
  });
}
