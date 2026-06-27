// POST /api/trade-off/push-subscriptions/unsubscribe
// Magic-link authenticated. Body: { slug, edit_token, endpoint_hash }.
//
// Sets enabled=false on the row. We keep the row so the tradesperson
// can re-enable from the dashboard list (faster than re-subscribing
// the whole device).

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
  const endpointHash = s(body.endpoint_hash);

  if (!slug || !token || !endpointHash) {
    return NextResponse.json(
      { ok: false, error: "Missing slug, edit_token, or endpoint_hash." },
      { status: 400 }
    );
  }
  if (!/^[a-f0-9]{64}$/i.test(endpointHash)) {
    return NextResponse.json({ ok: false, error: "Invalid endpoint_hash." }, { status: 400 });
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
    .from("hammerex_xrated_push_subscriptions")
    .update({ enabled: false })
    .eq("listing_id", listing.data.id)
    .eq("endpoint_hash", endpointHash)
    .select("id")
    .maybeSingle();

  if (upd.error) {
    return NextResponse.json({ ok: false, error: upd.error.message }, { status: 500 });
  }
  if (!upd.data) {
    return NextResponse.json({ ok: false, error: "Subscription not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
