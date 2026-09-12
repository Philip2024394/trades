// src/app/api/nex-live/upload-file/route.ts
//
// NEX LIVE · Phase C · AUTHENTICATED multipart upload endpoint
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase C
//
// §16 IMMUTABLE · owner_id is derived server-side from the authenticated
// Supabase session. Client-supplied owner_id is IGNORED. This is the
// only NEX Live upload path that Phase C endorses for customer traffic.
//
// The pre-existing /api/nex-media/upload remains for legacy callers
// (e.g. /nex-video/create) which supply owner_id from localStorage.
// Phase C does NOT modify that legacy endpoint · §36 storage boundary.
//
// Composition:
//   1. getAuthenticatedUser() → supabase_user_id (fail 401 if none)
//   2. Multipart parse · file only, no owner_id field
//   3. validateUpload(mime, size, filename) via upload-validation.ts
//   4. insertUploadingRow with owner_id = supabase_user_id
//   5. ObjectStorage.put → bytes to storage backend
//   6. completeUpload → state=ready
//   7. Return { ok, media }
//
// §29 · filename discarded; storage key is server-generated ULID-ish.
// §30 · no arbitrary code execution · bytes flow through storage
//       adapter without evaluation.

import { NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { getAuthenticatedUser } from "@/lib/nex/brains/_auth";
import { getObjectStorage } from "@/lib/nex/storage/object-registry";
import { getMediaPool, insertUploadingRow, completeUpload } from "@/lib/nex-media/media-object";
import { NEX_MEDIA_BUCKET, inferObjectType } from "@/lib/nex-media/types";
import { normaliseVisibility } from "@/lib/nex-media/permissions";
import {
  validateUpload,
  MAX_UPLOAD_BYTES,
  kindFromMime,
} from "@/lib/nex/live/upload-validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function mimeToExt(mime: string): string {
  const m = mime.toLowerCase();
  if (m === "video/mp4") return ".mp4";
  if (m === "video/webm") return ".webm";
  if (m === "video/quicktime") return ".mov";
  if (m === "audio/mpeg" || m === "audio/mp3") return ".mp3";
  if (m === "audio/ogg" || m === "audio/opus") return ".opus";
  if (m === "audio/wav" || m === "audio/x-wav") return ".wav";
  if (m === "audio/webm") return ".webm";
  return "";
}

function fieldStr(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.length > 0 ? v : null;
}

export async function POST(req: Request) {
  // ── 1 · §16 authenticate FIRST · no session = no upload ────────
  const auth = await getAuthenticatedUser();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error_code: "AUTHENTICATION_REQUIRED", error: "please sign in to upload" },
      { status: 401 },
    );
  }
  const authenticated_owner_id = auth.user.supabase_user_id;

  // ── 2 · Parse multipart ────────────────────────────────────────
  let form: FormData;
  try { form = await req.formData(); }
  catch {
    return NextResponse.json(
      { ok: false, error_code: "INVALID_FILE", error: "expected multipart/form-data" },
      { status: 400 },
    );
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error_code: "INVALID_FILE", error: "file field required" },
      { status: 400 },
    );
  }

  // §16 · If a client sent owner_id, LOG the attempt (audit) but ignore.
  const submittedOwnerId = fieldStr(form, "owner_id");
  if (submittedOwnerId && submittedOwnerId !== authenticated_owner_id) {
    // Not a hard failure · we simply refuse to honor client-supplied
    // owner_id. The server-derived one is used regardless.
    // Future: emit an audit event.
  }

  // ── 3 · Validate file with the authoritative Phase C validator ─
  const v = validateUpload({
    mime_type: file.type || "application/octet-stream",
    byte_size: file.size,
    filename: file.name || null,
  });
  if (!v.ok) {
    const status = v.error_code === "FILE_TOO_LARGE" ? 413
                 : v.error_code === "UNSUPPORTED_MEDIA" ? 415
                 : 400;
    return NextResponse.json(
      { ok: false, error_code: v.error_code, error: v.reason },
      { status },
    );
  }

  // ── 4 · Insert row with SERVER-DERIVED owner_id ────────────────
  const mime = file.type;
  const kind = kindFromMime(mime);
  const objectType = kind === "audio" ? "audio" : kind === "video" ? "video" : inferObjectType(mime);
  const ext = mimeToExt(mime);
  const suffix = randomBytes(6).toString("hex");
  const stampMs = Date.now().toString(36);
  // §29 · filename NEVER used · storage key server-generated
  const storageKey = `owner/${authenticated_owner_id}/${objectType}/${stampMs}-${suffix}${ext}`;
  const versionId = `nex-live-${stampMs}-${randomBytes(6).toString("hex")}`;

  const pool = getMediaPool();
  const uploadingRow = await insertUploadingRow(pool, {
    object_type: objectType,
    owner_id: authenticated_owner_id,          // §16 · server-derived
    visibility: normaliseVisibility(fieldStr(form, "visibility")),
    storage_key: storageKey,
    storage_version: versionId,
    mime_type: mime,
    context_type: "feed",
    context_ref: null,
    uploaded_via: "api/nex-live/upload-file",  // audit trail distinct
    uploaded_from_user_agent: req.headers.get("user-agent")?.slice(0, 200) ?? null,
    title: fieldStr(form, "title"),
    description: fieldStr(form, "description"),
  });

  // ── 5 · Storage put ────────────────────────────────────────────
  const bytes = Buffer.from(await file.arrayBuffer());
  const store = getObjectStorage();
  let putRes: Awaited<ReturnType<typeof store.put>>;
  try {
    putRes = await store.put(NEX_MEDIA_BUCKET, storageKey, {
      body: bytes,
      mime_type: mime,
      uploaded_by: authenticated_owner_id,
      business_id: null,
      source_ref: `nex-live-upload:${uploadingRow.media_id}`,
    });
  } catch (e) {
    // Truthful failure · mark row failed, do NOT pretend the upload succeeded
    await pool.query(
      `UPDATE nex.media_object SET state = 'failed', updated_at = now() WHERE media_id = $1`,
      [uploadingRow.media_id],
    ).catch(() => { /* best-effort */ });
    return NextResponse.json(
      { ok: false, error_code: "UPLOAD_FAILED", error: `storage put failed: ${(e as Error).message.slice(0, 120)}` },
      { status: 500 },
    );
  }

  // ── 6 · Complete upload · state → ready ────────────────────────
  await pool.query(
    `UPDATE nex.media_object SET storage_version = $2, updated_at = now() WHERE media_id = $1`,
    [uploadingRow.media_id, putRes.version_id],
  );
  const ready = await completeUpload(pool, {
    media_id: uploadingRow.media_id,
    size_bytes: putRes.size_bytes,
    content_hash: putRes.content_hash || createHash("sha256").update(bytes).digest("hex"),
    duration_ms: null,
    width_px: null,
    height_px: null,
    codec: null,
  });
  if (!ready) {
    return NextResponse.json(
      { ok: false, error_code: "PROCESSING_FAILED", error: "media_object update failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    media: {
      media_id: ready.media_id,
      owner_id: ready.owner_id,   // === authenticated_owner_id · §16 verified
      object_type: ready.object_type,
      mime_type: ready.mime_type,
      state: ready.state,
      visibility: ready.visibility,
      title: ready.title,
      description: ready.description,
    },
    honesty: {
      note: "owner_id is derived from your authenticated NEX session. Client-supplied owner_id fields are ignored.",
      max_upload_bytes: MAX_UPLOAD_BYTES,
    },
  });
}
