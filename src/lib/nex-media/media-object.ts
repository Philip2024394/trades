// src/lib/nex-media/media-object.ts
//
// NEX Media Foundation · DB layer for nex.media_object · Philip 2026-08-27.
// Read/write helpers used by the API routes + HQ page. Keeps SQL in one place.

import { Pool } from "pg";
import { getPostgresUrl } from "@/lib/nex/config/pg";
import {
  NEX_MEDIA_BUCKET,
  NEX_MEDIA_GRACE_DAYS,
  type MediaObject,
  type MediaObjectType,
  type MediaVisibility,
  type MediaContextType,
  type MediaState,
} from "./types";

let poolInstance: Pool | null = null;
export function getMediaPool(): Pool {
  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString: getPostgresUrl(),
      max: 3,
    });
  }
  return poolInstance;
}

type Queryable = { query<R = unknown>(sql: string, params?: unknown[]): Promise<{ rowCount: number | null; rows: R[] }> };

// ── row-shape helper ───────────────────────────────────────────
function rowToMedia(r: Record<string, unknown>): MediaObject {
  return {
    media_id: String(r.media_id),
    object_type: r.object_type as MediaObjectType,
    owner_id: String(r.owner_id),
    visibility: r.visibility as MediaVisibility,
    storage_bucket: String(r.storage_bucket),
    storage_key: String(r.storage_key),
    storage_version: String(r.storage_version),
    mime_type: String(r.mime_type),
    size_bytes: Number(r.size_bytes),
    content_hash: String(r.content_hash),
    duration_ms: r.duration_ms != null ? Number(r.duration_ms) : null,
    width_px: r.width_px != null ? Number(r.width_px) : null,
    height_px: r.height_px != null ? Number(r.height_px) : null,
    codec: (r.codec as string) ?? null,
    poster_media_id: (r.poster_media_id as string) ?? null,
    audio_codec: (r.audio_codec as string) ?? null,
    sample_rate: r.sample_rate != null ? Number(r.sample_rate) : null,
    channels: r.channels != null ? Number(r.channels) : null,
    context_type: (r.context_type as MediaContextType) ?? null,
    context_ref: (r.context_ref as string) ?? null,
    uploaded_via: String(r.uploaded_via),
    uploaded_at: new Date(r.uploaded_at as string),
    uploaded_from_user_agent: (r.uploaded_from_user_agent as string) ?? null,
    cycle_run_id: (r.cycle_run_id as string) ?? null,
    state: r.state as MediaState,
    deleted_at: r.deleted_at ? new Date(r.deleted_at as string) : null,
    hard_delete_after: r.hard_delete_after ? new Date(r.hard_delete_after as string) : null,
    title: (r.title as string) ?? null,
    description: (r.description as string) ?? null,
    extras: (r.extras as Record<string, unknown>) ?? {},
    created_at: new Date(r.created_at as string),
    updated_at: new Date(r.updated_at as string),
  };
}

// ── writers ────────────────────────────────────────────────────

export interface InsertUploadingInput {
  object_type: MediaObjectType;
  owner_id: string;
  visibility: MediaVisibility;
  storage_key: string;                 // caller-decided
  storage_version: string;             // returned by presign()
  mime_type: string;
  context_type?: MediaContextType | null;
  context_ref?: string | null;
  uploaded_via: string;
  uploaded_from_user_agent?: string | null;
  cycle_run_id?: string | null;
  title?: string | null;
  description?: string | null;
  extras?: Record<string, unknown>;
}

