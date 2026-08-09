// NEX Knowledge Inbox · Postgres Shadow Layer · Phase 11.2
//
// Dual-write to nex.knowledge_inbox alongside every filesystem mutation.
// Filesystem stays authoritative until Phase 11.3 flip · Postgres is a
// passive shadow whose writes never fail the primary path.
//
// Activation:
//   NEX_INBOX_SHADOW_POSTGRES=1  → shadow writes ON  (default: OFF)
//   NEX_POSTGRES_URL             → required for the pg pool
//
// Every function in this module is best-effort:
//   · returns void
//   · try/catches its own errors
//   · logs (behind NEX_INBOX_SHADOW_DEBUG=1) but never throws
//
// The primary filesystem write MUST NOT be delayed by the shadow write.
// Callers should `void shadowXxx(...)` fire-and-forget or await when
// the sequence matters for a downstream test — either way, the shadow
// call cannot reject to the outer scope.
//
// Guardrails:
//   · No feature flag = no writes = production is unchanged
//   · No reads · caller ALWAYS reads from filesystem
//   · No delete-by-hash convenience · caller must pass id
//   · Errors caught silently so a Postgres outage doesn't cascade

import type { InboxItem, InboxStatus } from "./types";
// Wave 11 · Step 7 · F34 · shared canonical withBrainRole.
import { withBrainRole as sharedWithBrainRole } from "@/lib/nex/db/with-brain-role";

export function isShadowEnabled(): boolean {
  return process.env.NEX_INBOX_SHADOW_POSTGRES === "1";
}

function debug(msg: string, err?: unknown): void {
  if (process.env.NEX_INBOX_SHADOW_DEBUG === "1") {
    console.warn(`[inbox-shadow] ${msg}`, err instanceof Error ? err.message : err ?? "");
  }
}

// Local alias so the many callsites below don't need renaming.
const withBrainRole = sharedWithBrainRole;

// Upsert one full inbox item. Used at capture time (saveTextItem /
// saveFileItem / saveUrlItem) and also during backfill.
export async function shadowUpsertInboxItem(item: InboxItem): Promise<void> {
  if (!isShadowEnabled()) return;
  try {
    await withBrainRole(async (c) => {
      await c.query(
        `INSERT INTO nex.knowledge_inbox
           (id, title, kind, status, source, hash,
            created_at_ms, created_at_iso, meta, preview_text,
            content_path, file_path, original_filename,
            byte_size, mime_type, url,
            processed_at_ms, processed_notes,
            object_bucket, object_key,
            shadow_written_at, shadow_updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           title             = EXCLUDED.title,
           kind              = EXCLUDED.kind,
           status            = EXCLUDED.status,
           source            = EXCLUDED.source,
           hash              = EXCLUDED.hash,
           meta              = EXCLUDED.meta,
           preview_text      = EXCLUDED.preview_text,
           content_path      = EXCLUDED.content_path,
           file_path         = EXCLUDED.file_path,
           original_filename = EXCLUDED.original_filename,
           byte_size         = EXCLUDED.byte_size,
           mime_type         = EXCLUDED.mime_type,
           url               = EXCLUDED.url,
           processed_at_ms   = EXCLUDED.processed_at_ms,
           processed_notes   = EXCLUDED.processed_notes,
           object_bucket     = EXCLUDED.object_bucket,
           object_key        = EXCLUDED.object_key,
           shadow_updated_at = NOW()`,
        [
          item.id, item.title, item.kind, item.status, item.source, item.hash,
          item.createdAt, item.createdAtIso, item.meta ?? null, item.previewText ?? null,
          item.contentPath ?? null, item.filePath ?? null, item.originalFilename ?? null,
          item.byteSize ?? null, item.mimeType ?? null, item.url ?? null,
          item.processedAt ?? null, item.processedNotes ?? null,
          item.objectBucket ?? null, item.objectKey ?? null,
        ]
      );
    });
  } catch (err) {
    debug(`upsert failed id=${item.id}`, err);
  }
}

// Bulk transition for the Phase 12.1 writeback path. Takes a Map of
// id → new status and updates every matching row. Missing rows are
// silently skipped (backfill fills the gap later).
export async function shadowUpdateInboxStatuses(updates: Map<string, InboxStatus>): Promise<void> {
  if (!isShadowEnabled()) return;
  if (updates.size === 0) return;
  try {
    await withBrainRole(async (c) => {
      // Build one round-trip using UNNEST · one query for the whole batch.
      const ids     = [...updates.keys()];
      const statuses = ids.map((id) => updates.get(id)!);
      await c.query(
        `UPDATE nex.knowledge_inbox AS ki
            SET status = u.new_status,
                shadow_updated_at = NOW()
           FROM UNNEST($1::text[], $2::text[]) AS u(id, new_status)
          WHERE ki.id = u.id`,
        [ids, statuses]
      );
    });
  } catch (err) {
    debug(`bulk status writeback failed size=${updates.size}`, err);
  }
}

// Delete one row. Called from deleteItem.
export async function shadowDeleteInboxItem(id: string): Promise<void> {
  if (!isShadowEnabled()) return;
  try {
    await withBrainRole(async (c) => {
      await c.query(`DELETE FROM nex.knowledge_inbox WHERE id = $1`, [id]);
    });
  } catch (err) {
    debug(`delete failed id=${id}`, err);
  }
}

// Upsert one stats row (per-day). Called from writeStats.
// stat_date is derived from InboxStats.completedTodayDate ("YYYY-MM-DD").
export async function shadowUpsertInboxStats(input: {
  completedTodayDate: string;
  completedToday: number;
  imagesAnalysed: number;
  voiceNotesTranscribed: number;
  lastProcessedAt?: number;
}): Promise<void> {
  if (!isShadowEnabled()) return;
  try {
    await withBrainRole(async (c) => {
      await c.query(
        `INSERT INTO nex.knowledge_inbox_stats
           (stat_date, completed_today, images_analysed_lifetime,
            voice_notes_transcribed_lifetime, last_processed_at_ms,
            shadow_written_at, shadow_updated_at)
         VALUES ($1::date, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (stat_date) DO UPDATE SET
           completed_today                  = EXCLUDED.completed_today,
           images_analysed_lifetime         = EXCLUDED.images_analysed_lifetime,
           voice_notes_transcribed_lifetime = EXCLUDED.voice_notes_transcribed_lifetime,
           last_processed_at_ms             = EXCLUDED.last_processed_at_ms,
           shadow_updated_at                = NOW()`,
        [
          input.completedTodayDate,
          input.completedToday,
          input.imagesAnalysed,
          input.voiceNotesTranscribed,
          input.lastProcessedAt ?? null,
        ]
      );
    });
  } catch (err) {
    debug(`stats upsert failed date=${input.completedTodayDate}`, err);
  }
}
