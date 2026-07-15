// GET /api/health/site — server can respond, environment loaded.
//
// Cheapest liveness check on the platform. Doesn't touch DB, Stripe,
// or any external. If this fails, the whole app is down. Powers the
// "Site uptime" tile on /admin/red-zone.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    status: "operational",
    detail: "Server responding",
    checkedAt: new Date().toISOString()
  });
}
