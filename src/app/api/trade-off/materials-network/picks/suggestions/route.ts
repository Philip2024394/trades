// GET /api/trade-off/materials-network/picks/suggestions?slug=…&token=…&q=…
// Magic-link authenticated. Search for merchant listings (wholesale_mode
// on, status='live') by display_name / city / primary_trade. Optional
// `q` is a free-text query; with no q we return the most recent merchants
// alphabetically. Excludes the tradesperson's own listing and any
// merchants they've already picked.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { constantTimeEq } from "@/lib/xratedMaterialsNetwork";

export const runtime = "nodejs";

const PAGE_SIZE = 24;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") ?? "").trim();
  const token = (url.searchParams.get("token") ?? "").trim();
  const q = (url.searchParams.get("q") ?? "").trim();

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
    return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  }
  if (!constantTimeEq(listing.data.edit_token, token)) {
    return NextResponse.json({ ok: false, error: "Invalid edit token." }, { status: 403 });
  }

  // Picks already on the tradie's list — exclude from the suggestion
  // set so the picker can't add the same merchant twice.
  const existing = await supabaseAdmin
    .from("hammerex_xrated_merchant_picks")
    .select("merchant_listing_id")
    .eq("tradie_listing_id", listing.data.id)
    .eq("status", "live");
  const excludeIds = new Set(
    (existing.data ?? []).map((r) => r.merchant_listing_id)
  );
  excludeIds.add(listing.data.id);

  let query = supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select(
      "id, slug, display_name, primary_trade, city, avatar_url, merchant_commission_rate, merchant_commission_min_pence, materials_network_paused, addons_enabled"
    )
    .eq("status", "live")
    .limit(PAGE_SIZE * 2); // overfetch — we client-filter for wholesale_mode

  if (q.length > 0) {
    // Postgres or() syntax for ilike across multiple columns.
    const safe = q.replace(/[%]/g, "\\%").replace(/[_]/g, "\\_");
    query = query.or(
      `display_name.ilike.%${safe}%,city.ilike.%${safe}%,primary_trade.ilike.%${safe}%`
    );
  }

  query = query.order("display_name", { ascending: true });

  const res = await query;
  if (res.error) {
    return NextResponse.json(
      { ok: false, error: res.error.message },
      { status: 500 }
    );
  }

  // Filter out non-merchants + already-picked (wholesale_mode is the
  // canonical "this is a merchant" signal).
  const merchants = (res.data ?? [])
    .filter((m) => {
      if (excludeIds.has(m.id)) return false;
      const map =
        m.addons_enabled && typeof m.addons_enabled === "object"
          ? (m.addons_enabled as Record<string, boolean>)
          : {};
      return map.wholesale_mode === true;
    })
    .slice(0, PAGE_SIZE)
    .map((m) => ({
      id: m.id,
      slug: m.slug,
      display_name: m.display_name,
      primary_trade: m.primary_trade,
      city: m.city,
      avatar_url: m.avatar_url,
      merchant_commission_rate: m.merchant_commission_rate,
      merchant_commission_min_pence: m.merchant_commission_min_pence,
      paused: m.materials_network_paused
    }));

  return NextResponse.json({ ok: true, merchants });
}
