// POST /api/trade-off/materials-network/picks/reorder
// Magic-link authenticated. Body: { slug, edit_token, ordered_ids:string[] }.
// Persists the dnd-kit drag-reorder by writing sort_order = index for
// each pick. Only updates rows whose tradie_listing_id matches the
// authenticated tradie so a leaked id list can't tamper with another
// listing's picks.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { MAX_PICKS, constantTimeEq } from "@/lib/xratedMaterialsNetwork";

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
  const orderedRaw = Array.isArray(body.ordered_ids) ? body.ordered_ids : [];
  const orderedIds = orderedRaw
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);

  if (!slug || !token || orderedIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Missing slug, edit_token, or ordered_ids." },
      { status: 400 }
    );
  }
  if (orderedIds.length > MAX_PICKS) {
    return NextResponse.json(
      { ok: false, error: `ordered_ids exceeds cap of ${MAX_PICKS}.` },
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

  // Apply updates sequentially so we can early-return on error. With a
  // cap of 12 picks, the latency is negligible.
  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i]!;
    const upd = await supabaseAdmin
      .from("hammerex_xrated_merchant_picks")
      .update({ sort_order: i })
      .eq("id", id)
      .eq("tradie_listing_id", listing.data.id);
    if (upd.error) {
      return NextResponse.json(
        { ok: false, error: upd.error.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
