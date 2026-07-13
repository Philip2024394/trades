// GET /api/trade-off/session
//
// Read-only "am I signed in?" endpoint used by the header burger
// menu to swap between "Log in / Join Free" and "My Notebook / Sign
// out" states. Returns the merchant's slug when they carry a valid
// signed session cookie. Cookie itself is HttpOnly so the client can
// never introspect it directly — this endpoint is the safe read
// bridge.

import { NextResponse, type NextRequest } from "next/server";
import { readTradeSession } from "@/lib/tradeSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = readTradeSession(req);
  if (!session) {
    return NextResponse.json({ ok: false });
  }
  return NextResponse.json({ ok: true, slug: session.slug, listingId: session.listing_id });
}
