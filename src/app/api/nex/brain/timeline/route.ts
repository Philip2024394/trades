// GET /api/nex/brain/timeline — real-time pipeline event feed
//
// Philip 2026-08-06 · "Build a Pipeline Monitor. A monitoring page
// with a timeline showing every event as it happens."
//
// Returns the latest audit_log entries as a chronological timeline.
// Every worker writes to audit_log on completion (context-assembled,
// voice-guide-assembled, learning-bundle-assembled, insert, approve,
// review-required, guardian-finding, retry-succeeded, etc.), so the
// timeline naturally captures the whole pipeline life-cycle.
//
// Query params:
//   limit      max events to return (default 50, max 200)
//   since      ISO timestamp — return only events strictly newer than
//              this. Used by the client for tail-polling: pass the
//              most recent event's created_at to get only new events.
//   entity_id  filter to events about a specific record or inbox item

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { brainStore } from "@/lib/nex/brain/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(1, Number(searchParams.get("limit") ?? "50")), 200);
  const since = searchParams.get("since") ?? undefined;
  const entity_id = searchParams.get("entity_id") ?? undefined;

  try {
    const events = await brainStore().listAudit({
      limit,
      since: since && since !== "null" ? since : undefined,
      entity_id: entity_id && entity_id !== "null" ? entity_id : undefined,
    });
    return NextResponse.json({ ok: true, events });
  } catch (err) {
    console.error("[api.brain.timeline] failed:", err);
    return NextResponse.json({ ok: false, error: "timeline_failed" }, { status: 500 });
  }
}
