// POST /api/media/save
// Unified save endpoint — homeowners OR merchants can save videos
// (photo support activates when we align on the photo schema).
//
// Toggle semantics:
//   • First POST with a given media_id → creates a save row + returns saved: true
//   • Second POST with the same media_id → deletes the save row + returns saved: false
// Client shows the button state based on the response.
//
// Also fires notebook_save event on hammerex_video_metrics for
// analytics — the metric ledger is the event stream, hammerex_media_saves
// is the durable list.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SavePayload = {
  media_kind: "video" | "photo";
  media_id:   string;
};

export async function POST(req: Request) {
  let body: SavePayload;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 }); }

  if (!body.media_id || !["video", "photo"].includes(body.media_kind)) {
    return NextResponse.json({ ok: false, error: "invalid-payload" }, { status: 400 });
  }

  // Resolve saver identity — try merchant first, then homeowner.
  // Trades saving a video is a legitimate action (research, quote
  // reference, mentor material), so we accept both session types.
  const merchantSlug = await getMerchantSlug();
  const homeowner    = merchantSlug ? null : await getHomeownerFromCookie();

  if (!merchantSlug && !homeowner) {
    return NextResponse.json({ ok: false, error: "auth-required" }, { status: 401 });
  }

  const saverKind: "merchant" | "homeowner" = merchantSlug ? "merchant" : "homeowner";
  const saverId   = merchantSlug ?? homeowner!.id;

  // Toggle: check existing then create OR delete
  const existing = await supabaseAdmin
    .from("hammerex_media_saves")
    .select("id")
    .eq("saver_kind", saverKind)
    .eq("saver_id",   saverId)
    .eq("media_kind", body.media_kind)
    .eq("media_id",   body.media_id)
    .maybeSingle();

  if (existing.data) {
    // Already saved → unsave
    await supabaseAdmin
      .from("hammerex_media_saves")
      .delete()
      .eq("id", existing.data.id);
    return NextResponse.json({ ok: true, saved: false, action: "removed" });
  }

  // Not saved → save
  const insert = await supabaseAdmin
    .from("hammerex_media_saves")
    .insert({
      saver_kind: saverKind,
      saver_id:   saverId,
      media_kind: body.media_kind,
      media_id:   body.media_id
    })
    .select("id")
    .single();

  if (insert.error) {
    return NextResponse.json({ ok: false, error: "db-insert-failed", detail: insert.error.message }, { status: 500 });
  }

  // Fire the notebook_save metric event (analytics stream)
  if (body.media_kind === "video") {
    await supabaseAdmin
      .from("hammerex_video_metrics")
      .insert({
        video_id:   body.media_id,
        event:      "save",
        actor_kind: saverKind === "merchant" ? "trade" : "homeowner",
        actor_slug: saverId
      })
      .then(() => undefined)
      .catch(() => undefined);

    // Bump denormalised save_count on the video row
    const cur = await supabaseAdmin
      .from("hammerex_videos")
      .select("save_count")
      .eq("id", body.media_id)
      .single();
    if (cur.data) {
      await supabaseAdmin
        .from("hammerex_videos")
        .update({ save_count: (cur.data.save_count ?? 0) + 1 })
        .eq("id", body.media_id);
    }
  }

  return NextResponse.json({ ok: true, saved: true, action: "created", id: insert.data.id });
}

// GET /api/media/save?media_kind=video&media_id=<uuid>
// Check if the current user has saved this media (for button initial state).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mediaKind = url.searchParams.get("media_kind");
  const mediaId   = url.searchParams.get("media_id");
  if (!mediaId || !mediaKind) {
    return NextResponse.json({ ok: false, error: "missing-params" }, { status: 400 });
  }

  const merchantSlug = await getMerchantSlug();
  const homeowner    = merchantSlug ? null : await getHomeownerFromCookie();
  if (!merchantSlug && !homeowner) {
    return NextResponse.json({ ok: true, saved: false, authed: false });
  }

  const saverKind = merchantSlug ? "merchant" : "homeowner";
  const saverId   = merchantSlug ?? homeowner!.id;

  const { data } = await supabaseAdmin
    .from("hammerex_media_saves")
    .select("id")
    .eq("saver_kind", saverKind)
    .eq("saver_id",   saverId)
    .eq("media_kind", mediaKind)
    .eq("media_id",   mediaId)
    .maybeSingle();

  return NextResponse.json({ ok: true, saved: Boolean(data), authed: true });
}
