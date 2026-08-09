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
