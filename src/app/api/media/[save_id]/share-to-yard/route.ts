// POST /api/media/[save_id]/share-to-yard
// Share a saved video to the current user's Yard feed. Creates a
// feed-class video row referencing the source video's parent_video_id.
//
// Only works if:
//   • Save belongs to the current session user
//   • Save is a video (photo share lands later)
//   • Source video is still live (not removed by owner)
//   • Current session is a merchant (only trades post to Yard)
//
// Behaviour: identical to /api/videos/[id]/repost-to-feed but starts
// from a save_id instead of a raw video_id (rail-friendly endpoint).

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ save_id: string }> }
) {
  const merchantSlug = await getMerchantSlug();
  if (!merchantSlug) {
    return NextResponse.json({ ok: false, error: "auth-required-merchant" }, { status: 401 });
  }

  const { save_id: saveId } = await params;

  // Fetch the save row + confirm ownership
  const saveRes = await supabaseAdmin
    .from("hammerex_media_saves")
    .select("id, saver_kind, saver_id, media_kind, media_id")
    .eq("id", saveId)
    .maybeSingle();
  if (!saveRes.data) return NextResponse.json({ ok: false, error: "save-not-found" }, { status: 404 });
  const save = saveRes.data;

  if (save.saver_kind !== "merchant" || save.saver_id !== merchantSlug) {
    return NextResponse.json({ ok: false, error: "not-owner" }, { status: 403 });
  }
  if (save.media_kind !== "video") {
    return NextResponse.json({ ok: false, error: "photo-share-not-supported-yet" }, { status: 400 });
  }

  // Fetch the source video
  const vRes = await supabaseAdmin
    .from("hammerex_videos")
    .select("id, merchant_slug, title, description, video_url, thumbnail_url, duration_seconds, category_slug, trade_slug, project_type, city, regions, difficulty, estimated_time_hours, estimated_cost_gbp, status")
    .eq("id", save.media_id)
    .maybeSingle();
  if (!vRes.data) return NextResponse.json({ ok: false, error: "video-removed-by-owner" }, { status: 410 });
  if (vRes.data.status !== "live") return NextResponse.json({ ok: false, error: "video-not-live" }, { status: 410 });
  const source = vRes.data;

  // Create the feed-class post — same pattern as repost-to-feed
  const nowIso = new Date().toISOString();
  const insert = await supabaseAdmin
    .from("hammerex_videos")
    .insert({
      merchant_slug:        merchantSlug,   // posted BY the sharer, not the original owner
      parent_video_id:      source.id,
      title:                source.title,
      description:          source.description,
      video_url:            source.video_url,
      thumbnail_url:        source.thumbnail_url,
      duration_seconds:     source.duration_seconds,
      video_class:          "feed",
      status:               "live",
      category_slug:        source.category_slug,
      trade_slug:           source.trade_slug,
      project_type:         source.project_type,
      city:                 source.city,
      regions:              source.regions ?? [],
      difficulty:           source.difficulty,
      estimated_time_hours: source.estimated_time_hours,
      estimated_cost_gbp:   source.estimated_cost_gbp,
      published_at:         nowIso
    })
    .select("id, expires_at")
    .single();

  if (insert.error || !insert.data) {
    return NextResponse.json({ ok: false, error: "db-insert-failed", detail: insert.error?.message }, { status: 500 });
  }

  return NextResponse.json({
    ok:         true,
    feed_id:    insert.data.id,
    expires_at: insert.data.expires_at,
    source_id:  source.id
  });
}
