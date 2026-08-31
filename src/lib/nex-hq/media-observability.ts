// src/lib/nex-hq/media-observability.ts
//
// NEX HQ · Media Foundation observability · Philip 2026-08-27.
// Read-only aggregator for /nex-head-quarters/media.

import { Pool } from "pg";

const POOL = new Pool({
  connectionString: process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
  max: 3,
});

export interface MediaSummary {
  total: number;
  byType: { image: number; video: number; audio: number; document: number };
  byState: { uploading: number; processing: number; ready: number; failed: number; deleted: number };
  byVisibility: { private: number; unlisted: number; public: number };
  totalBytes: number;
  bytesLast24h: number;
  uploadsLast24h: number;
  activeStorageBackend: string;
  orphanUploading: number;
  deletedPending: number;
  deletedReadyForHardDelete: number;
  totalManifestRows: number;
  // Stage 2 · Video Feed V1
  feedPublicVideos: number;
  feedViews24h: number;
  feedUniqueViewers24h: number;
  feedMedianWatchedMs24h: number;
  feedUnmuteRate24h: number;   // 0..1 · fraction of impressions with unmuted=true
}

export interface RecentMedia {
  media_id: string;
  object_type: string;
  owner_id: string;
  visibility: string;
  state: string;
  mime_type: string;
  size_bytes: number;
  title: string | null;
  context_type: string | null;
  context_ref: string | null;
  uploaded_at: Date;
  deleted_at: Date | null;
  hard_delete_after: Date | null;
}

async function scalar(sql: string, params?: unknown[]): Promise<number> {
  const r = await POOL.query(sql, params);
  return Number(Object.values(r.rows[0] ?? {})[0] ?? 0);
}

export async function loadMediaSummary(): Promise<MediaSummary> {
  const total = await scalar(`SELECT COUNT(*) FROM nex.media_object`);
  const totalBytes = await scalar(`SELECT COALESCE(SUM(size_bytes), 0) FROM nex.media_object WHERE state IN ('ready','processing','deleted')`);
  const bytesLast24h = await scalar(`SELECT COALESCE(SUM(size_bytes), 0) FROM nex.media_object WHERE uploaded_at > now() - interval '24 hours'`);
  const uploadsLast24h = await scalar(`SELECT COUNT(*) FROM nex.media_object WHERE uploaded_at > now() - interval '24 hours'`);

  const byTypeRows = (await POOL.query(`SELECT object_type, COUNT(*)::int AS n FROM nex.media_object GROUP BY 1`)).rows;
  const byType = { image: 0, video: 0, audio: 0, document: 0 };
  for (const r of byTypeRows) if (r.object_type in byType) (byType as Record<string, number>)[r.object_type] = Number(r.n);

  const byStateRows = (await POOL.query(`SELECT state, COUNT(*)::int AS n FROM nex.media_object GROUP BY 1`)).rows;
  const byState = { uploading: 0, processing: 0, ready: 0, failed: 0, deleted: 0 };
  for (const r of byStateRows) if (r.state in byState) (byState as Record<string, number>)[r.state] = Number(r.n);

  const byVisRows = (await POOL.query(`SELECT visibility, COUNT(*)::int AS n FROM nex.media_object WHERE state='ready' GROUP BY 1`)).rows;
  const byVisibility = { private: 0, unlisted: 0, public: 0 };
  for (const r of byVisRows) if (r.visibility in byVisibility) (byVisibility as Record<string, number>)[r.visibility] = Number(r.n);

  const orphanUploading = await scalar(`SELECT COUNT(*) FROM nex.media_object WHERE state = 'uploading' AND uploaded_at < now() - interval '1 hour'`);
  const deletedPending = await scalar(`SELECT COUNT(*) FROM nex.media_object WHERE state = 'deleted' AND (hard_delete_after IS NULL OR now() < hard_delete_after)`);
  const deletedReadyForHardDelete = await scalar(`SELECT COUNT(*) FROM nex.media_object WHERE state = 'deleted' AND hard_delete_after IS NOT NULL AND now() >= hard_delete_after`);

  const totalManifestRows = await scalar(`SELECT COUNT(*) FROM nex.object_manifest`).catch(() => 0);

  const activeStorageBackend = (process.env.NEX_OBJECT_BACKEND ?? "filesystem").toLowerCase();

  // Stage 2 · Video Feed V1 · ramp-gate metrics
  const feedPublicVideos = await scalar(
    `SELECT COUNT(*) FROM nex.media_object WHERE object_type = 'video' AND state = 'ready' AND visibility = 'public'`,
  );
  const feedViews24h = await scalar(
    `SELECT COUNT(*) FROM nex.video_feed_impression WHERE seen_at > now() - interval '24 hours'`,
  ).catch(() => 0);
  const feedUniqueViewers24h = await scalar(
    `SELECT COUNT(DISTINCT viewer_id) FROM nex.video_feed_impression WHERE seen_at > now() - interval '24 hours'`,
  ).catch(() => 0);
  const feedMedianWatchedMs24h = Number(
    (await POOL.query(
      `SELECT COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY watched_ms), 0) AS median
         FROM nex.video_feed_impression WHERE seen_at > now() - interval '24 hours'`,
    ).catch(() => ({ rows: [{ median: 0 }] }))).rows[0]?.median ?? 0,
  );
  const feedUnmutedCount = await scalar(
    `SELECT COUNT(*) FROM nex.video_feed_impression WHERE seen_at > now() - interval '24 hours' AND unmuted = true`,
  ).catch(() => 0);
  const feedUnmuteRate24h = feedViews24h > 0 ? feedUnmutedCount / feedViews24h : 0;

  return {
    total, byType, byState, byVisibility,
    totalBytes, bytesLast24h, uploadsLast24h,
    activeStorageBackend, orphanUploading, deletedPending, deletedReadyForHardDelete,
    totalManifestRows,
    feedPublicVideos, feedViews24h, feedUniqueViewers24h,
    feedMedianWatchedMs24h, feedUnmuteRate24h,
  };
}

export async function loadRecentMedia(limit = 40): Promise<RecentMedia[]> {
  const r = await POOL.query<Record<string, unknown>>(
    `SELECT media_id, object_type, owner_id, visibility, state, mime_type, size_bytes,
            title, context_type, context_ref, uploaded_at, deleted_at, hard_delete_after
       FROM nex.media_object
      ORDER BY uploaded_at DESC LIMIT $1`,
    [limit],
  );
  return r.rows.map((row) => ({
    media_id: String(row.media_id),
    object_type: String(row.object_type),
    owner_id: String(row.owner_id),
    visibility: String(row.visibility),
    state: String(row.state),
    mime_type: String(row.mime_type),
    size_bytes: Number(row.size_bytes),
    title: (row.title as string) ?? null,
    context_type: (row.context_type as string) ?? null,
    context_ref: (row.context_ref as string) ?? null,
    uploaded_at: new Date(row.uploaded_at as string),
    deleted_at: row.deleted_at ? new Date(row.deleted_at as string) : null,
    hard_delete_after: row.hard_delete_after ? new Date(row.hard_delete_after as string) : null,
  }));
}
