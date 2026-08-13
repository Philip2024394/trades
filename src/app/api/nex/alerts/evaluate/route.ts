// POST /api/nex/alerts/evaluate — run all enabled rules against a
// fresh platform snapshot · open/dedup/resolve alerts · dispatch new
// ones through configured channels (Wave 3 H5 · gated by
// NEX_ALERTS_DISPATCH_ENABLED=1). Also pressable from the AlertsCentrePanel
// Run-tick button.
//
// Wave 3 · H5 · dispatch behaviour:
//   NEX_ALERTS_DISPATCH_ENABLED unset  → alerts open/resolve · outbound
//                                        notifications suppressed
//   NEX_ALERTS_DISPATCH_ENABLED=1      → dispatch per rule notify_channels

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { evaluate } from "@/lib/nex/alerts/evaluator";
// W-OBS-1 Path A Layer 1 · Wave 3 H5 · adopted 2026-08-10.
import { runFromRequest } from "@/lib/nex/observability/correlation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  return runFromRequest(req, async () => NextResponse.json(await evaluate()));
}
export async function GET(req: NextRequest) {
  return runFromRequest(req, async () => NextResponse.json(await evaluate()));
}
