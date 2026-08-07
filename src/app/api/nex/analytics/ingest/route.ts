// POST /api/nex/analytics/ingest — webhook target for provider adapters
// Body: AnalyticsEvent (see src/lib/nex/analytics/types.ts)
// Also accepts a bulk form: { events: AnalyticsEvent[] }
import { NextResponse } from "next/server";
import { ingestEvent } from "@/lib/nex/analytics/ingest";
import type { AnalyticsEvent } from "@/lib/nex/analytics/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: AnalyticsEvent | { events: AnalyticsEvent[] };
  try { body = await request.json() as AnalyticsEvent | { events: AnalyticsEvent[] }; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const events: AnalyticsEvent[] = "events" in body && Array.isArray(body.events) ? body.events : [body as AnalyticsEvent];
  if (events.length === 0) return NextResponse.json({ ok: false, error: "no events" }, { status: 400 });
  if (events.length > 500) return NextResponse.json({ ok: false, error: "batch too large · max 500" }, { status: 400 });

  const results = await Promise.all(events.map((e) => ingestEvent(e)));
  const okCount   = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;
  return NextResponse.json({ ok: failCount === 0, ingested: okCount, failed: failCount, event_ids: results.filter((r) => r.ok).map((r) => (r as { event_id: string }).event_id) });
}
