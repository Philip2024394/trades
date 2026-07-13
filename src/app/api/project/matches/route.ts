// GET /api/project/matches?postcode=X&projectType=Y
//
// Returns up to 5 trades matching the requested trade for the postcode
// area. Simplest algorithm:
//   1. Trades whose primary_trade OR secondary_trades intersects the
//      trade slugs mapped from projectType.
//   2. Prefer postcode_prefix match; fall back to trades without
//      a postcode constraint.
//   3. Sort: verified first → tier premium/verified before free → most
//      recently joined last.
//   4. Cap at 5.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Same mapping as draftStore. Duplicated intentionally so the API is
// self-contained (client store can't be imported into a server route).
const PROJECT_TO_TRADE: Record<string, string[]> = {
  kitchen: ["kitchen-fitter", "carpenter", "builder"],
  bathroom: ["bathroom-fitter", "plumber", "tiler"],
  extension: ["builder", "carpenter"],
  "loft-conversion": ["builder", "carpenter", "roofer"],
  roofing: ["roofer"],
  boiler: ["heating-engineer", "plumber"],
  electrics: ["electrician"],
  plumbing: ["plumber"],
  flooring: ["flooring-installer", "carpenter"],
  decorating: ["painter", "decorator"],
  "windows-doors": ["window-installer", "carpenter"],
  "damp-repair": ["builder", "damp-specialist"],
  landscaping: ["landscaper", "gardener"],
  driveway: ["landscaper", "groundworker"],
  other: []
};

type Row = {
  id: string;
  slug: string;
  display_name: string;
  primary_trade: string;
  city: string | null;
  postcode_prefix: string | null;
  avatar_url: string | null;
  hammerex_standard_verified: boolean;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const postcode = (url.searchParams.get("postcode") ?? "")
    .trim()
    .toUpperCase();
  const projectType = url.searchParams.get("projectType") ?? "";

  const tradeSlugs = PROJECT_TO_TRADE[projectType] ?? [];

  // Postcode prefix is the first outward code (e.g. "M1" from "M1 2AB")
  const prefix = postcode.split(/\s+/)[0] || "";

  let query = supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select(
      "id, slug, display_name, primary_trade, city, postcode_prefix, avatar_url, hammerex_standard_verified"
    )
    .eq("status", "live")
    .limit(25);

  if (tradeSlugs.length > 0) {
    query = query.in("primary_trade", tradeSlugs);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as Row[];

  // Sort: postcode-prefix match first, then verified, then created-order
  const scored = rows
    .map((r) => ({
      row: r,
      prefixMatch: prefix && r.postcode_prefix === prefix ? 2 : 0,
      verified: r.hammerex_standard_verified ? 1 : 0
    }))
    .sort((a, b) => b.prefixMatch + b.verified - (a.prefixMatch + a.verified));

  const top = scored.slice(0, 5).map((s) => ({
    id: s.row.id,
    slug: s.row.slug,
    displayName: s.row.display_name,
    trade: s.row.primary_trade,
    city: s.row.city,
    postcodePrefix: s.row.postcode_prefix,
    avatarUrl: s.row.avatar_url,
    verified: s.row.hammerex_standard_verified,
    isLocal: prefix && s.row.postcode_prefix === prefix
  }));

  // Yard job-seek posts matching the trade — "trades saying they're
  // available right now". Shown as a secondary rail below the main
  // match list so the homeowner sees active supply for their trade.
  let yardPosts: Array<{
    id: string;
    slug: string;
    title: string;
    body: string;
    region: string | null;
    tradeSlug: string;
    posterName: string;
    posterSlug: string;
    createdAt: string;
  }> = [];
  if (tradeSlugs.length > 0) {
    const { data: seekRows } = await supabaseAdmin
      .from("hammerex_trade_off_yard_posts")
      .select(
        "id, listing_id, title, body, region, trade_slug, kind, status, created_at, expires_at"
      )
      .eq("kind", "job-seek")
      .eq("status", "live")
      .in("trade_slug", tradeSlugs)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(20);
    if (seekRows && seekRows.length > 0) {
      const listingIds = Array.from(
        new Set(seekRows.map((r) => r.listing_id))
      );
      const { data: posters } = await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("id, slug, display_name, city, postcode_prefix")
        .in("id", listingIds);
      const posterMap = new Map(
        (posters ?? []).map((p) => [p.id, p])
      );
      yardPosts = seekRows
        .map((r) => {
          const p = posterMap.get(r.listing_id);
          if (!p) return null;
          return {
            id: r.id,
            slug: p.slug,
            title: r.title,
            body: r.body,
            region: r.region ?? p.city ?? null,
            tradeSlug: r.trade_slug,
            posterName: p.display_name,
            posterSlug: p.slug,
            createdAt: r.created_at,
            _local: prefix && p.postcode_prefix === prefix ? 1 : 0
          };
        })
        .filter(Boolean) as typeof yardPosts;
      // Local first, then newest.
      yardPosts.sort((a, b) => {
        const la = (a as { _local?: number })._local ?? 0;
        const lb = (b as { _local?: number })._local ?? 0;
        return lb - la;
      });
      yardPosts = yardPosts.slice(0, 5);
    }
  }

  return NextResponse.json({ ok: true, matches: top, yardPosts });
}
