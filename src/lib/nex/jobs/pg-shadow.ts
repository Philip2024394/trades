// NEX Knowledge Jobs · Postgres Shadow Layer · Phase 11.2
//
// Dual-write to nex.knowledge_dump_jobs alongside every filesystem
// jobs.jsonl mutation. Filesystem stays authoritative until Phase 11.3
// flip. Every write is best-effort · never throws.
//
// The JSONL store is append-only (every state change = new line) so
// its natural read semantic is "latest snapshot wins". The Postgres
// shadow captures only the LATEST row — the audit trail lives in
// nex.audit_log, not here.
//
// Activation:
//   NEX_INBOX_SHADOW_POSTGRES=1  (same flag as inbox shadow)
//
// See src/lib/nex/knowledge-inbox/pg-shadow.ts for the pattern.

import type { KnowledgeJob } from "./fs-store";
// Wave 11 · Step 7 · F34 · shared canonical withBrainRole.
import { withBrainRole } from "@/lib/nex/db/with-brain-role";

function shadowEnabled(): boolean {
  return process.env.NEX_INBOX_SHADOW_POSTGRES === "1";
}

function debug(msg: string, err?: unknown): void {
  if (process.env.NEX_INBOX_SHADOW_DEBUG === "1") {
    console.warn(`[jobs-shadow] ${msg}`, err instanceof Error ? err.message : err ?? "");
  }
}

// Insert-or-update the LATEST snapshot of one job. Called from
// createJob + updateJob so the shadow always reflects filesystem's
// latest visible state.
export async function shadowUpsertJob(job: KnowledgeJob): Promise<void> {
  if (!shadowEnabled()) return;
  try {
    await withBrainRole(async (c) => {
      await c.query(
        `INSERT INTO nex.knowledge_dump_jobs
           (job_id, source, owner, knowledge_type, target_brains,
            status, progress, completion_result,
            inbox_item_id, title, content_length,
            created_at, updated_at,
            shadow_written_at, shadow_updated_at)
         VALUES ($1,$2,$3,$4,$5::text[],$6,$7,$8::jsonb,$9,$10,$11,
                 $12::timestamptz, $13::timestamptz, NOW(), NOW())
         ON CONFLICT (job_id) DO UPDATE SET
           source            = EXCLUDED.source,
           owner             = EXCLUDED.owner,
           knowledge_type    = EXCLUDED.knowledge_type,
           target_brains     = EXCLUDED.target_brains,
           status            = EXCLUDED.status,
           progress          = EXCLUDED.progress,
           completion_result = EXCLUDED.completion_result,
           inbox_item_id     = EXCLUDED.inbox_item_id,
           title             = EXCLUDED.title,
           content_length    = EXCLUDED.content_length,
           updated_at        = EXCLUDED.updated_at,
           shadow_updated_at = NOW()`,
        [
          job.job_id, job.source, job.owner, job.knowledge_type, job.target_brains,
          job.status, job.progress,
          job.completion_result ? JSON.stringify(job.completion_result) : null,
          job.inbox_item_id, job.title, job.content_length,
          job.created_at, job.updated_at,
        ]
      );
    });
  } catch (err) {
    debug(`upsert failed job_id=${job.job_id}`, err);
  }
}

// G1 · Truth Contract · atomic KJ-terminal + inbox-terminal transition.
//
// Philip 2026-08-10 · required for the "no half-state" invariant. HQ
// reads Postgres for both KJ status and inbox status. Before this
// helper existed, `shadowUpsertJob` set KJ.status=completed while the
// inbox row stayed status=processing forever · so the Reception
// counter that reads /knowledge-inbox/list only ever increased.
//
// This helper writes BOTH the KJ terminal snapshot AND the inbox
// terminal state inside ONE Postgres transaction. Either both writes
// commit, or both roll back. HQ can never observe the half-state
// {KJ=completed · inbox=processing}.
//
// Semantics of the inbox terminal state:
//   status='processed'    · the inbox item has LEFT active production
//                           because its associated KJ reached a
//                           terminal state. This does NOT mean success.
//                           Success/failure lives on the KJ.
//   processed_at_ms       · epoch ms when the tie committed
//   processed_notes       · 'kj:completed' or 'kj:failed'
//
// Return: { ok: true } on committed tie · { ok: false, error } on
// rollback OR on shadow-disabled. Caller inspects and refuses to
// proceed if !ok (see applyTerminalKnowledgeJobTransition).
export async function shadowTerminalTie(
  job: KnowledgeJob,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!shadowEnabled()) {
    // Consistent with the rest of this module · shadow disabled = no
    // pg writes at all · caller treats this as "nothing to tie" and
    // proceeds. Local dev without pg url is the primary case.
    return { ok: true };
  }
  try {
    const result = await withBrainRole(async (c) => {
      // (1) KJ terminal snapshot · same INSERT-or-UPDATE shape as
      //     shadowUpsertJob above · idempotent on job_id conflict.
      await c.query(
        `INSERT INTO nex.knowledge_dump_jobs
           (job_id, source, owner, knowledge_type, target_brains,
            status, progress, completion_result,
            inbox_item_id, title, content_length,
            created_at, updated_at,
            shadow_written_at, shadow_updated_at)
         VALUES ($1,$2,$3,$4,$5::text[],$6,$7,$8::jsonb,$9,$10,$11,
                 $12::timestamptz, $13::timestamptz, NOW(), NOW())
         ON CONFLICT (job_id) DO UPDATE SET
           source            = EXCLUDED.source,
           owner             = EXCLUDED.owner,
           knowledge_type    = EXCLUDED.knowledge_type,
           target_brains     = EXCLUDED.target_brains,
           status            = EXCLUDED.status,
           progress          = EXCLUDED.progress,
           completion_result = EXCLUDED.completion_result,
           inbox_item_id     = EXCLUDED.inbox_item_id,
           title             = EXCLUDED.title,
           content_length    = EXCLUDED.content_length,
           updated_at        = EXCLUDED.updated_at,
           shadow_updated_at = NOW()`,
        [
          job.job_id, job.source, job.owner, job.knowledge_type, job.target_brains,
          job.status, job.progress,
          job.completion_result ? JSON.stringify(job.completion_result) : null,
          job.inbox_item_id, job.title, job.content_length,
          job.created_at, job.updated_at,
        ]
      );
      // (2) Inbox terminal · only if the KJ has an inbox linkage.
      //     Some KJs (background/system) have no inbox item · skip cleanly.
      if (job.inbox_item_id) {
        const r = await c.query(
          `UPDATE nex.knowledge_inbox
              SET status = 'processed',
                  processed_at_ms = $2::bigint,
                  processed_notes = $3,
                  shadow_updated_at = NOW()
            WHERE id = $1
              AND status <> 'processed'`,
          [job.inbox_item_id, Date.now(), `kj:${job.status}`],
        );
        return { inbox_rows_updated: r.rowCount ?? 0 };
      }
      return { inbox_rows_updated: 0 };
    });
    if (result === null) {
      // withBrainRole returns null when NEX_POSTGRES_URL is unset ·
      // treated identically to "shadow disabled" above.
      return { ok: true };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    debug(`terminal-tie ROLLBACK job_id=${job.job_id}`, err);
    return { ok: false, error: msg };
  }
}
