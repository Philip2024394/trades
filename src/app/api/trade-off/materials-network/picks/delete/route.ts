// POST /api/trade-off/materials-network/picks/delete
// Magic-link authenticated. Body: { slug, edit_token, pick_id }.
// Soft-archives the pick (sets status='archived') so historical
// referrals against this pick keep their attribution chain intact.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { constantTimeEq } from "@/lib/xratedMaterialsNetwork";

export const runtime = "nodejs";

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const slug = s(body.slug);
  const token = s(body.edit_token);
  const pickId = s(body.pick_id);

  if (!slug || !token || !pickId) {
    return NextResponse.json(
      { ok: false, error: "Missing slug, edit_token, or pick_id." },
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

  const upd = await supabaseAdmin
    .from("hammerex_xrated_merchant_picks")
    .update({ status: "archived" })
    .eq("id", pickId)
    .eq("tradie_listing_id", listing.data.id)
    .select("id")
    .maybeSingle();

  if (upd.error) {
    return NextResponse.json(
      { ok: false, error: upd.error.message },
      { status: 500 }
    );
  }
  if (!upd.data) {
    return NextResponse.json(
      { ok: false, error: "Pick not found." },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