/** Create a media_object row in state='uploading'. Called by /upload-url. */
export async function insertUploadingRow(db: Queryable, input: InsertUploadingInput): Promise<MediaObject> {
  const r = await db.query<Record<string, unknown>>(
    `INSERT INTO nex.media_object (
       object_type, owner_id, visibility,
       storage_bucket, storage_key, storage_version,
       mime_type, size_bytes, content_hash,
       context_type, context_ref,
       uploaded_via, uploaded_from_user_agent, cycle_run_id,
       title, description, extras,
       state
     ) VALUES (
       $1, $2, $3,
       $4, $5, $6,
       $7, 0, '',
       $8, $9,
       $10, $11, $12,
       $13, $14, COALESCE($15::jsonb, '{}'::jsonb),
       'uploading'
     ) RETURNING *`,
    [
      input.object_type, input.owner_id, input.visibility,
      NEX_MEDIA_BUCKET, input.storage_key, input.storage_version,
      input.mime_type,
      input.context_type ?? null, input.context_ref ?? null,
      input.uploaded_via, input.uploaded_from_user_agent ?? null, input.cycle_run_id ?? null,
      input.title ?? null, input.description ?? null,
      input.extras ? JSON.stringify(input.extras) : null,
    ],
  );
  return rowToMedia(r.rows[0]);
}

export interface CompleteUploadInput {
  media_id: string;
  size_bytes: number;
  content_hash: string;
  duration_ms?: number | null;
  width_px?: number | null;
  height_px?: number | null;
  codec?: string | null;
  audio_codec?: string | null;
  sample_rate?: number | null;
  channels?: number | null;
  poster_media_id?: string | null;
}

/** Mark upload complete · state='uploading' → 'ready'. Called by /register. */
export async function completeUpload(db: Queryable, input: CompleteUploadInput): Promise<MediaObject | null> {
  const r = await db.query<Record<string, unknown>>(
    `UPDATE nex.media_object SET
        state = 'ready',
        size_bytes = $2,
        content_hash = $3,
        duration_ms = COALESCE($4, duration_ms),
        width_px = COALESCE($5, width_px),
        height_px = COALESCE($6, height_px),
        codec = COALESCE($7, codec),
        audio_codec = COALESCE($8, audio_codec),
        sample_rate = COALESCE($9, sample_rate),
        channels = COALESCE($10, channels),
        poster_media_id = COALESCE($11, poster_media_id),
        updated_at = now()
      WHERE media_id = $1 AND state = 'uploading'
      RETURNING *`,
    [
      input.media_id, input.size_bytes, input.content_hash,
      input.duration_ms ?? null, input.width_px ?? null, input.height_px ?? null,
      input.codec ?? null, input.audio_codec ?? null,
      input.sample_rate ?? null, input.channels ?? null,
      input.poster_media_id ?? null,
    ],
  );
  return r.rowCount ? rowToMedia(r.rows[0]) : null;
}

/** Soft delete · state → 'deleted' · schedules hard delete +7 days. */
export async function softDelete(db: Queryable, media_id: string): Promise<MediaObject | null> {
  const r = await db.query<Record<string, unknown>>(
    `UPDATE nex.media_object SET
        state = 'deleted',
        deleted_at = now(),
        hard_delete_after = now() + interval '${NEX_MEDIA_GRACE_DAYS} days',
        updated_at = now()
      WHERE media_id = $1 AND state <> 'deleted'
      RETURNING *`,
    [media_id],
  );
  return r.rowCount ? rowToMedia(r.rows[0]) : null;
}

// ── readers ────────────────────────────────────────────────────

export async function getById(db: Queryable, media_id: string): Promise<MediaObject | null> {
  const r = await db.query<Record<string, unknown>>(
    `SELECT * FROM nex.media_object WHERE media_id = $1 LIMIT 1`,
    [media_id],
  );
  return r.rowCount ? rowToMedia(r.rows[0]) : null;
}

export async function listByOwner(db: Queryable, owner_id: string, limit = 50): Promise<MediaObject[]> {
  const r = await db.query<Record<string, unknown>>(
    `SELECT * FROM nex.media_object
      WHERE owner_id = $1 AND state IN ('uploading','processing','ready')
      ORDER BY uploaded_at DESC LIMIT $2`,
    [owner_id, limit],
  );
  return r.rows.map(rowToMedia);
}
