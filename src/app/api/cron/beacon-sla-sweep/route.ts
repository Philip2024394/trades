// GET /api/cron/beacon-sla-sweep
//
// Every 5 minutes: sweeps `assigned` claims past their SLA, times
// them out, back-fills the next wave for beacons that dropped below
// their slot target, escalates to admin residual when no more trades
// exist. See src/lib/beacon.server.ts for the mechanics.
//
// Gated by `CRON_SECRET` matching a bearer token so this route is
// only callable by the Vercel Cron scheduler. Register in vercel.json.

import { NextResponse } from "next/server";
import { slaSweep } from "@/lib/beacon.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (secret && bearer !== secret) {
    return NextResponse.json({ ok: false, error: "not-authorised" }, { status: 401 });
  }

  try {
    const result = await slaSweep();
    console.log("[cron/beacon-sla-sweep] result:", result);
    return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
  } catch (err) {
    console.error("[cron/beacon-sla-sweep] threw:", err);
    return NextResponse.json({ ok: false, error: "internal", detail: String(err) }, { status: 500 });
  }
}
