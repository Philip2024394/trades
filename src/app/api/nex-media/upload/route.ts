// POST /api/nex-media/upload
//
// NEX Media Foundation · Stage 2.5 · direct multipart upload · Philip 2026-08-27.
//
// Alt to the presigned-URL flow (/upload-url + /register) for cases where
// the client can't PUT to a signed URL directly (e.g. dev backends without
// real presign, or browsers uploading small blobs where 1-round-trip is
// preferable). Same lifecycle · same doctrines.
//
// Multipart form fields:
//   file          (required · the media bytes)
//   owner_id      (required · pure-NEX identity string)
//   object_type?  (image|video|audio|document · inferred from file mime if absent)
//   visibility?   (private|unlisted|public · default private per ADR-0118 § 4)
//   context_type? (profile|business|product|feed|...)
//   context_ref?
//   title?
//   description?
//   duration_ms?  (client-observed for video/audio)
//   width_px?
//   height_px?
//   codec?
//
// Returns { ok, media }.
//
// Ceiling: 100 MB per file (Stage 2.5 recording is 60s of WebM ~ 5-15 MB).

import { NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { getObjectStorage } from "@/lib/nex/storage/object-registry";
import { getMediaPool, insertUploadingRow, completeUpload } from "@/lib/nex-media/media-object";
import { NEX_MEDIA_BUCKET, inferObjectType, type MediaContextType, type MediaObjectType } from "@/lib/nex-media/types";
import { normaliseVisibility } from "@/lib/nex-media/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const OBJECT_TYPES = new Set(["image", "video", "audio", "document"]);
const CONTEXT_TYPES = new Set([
  "profile", "business", "product", "feed", "live_recording",
  "call_recording", "chat", "document_library", "category_library",
]);
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

function fieldStr(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.length > 0 ? v : null;
}
function fieldNum(fd: FormData, key: string): number | null {
  const v = fd.get(key);
  if (typeof v !== "string" || v.length === 0) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ ok: false, error: "expected multipart/form-data" }, { status: 400 }); }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "file field required" }, { status: 400 });
  if (file.size <= 0) return NextResponse.json({ ok: false, error: "file empty" }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ ok: false, error: `file too large (max ${MAX_UPLOAD_BYTES} bytes)` }, { status: 413 });
  }

  const ownerId = fieldStr(form, "owner_id");
  if (!ownerId) return NextResponse.json({ ok: false, error: "owner_id required" }, { status: 400 });

  const mime = file.type || "application/octet-stream";
  const explicitType = fieldStr(form, "object_type");
  const objectType: MediaObjectType = (explicitType && OBJECT_TYPES.has(explicitType))
    ? (explicitType as MediaObjectType)
    : inferObjectType(mime);

  const contextTypeRaw = fieldStr(form, "context_type");
  const contextType: MediaContextType | null = contextTypeRaw && CONTEXT_TYPES.has(contextTypeRaw)
    ? (contextTypeRaw as MediaContextType) : null;

  // Storage key + version.
  const ext = mimeToExt(mime);
  const suffix = randomBytes(6).toString("hex");
  const stampMs = Date.now().toString(36);
  const storageKey = `owner/${ownerId}/${objectType}/${stampMs}-${suffix}${ext}`;
  const versionId = `direct-${stampMs}-${randomBytes(6).toString("hex")}`;

  // Row in state='uploading'.
  const pool = getMediaPool();
  const uploadingRow = await insertUploadingRow(pool, {
    object_type: objectType,
    owner_id: ownerId,
    visibility: normaliseVisibility(fieldStr(form, "visibility")),
    storage_key: storageKey,
    storage_version: versionId,
    mime_type: mime,
    context_type: contextType,
    context_ref: fieldStr(form, "context_ref"),
    uploaded_via: "api/nex-media/upload",
    uploaded_from_user_agent: req.headers.get("user-agent")?.slice(0, 200) ?? null,
    title: fieldStr(form, "title"),
    description: fieldStr(form, "description"),
  });

  // Write bytes via the ObjectStorage abstraction (whichever backend is active).
  const bytes = Buffer.from(await file.arrayBuffer());
  const store = getObjectStorage();
  let putRes: Awaited<ReturnType<typeof store.put>>;
  try {
    putRes = await store.put(NEX_MEDIA_BUCKET, storageKey, {
      body: bytes,
      mime_type: mime,
      uploaded_by: ownerId,
      business_id: null,
      source_ref: `upload:${uploadingRow.media_id}`,
    });
  } catch (e) {
    // Roll back the uploading row by soft-deleting it so it doesn't clutter HQ.
    await pool.query(`UPDATE nex.media_object SET state = 'failed', updated_at = now() WHERE media_id = $1`, [uploadingRow.media_id]);
    return NextResponse.json({ ok: false, error: `storage put failed · ${(e as Error).message}` }, { status: 500 });
  }

  // Update storage_version to what the backend actually returned + mark ready.
  await pool.query(
    `UPDATE nex.media_object SET storage_version = $2, updated_at = now() WHERE media_id = $1`,
    [uploadingRow.media_id, putRes.version_id],
  );
  const ready = await completeUpload(pool, {
    media_id: uploadingRow.media_id,
    size_bytes: putRes.size_bytes,
    content_hash: putRes.content_hash || createHash("sha256").update(bytes).digest("hex"),
    duration_ms: fieldNum(form, "duration_ms"),
    width_px: fieldNum(form, "width_px"),
    height_px: fieldNum(form, "height_px"),
    codec: fieldStr(form, "codec"),
  });
  if (!ready) return NextResponse.json({ ok: false, error: "register race · media_object update failed" }, { status: 500 });

  return NextResponse.json({ ok: true, media: ready });
}

function mimeToExt(mime: string): string {
  const m = mime.toLowerCase();
  if (m.startsWith("image/jpeg") || m === "image/jpg") return ".jpg";
  if (m === "image/png") return ".png";
  if (m === "image/webp") return ".webp";
  if (m === "image/gif") return ".gif";
  if (m === "image/avif") return ".avif";
  if (m === "video/mp4") return ".mp4";
  if (m === "video/webm") return ".webm";
  if (m === "video/quicktime") return ".mov";
  if (m === "audio/mpeg") return ".mp3";
  if (m === "audio/ogg" || m === "audio/opus") return ".opus";
  if (m === "audio/wav") return ".wav";
  if (m === "audio/webm") return ".webm";
  if (m === "application/pdf") return ".pdf";
  return "";
}
