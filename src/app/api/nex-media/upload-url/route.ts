// POST /api/nex-media/upload-url
//
// NEX Media Foundation · Stage 1 · Philip 2026-08-27.
// ADR-0118 governs semantics.
//
// Client → this route → { uploadUrl (presigned PUT), media_id, storage_key,
//                         storage_version } → client PUTs bytes → client calls
// /api/nex-media/register to mark upload complete.
//
// Requires body: {
//   owner_id:      string        // pure-NEX identity string (see ADR-0118 § 1)
//   object_type:   image|video|audio|document (or inferred from mime_type)
//   mime_type:     string
//   visibility?:   private|unlisted|public   (default private per ADR-0118 § 4)
//   context_type?: profile|business|product|feed|live_recording|call_recording|chat|document_library|category_library
//   context_ref?:  string
//   title?:        string
//   description?:  string
// }

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getObjectStorage } from "@/lib/nex/storage/object-registry";
import { getMediaPool, insertUploadingRow } from "@/lib/nex-media/media-object";
import { NEX_MEDIA_BUCKET, inferObjectType, type MediaContextType, type MediaObjectType } from "@/lib/nex-media/types";
import { normaliseVisibility } from "@/lib/nex-media/permissions";

export const dynamic = "force-dynamic";

const OBJECT_TYPES = new Set(["image", "video", "audio", "document"]);
const CONTEXT_TYPES = new Set([
  "profile", "business", "product", "feed", "live_recording",
  "call_recording", "chat", "document_library", "category_library",
]);

interface Body {
  owner_id?: string;
  object_type?: string;
  mime_type?: string;
  visibility?: string;
  context_type?: string | null;
  context_ref?: string | null;
  title?: string | null;
  description?: string | null;
  extras?: Record<string, unknown>;
}

export async function POST(req: Request) {
  let body: Body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 }); }

  if (typeof body.owner_id !== "string" || body.owner_id.length === 0) {
    return NextResponse.json({ ok: false, error: "owner_id required" }, { status: 400 });
  }
  if (typeof body.mime_type !== "string" || body.mime_type.length === 0) {
    return NextResponse.json({ ok: false, error: "mime_type required" }, { status: 400 });
  }
  const inferred = inferObjectType(body.mime_type);
  const objectType: MediaObjectType = (body.object_type && OBJECT_TYPES.has(body.object_type))
    ? (body.object_type as MediaObjectType)
    : inferred;

  const contextType: MediaContextType | null = body.context_type
    ? (CONTEXT_TYPES.has(body.context_type) ? (body.context_type as MediaContextType) : null)
    : null;

  // Deterministic-ish storage key. We namespace by owner + a short random
  // suffix. Extension inferred from mime for readability in logs.
  const ext = mimeToExt(body.mime_type);
  const suffix = randomBytes(6).toString("hex");
  const stampMs = Date.now().toString(36);
  const storageKey = `owner/${body.owner_id}/${objectType}/${stampMs}-${suffix}${ext}`;

  const store = getObjectStorage();

  let presigned: string;
  try {
    presigned = await store.presign(NEX_MEDIA_BUCKET, storageKey, {
      operation: "put",
      expires_seconds: 900,
      content_type: body.mime_type,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: `presign failed · ${(e as Error).message}`,
      hint: "Backend may not support native presign — check NEX_OBJECT_BACKEND and adapter capabilities",
    }, { status: 500 });
  }

  // Extract version_id from R2's fragment convention, or generate one for
  // backends without native versioning (filesystem/postgres). Either way the
  // upload-url row is transient until /register commits it.
  let versionId = "pending";
  const frag = presigned.indexOf("#nex-version=");
  if (frag >= 0) versionId = presigned.slice(frag + "#nex-version=".length);
  else versionId = `pending-${randomBytes(6).toString("hex")}`;

  const pool = getMediaPool();
  const row = await insertUploadingRow(pool, {
    object_type: objectType,
    owner_id: body.owner_id,
    visibility: normaliseVisibility(body.visibility),
    storage_key: storageKey,
    storage_version: versionId,
    mime_type: body.mime_type,
    context_type: contextType,
    context_ref: body.context_ref ?? null,
    uploaded_via: "api/nex-media/upload-url",
    uploaded_from_user_agent: req.headers.get("user-agent")?.slice(0, 200) ?? null,
    title: body.title ?? null,
    description: body.description ?? null,
    extras: body.extras,
  });

  return NextResponse.json({
    ok: true,
    media_id: row.media_id,
    upload_url: presigned,
    storage_key: storageKey,
    storage_bucket: NEX_MEDIA_BUCKET,
    storage_version: versionId,
    expires_in_seconds: 900,
  });
}

function mimeToExt(mime: string): string {
  const m = mime.toLowerCase();
  if (m === "image/jpeg" || m === "image/jpg") return ".jpg";
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
