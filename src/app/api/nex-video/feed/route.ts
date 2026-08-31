// GET /api/nex-video/feed
//
// NEX Video Feed V1 · Philip 2026-08-27.
// Returns paginated public NEX videos, newest first. Recency-only.
// No recommendation model. That's Stage 3+.
//
// Query params:
//   cursor    ISO timestamp · next page starts at videos older than this
//   limit     default 10 · max 30
//
// Response shape:
//   {
//     ok: true,
//     videos: [{
//       media_id, owner_id, title, description,
//       mime_type, duration_ms, width_px, height_px,
//       uploaded_at, playback_url,   // signed URL from ObjectStorage.presign
//       poster_url,                  // if poster_media_id set
//     }, ...],
//     next_cursor: iso | null
//   }

import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getObjectStorage } from "@/lib/nex/storage/object-registry";

export const dynamic = "force-dynamic";

let poolInstance: Pool | null = null;
function getPool(): Pool {
  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString: process.env.NEX_POSTGRES_URL
        ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
      max: 3,
    });
  }
  return poolInstance;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const rawLimit = Number(url.searchParams.get("limit") ?? "10");
  const limit = Math.min(Math.max(1, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 10), 30);

  const params: unknown[] = [];
  let cursorClause = "";
  if (cursor) {
    const d = new Date(cursor);
    if (!isNaN(d.getTime())) {
      params.push(d.toISOString());
      cursorClause = `AND uploaded_at < $${params.length}::timestamptz`;
    }
  }
  params.push(limit + 1);   // fetch one extra to detect next page

  const pool = getPool();
  const r = await pool.query(
    `SELECT media_id, owner_id, title, description,
            mime_type, duration_ms, width_px, height_px,
            uploaded_at, storage_bucket, storage_key, storage_version,
            poster_media_id
       FROM nex.media_object
      WHERE object_type = 'video'
        AND state = 'ready'
        AND visibility = 'public'
        ${cursorClause}
      ORDER BY uploaded_at DESC
      LIMIT $${params.length}`,
    params,
  );

  const rows = r.rows;
  const hasMore = rows.length > limit;
  const returnedRows = hasMore ? rows.slice(0, limit) : rows;

  // Resolve poster media rows in a single lookup if any videos have posters
  const posterIds = returnedRows.map((v) => v.poster_media_id).filter(Boolean);
  const posterMap = new Map<string, { bucket: string; key: string; version: string }>();
  if (posterIds.length > 0) {
    const p = await pool.query(
      `SELECT media_id, storage_bucket, storage_key, storage_version
         FROM nex.media_object WHERE media_id = ANY($1::uuid[])`,
      [posterIds],
    );
    for (const row of p.rows) {
      posterMap.set(String(row.media_id), {
        bucket: String(row.storage_bucket),
        key: String(row.storage_key),
        version: String(row.storage_version),
      });
    }
  }

  const store = getObjectStorage();
  const videos = await Promise.all(returnedRows.map(async (v) => {
    let playback_url: string | null = null;
    try {
      playback_url = await store.presign(v.storage_bucket, v.storage_key, {
        operation: "get", expires_seconds: 3600,
      });
    } catch { playback_url = null; }
    let poster_url: string | null = null;
    if (v.poster_media_id && posterMap.has(String(v.poster_media_id))) {
      const p = posterMap.get(String(v.poster_media_id))!;
      try {
        poster_url = await store.presign(p.bucket, p.key, {
          operation: "get", expires_seconds: 3600,
        });
      } catch { poster_url = null; }
    }
    return {
      media_id: String(v.media_id),
      owner_id: String(v.owner_id),
      title: v.title as string | null,
      description: v.description as string | null,
      mime_type: String(v.mime_type),
      duration_ms: v.duration_ms != null ? Number(v.duration_ms) : null,
      width_px: v.width_px != null ? Number(v.width_px) : null,
      height_px: v.height_px != null ? Number(v.height_px) : null,
      uploaded_at: (v.uploaded_at as Date).toISOString(),
      playback_url,
      poster_url,
    };
  }));

  const next_cursor = hasMore ? videos[videos.length - 1].uploaded_at : null;
  return NextResponse.json({ ok: true, videos, next_cursor });
}
