// Server-side loader for the feed-tile library. Reads the
// hammerex_feed_tile_library table (managed via /admin/feed-tile-library),
// falls back to the static seed baked into canteenFeedTileLibrary.ts
// if the DB is unreachable so previews never blank out.
//
// Import this ONLY from server components / route handlers. Client
// components receive the resolved list as a prop from the nearest
// server ancestor (templates picker page, canteen page).

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { STATIC_FEED_TILE_LIBRARY, type FeedTileLibraryImage } from "@/lib/canteenFeedTileLibrary";

type Row = {
  slug:        string;
  url:         string;
  alt:         string;
  trade_slugs: string[] | null;
  text_tone:   "white" | "black" | "gray" | null;
  active:      boolean | null;
};

/** Load the full active feed-tile library from the DB. Trade slug is
 *  intentionally NOT filtered here — the caller passes the raw list
 *  to the client and filters there. Keeps the same list handy for
 *  URL→entry lookups (used by the canteen renderer for text tone). */
export async function loadFeedTileLibrary(): Promise<FeedTileLibraryEntry[]> {
  const res = await supabaseAdmin
    .from("hammerex_feed_tile_library")
    .select("slug, url, alt, trade_slugs, text_tone, active")
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (res.error) {
    console.warn("[feed-tile-library] DB read failed — falling back to static seed:", res.error.message);
    return STATIC_FEED_TILE_LIBRARY;
  }
  const rows = (res.data ?? []) as Row[];
  if (rows.length === 0) return STATIC_FEED_TILE_LIBRARY;

  return rows.map((r) => ({
    id:          r.slug,
    url:         r.url,
    alt:         r.alt,
    trade_slugs: r.trade_slugs ?? [],
    textTone:    (r.text_tone ?? "white") as FeedTileLibraryImage["textTone"]
  }));
}

/** Entry shape passed from server → client. Same as
 *  FeedTileLibraryImage but with an explicit `trade_slugs` array so
 *  the client can filter by trade without needing a Record lookup. */
export type FeedTileLibraryEntry = FeedTileLibraryImage & {
  trade_slugs: string[];
};
