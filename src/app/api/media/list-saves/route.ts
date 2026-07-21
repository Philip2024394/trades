// GET /api/media/list-saves?kind=video&limit=24
// Returns the current user's saved media (video OR photo), joined
// with the underlying media data so the rail can render without
// a second round-trip.
//
// Auth: merchant OR homeowner session. If neither, returns { authed: false }.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url  = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "video";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "24"), 100);

  const merchantSlug = await getMerchantSlug();
  const homeowner    = merchantSlug ? null : await getHomeownerFromCookie();
  if (!merchantSlug && !homeowner) {
    return NextResponse.json({ ok: true, authed: false, saves: [] });
  }
  const saverKind: "merchant" | "homeowner" = merchantSlug ? "merchant" : "homeowner";
  const saverId   = merchantSlug ?? homeowner!.id;

  // Load raw saves — sorted pinned-first, then newest
  const savesRes = await supabaseAdmin
    .from("hammerex_media_saves")
    .select("id, media_kind, media_id, pinned, created_at")
    .eq("saver_kind", saverKind)
    .eq("saver_id",   saverId)
    .eq("media_kind", kind)
    .order("pinned",     { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  const saves = savesRes.data ?? [];
  if (saves.length === 0) {
    return NextResponse.json({ ok: true, authed: true, saves: [] });
  }

  // Batch-fetch the actual media rows so we can render titles +
  // thumbnails + detect removal (status='removed' → tombstone).
  const items = kind === "video"
    ? await hydrateVideos(saves.map((s) => s.media_id))
    : new Map();  // photo hydration lands with the photo table alignment

  const enriched = saves.map((s) => {
    const media = items.get(s.media_id);
    return {
      save_id:    s.id,
      media_kind: s.media_kind,
      media_id:   s.media_id,
      pinned:     s.pinned,
      saved_at:   s.created_at,
      // If media row is gone entirely OR marked removed → tombstone
      removed:    !media || media.status === "removed",
      video:      media ?? null
    };
  });

  return NextResponse.json({ ok: true, authed: true, saves: enriched });
}

async function hydrateVideos(ids: string[]) {
  const { data } = await supabaseAdmin
    .from("hammerex_videos")
    .select("id, title, thumbnail_url, duration_seconds, merchant_slug, status, video_class")
    .in("id", ids);
  const map = new Map();
  (data ?? []).forEach((v) => map.set(v.id, v));
  return map;
}
