// src/app/api/nex/founder-window/flow-counts/route.ts
//
// Founder's Window · GET /api/nex/founder-window/flow-counts
//
// Returns real per-stage counts (1h, 24h, total). Every number is a live
// Postgres query. Zero fabrication. Honest `note` field where a stage is
// unmeasurable today.

import { NextResponse } from "next/server";
import { computeFlowCounts } from "@/lib/nex/founder-window/flow-counts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isFounderRequest(req: Request): boolean {
  const url = new URL(req.url);
  const host = url.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  const cookie = req.headers.get("cookie") ?? "";
  if (cookie.includes("admin_authed=1") || /x-admin-sig|nex_session=/.test(cookie)) return true;
  const token = req.headers.get("x-hq-token") ?? url.searchParams.get("hq_token");
  const expected = process.env.NEX_HQ_DASHBOARD_TOKEN;
  if (expected && expected.length >= 16 && token && token === expected) return true;
  return false;
}

export async function GET(req: Request) {
  if (!isFounderRequest(req)) {
    return NextResponse.json({ error: "no_founder_credential" }, { status: 401 });
  }
  const t0 = Date.now();
  const stages = await computeFlowCounts();
  return NextResponse.json({
    generated_at: new Date().toISOString(),
    compute_duration_ms: Date.now() - t0,
    stages,
  }, { headers: { "Cache-Control": "no-store" } });
}
