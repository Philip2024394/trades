// GET /api/trade-off/session
//
// Read-only "am I signed in?" endpoint used by the header burger
// menu to swap between "Log in / Join Free" and "My Notebook / Sign
// out" states. Returns the merchant's slug + a compact profile
// (display name, avatar, trade label, city) so the burger can render
// a signed-in profile card without a second round-trip.
//
// The signed session cookie itself is HttpOnly so the client can
// never introspect it directly — this endpoint is the safe read
// bridge.

import { NextResponse, type NextRequest } from "next/server";
import { readTradeSession } from "@/lib/tradeSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { tradeLabel as lookupTradeLabel } from "@/lib/tradeOff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = readTradeSession(req);
  if (!session) {
    return NextResponse.json({ ok: false });
  }
  // Look up the display fields — best-effort. If the listing row is
  // missing for any reason we still return `ok: true` so the header
  // renders the signed-in variant; the profile card degrades gracefully.
  const { data } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("display_name, primary_trade, city, avatar_url")
    .eq("id", session.listing_id)
    .maybeSingle();
  return NextResponse.json({
    ok: true,
    slug: session.slug,
    listingId: session.listing_id,
    displayName: data?.display_name ?? null,
    avatarUrl: data?.avatar_url ?? null,
    primaryTrade: data?.primary_trade ?? null,
    tradeLabel: data?.primary_trade ? lookupTradeLabel(data.primary_trade) : null,
    city: data?.city ?? null
  });
}
