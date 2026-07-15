// GET /api/health/stripe — Stripe API key is loaded and reachable.
//
// Issues a `stripe.balance.retrieve()` — the cheapest authenticated
// endpoint Stripe exposes. If the key is missing/invalid we return
// 'down'. Slow response is 'degraded'. Powers the "Stripe · payments"
// tile on /admin/red-zone.

import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({
      ok: false,
      status: "down",
      detail: "STRIPE_SECRET_KEY not set",
      elapsedMs: 0,
      checkedAt: new Date().toISOString()
    });
  }
  try {
    const stripe = new Stripe(key);
    await stripe.balance.retrieve();
    const elapsed = Date.now() - startedAt;
    return NextResponse.json({
      ok: true,
      status: elapsed > 1500 ? "degraded" : "operational",
      detail: `Balance API · ${elapsed}ms`,
      elapsedMs: elapsed,
      checkedAt: new Date().toISOString()
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      status: "down",
      detail: `Stripe threw: ${e instanceof Error ? e.message : String(e)}`,
      elapsedMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString()
    });
  }
}
