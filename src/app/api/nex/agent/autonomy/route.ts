// src/app/api/nex/agent/autonomy/route.ts
//
// NEX Agent · Autonomy Dashboard · 9-signal snapshot.
// GET → the founder's permanent metric layer. Always computed fresh.
// Never stored · never spoofable · derived from real Postgres state.

import { NextResponse } from "next/server";
import { computeAutonomyDashboard } from "@/lib/nex-agent/core/autonomy-dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dashboard = await computeAutonomyDashboard();
    return NextResponse.json({ ok: true, dashboard }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message.slice(0, 200) }, { status: 500 });
  }
}
