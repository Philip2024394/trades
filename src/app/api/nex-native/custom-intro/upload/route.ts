// POST /api/nex-native/custom-intro/upload
//
// Phase 1.0 Custom Intro · entitled owner uploads an MP4 video.
// Server-side validation (mime + size + duration + aspect) · NEX-owned
// MinIO storage via the object-storage registry (adapter sealed
// 2026-10-06) · persists metadata through recordUploadedVideo.
//
// Request: multipart/form-data
//   file:         the video file
//   duration_ms:  number · derived client-side from HTMLVideoElement
//   width:        number · derived client-side
//   height:       number · derived client-side
//
// Response: { ok: true, video_key } on success · { ok: false, error }
// otherwise.
//
// Authorization: owner-scoped. The session resolver establishes the
// owner · entitlement row MUST exist (admin-granted post-NEX1-chat
// payment) · the server never accepts an unverified "I paid" claim.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  getCustomIntroRow,
  recordUploadedVideo,
  validateVideo,
  CUSTOM_INTRO_VIDEO_LIMITS,
  CUSTOM_INTRO_STORAGE_BUCKET,
} from "@/lib/nex-native/custom-intro-service";
import { getObjectStorage } from "@/lib/nex/storage/object-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }

  // Owner must have an entitlement row before they can upload.
  const entitlement = await getCustomIntroRow(session.account.id);
  if (!entitlement) {
    return NextResponse.json(
      { ok: false, error: "not_entitled" },
      { status: 403 },
    );
  }

  // Parse multipart.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 400 });
  }
  const file = form.get("file");
  const durationRaw = form.get("duration_ms");
  const widthRaw = form.get("width");
  const heightRaw = form.get("height");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "missing_file" }, { status: 400 });
  }
  const duration_ms = Number(durationRaw);
  const width = Number(widthRaw);
  const height = Number(heightRaw);
  if (!Number.isFinite(duration_ms) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return NextResponse.json(
      { ok: false, error: "missing_metadata" },
      { status: 400 },
    );
  }

  // Guard: file.size matches the Buffer length we're about to send to
  // the object store. Cap at the sealed max so we never buffer a huge
  // payload into memory before validation runs.
  if (file.size <= 0 || file.size > CUSTOM_INTRO_VIDEO_LIMITS.max_size_bytes) {
    return NextResponse.json(
      { ok: false, error: "file_too_large" },
      { status: 400 },
    );
  }

  // Validate against the sealed limits.
  const validation = validateVideo({
    mime_type: file.type || "application/octet-stream",
    size_bytes: file.size,
    duration_ms,
    width,
    height,
  });
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.reason }, { status: 400 });
  }

  // Read bytes and upload via the NEX object-storage abstraction.
  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = file.type === "video/quicktime" ? ".mov" : ".mp4";
  const key = `custom-intro/${session.account.id}/${Date.now()}${extension}`;

  const storage = getObjectStorage();
  const put = await storage.put(CUSTOM_INTRO_STORAGE_BUCKET, key, {
    body: buffer,
    mime_type: file.type || "video/mp4",
    uploaded_by: session.account.id,
    source_ref: "custom-intro",
    custom: {
      duration_ms: String(duration_ms),
      width: String(width),
      height: String(height),
    },
  });

  // Persist against the entitlement row. We store the KEY (not a
  // signed URL) so we can refresh signed URLs as needed · the client
  // reads via /api/nex-native/custom-intro/video.
  const videoRef = `${put.bucket}/${put.key}`;
  const updated = await recordUploadedVideo({
    account_id: session.account.id,
    video_url: videoRef,
    duration_ms,
    width,
    height,
    size_bytes: file.size,
  });
  if (!updated) {
    return NextResponse.json(
      { ok: false, error: "persist_failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, video_ref: videoRef });
}
