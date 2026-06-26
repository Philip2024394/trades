// POST /api/trade-off/video-upload-url
// Returns a Supabase Storage signed upload URL so the browser can
// upload the tradesperson's intro video directly to Storage, bypassing
// Vercel's 4.5 MB API body limit. Max 30 MB, MP4 / MOV / WebM only.
//
// Flow:
//   1. Client → POST with { listing_id, content_type, size_bytes, edit_token }
//   2. We validate ownership via the edit token (same magic-link pattern
//      every other edit endpoint uses), validate MIME + size, then
//      generate a 15-minute signed upload URL.
//   3. Client uploads the file directly to Supabase Storage via PUT
//      against the signed URL (no Vercel hop).
//   4. Client calls /api/trade-off/video-save with { listing_id, video_url, edit_token }
//      to persist the public URL on the listing row.

import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const MAX_BYTES = 30 * 1024 * 1024; // 30 MB
const ALLOWED_TYPES = new Set([
  "video/mp4",
  "video/quicktime", // iPhone .mov
  "video/webm"
]);
const BUCKET = "product-images"; // reuse the existing public bucket

function ext(contentType: string): string {
  if (contentType === "video/quicktime") return "mov";
  if (contentType === "video/webm") return "webm";
  return "mp4";
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

  const listingId = String(body.listing_id ?? "").trim();
  const editToken = String(body.edit_token ?? "").trim();
  const contentType = String(body.content_type ?? "").trim();
  const sizeBytes = Number(body.size_bytes);

  if (!listingId) {
    return NextResponse.json(
      { ok: false, error: "Missing listing id" },
      { status: 400 }
    );
  }
  if (!editToken) {
    return NextResponse.json(
      { ok: false, error: "Missing edit token" },
      { status: 401 }
    );
  }
  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json(
      { ok: false, error: "Only MP4, MOV or WebM videos are accepted." },
      { status: 400 }
    );
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Video must be 30 MB or smaller." },
      { status: 413 }
    );
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token, status")
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

  const path = `trade-videos/${listingId}/${randomUUID()}.${ext(contentType)}`;

  const signed = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);
  if (signed.error || !signed.data) {
    console.error("[video-upload-url] signed url failed:", signed.error);
    return NextResponse.json(
      { ok: false, error: "Could not create upload URL — try again." },
      { status: 500 }
    );
  }

  const publicUrl = supabaseAdmin.storage
    .from(BUCKET)
    .getPublicUrl(path).data.publicUrl;

  return NextResponse.json({
    ok: true,
    upload_url: signed.data.signedUrl,
    upload_token: signed.data.token,
    path,
    public_url: publicUrl,
    content_type: contentType
  });
}
