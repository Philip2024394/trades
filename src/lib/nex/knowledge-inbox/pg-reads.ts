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
import { INBOX_KINDS, INBOX_STATUSES, KNOWLEDGE_SOURCES } from "./types";
// Wave 11 · Step 7 · F34 remediation · shared canonical withBrainRole.
// The local copy previously defined in this file has been removed ·
// migration is behavior-preserving (same Promise<T | null> contract).
import { withBrainRole } from "@/lib/nex/db/with-brain-role";
// Wave 11 · GROUP B · closes F17 (enum casts silent). Every pg row is
// validated at the boundary — invalid rows are dropped from the return
// set, counted, and signalled to observability.
import { validateOrDrop } from "@/lib/nex/observability/validate";

export function isPostgresReadEnabled(): boolean {
  return process.env.NEX_INBOX_READ_BACKEND === "postgres";
}


// Row → InboxItem shape converter. Wave 11 F17 remediation: replaced
// bare `as InboxKind` casts with a validator that returns
// { ok: false, reason } when the DB row has a value outside the enum
// set. The result is fed to validateOrDrop upstream so invalid rows
// are dropped from the return set (never propagated to caller with
// wrong enum tags).
function validateInboxRow(row: unknown, idx: number): { ok: true; value: InboxItem } | { ok: false; reason: string } {
  if (row == null || typeof row !== "object") return { ok: false, reason: "row-not-object" };
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "string" || r.id.length === 0)         return { ok: false, reason: "id-missing" };
  if (typeof r.title !== "string")                            return { ok: false, reason: "title-missing" };
  if (typeof r.kind !== "string" || !(INBOX_KINDS as Set<string>).has(r.kind))          return { ok: false, reason: "invalid-kind" };
  if (typeof r.status !== "string" || !(INBOX_STATUSES as Set<string>).has(r.status))    return { ok: false, reason: "invalid-status" };
  if (typeof r.source !== "string" || !(KNOWLEDGE_SOURCES as Set<string>).has(r.source)) return { ok: false, reason: "invalid-source" };
  if (typeof r.hash !== "string")                             return { ok: false, reason: "hash-missing" };
  if (r.created_at_ms == null)                                return { ok: false, reason: "created_at_ms-missing" };
  // pg driver returns `timestamptz` as a JS Date object (not a string),
  // so accept either shape. Same fix pattern as W4-1 in rollup-worker.
  // Coerce to canonical ISO string below.
  const createdAtIsoRaw = r.created_at_iso;
  const createdAtIsoOk = createdAtIsoRaw instanceof Date
    ? Number.isFinite(createdAtIsoRaw.getTime())
    : typeof createdAtIsoRaw === "string" && createdAtIsoRaw.length > 0;
  if (!createdAtIsoOk)                                        return { ok: false, reason: "created_at_iso-missing" };
  const item: InboxItem = {
    id:               r.id,
    title:            r.title,
    kind:             r.kind as InboxKind,
    status:           r.status as InboxStatus,
    source:           r.source as KnowledgeSource,
    createdAt:        Number(r.created_at_ms),
    createdAtIso:     createdAtIsoRaw instanceof Date
                        ? createdAtIsoRaw.toISOString()
                        : new Date(createdAtIsoRaw as string).toISOString(),
    hash:             r.hash,
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
  return { ok: true, value: item };
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
      // Wave 11 F17 · validateOrDrop replaces bare `rows.map(rowToInboxItem)`.
      // Invalid rows are dropped + counted + signalled · never propagated.
      const { valid } = validateOrDrop(r.rows, validateInboxRow, {
        subsystem: "inbox-pg-read",
        counter: "validate.row_dropped",
        signal_kind: "row-dropped",
      });
      return valid;
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
