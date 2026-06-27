// POST /api/trade-off/wholesale-zones/delete
// Magic-link authenticated. Body: { slug, edit_token, zone_id }.
// Hard delete — wholesale zones carry no historical state worth
// preserving.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

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
  const zoneId = s(body.zone_id);

  if (!slug || !token || !zoneId) {
    return NextResponse.json(
      { ok: false, error: "Missing slug, edit_token, or zone_id." },
      { status: 400 }
    );
  }
  if (!UUID_RE.test(zoneId)) {
    return NextResponse.json({ ok: false, error: "Invalid zone id." }, { status: 400 });
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

  const del = await supabaseAdmin
    .from("hammerex_xrated_wholesale_zones")
    .delete()
    .eq("id", zoneId)
    .eq("listing_id", listing.data.id)
    .select("id")
    .maybeSingle();

  if (del.error) {
    console.error("[trade-off/wholesale-zones/delete] delete failed:", del.error);
    return NextResponse.json({ ok: false, error: del.error.message }, { status: 500 });
  }
  if (!del.data) {
    return NextResponse.json({ ok: false, error: "Zone not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
