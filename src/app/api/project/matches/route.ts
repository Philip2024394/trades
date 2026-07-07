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

  return NextResponse.json({ ok: true, matches: top });
}
