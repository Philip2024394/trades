// POST /api/beacon/claim
//
// Trade claims a beacon. Deducts 1 washer + flips the claim row to
// `claimed` + returns the WhatsApp deep-link the trade should open
// with the pre-filled message.
//
// Auth follows the same pattern as /api/trade-off/install-leads/status:
// the caller passes { slug, edit_token, beacon_id } in the body; we
// compare edit_token constant-time against the stored merchant token.

import { NextResponse } from "next/server";
import { claimBeacon } from "@/lib/beacon.server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  beacon_id?:      unknown;
  slug?:           unknown;
  edit_token?:     unknown;
  custom_message?: unknown;
};

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Constant-time equality for edit-token comparison. */
function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: Request) {
  let body: Body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 }); }

  const beaconId  = s(body.beacon_id).trim();
  const slug      = s(body.slug).trim();
  const editToken = s(body.edit_token).trim();
  if (!beaconId || !slug || !editToken) {
    return NextResponse.json({ ok: false, error: "missing-fields" }, { status: 400 });
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, edit_token")
    .eq("slug", slug)
    .maybeSingle();
  if (!listing.data || !constantTimeEq((listing.data.edit_token as string) ?? "", editToken)) {
    return NextResponse.json({ ok: false, error: "not-authorised" }, { status: 403 });
  }

  const customMessage = typeof body.custom_message === "string" ? body.custom_message : undefined;
  const result = await claimBeacon({ beaconId, merchantSlug: slug, customMessage });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: 409 });
  }
  return NextResponse.json({ ok: true, whatsapp_href: result.whatsappHref });
}
