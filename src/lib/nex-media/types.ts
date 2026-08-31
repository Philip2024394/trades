// src/lib/nex-media/types.ts
//
// NEX Media Foundation · TypeScript types · Philip 2026-08-27.
// Mirror of nex.media_object schema. ADR-0118 governs the semantics.

export type MediaObjectType = "image" | "video" | "audio" | "document";
export type MediaVisibility = "private" | "unlisted" | "public";
export type MediaState = "uploading" | "processing" | "ready" | "failed" | "deleted";
export type MediaContextType =
  | "profile" | "business" | "product" | "feed" | "live_recording"
  | "call_recording" | "chat" | "document_library" | "category_library";

export interface MediaObject {
  media_id: string;
  object_type: MediaObjectType;
  owner_id: string;
  visibility: MediaVisibility;
  storage_bucket: string;
  storage_key: string;
  storage_version: string;
  mime_type: string;
  size_bytes: number;
  content_hash: string;
  duration_ms: number | null;
  width_px: number | null;
  height_px: number | null;
  codec: string | null;
  poster_media_id: string | null;
  audio_codec: string | null;
  sample_rate: number | null;
  channels: number | null;
  context_type: MediaContextType | null;
  context_ref: string | null;
  uploaded_via: string;
  uploaded_at: Date;
  uploaded_from_user_agent: string | null;
  cycle_run_id: string | null;
  state: MediaState;
  deleted_at: Date | null;
  hard_delete_after: Date | null;
  title: string | null;
  description: string | null;
  extras: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

/** Bucket name for the unified NEX media foundation. */
export const NEX_MEDIA_BUCKET = "nex-media";
export const NEX_MEDIA_GRACE_DAYS = 7;

/** MIME → object_type inference · used at register time. */
export function inferObjectType(mime: string): MediaObjectType {
  const m = (mime || "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  return "document";
}
