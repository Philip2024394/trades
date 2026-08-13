// POST /api/nex/automation/scan — evaluate recent events against enabled rules
//
// Body (all optional):
//   { since_hours?: number, event_limit?: number }
//
// Idempotent per (rule_id, event_id) — safe to call repeatedly from cron
// or admin trigger. L3 rules execute inline · L1/L2 rules create pending runs.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { scanRecentEvents } from "@/lib/nex/automation/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try { body = await req.json() as Record<string, unknown>; } catch { /* body optional */ }

  const hoursRaw = typeof body.since_hours === "number" ? body.since_hours : 1;
  const eventLimit = typeof body.event_limit === "number" ? body.event_limit : 500;
  const sinceMs = Math.min(Math.max(0.05, hoursRaw), 168) * 60 * 60 * 1000;
  const limit = Math.min(Math.max(1, eventLimit), 2000);

  try {
    const result = await scanRecentEvents(sinceMs, limit);
    return NextResponse.json({ ok: true, backend: "filesystem", ...result });
  } catch (err) {
    console.error("[automation.scan.POST] failed:", err);
    return NextResponse.json({ ok: false, error: "scan_failed", detail: err instanceof Error ? err.message : "unknown" }, { status: 500 });
  }
}
