// POST /api/studio/events   { events: BeaconEvent[] }
//
// Public endpoint — receives customer-side telemetry from the beacon.
// No auth. Validated + rate-limited by batch size and by the caps in
// the beacon itself. Every event is inserted into studio_layout_events.
//
// The client sends a `visitor_id` (uuid it minted in localStorage). The
// server hashes it with a per-brand salt so the raw id NEVER lands in
// the database — that keeps us clear of the GDPR "device identifier"
// rules while still giving us a stable pseudonymous id for dedupe.

import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const MAX_EVENTS_PER_REQUEST = 30;

const ALLOWED_EVENTS = new Set([
  "view",
  "click",
  "scroll",
  "convert",
  "pick",
  "edit",
  "move",
  "remove",
  "publish",
  "revert",
  "score"
]);

// The `event` check constraint in studio_layout_events currently accepts
// this narrower set. Everything else is dropped silently rather than
// 400'd — this endpoint is on the customer hot-path and should never be
// the thing that breaks a page.
const PERSISTED_EVENTS = new Set([
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

type IncomingEvent = {
  event: string;
  brand_id?: string | null;
  page_id?: string | null;
  section_key?: string | null;
  layout_variant?: string | null;
  instance_id?: string | null;
  variant_bucket?: string | null;
  experiment_id?: string | null;
  payload?: Record<string, unknown>;
  visitor_id?: string | null;
  ts?: number;
};

const HASH_SALT = process.env.STUDIO_VISITOR_HASH_SALT ?? "studio-v1";

function hashVisitor(visitorId: string | null | undefined, brandId: string | null | undefined): string | null {
  if (!visitorId) return null;
  return createHash("sha256")
    .update(`${HASH_SALT}::${brandId ?? "no-brand"}::${visitorId}`)
    .digest("hex")
    .slice(0, 32);
}

export async function POST(req: Request) {
  let body: { events?: IncomingEvent[] };
  try {
    body = (await req.json()) as { events?: IncomingEvent[] };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }
  if (!Array.isArray(body.events) || body.events.length === 0) {
    return NextResponse.json({ ok: false, error: "empty-batch" }, { status: 400 });
  }
  const events = body.events.slice(0, MAX_EVENTS_PER_REQUEST);

  const rows = events
    .filter((e) => typeof e.event === "string" && ALLOWED_EVENTS.has(e.event))
    .filter((e) => PERSISTED_EVENTS.has(e.event))
    .map((e) => {
      const bucket =
        e.variant_bucket === "A" || e.variant_bucket === "B"
          ? e.variant_bucket
          : null;
      return {
        merchant_id: null as string | null,
        brand_id: e.brand_id ?? null,
        page_id: e.page_id ?? null,
        section_key: e.section_key ?? null,
        layout_variant: e.layout_variant ?? null,
        instance_id: e.instance_id ?? null,
        variant_bucket: bucket,
        experiment_id: e.experiment_id ?? null,
        event: e.event,
        payload_json: e.payload ?? null,
        visitor_hash: hashVisitor(e.visitor_id, e.brand_id ?? null)
      };
    });

  if (rows.length === 0) {
    // Nothing to write, but tell the caller we accepted the request so
    // it doesn't retry.
    return NextResponse.json({ ok: true, inserted: 0 });
  }

  const res = await supabaseAdmin.from("studio_layout_events").insert(rows);
  if (res.error) {
    return NextResponse.json(
      { ok: false, error: res.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, inserted: rows.length });
}
