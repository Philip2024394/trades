// POST /api/trade-off/push-subscriptions/refresh
// Called by the service worker on `pushsubscriptionchange` (the
// browser rotated the endpoint URL — usually a Chrome / Edge VAPID
// refresh). Body: { old_endpoint, endpoint, p256dh_key, auth_key }.
//
// We can't carry the magic-link edit_token through the SW lifecycle,
// so this route is NOT token-gated. It only allows in-place
// rewrites: we look up the existing row by SHA-256(old_endpoint) and
// only update the endpoint / keys columns, never the listing_id or
// any per-device preferences. If no row matches, we 404 silently.

import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true, refreshed: false });
  }

  const oldEndpoint = s(body.old_endpoint);
  const endpoint = s(body.endpoint);
  const p256dh = s(body.p256dh_key);
  const auth = s(body.auth_key);

  if (!oldEndpoint || !endpoint || !p256dh || !auth) {
    return NextResponse.json({ ok: true, refreshed: false });
  }
  if (!/^https?:\/\//.test(endpoint)) {
    return NextResponse.json({ ok: true, refreshed: false });
  }

  const oldHash = createHash("sha256").update(oldEndpoint).digest("hex");

  const upd = await supabaseAdmin
    .from("hammerex_xrated_push_subscriptions")
    .update({
      endpoint,
      p256dh_key: p256dh,
      auth_key: auth,
      failure_count: 0,
      enabled: true
    })
    .eq("endpoint_hash", oldHash)
    .select("id")
    .maybeSingle();

  if (upd.error || !upd.data) {
    return NextResponse.json({ ok: true, refreshed: false });
  }
  return NextResponse.json({ ok: true, refreshed: true });
}
