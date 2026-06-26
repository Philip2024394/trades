// POST /api/trade-off/track-whatsapp-click
// Records a customer tapping the WhatsApp / Contact button on a tradie
// profile. Body: { listing_id }. Increments whatsapp_click_count and
// stamps last_whatsapp_click_at on hammerex_trade_off_listings.
//
// Best-effort: ANY failure returns { ok: true } with HTTP 200 so a missed
// beacon never blocks the customer's jump-out to WhatsApp.
//
// Dedupe: in-memory map keyed on `${listing_id}::${ip}` with a 5-minute
// TTL — stops the same customer mashing the button from inflating the
// counter. Survives only the lambda lifetime, which is acceptable for a
// soft-counter feeding an upgrade nudge (NOT a billing metric).

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const DEDUPE_WINDOW_MS = 5 * 60 * 1000;
// Module-scope cache — survives between invocations on the same instance.
// Keys auto-evict on insert when older than DEDUPE_WINDOW_MS.
const lastSeen = new Map<string, number>();

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

function evictExpired(now: number): void {
  // Cheap pass — only walks when the map gets noticeably big.
  if (lastSeen.size < 256) return;
  for (const [key, ts] of lastSeen) {
    if (now - ts > DEDUPE_WINDOW_MS) lastSeen.delete(key);
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // sendBeacon with empty body — still return ok so we don't error the page.
      return NextResponse.json({ ok: true });
    }

    const listing_id =
      typeof body.listing_id === "string" && body.listing_id.trim().length > 0
        ? body.listing_id.trim()
        : null;
    if (!listing_id) return NextResponse.json({ ok: true });

    const ip = clientIp(req) ?? "unknown";
    const dedupeKey = `${listing_id}::${ip}`;
    const now = Date.now();
    const prev = lastSeen.get(dedupeKey);
    if (prev && now - prev < DEDUPE_WINDOW_MS) {
      // Same listing + same IP within 5 minutes — counted once already.
      return NextResponse.json({ ok: true, deduped: true });
    }
    lastSeen.set(dedupeKey, now);
    evictExpired(now);

    // Fetch current count, then write the increment. Using a read-modify-write
    // here (instead of an atomic RPC) is fine: the counter is a UX signal,
    // not a money-affecting number; a lost race at most under-counts by 1.
    const cur = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("whatsapp_click_count")
      .eq("id", listing_id)
      .maybeSingle();
    if (cur.error || !cur.data) return NextResponse.json({ ok: true });
    const next = (cur.data.whatsapp_click_count ?? 0) + 1;

    await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .update({
        whatsapp_click_count: next,
        last_whatsapp_click_at: new Date(now).toISOString()
      })
      .eq("id", listing_id);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
