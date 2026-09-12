// src/lib/nex/live/media-resolver.ts
//
// NEX LIVE · Phase 2 · Playback URL enrichment
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase 2
//
// PURPOSE (§4 · §5 · §39)
//   Resolve a NEX Live media_id to a real playback URL by composing
//   the existing nex-media Postgres row + ObjectStorage.presign pipeline
//   that /api/nex-video/feed already uses.
//
// DISCIPLINE (§4 immutable)
//   · Never fabricate a URL.
//   · Never generate a synthetic media record.
//   · When ObjectStorage / Postgres are unavailable (dev env without
//     credentials), return null + honest reason so callers render
//     "media temporarily unavailable" instead of a fake URL.
//
// SCOPE (Phase 2)
//   Pure server-side function. No React. No client fetch. Takes a set
//   of media_ids and returns the same set enriched with playback_url
//   (or null) and a short honesty reason.
//
// §5 provider independence · this module is the ONLY module that knows
// how to reach the underlying storage. Every UI component reads its
// output opaquely — swapping the storage provider requires no UI
// changes.

import { Pool } from "pg";
import { getObjectStorage } from "@/lib/nex/storage/object-registry";
import { getPostgresUrl } from "@/lib/nex/config/pg";

let poolInstance: Pool | null = null;
function getPool(): Pool {
  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString: getPostgresUrl(),
      max: 3,
    });
  }
  return poolInstance;
}

export type ResolvedMedia = {
  media_id: string;
  playback_url: string | null;
  poster_url: string | null;
  mime_type: string | null;
  duration_ms: number | null;
  width_px: number | null;
  height_px: number | null;
  owner_id: string | null;
  title: string | null;
  description: string | null;
  uploaded_at_iso: string | null;
  /** Machine-readable reason for null · rendered by UI as honesty text.
   *  "resolved" · "not_found" · "storage_error" · "postgres_unavailable" ·
   *  "state_not_ready" · "visibility_private". */
  reason: string;
};

const NULL_RESULT = (media_id: string, reason: string): ResolvedMedia => ({
  media_id,
  playback_url: null,
  poster_url: null,
  mime_type: null,
  duration_ms: null,
  width_px: null,
  height_px: null,
  owner_id: null,
  title: null,
  description: null,
  uploaded_at_iso: null,
  reason,
});

/** Resolve many media_ids in a single Postgres round-trip when possible.
 *  Returns one entry per requested id (never fewer). Never throws. */
export async function resolveMediaForPlayback(media_ids: ReadonlyArray<string>): Promise<ResolvedMedia[]> {
  if (media_ids.length === 0) return [];

  // First, ensure Postgres is reachable. If not, return all-null.
  let pool: Pool;
  try {
    pool = getPool();
    // Cheap connectivity probe
    await pool.query("SELECT 1");
  } catch (err) {
    return media_ids.map((id) => NULL_RESULT(id, `postgres_unavailable:${(err as Error).message.slice(0, 60)}`));
  }

  // Query the media rows.
  type Row = {
    media_id: string; owner_id: string;
    title: string | null; description: string | null;
    mime_type: string; duration_ms: number | null;
    width_px: number | null; height_px: number | null;
    uploaded_at: Date;
    storage_bucket: string; storage_key: string;
    state: string; visibility: string;
    poster_media_id: string | null;
  };

  let rows: Row[];
  try {
    const q = await pool.query<Row>(
      `SELECT media_id, owner_id, title, description,
              mime_type, duration_ms, width_px, height_px,
              uploaded_at, storage_bucket, storage_key,
              state, visibility, poster_media_id
         FROM nex.media_object
        WHERE media_id = ANY($1::uuid[])`,
      [media_ids],
    );
    rows = q.rows;
  } catch (err) {
    return media_ids.map((id) => NULL_RESULT(id, `postgres_query_failed:${(err as Error).message.slice(0, 60)}`));
  }

  const byId = new Map(rows.map((r) => [String(r.media_id), r]));

  // Presign playback + poster URLs where allowed.
  const store = getObjectStorage();
  const resultPromises = media_ids.map(async (id): Promise<ResolvedMedia> => {
    const row = byId.get(id);
    if (!row) return NULL_RESULT(id, "not_found");
    if (row.state !== "ready") return NULL_RESULT(id, `state_not_ready:${row.state}`);
    if (row.visibility !== "public" && row.visibility !== "unlisted") {
      // §11 · §33 · never leak private media through this resolver
      return NULL_RESULT(id, `visibility_${row.visibility}`);
    }
    let playback_url: string | null = null;
    try {
      playback_url = await store.presign(row.storage_bucket, row.storage_key, {
        operation: "get", expires_seconds: 3600,
      });
    } catch (err) {
      return NULL_RESULT(id, `storage_error:${(err as Error).message.slice(0, 60)}`);
    }
    let poster_url: string | null = null;
    if (row.poster_media_id) {
      const posterRow = byId.get(String(row.poster_media_id));
      if (posterRow) {
        try {
          poster_url = await store.presign(posterRow.storage_bucket, posterRow.storage_key, {
            operation: "get", expires_seconds: 3600,
          });
        } catch { /* poster failure is non-fatal — keep null */ }
      }
    }
    return {
      media_id: id,
      playback_url,
      poster_url,
      mime_type: row.mime_type,
      duration_ms: row.duration_ms,
      width_px: row.width_px,
      height_px: row.height_px,
      owner_id: row.owner_id,
      title: row.title,
      description: row.description,
      uploaded_at_iso: row.uploaded_at ? new Date(row.uploaded_at).toISOString() : null,
      reason: "resolved",
    };
  });

  return Promise.all(resultPromises);
}

/** Test hook · lets unit tests reset the singleton pool so they can
 *  observe fresh connect/disconnect behaviour. Never call in production. */
export function _resetMediaResolverPoolForTests(): void {
  if (poolInstance) {
    try { poolInstance.end(); } catch { /* ignore */ }
  }
  poolInstance = null;
}
