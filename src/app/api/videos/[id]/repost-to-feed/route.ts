// POST /api/videos/[id]/repost-to-feed
// Networkers TV — repost an existing library video as a 30-day
// feed-class post. Free (WASHERS_PER_FEED_POST=0 in v0.5).
//
// This is the "one upload, many posts" pattern: the library video
// (portfolio/kb) stays permanent; a new feed-class row is created
// that references it via parent_video_id + shares the same video_url.
// The feed row auto-expires in 30 days per the migration trigger.
//
// Auth: merchant must own the source video.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const merchantSlug = await getMerchantSlug();
  if (!merchantSlug) {
    return NextResponse.json({ ok: false, error: "auth-required" }, { status: 401 });
  }

  const { id: sourceId } = await params;

  // Fetch the source video + validate ownership + class
  const src = await supabaseAdmin
    .from("hammerex_videos")
    .select("id, merchant_slug, title, description, video_url, thumbnail_url, duration_seconds, category_slug, trade_slug, project_type, city, regions, difficulty, estimated_time_hours, estimated_cost_gbp, video_class, status")
    .eq("id", sourceId)
    .maybeSingle();

  if (src.error || !src.data) {
    return NextResponse.json({ ok: false, error: "source-not-found" }, { status: 404 });
  }
  const source = src.data;

  if (source.merchant_slug !== merchantSlug) {
    return NextResponse.json({ ok: false, error: "not-owner" }, { status: 403 });
  }
  if (source.video_class === "feed") {
    return NextResponse.json({ ok: false, error: "source-is-feed", message: "Can only repost from a permanent library video (portfolio or knowledge-base class)." }, { status: 400 });
  }
  if (source.status !== "live") {
    return NextResponse.json({ ok: false, error: "source-not-live" }, { status: 400 });
  }

  // Create the feed-class row referencing the source
  const nowIso = new Date().toISOString();
  const insert = await supabaseAdmin
    .from("hammerex_videos")
    .insert({
      merchant_slug:        merchantSlug,
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
      // expires_at auto-set to now + 30 days by the trigger
    })
    .select("id, expires_at")
    .single();

  if (insert.error || !insert.data) {
    return NextResponse.json({ ok: false, error: "db-insert-failed", detail: insert.error?.message }, { status: 500 });
  }

  return NextResponse.json({
    ok:         true,
    id:         insert.data.id,
    expires_at: insert.data.expires_at,
    source_id:  source.id
  });
}
