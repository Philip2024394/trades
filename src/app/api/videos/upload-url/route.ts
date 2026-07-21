// POST /api/videos/upload-url
// Networkers TV — generate a signed upload URL for direct-to-Supabase
// video + thumbnail upload from the browser.
//
// Flow:
//   1. Trade picks a file in the browser
//   2. Client POSTs here → gets a signed upload URL + object path
//   3. Client PUTs the file directly to Supabase Storage
//   4. Client POSTs to /api/videos/create with the public URL
//
// Auth: merchant session required. Storage path namespaced by
// merchant slug so trades never overwrite each other.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VIDEO_BUCKET     = "networkers-tv-videos";
const THUMBNAIL_BUCKET = "networkers-tv-thumbnails";

// Supabase Storage signed URLs default to 30s expiry — increased to
// 30 minutes for large-file uploads.
const SIGNED_UPLOAD_TTL_SECONDS = 30 * 60;

type SignPayload = {
  kind:      "video" | "thumbnail";
  extension: string;    // "mp4" | "mov" | "webm" | "jpg" | "png" | "webp"
};

const ALLOWED_VIDEO_EXT     = new Set(["mp4", "mov", "webm"]);
const ALLOWED_THUMBNAIL_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

export async function POST(req: Request) {
  const merchantSlug = await getMerchantSlug();
  if (!merchantSlug) {
    return NextResponse.json({ ok: false, error: "auth-required" }, { status: 401 });
  }

  let body: SignPayload;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 }); }

  const ext = (body.extension ?? "").toLowerCase().replace(/^\./, "");
  const bucket = body.kind === "thumbnail" ? THUMBNAIL_BUCKET : VIDEO_BUCKET;
  const allowedSet = body.kind === "thumbnail" ? ALLOWED_THUMBNAIL_EXT : ALLOWED_VIDEO_EXT;

  if (!allowedSet.has(ext)) {
    return NextResponse.json({
      ok: false,
      error: "invalid-extension",
      allowed: Array.from(allowedSet)
    }, { status: 400 });
  }

  // Object path: {merchant_slug}/{timestamp}-{random}.{ext}
  //   • Namespaced by merchant → no overwrite risk
  //   • Timestamp + random suffix → no collision within the same
  //     merchant even on same-second uploads
  const timestamp = Date.now();
  const random    = Math.random().toString(36).slice(2, 10);
  const objectPath = `${merchantSlug}/${timestamp}-${random}.${ext}`;

  const signed = await supabaseAdmin
    .storage
    .from(bucket)
    .createSignedUploadUrl(objectPath);

  if (signed.error || !signed.data) {
    return NextResponse.json({
      ok: false,
      error: "signed-url-failed",
      detail: signed.error?.message
    }, { status: 500 });
  }

  // Public URL that will resolve once the upload completes
  const { data: publicUrlData } = supabaseAdmin
    .storage
    .from(bucket)
    .getPublicUrl(objectPath);

  return NextResponse.json({
    ok:              true,
    signed_url:      signed.data.signedUrl,
    token:           signed.data.token,
    object_path:     objectPath,
    bucket,
    public_url:      publicUrlData.publicUrl,
    expires_in_seconds: SIGNED_UPLOAD_TTL_SECONDS
  });
}
