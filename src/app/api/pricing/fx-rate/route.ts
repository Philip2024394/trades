// GET /api/pricing/fx-rate?to=EUR
//
// Returns the current GBP→<target> exchange rate for use by client-
// side components rendering dual-price displays on Business Brain
// surfaces. Server-side cached (24h TTL) so client calls hit our
// cache, not the upstream FX provider.
//
// Never used by Trade Brain surfaces per platform rule — no £
// figures on Trade Brain means no conversion to do.

import { NextResponse, type NextRequest } from "next/server";
import { getRates } from "@/lib/pricing/_fx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get("to")?.toUpperCase();
  if (!to || !/^[A-Z]{3}$/.test(to)) {
    return NextResponse.json({ ok: false, error: "invalid_to_currency" }, { status: 400 });
  }

  const { base, rates, stale } = await getRates();
  const rate = rates[to];
  if (typeof rate !== "number") {
    return NextResponse.json({ ok: false, error: "currency_not_supported" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    base,
    to,
    rate,
    stale,
    fetched_at: new Date().toISOString()
  });
}
