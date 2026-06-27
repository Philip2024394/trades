// GET /api/trade-off/materials-network/picks/list?slug=…&token=…
// Magic-link authenticated. Returns the tradesperson's curated merchant
// picks ordered by sort_order asc. Joins to the merchant listing so the
// dashboard editor renders display_name + city + avatar + commission
// rate in one round-trip.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { constantTimeEq } from "@/lib/xratedMaterialsNetwork";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") ?? "").trim();
  const token = (url.searchParams.get("token") ?? "").trim();

  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "Missing slug or token." },
      { status: 400 }
    );
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token")
    .eq("slug", slug)
    .maybeSingle();

  if (!listing.data) {
    return NextResponse.json(
      { ok: false, error: "Listing not found." },
      { status: 404 }
    );
  }
  if (!constantTimeEq(listing.data.edit_token, token)) {
    return NextResponse.json(
      { ok: false, error: "Invalid edit token." },
      { status: 403 }
    );
  }

  const picksRes = await supabaseAdmin
    .from("hammerex_xrated_merchant_picks")
    .select("*")
    .eq("tradie_listing_id", listing.data.id)
    .eq("status", "live")
    .order("sort_order", { ascending: true });

  const picks = picksRes.data ?? [];
  const merchantIds = picks.map((p) => p.merchant_listing_id);

  let merchants: Array<{
    id: string;
    slug: string;
    display_name: string;
    primary_trade: string;
    city: string;
    avatar_url: string | null;
    merchant_commission_rate: number | null;
    merchant_commission_min_pence: number;
    materials_network_paused: boolean;
  }> = [];

  if (merchantIds.length > 0) {
    const mRes = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select(
        "id, slug, display_name, primary_trade, city, avatar_url, merchant_commission_rate, merchant_commission_min_pence, materials_network_paused"
      )
      .in("id", merchantIds);
    merchants = mRes.data ?? [];
  }

  const byId = new Map(merchants.map((m) => [m.id, m]));
  const enriched = picks
    .map((p) => {
      const m = byId.get(p.merchant_listing_id);
      if (!m) return null;
      return {
        id: p.id,
        merchant_listing_id: p.merchant_listing_id,
        merchant_slug: m.slug,
        merchant_display_name: m.display_name,
        merchant_city: m.city,
        merchant_primary_trade: m.primary_trade,
        merchant_avatar_url: m.avatar_url,
        merchant_commission_rate: m.merchant_commission_rate,
        merchant_commission_min_pence: m.merchant_commission_min_pence,
        merchant_paused: m.materials_network_paused,
        intro_note: p.intro_note,
        sort_order: p.sort_order
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return NextResponse.json({ ok: true, picks: enriched });
}
