// NEX Knowledge Inbox · Postgres read adapters · Wave 6
//
// PURPOSE
// Provide the ability to READ inbox items + stats from
// nex.knowledge_inbox / nex.knowledge_inbox_stats instead of the
// legacy filesystem index.json / stats.json.
//
// This module is INACTIVE by default. Activation requires:
//   · NEX_INBOX_READ_BACKEND=postgres
//   · NEX_POSTGRES_URL present
// Otherwise the filesystem read paths in storage.ts are unchanged.
//
// SAFETY
//   · Reads are best-effort: if Postgres query fails, storage.ts's
//     read function has a fallback path that returns to filesystem
//   · No writes here · this is a pure read adapter
//   · Uses SET LOCAL ROLE nex_brain_app · RLS enforced
//   · Runs in a normal transaction · no long-held connections
//
// PRODUCTION FLIP
// When NEX_INBOX_READ_BACKEND=postgres is set in production:
//   1. inbox APIs (list, get, search) start reading from nex.*
//   2. Cloud workers (Fly · once redeployed) can dispatch inbox items
//      without needing filesystem access (P0-5 unblocked)
//   3. Filesystem writes continue via existing shadow-write path so
//      rollback (env flip back) is loss-less
//
// The Phase 3a schema (migration 045) added object_bucket/object_key
// columns · this reader materializes them into the InboxItem shape
// so the pipeline transparently sees Object Storage references.

import type { InboxItem, InboxStats, InboxKind, InboxStatus, KnowledgeSource } from "./types";
import { withClient, type PgClientLike } from "@/lib/nex/db";

export function isPostgresReadEnabled(): boolean {
  return process.env.NEX_INBOX_READ_BACKEND === "postgres";
}

async function withBrainRole<T>(fn: (c: PgClientLike) => Promise<T>): Promise<T | null> {
  return withClient(async (c) => {
    await c.query("BEGIN");
    try {
      await c.query("SET LOCAL ROLE nex_brain_app");
      const r = await fn(c);
      await c.query("COMMIT");
      return r;
    } catch (e) {
      await c.query("ROLLBACK").catch(() => {});
      throw e;
    }
  });
}

// Row → InboxItem shape converter. Fields absent in the DB (contentPath,
// url, etc. for legacy items) fall through as undefined per the type.
function rowToInboxItem(r: Record<string, unknown>): InboxItem {
  return {
    id:               String(r.id),
    title:            String(r.title),
    kind:             r.kind as InboxKind,
    status:           r.status as InboxStatus,
    source:           r.source as KnowledgeSource,
    createdAt:        Number(r.created_at_ms),
    createdAtIso:     new Date(r.created_at_iso as string).toISOString(),
    hash:             String(r.hash),
    meta:             (r.meta          as string | null) ?? undefined,
    previewText:      (r.preview_text  as string | null) ?? undefined,
    contentPath:      (r.content_path  as string | null) ?? undefined,
    filePath:         (r.file_path     as string | null) ?? undefined,
    objectBucket:     (r.object_bucket as string | null) ?? undefined,
    objectKey:        (r.object_key    as string | null) ?? undefined,
    originalFilename: (r.original_filename as string | null) ?? undefined,
    byteSize:         r.byte_size != null ? Number(r.byte_size) : undefined,
    mimeType:         (r.mime_type as string | null) ?? undefined,
    url:              (r.url        as string | null) ?? undefined,
    processedAt:      r.processed_at_ms != null ? Number(r.processed_at_ms) : undefined,
    processedNotes:   (r.processed_notes as string | null) ?? undefined,
  };
}

/**
 * Read the entire inbox from nex.knowledge_inbox · ordered by
 * created_at_iso DESC (newest first · matches legacy filesystem order).
 *
 * Returns null when Postgres is unreachable · caller can fall back to
 * filesystem. Returns [] when Postgres is reachable but no rows.
 */
export async function readIndexFromPostgres(): Promise<InboxItem[] | null> {
  try {
    return await withBrainRole(async (c) => {
      const r = await c.query(
        `SELECT id, title, kind, status, source, hash,
                created_at_ms, created_at_iso, meta, preview_text,
                content_path, file_path, original_filename,
                byte_size, mime_type, url,
                processed_at_ms, processed_notes,
                object_bucket, object_key
           FROM nex.knowledge_inbox
          ORDER BY created_at_iso DESC`,
      );
      return r.rows.map(rowToInboxItem);
    });
  } catch (err) {
    console.warn("[inbox-pg-read] readIndex failed · caller should fall back to filesystem:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Read the current stats row from nex.knowledge_inbox_stats · picking
 * today's row when present · otherwise the most recent one · otherwise
 * returns a zero-filled stats object for today.
 */
export async function readStatsFromPostgres(): Promise<InboxStats | null> {
  try {
    return await withBrainRole(async (c) => {
      const today = new Date().toISOString().slice(0, 10);
      // Prefer today's row · fall back to the most recent
      const r = await c.query(
        `SELECT stat_date::text AS stat_date, completed_today, images_analysed_lifetime,
                voice_notes_transcribed_lifetime, last_processed_at_ms
           FROM nex.knowledge_inbox_stats
          ORDER BY (stat_date = $1) DESC, stat_date DESC
          LIMIT 1`,
        [today],
      );
      const row = r.rows[0];
      if (!row) {
        return {
          completedToday: 0,
          completedTodayDate: today,
          imagesAnalysed: 0,
          voiceNotesTranscribed: 0,
          recordsCreated: null,
          recordsUpdated: null,
          faqsGenerated: null,
          edgesCreated: null,
          duplicatesMerged: null,
        };
      }
      const stats: InboxStats = {
        completedToday:        row.stat_date === today ? Number(row.completed_today) : 0,
        completedTodayDate:    row.stat_date === today ? String(row.stat_date) : today,
        imagesAnalysed:        Number(row.images_analysed_lifetime),
        voiceNotesTranscribed: Number(row.voice_notes_transcribed_lifetime),
        lastProcessedAt:       row.last_processed_at_ms != null ? Number(row.last_processed_at_ms) : undefined,
        recordsCreated:        null,
        recordsUpdated:        null,
        faqsGenerated:         null,
        edgesCreated:          null,
        duplicatesMerged:      null,
      };
      return stats;
    });
  } catch (err) {
    console.warn("[inbox-pg-read] readStats failed · caller should fall back to filesystem:", err instanceof Error ? err.message : err);
    return null;
  }
}
