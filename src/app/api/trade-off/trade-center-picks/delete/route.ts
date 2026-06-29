// POST /api/trade-off/trade-center-picks/delete
// Magic-link authenticated. Body: { slug, edit_token, pick_id }.
// Auth + scope-check, then deletes the row.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

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
  const pick_id = s(body.pick_id);

  if (!slug || !token || !pick_id) {
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
    return NextResponse.json(
      { ok: false, error: "Listing not found." },
      { status: 404 }
    );
  }
  if (!constantTimeEq(listing.data.edit_token, token)) {
    return NextResponse.json(
      { ok: false, error: "Invalid edit token." },
      { status: 401 }
    );
  }

  const pick = await supabaseAdmin
    .from("hammerex_xrated_trade_center_picks")
    .select("id, listing_id")
    .eq("id", pick_id)
    .maybeSingle();
  if (!pick.data) {
    return NextResponse.json(
      { ok: false, error: "Pick not found." },
      { status: 404 }
    );
  }
  if (pick.data.listing_id !== listing.data.id) {
    return NextResponse.json(
      { ok: false, error: "Pick does not belong to this listing." },
      { status: 403 }
    );
  }

  const del = await supabaseAdmin
    .from("hammerex_xrated_trade_center_picks")
    .delete()
    .eq("id", pick_id);
  if (del.error) {
    console.error("[trade-center-picks/delete] delete failed:", del.error);
    return NextResponse.json(
      { ok: false, error: del.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
