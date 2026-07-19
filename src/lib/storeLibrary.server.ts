// storeLibrary.server — Site Interest Store data layer.
//
// The Store reads from hammerex_feed_tile_library directly rather
// than the hero-library JSON, because DB rows carry explicit
// `trade_slugs` arrays — no fuzzy keyword matching, no accidental
// cross-trade rollups. Every image is exactly-tagged by hand at
// insert time so counts stay accurate.
//
// SERVER-ONLY. Consumers: /store/page.tsx, /store/browse/page.tsx,
// /store/i/[id]/page.tsx, /api/store/*.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type StoreImage = {
  id:          string;
  url:         string;
  alt:         string;
  trade_slugs: string[];
  text_tone:   "white" | "black" | "gray";
  tier:        1 | 2 | 3 | 4;
};

// 4-tier routing rule (Philip 2026-07-17):
//   1 = live feed gallery only (clean, feed-aspect, non-store)
//   2 = Site Interest browse (trade-connected, clean)
//   3 = Sell — premium flagship (100% commercial quality)
//   4 = Studio App Builder archive (banners, branded, off-aspect)
// Store surfaces read tier 2 + 3 only; feed reads tier 1..3; archive is untouched.

let cache: StoreImage[] | null = null;
let cachedAt = 0;
const CACHE_TTL = 60 * 1000; // 1-minute cache; store pages are read-heavy

async function loadFromDb(): Promise<StoreImage[]> {
  const res = await supabaseAdmin
    .from("hammerex_feed_tile_library")
    .select("slug, url, alt, trade_slugs, text_tone, tier")
    .eq("active", true)
    .in("tier", [2, 3])
    .eq("has_brand_marks", false)
    .eq("is_banner", false)
    .order("tier", { ascending: false })  // tier-3 (premium) first
    .order("slug", { ascending: true });
  if (res.error) {
    console.error("[storeLibrary] db read failed:", res.error);
    return [];
  }
  return (res.data ?? []).map((r) => ({
    id:          r.slug as string,
    url:         r.url  as string,
    alt:         (r.alt ?? "")  as string,
    trade_slugs: (r.trade_slugs ?? []) as string[],
    text_tone:   ((r.text_tone ?? "white")) as "white" | "black" | "gray",
    tier:        ((r.tier ?? 2) as 1 | 2 | 3 | 4)
  }));
}

async function getLibrary(): Promise<StoreImage[]> {
  const now = Date.now();
  if (cache && (now - cachedAt) < CACHE_TTL) return cache;
  cache = await loadFromDb();
  cachedAt = now;
  return cache;
}

/** Every image in the store. Cached for 60s. */
export async function storeAllImages(): Promise<StoreImage[]> {
  return getLibrary();
}

/** Look up one image by slug/id. */
export async function storeImageById(id: string): Promise<StoreImage | null> {
  const lib = await getLibrary();
  return lib.find((e) => e.id === id) ?? null;
}

/** Free-text search over subject/alt + trade_slugs. Exact-match on
 *  trade + fuzzy contains on alt. */
export async function storeSearch(query: string, limit = 60): Promise<StoreImage[]> {
  const lib = await getLibrary();
  const q = (query ?? "").toLowerCase().trim();
  if (!q) return lib.slice(0, limit);
  const tokens = q.split(/[\s,]+/).filter((t) => t.length >= 2);
  if (tokens.length === 0) return lib.slice(0, limit);

  const scored = lib.map((img) => {
    const alt   = img.alt.toLowerCase();
    const tags  = img.trade_slugs.map((t) => t.toLowerCase().replace(/-/g, " "));
    let score = 0;
    for (const t of tokens) {
      // Exact trade match wins big
      if (tags.some((tag) => tag === t || tag.split(/\s+/).includes(t))) score += 20;
      // Alt/subject contains token
      if (alt.includes(t)) score += 5;
    }
    return { img, score };
  })
  .filter((x) => x.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, limit)
  .map((x) => x.img);

  return scored;
}

/** Per-trade counts — every distinct trade_slug across the library
 *  with its image count. Sorted by count desc. Accurate because
 *  trade_slugs are curated per row at insert. */
export async function storeTradeCounts(): Promise<Array<{ trade: string; count: number }>> {
  const lib = await getLibrary();
  const counts = new Map<string, number>();
  for (const img of lib) {
    for (const t of img.trade_slugs) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([trade, count]) => ({ trade, count }))
    .sort((a, b) => b.count - a.count || a.trade.localeCompare(b.trade));
}

/** Filter images to a specific trade (exact trade_slug match). */
export async function storeImagesForTrade(tradeSlug: string, limit = 60): Promise<StoreImage[]> {
  const lib = await getLibrary();
  return lib.filter((e) => e.trade_slugs.includes(tradeSlug)).slice(0, limit);
}

/** Premium (tier 3) images only — feeds the store's "Featured / flagship"
 *  strips. Tier 3 is the 100% commercial-quality cut Philip picks by
 *  hand at insert. */
export async function storePremiumImages(limit = 24): Promise<StoreImage[]> {
  const lib = await getLibrary();
  return lib.filter((e) => e.tier === 3).slice(0, limit);
}
