// POST /api/trade-off/yard/beacon/[id]/respond
//
// A merchant or trade responds to a live beacon with their offer.
// One response per responder per beacon (enforced by UNIQUE index).
//
// Request body: { slug, edit_token, message, price_pounds?, availability? }
// Response body: { ok, responseId, isAccepted, responseCount }
//
// Auth: magic-link (slug + edit_token). Beacon must be still live
// (not expired, not closed). Responders can't respond to their own
// beacon.

import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function n(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const num = Number.parseFloat(v);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function constantTimeEq(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: beaconId } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400 }
    );
  }

  const slug = s(body.slug).trim();
  const editToken = s(body.edit_token).trim();
  const message = s(body.message).trim();
  const availability = s(body.availability).trim();
  const pricePoundsN = n(body.price_pounds);

  if (!slug || !editToken) {
    return NextResponse.json(
      { ok: false, error: "missing_auth" },
      { status: 401 }
    );
  }
  if (!message || message.length > 800) {
    return NextResponse.json(
      { ok: false, error: "invalid_message" },
      { status: 400 }
    );
  }

  const { data: listing } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token, status")
    .eq("slug", slug)
    .maybeSingle();

  if (!listing || !constantTimeEq(listing.edit_token, editToken)) {
    return NextResponse.json(
      { ok: false, error: "unauthorised" },
      { status: 401 }
    );
  }
  if (listing.status !== "live") {
    return NextResponse.json(
      { ok: false, error: "listing_not_live" },
      { status: 403 }
    );
  }

  const { data: beacon } = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select(
      "id, listing_id, kind, beacon_expires_at, beacon_closed_at"
    )
    .eq("id", beaconId)
    .maybeSingle();

  if (!beacon || beacon.kind !== "beacon") {
    return NextResponse.json(
      { ok: false, error: "beacon_not_found" },
      { status: 404 }
    );
  }
  if (beacon.listing_id === listing.id) {
    return NextResponse.json(
      { ok: false, error: "self_response" },
      { status: 400 }
    );
  }
  if (beacon.beacon_closed_at) {
    return NextResponse.json(
      { ok: false, error: "beacon_closed" },
      { status: 409 }
    );
  }
  if (
    beacon.beacon_expires_at &&
    Date.parse(beacon.beacon_expires_at) <= Date.now()
  ) {
    return NextResponse.json(
      { ok: false, error: "beacon_expired" },
      { status: 409 }
    );
  }

  const pricePence =
    pricePoundsN !== null ? Math.round(pricePoundsN * 100) : null;

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("hammerex_yard_beacon_responses")
    .upsert(
      {
        beacon_post_id: beaconId,
        responder_listing_id: listing.id,
        message,
        availability_text: availability || null,
        price_pence: pricePence
      },
      { onConflict: "beacon_post_id,responder_listing_id" }
    )
    .select("id, is_accepted")
    .single();

  if (insErr || !inserted) {
    return NextResponse.json(
      { ok: false, error: "insert_failed", detail: insErr?.message },
      { status: 500 }
    );
  }

  // Read the fresh response_count for the client (denormalised via
  // trigger — this is authoritative).
  const { data: refreshed } = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select("beacon_response_count")
    .eq("id", beaconId)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    responseId: inserted.id,
    isAccepted: inserted.is_accepted,
    responseCount: refreshed?.beacon_response_count ?? 0
  });
}
