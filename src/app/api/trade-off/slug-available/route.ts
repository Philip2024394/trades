// GET /api/trade-off/slug-available?slug=<slug>
// Lightweight availability check for the vanity slug picker in the signup
// form. Returns { available: boolean, reason?: string }.
//
// A slug is unavailable if:
//   - it matches anything in TRADE_OFF_RESERVED_SLUGS
//   - is shorter than 3 or longer than 60 chars
//   - contains anything other than [a-z0-9-]
//   - starts or ends with a hyphen
//   - already exists in hammerex_trade_off_listings (any status)

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isReservedSlug } from "@/lib/tradeOff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") ?? "").toLowerCase().trim();
  // Optional "self" param so the edit form doesn't flag the tradie's own
  // current slug as taken.
  const self = (url.searchParams.get("self") ?? "").toLowerCase().trim();

  if (!slug) {
    return NextResponse.json({ available: false, reason: "empty" });
  }
  if (slug === self) {
    return NextResponse.json({ available: true });
  }
  if (isReservedSlug(slug)) {
    return NextResponse.json({ available: false, reason: "reserved" });
  }

  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (res.error && res.error.code !== "PGRST116") {
    console.error("[trade-off/slug-available] lookup failed:", res.error);
    return NextResponse.json(
      { available: false, reason: "error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ available: !res.data });
}
