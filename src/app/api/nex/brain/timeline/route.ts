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
import { z } from "zod";
import { brainStore } from "@/lib/nex/brain/storage";
import { validateSearchParams } from "@/lib/nex/brain/http/validate-input";
import { logger } from "@/lib/nex/observability/logger";
// W-OBS-1 Path A Layer 1 · Wave 3 H2.a · adopted 2026-08-10.
import { runFromRequest } from "@/lib/nex/observability/correlation";

const log = logger("api.brain.timeline");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  // `since` accepts ISO datetime; the literal string "null" is also
  // ignored (kept as backward-compat: some legacy callers pass "null"
  // as a stringified placeholder for absent value).
  since: z.string().datetime().optional().or(z.literal("null").transform(() => undefined)),
  entity_id: z.string().min(1).optional().or(z.literal("null").transform(() => undefined)),
});

export async function GET(req: NextRequest) {
  return runFromRequest(req, () => timelineHandler(req));
}

async function timelineHandler(req: NextRequest) {
  const parsed = validateSearchParams(req, QuerySchema);
  if (!parsed.ok) return parsed.response;
  const { limit, since, entity_id } = parsed.data;

  try {
    const events = await brainStore().listAudit({ limit, since, entity_id });
    return NextResponse.json({ ok: true, events });
  } catch (err) {
    log.error("timeline_failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false, error: "timeline_failed" }, { status: 500 });
  }
}
