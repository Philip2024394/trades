// POST /api/trade-off/faq-items/track-view
// Public, no auth. Body: { slug, ref_code }.
// Increments view_count on a single FAQ row when a customer expands /
// shares it from the dedicated /<slug>/faq page. Rate-limited per
// (ip_hash, slug, ref_code) via an in-memory sliding window so a
// determined scraper can't inflate the counter. Memory-only rate limit
// is acceptable here — at worst a few extra views slip through, which
// the tradesperson reads as a softer "high signal" metric anyway.

import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const REF_RE = /^FAQ-[0-9]{3,4}$/;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_BUCKET = new Map<string, number>();

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const first = xff.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "0.0.0.0";
}

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

function shouldRateLimit(key: string): boolean {
  const now = Date.now();
  const last = RATE_BUCKET.get(key);
  if (last && now - last < RATE_WINDOW_MS) {
    return true;
  }
  RATE_BUCKET.set(key, now);
  // Crude housekeeping — every ~100 keys, sweep stale entries.
  if (RATE_BUCKET.size > 100 && Math.random() < 0.05) {
    for (const [k, t] of RATE_BUCKET) {
      if (now - t > RATE_WINDOW_MS) RATE_BUCKET.delete(k);
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const slug = s(body.slug);
  const refRaw = s(body.ref_code).toUpperCase();
  if (!slug || !refRaw) {
    return NextResponse.json(
      { ok: false, error: "Missing slug or ref_code." },
      { status: 400 }
    );
  }
  if (!REF_RE.test(refRaw)) {
    return NextResponse.json(
      { ok: false, error: "Invalid ref_code." },
      { status: 400 }
    );
  }

  const ipHash = hashIp(clientIp(req));
  const key = `${ipHash}:${slug}:${refRaw}`;
  if (shouldRateLimit(key)) {
    return NextResponse.json({ ok: true, rate_limited: true });
  }

  // Resolve the listing by slug. Public read on the listings table is
  // already permitted via the anon key, but we go through the admin
  // client so the increment update writes through RLS.
  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  if (!listing.data) {
    return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  }

  const faq = await supabaseAdmin
    .from("hammerex_xrated_faq_items")
    .select("id, view_count")
    .eq("listing_id", listing.data.id)
    .eq("ref_code", refRaw)
    .maybeSingle();
  if (!faq.data) {
    return NextResponse.json({ ok: false, error: "FAQ not found." }, { status: 404 });
  }

  const nextCount = (faq.data.view_count ?? 0) + 1;
  const upd = await supabaseAdmin
    .from("hammerex_xrated_faq_items")
    .update({ view_count: nextCount })
    .eq("id", faq.data.id)
    .select("id, view_count")
    .maybeSingle();
  if (upd.error) {
    console.error("[trade-off/faq-items/track-view] update failed:", upd.error);
    return NextResponse.json(
      { ok: false, error: upd.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, view_count: upd.data?.view_count ?? nextCount });
}
