// GET /api/trade-off/push-subscriptions/list?slug=...&edit_token=...
// Magic-link authenticated. Returns the listing's subscribed devices.
// Privacy: we strip the raw endpoint URL — only the SHA-256 hash plus
// the per-device knobs ever leave the server.

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

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") ?? "").trim();
  const token = (url.searchParams.get("edit_token") ?? "").trim();

  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "Missing slug or edit_token.", subscriptions: [] },
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
      { ok: false, error: "Listing not found.", subscriptions: [] },
      { status: 404 }
    );
  }
  if (!constantTimeEq(listing.data.edit_token, token)) {
    return NextResponse.json(
      { ok: false, error: "Invalid edit token.", subscriptions: [] },
      { status: 403 }
    );
  }

  const subs = await supabaseAdmin
    .from("hammerex_xrated_push_subscriptions")
    .select(
      "endpoint_hash, platform, device_label, last_used_at, vibration_pattern, muted_events, quiet_hours_start, quiet_hours_end, enabled, created_at, failure_count"
    )
    .eq("listing_id", listing.data.id)
    .order("created_at", { ascending: false });

  if (subs.error) {
    return NextResponse.json(
      { ok: false, error: subs.error.message, subscriptions: [] },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, subscriptions: subs.data ?? [] });
}
