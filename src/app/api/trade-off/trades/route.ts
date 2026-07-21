// GET /api/trade-off/trades?q=<term>&limit=<n>
//
// Type-ahead search over hammerex_trade_off_listings, used by the
// canteen "invite member" modal (and reusable elsewhere). Case-
// insensitive ILIKE across display_name, slug, primary_trade, city.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q     = (searchParams.get("q") ?? "").trim();
  const limit = Math.min(Number(searchParams.get("limit") ?? "12"), 50);
  if (!q) return NextResponse.json({ ok: true, results: [] });

  const like = `%${q}%`;
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("slug, display_name, primary_trade, city, avatar_url")
    .or(
      `display_name.ilike.${like},slug.ilike.${like},primary_trade.ilike.${like},city.ilike.${like}`
    )
    .not("slug", "is", null)
    .order("display_name")
    .limit(limit);

  if (res.error) {
    return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 });
  }
  const results = (res.data ?? []).map((r) => ({
    slug:         r.slug,
    displayName:  r.display_name ?? r.slug,
    primaryTrade: r.primary_trade,
    city:         r.city,
    avatarUrl:    r.avatar_url
  }));
  return NextResponse.json({ ok: true, results });
}
