// POST /api/trade-off/push-subscriptions/update-settings
// Magic-link authenticated. Body: { slug, edit_token, endpoint_hash,
// vibration_pattern?, muted_events?, quiet_hours_start?, quiet_hours_end? }.
//
// Per-device settings. Undefined fields are left alone; explicit null
// clears a column (used for "no quiet hours"); arrays replace whole.

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

function hourOrNullOrUndefined(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 23) return undefined;
  return Math.floor(n);
}

function intArrayOrUndefined(v: unknown): number[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) return undefined;
  const out: number[] = [];
  for (const x of v) {
    const n = Number(x);
    if (!Number.isFinite(n) || n < 0 || n > 5000) return undefined;
    out.push(Math.floor(n));
  }
  if (out.length === 0 || out.length > 20) return undefined;
  return out;
}

function stringArrayOrUndefined(v: unknown): string[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string") return undefined;
    const t = x.trim();
    if (t.length === 0 || t.length > 64) return undefined;
    out.push(t);
  }
  return out;
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

  const update: Record<string, unknown> = {};
  const vibrate = intArrayOrUndefined(body.vibration_pattern);
  if (vibrate !== undefined) update.vibration_pattern = vibrate;
  const muted = stringArrayOrUndefined(body.muted_events);
  if (muted !== undefined) update.muted_events = muted;
  const qhStart = hourOrNullOrUndefined(body.quiet_hours_start);
  if (qhStart !== undefined) update.quiet_hours_start = qhStart;
  const qhEnd = hourOrNullOrUndefined(body.quiet_hours_end);
  if (qhEnd !== undefined) update.quiet_hours_end = qhEnd;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: "Nothing to update." }, { status: 400 });
  }

  const upd = await supabaseAdmin
    .from("hammerex_xrated_push_subscriptions")
    .update(update)
    .eq("listing_id", listing.data.id)
    .eq("endpoint_hash", endpointHash)
    .select(
      "endpoint_hash, platform, device_label, vibration_pattern, muted_events, quiet_hours_start, quiet_hours_end, enabled"
    )
    .maybeSingle();

  if (upd.error) {
    return NextResponse.json({ ok: false, error: upd.error.message }, { status: 500 });
  }
  if (!upd.data) {
    return NextResponse.json({ ok: false, error: "Subscription not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, subscription: upd.data });
}
