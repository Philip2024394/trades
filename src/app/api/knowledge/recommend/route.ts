// POST /api/knowledge/recommend
//
// Given a set of merchant + trade categories (derived from an AI
// answer's cited KB entries), return matching local Networkers
// listings so the panel can render "Need this done?" recommendations.
//
// Body:
//   {
//     merchantCategories?: string[],   // e.g. ['building-merchant','concrete-supplier']
//     tradeCategories?:    string[],   // e.g. ['bricklayer','groundworker']
//     city?:               string,     // optional geo filter
//     limit?:              number      // default 6
//   }
//
// Returns:
//   {
//     ok: true,
//     merchants: [{slug, display_name, city, tier}],
//     trades:    [{slug, display_name, city, tier, primary_trade}]
//   }
//
// Never returns personal data. Public endpoint (no auth) — used by
// the Ask-AI panel on public video pages.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIER_RANK: Record<string, number> = {
  "works":        5,
  "business":     4,
  "professional": 3,
  "starter":      2,
  "free":         1
};

export async function POST(req: Request) {
  let body: {
    merchantCategories?: string[];
    tradeCategories?:    string[];
    city?:               string;
    limit?:              number;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 }); }

  const limit = Math.min(Math.max(body.limit ?? 6, 1), 12);
  const merchantCats = (body.merchantCategories ?? []).filter(s => typeof s === "string" && s.length > 0);
  const tradeCats    = (body.tradeCategories    ?? []).filter(s => typeof s === "string" && s.length > 0);
  const cityFilter   = body.city && typeof body.city === "string" ? body.city.toLowerCase() : null;

  if (merchantCats.length === 0 && tradeCats.length === 0) {
    return NextResponse.json({ ok: true, merchants: [], trades: [] });
  }

  // The KB stores category slugs that match primary_trade values on
  // hammerex_trade_off_listings 1:1 (bricklayer, building-merchant,
  // driveway-installer etc). Query the primary_trade column directly.
  const wantedSlugs = Array.from(new Set([...merchantCats, ...tradeCats]));
  if (wantedSlugs.length === 0) {
    return NextResponse.json({ ok: true, merchants: [], trades: [] });
  }

  let query = supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("slug, display_name, city, tier, primary_trade")
    .in("primary_trade", wantedSlugs)
    .is("suspended_at", null)
    .limit(limit * 4);

  if (cityFilter) {
    query = query.ilike("city", `%${cityFilter}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[knowledge.recommend] query failed:", error.message);
    return NextResponse.json({ ok: true, merchants: [], trades: [] });
  }

  const rows = ((data as any[]) ?? [])
    .sort((a, b) => (TIER_RANK[b.tier ?? "free"] ?? 0) - (TIER_RANK[a.tier ?? "free"] ?? 0));

  // Split into merchants vs trades by which category set the primary_trade
  // came from. If a slug is in both sets, prefer trade side.
  const merchantSet = new Set(merchantCats);
  const tradeSet    = new Set(tradeCats);
  const merchants: any[] = [];
  const trades:    any[] = [];
  for (const r of rows) {
    if (tradeSet.has(r.primary_trade))         trades.push(r);
    else if (merchantSet.has(r.primary_trade)) merchants.push(r);
    if (merchants.length >= limit && trades.length >= limit) break;
  }

  return NextResponse.json({
    ok:        true,
    merchants: merchants.slice(0, limit).map(shape),
    trades:    trades.slice(0, limit).map(shape)
  });
}

function shape(r: any) {
  return {
    slug:          r.slug,
    display_name:  r.display_name ?? r.slug,
    city:          r.city ?? null,
    tier:          r.tier ?? "free",
    primary_trade: r.primary_trade ?? null
  };
}
