// POST /api/trade-off/push-subscriptions/subscribe
// Magic-link authenticated. Body: { slug, edit_token, endpoint,
// p256dh_key, auth_key, user_agent, platform, device_label?,
// vibration_pattern?, muted_events?, quiet_hours_start?, quiet_hours_end? }.
//
// UPSERT keyed on (listing_id, endpoint_hash). Sets enabled=true and
// resets failure_count=0 so a previously-disabled row revives in one
// call. Returns the endpoint_hash so the client can store it locally
// for later disable / test / settings calls — without ever holding
// the raw endpoint URL.
//
// Privacy: we accept the raw endpoint here (it's the only way to send
// pushes), persist it, and surface only the SHA-256 hash back in any
// other response.

import { NextResponse, type NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
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

function hourOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > 23) return null;
  return Math.floor(n);
}

function intArrayOrNull(v: unknown): number[] | null {
  if (!Array.isArray(v)) return null;
  const out: number[] = [];
  for (const x of v) {
    const n = Number(x);
    if (!Number.isFinite(n) || n < 0 || n > 5000) return null;
    out.push(Math.floor(n));
  }
  if (out.length === 0 || out.length > 20) return null;
  return out;
}

function stringArrayOrNull(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string") return null;
    const t = x.trim();
    if (t.length === 0 || t.length > 64) return null;
    out.push(t);
  }
  return out;
}

const PLATFORMS = new Set(["ios", "android", "desktop", "unknown"]);

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const slug = s(body.slug);
  const token = s(body.edit_token);
  const endpoint = s(body.endpoint);
  const p256dh = s(body.p256dh_key);
  const auth = s(body.auth_key);
  const userAgent = s(body.user_agent).slice(0, 500) || null;
  const platformRaw = s(body.platform);
  const platform = PLATFORMS.has(platformRaw) ? platformRaw : "unknown";
  const deviceLabel = s(body.device_label).slice(0, 60) || null;
  const vibrationPattern = intArrayOrNull(body.vibration_pattern);
  const mutedEvents = stringArrayOrNull(body.muted_events);
  const quietStart = hourOrNull(body.quiet_hours_start);
  const quietEnd = hourOrNull(body.quiet_hours_end);

  if (!slug || !token || !endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { ok: false, error: "Missing slug, edit_token, endpoint, p256dh_key or auth_key." },
      { status: 400 }
    );
  }
  if (!/^https?:\/\//.test(endpoint)) {
    return NextResponse.json({ ok: false, error: "Invalid endpoint URL." }, { status: 400 });
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

  const endpointHash = createHash("sha256").update(endpoint).digest("hex");

  const row: Record<string, unknown> = {
    listing_id: listing.data.id,
    endpoint,
    p256dh_key: p256dh,
    auth_key: auth,
    user_agent: userAgent,
    platform,
    device_label: deviceLabel,
    enabled: true,
    failure_count: 0
  };
  if (vibrationPattern) row.vibration_pattern = vibrationPattern;
  if (mutedEvents) row.muted_events = mutedEvents;
  if (quietStart !== null) row.quiet_hours_start = quietStart;
  if (quietEnd !== null) row.quiet_hours_end = quietEnd;

  const upsert = await supabaseAdmin
    .from("hammerex_xrated_push_subscriptions")
    .upsert(row, { onConflict: "listing_id,endpoint_hash" })
    .select("id, endpoint_hash, platform, device_label, vibration_pattern, muted_events, quiet_hours_start, quiet_hours_end, enabled")
    .maybeSingle();

  if (upsert.error || !upsert.data) {
    console.error("[push-subscriptions/subscribe] upsert failed:", upsert.error);
    return NextResponse.json(
      { ok: false, error: upsert.error?.message ?? "Upsert failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    endpoint_hash: upsert.data.endpoint_hash ?? endpointHash,
    subscription: {
      endpoint_hash: upsert.data.endpoint_hash ?? endpointHash,
      platform: upsert.data.platform,
      device_label: upsert.data.device_label,
      vibration_pattern: upsert.data.vibration_pattern,
      muted_events: upsert.data.muted_events,
      quiet_hours_start: upsert.data.quiet_hours_start,
      quiet_hours_end: upsert.data.quiet_hours_end,
      enabled: upsert.data.enabled
    }
  });
}
