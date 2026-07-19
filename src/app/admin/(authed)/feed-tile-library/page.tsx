// /admin/feed-tile-library — Live Feed Tile library CRUD.
//
// Server component: loads all rows (active + inactive). Client
// component below handles row edits, new-entry form, soft/hard delete.

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { FeedTileLibraryAdmin } from "./FeedTileLibraryAdmin";

export const dynamic = "force-dynamic";

type Row = {
  id:          string;
  slug:        string;
  url:         string;
  alt:         string;
  trade_slugs: string[];
  text_tone:   "white" | "black" | "gray";
  active:      boolean;
  posted_by:   string;
  updated_at:  string;
};

async function loadRows(): Promise<Row[]> {
  const res = await supabaseAdmin
    .from("hammerex_feed_tile_library")
    .select("id, slug, url, alt, trade_slugs, text_tone, active, posted_by, updated_at")
    .order("created_at", { ascending: false });
  if (res.error) {
    console.error("[admin/feed-tile-library] load failed:", res.error);
    return [];
  }
  return (res.data ?? []) as Row[];
}

export default async function FeedTileLibraryPage() {
  const rows = await loadRows();
  const activeCount = rows.filter((r) => r.active).length;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center gap-2 text-xs text-brand-muted">
        <Link href="/admin" className="hover:text-brand-text">Admin</Link>
        <span>›</span>
        <span>Feed tile library</span>
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-brand-text">
            Live Feed Tile library
          </h1>
          <p className="mt-1 text-sm text-brand-muted">
            {activeCount} active · {rows.length} total. Images shown in the templates picker&apos;s Library tab, filtered by merchant trade.
          </p>
        </div>
      </div>

      <FeedTileLibraryAdmin initialRows={rows}/>
    </div>
  );
}
