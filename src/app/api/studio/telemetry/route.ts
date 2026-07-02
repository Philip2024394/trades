// Studio telemetry ingest.
//
// POST { events: [...] } — writes each event into studio_layout_events.
// Cookie-authenticated: the editor already has a session; the iframe
// forwards its telemetry through the parent so no cross-origin token
// juggling is needed.
//
// Non-blocking on the merchant path: any DB failure logs server-side
// but the response still returns ok:true so the client doesn't retry.
// Telemetry drops are acceptable — editing is not.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadStudioSession } from "@/lib/studio/session";
import type { LayoutEventKind } from "@/lib/studio/schema";
import type { StudioTelemetryEvent } from "@/lib/studio/telemetry";

export const runtime = "nodejs";

/** Cap per request so a runaway iframe can't fill the event table.
 *  Extra events are silently dropped. */
const MAX_EVENTS_PER_REQUEST = 200;

/** Match the CHECK constraint on studio_layout_events.event. Anything
 *  outside this set is dropped — the DB would reject it anyway. */
const CANONICAL_EVENTS: ReadonlySet<LayoutEventKind> = new Set<LayoutEventKind>([
  "pick",
  "edit",
  "move",
  "remove",
  "publish",
  "revert",
  "view",
  "convert",
  "score"
]);

export async function POST(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  let body: { events?: StudioTelemetryEvent[] } | null = null;
  try {
    body = (await req.json()) as { events?: StudioTelemetryEvent[] };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const events = Array.isArray(body?.events) ? body.events : [];
  const filtered = events.filter((e) => CANONICAL_EVENTS.has(e.event));
  if (filtered.length === 0) {
    return NextResponse.json({ ok: true, ingested: 0 });
  }

  const rows = filtered.slice(0, MAX_EVENTS_PER_REQUEST).map((e) => ({
    merchant_id: session.merchant.id,
    brand_id: session.brand.id,
    page_id: e.pageId ?? null,
    section_key: e.sectionKey ?? null,
    layout_variant: e.layoutVariant ?? null,
    event: e.event,
    payload_json: {
      ...(e.metadata ?? {}),
      ...(e.tags ? { _tags: e.tags } : {})
    }
  }));

  try {
    const res = await supabaseAdmin
      .from("studio_layout_events")
      .insert(rows);
    if (res.error) {
      console.warn("[studio/telemetry] insert failed:", res.error.message);
    }
  } catch (e) {
    console.warn("[studio/telemetry] insert exception:", (e as Error).message);
  }

  return NextResponse.json({ ok: true, ingested: rows.length });
}
