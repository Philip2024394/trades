// POST /api/videos/[id]/metric
// Networkers TV — record a business-metric event against a video.
//
// Events (from hammerex_video_metrics CHECK):
//   view · view_complete · save · notebook_save
//   quote_attach · quote_view · product_click
//   lead_generated · booking · sale
//   contact_reveal · shared · ai_assistant_query
//
// Public endpoint — anyone can record a view. Higher-value events
// (lead_generated, booking, sale) will need auth in Phase 3 when
// they're wired to the attribution engine.
//
// Denormalised counters on hammerex_videos are updated on the
// three highest-frequency events (view / save / quote_attach) so
// the leaf page can render them without a live count.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_EVENTS = new Set([
  "view","view_complete","save","notebook_save",
  "quote_attach","quote_view","product_click",
  "lead_generated","booking","sale",
  "contact_reveal","shared","ai_assistant_query"
]);

// Which events increment which denormalised counter on the parent row.
const COUNTER_MAP: Record<string, string> = {
  view:            "view_count",
  save:            "save_count",
  quote_attach:    "quote_attach_count",
  lead_generated:  "lead_count",
  booking:         "booking_count"
};

type MetricPayload = {
  event:        string;
  actor_kind?:  "anonymous" | "homeowner" | "trade" | "merchant" | "admin";
  actor_slug?:  string;
  session_id?:  string;
  metadata?:    Record<string, unknown>;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: videoId } = await params;

  let body: MetricPayload;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 }); }

  if (!VALID_EVENTS.has(body.event)) {
    return NextResponse.json({ ok: false, error: "invalid-event" }, { status: 400 });
  }

  // Confirm video exists (avoid ghost metrics)
  const vRes = await supabaseAdmin
    .from("hammerex_videos")
    .select("id, status")
    .eq("id", videoId)
    .maybeSingle();
  if (!vRes.data) return NextResponse.json({ ok: false, error: "video-not-found" }, { status: 404 });

  // Insert event row
  const insert = await supabaseAdmin
    .from("hammerex_video_metrics")
    .insert({
      video_id:   videoId,
      event:      body.event,
      actor_kind: body.actor_kind ?? "anonymous",
      actor_slug: body.actor_slug ?? null,
      session_id: body.session_id ?? null,
      metadata:   body.metadata ?? {}
    });

  if (insert.error) {
    return NextResponse.json({ ok: false, error: "db-insert-failed", detail: insert.error.message }, { status: 500 });
  }

  // Bump denormalised counter if applicable
  const counter = COUNTER_MAP[body.event];
  if (counter) {
    // Simple increment via SQL raw update — no RPC needed for a single-column bump
    await supabaseAdmin
      .from("hammerex_videos")
      .update({ [counter]: (undefined as unknown) })  // placeholder, replaced below
      .eq("id", videoId)
      .then(() => undefined)
      .catch(() => undefined);
    // Real increment via .rpc-less pattern: fetch + write. Cheap at
    // v0.5 volumes; swap for a Postgres trigger or view later.
    const cur = await supabaseAdmin
      .from("hammerex_videos")
      .select(counter)
      .eq("id", videoId)
      .single();
    const curVal = (cur.data as Record<string, number> | null)?.[counter] ?? 0;
    await supabaseAdmin
      .from("hammerex_videos")
      .update({ [counter]: curVal + 1 })
      .eq("id", videoId);
  }

  return NextResponse.json({ ok: true, recorded: body.event });
}
