// POST /api/trade-off/video-save
// Records the uploaded video URL on the listing row after the direct-
// to-storage upload succeeds. Same magic-link edit-token auth pattern
// as /api/trade-off/video-upload-url.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const listingId = s(body.listing_id);
  const editToken = s(body.edit_token);
  const videoUrl = s(body.video_url);
  const videoCaption = s(body.video_caption);

  if (!listingId || !editToken) {
    return NextResponse.json(
      { ok: false, error: "Missing listing or token" },
      { status: 400 }
    );
  }
  // The URL must point at our Supabase Storage bucket OR be a YouTube
  // URL — the PremiumHero detects format and routes accordingly. We
  // reject anything else so a bad token can't seed an open redirect.
  const isSupabaseStorage = videoUrl.startsWith(
    "https://msdonkkechxzgagyguoe.supabase.co/storage/"
  );
  const isYouTube =
    videoUrl.startsWith("https://www.youtube.com/") ||
    videoUrl.startsWith("https://youtu.be/") ||
    videoUrl.startsWith("https://youtube.com/");
  if (!videoUrl || (!isSupabaseStorage && !isYouTube)) {
    return NextResponse.json(
      { ok: false, error: "Video URL must be self-hosted or a YouTube link." },
      { status: 400 }
    );
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing.data) {
    return NextResponse.json(
      { ok: false, error: "Listing not found" },
      { status: 404 }
    );
  }
  if (listing.data.edit_token !== editToken) {
    return NextResponse.json(
      { ok: false, error: "Invalid edit token" },
      { status: 403 }
    );
  }

  const patch: Record<string, string | null> = { video_url: videoUrl };
  if (videoCaption) patch.video_caption = videoCaption.slice(0, 60);

  const upd = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update(patch)
    .eq("id", listingId)
    .select("id")
    .maybeSingle();
  if (upd.error) {
    console.error("[video-save] update failed:", upd.error);
    return NextResponse.json(
      { ok: false, error: "Could not save — try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
