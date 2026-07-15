// POST /api/inspiration/visualise
//
// Site Interest "Visualise in my room" bolt-on submit endpoint.
// Accepts multipart/form-data:
//   • sourceImageUrl (string)  — the Site Interest image
//   • sourcePostId (string, optional)
//   • sourceCanteenId (string, optional)
//   • targetTradeSlug (string, optional)
//   • promptNote (string, optional, max 500 chars)
//   • roomPhoto (File)         — user's uploaded room photo
//
// Stores the room photo in the visualise-photos Supabase bucket,
// records a queued visualise_request row, and returns { id,
// status: "queued" }. Real AI generation happens in a follow-up
// worker (Fal / Replicate / etc); this endpoint just captures
// intent + files.
//
// Rate limit: 3 requests per IP per hour (matches quote-requests).

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ensureSiteBoardOwnerKey } from "@/lib/siteBoards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROOM_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB
const RATE_LIMIT_PER_HOUR = 3;

function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  return null;
}

async function isRateLimited(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const res = await supabaseAdmin
    .from("hammerex_visualise_requests")
    .select("id", { count: "exact", head: true })
    .eq("ip_address", ip)
    .gte("created_at", hourAgo);
  if (res.error) return false;
  return (res.count ?? 0) >= RATE_LIMIT_PER_HOUR;
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return NextResponse.json({ ok: false, error: "invalid-content-type" }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-multipart" }, { status: 400 });
  }

  const sourceImageUrl  = String(form.get("sourceImageUrl") ?? "").trim();
  const sourcePostId    = String(form.get("sourcePostId") ?? "").trim() || null;
  const sourceCanteenId = String(form.get("sourceCanteenId") ?? "").trim() || null;
  const targetTradeSlug = String(form.get("targetTradeSlug") ?? "").trim() || null;
  const promptNote      = String(form.get("promptNote") ?? "").trim().slice(0, 500) || null;
  const roomPhoto       = form.get("roomPhoto");

  if (!sourceImageUrl || !/^https?:\/\//.test(sourceImageUrl)) {
    return NextResponse.json({ ok: false, error: "invalid-source-image" }, { status: 400 });
  }
  if (!(roomPhoto instanceof File)) {
    return NextResponse.json({ ok: false, error: "room-photo-required" }, { status: 400 });
  }
  if (roomPhoto.size > MAX_ROOM_PHOTO_BYTES) {
    return NextResponse.json({ ok: false, error: "room-photo-too-large" }, { status: 400 });
  }
  if (!roomPhoto.type.startsWith("image/")) {
    return NextResponse.json({ ok: false, error: "room-photo-must-be-image" }, { status: 400 });
  }

  const ip = clientIp(req);
  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: "rate-limited", message: "Too many visualise requests in the last hour. Try again shortly." },
      { status: 429 }
    );
  }

  // Upload room photo → Supabase Storage
  const ownerKey = await ensureSiteBoardOwnerKey();
  const ext = roomPhoto.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "jpg";
  const shortOwner = ownerKey.replace("cookie:", "").slice(0, 8);
  const storagePath = `${shortOwner}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buffer = await roomPhoto.arrayBuffer();
  const up = await supabaseAdmin.storage
    .from("visualise-photos")
    .upload(storagePath, buffer, {
      contentType: roomPhoto.type,
      upsert: false
    });
  if (up.error) {
    // eslint-disable-next-line no-console
    console.error("[api/inspiration/visualise] upload failed", up.error);
    return NextResponse.json({ ok: false, error: "upload-failed" }, { status: 500 });
  }
  const roomPhotoUrl = supabaseAdmin.storage
    .from("visualise-photos")
    .getPublicUrl(up.data.path).data.publicUrl;

  const insert = await supabaseAdmin
    .from("hammerex_visualise_requests")
    .insert({
      owner_key:         ownerKey,
      source_image_url:  sourceImageUrl,
      source_post_id:    sourcePostId,
      source_canteen_id: sourceCanteenId,
      target_trade_slug: targetTradeSlug,
      room_photo_url:    roomPhotoUrl,
      prompt_note:       promptNote,
      status:            "queued",
      credit_consumed:   true,
      ip_address:        ip,
      user_agent:        req.headers.get("user-agent")
    })
    .select("id")
    .single();

  if (insert.error || !insert.data) {
    // eslint-disable-next-line no-console
    console.error("[api/inspiration/visualise] insert failed", insert.error);
    return NextResponse.json({ ok: false, error: "db-insert-failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok:     true,
    id:     insert.data.id,
    status: "queued"
  });
}
