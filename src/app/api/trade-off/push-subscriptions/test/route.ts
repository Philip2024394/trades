// POST /api/trade-off/push-subscriptions/test
// Magic-link authenticated. Body: { slug, edit_token, endpoint_hash }.
//
// Sends a single test web-push to JUST the requested subscription
// (not the rest of the listing's devices). Throttle is bypassed so a
// tradesperson can hammer the test button while setting up; the
// rate-limit headers from FCM / APNs still protect the upstream.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendLeadAlert } from "@/lib/leadAlerts";

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

  const result = await sendLeadAlert(
    listing.data.id,
    { type: "test", data: { sent_at: new Date().toISOString() } },
    { throttle: false, onlyEndpointHash: endpointHash }
  );

  return NextResponse.json({ ok: true, result });
}
