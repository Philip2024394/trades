// POST /api/trade-off/track-view
// Inserts a "view start" row into hammerex_xrated_views. Used by the
// XratedViewTracker client component to measure per-listing page-view
// analytics on the Xrated Trades surfaces.
//
// Best-effort: any failure returns { ok: false } with HTTP 200 so a tracking
// miss never breaks the page. IP is SHA-256 hashed (first 16 hex chars) — we
// never store the raw IP. Country/city are pulled from the hx_country /
// hx_city cookies populated by the geo middleware.

import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCountryFromRequest, getCityFromRequest } from "@/lib/geo";

export const runtime = "nodejs";

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false });
    }

    const page = typeof body.page === "string" ? body.page.trim().slice(0, 50) : "";
    const session_id =
      typeof body.session_id === "string" ? body.session_id.trim().slice(0, 64) : "";
    const listing_id =
      typeof body.listing_id === "string" && body.listing_id.trim().length > 0
        ? body.listing_id.trim()
        : null;
    const referrer =
      typeof body.referrer === "string" && body.referrer.trim().length > 0
        ? body.referrer.trim().slice(0, 500)
        : null;

    if (!page || !session_id) {
      return NextResponse.json({ ok: false });
    }

    const ip = clientIp(req);
    const ip_hash = ip ? hashIp(ip) : null;
    const country = getCountryFromRequest(req.headers, req.cookies);
    const city = getCityFromRequest(req.headers, req.cookies);
    const user_agent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

    const insert = await supabaseAdmin
      .from("hammerex_xrated_views")
      .insert({
        listing_id,
        page,
        session_id,
        ip_hash,
        country,
        city,
        referrer,
        user_agent,
        viewed_at: new Date().toISOString(),
        ended_at: null
      })
      .select("id")
      .maybeSingle();

    if (insert.error || !insert.data) {
      return NextResponse.json({ ok: false });
    }

    return NextResponse.json({ ok: true, view_id: insert.data.id });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
