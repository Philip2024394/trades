// NEX Knowledge Dump jobs · Postgres read adapters · Wave 6b
//
// PURPOSE
// Read Knowledge Dump jobs from nex.knowledge_dump_jobs instead of
// the legacy filesystem JSONL at data/nex-jobs/jobs.jsonl.
//
// This module is INACTIVE by default. Activation requires:
//   · NEX_INBOX_READ_BACKEND=postgres (same env var as Wave 6a ·
//     both inbox items+stats+dump-jobs are conceptually the same
//     read-flip capability)
//   · NEX_POSTGRES_URL present
// Otherwise the filesystem read paths in fs-store.ts are unchanged.
//
// SAFETY
//   · Reads are best-effort · if Postgres query fails, fs-store.ts's
//     read function has a fallback path that returns to filesystem
//   · No writes here · pure read adapter
//   · SET LOCAL ROLE nex_brain_app · RLS enforced
//   · Returns null on failure so caller can fall back cleanly

import type { JobStatus, KnowledgeJob } from "./fs-store";
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

function rowToJob(r: Record<string, unknown>): KnowledgeJob {
  return {
    job_id:             String(r.job_id),
    source:             String(r.source),
    owner:              String(r.owner),
    created_at:         new Date(r.created_at as string).toISOString(),
    knowledge_type:     (r.knowledge_type as string | null) ?? null,
    target_brains:      (r.target_brains as string[] | null) ?? [],
    status:             r.status as JobStatus,
    progress:           Number(r.progress),
    completion_result:  (r.completion_result as KnowledgeJob["completion_result"]) ?? null,
    inbox_item_id:      (r.inbox_item_id as string | null) ?? null,
    title:              (r.title as string | null) ?? null,
    content_length:     Number(r.content_length),
    updated_at:         new Date(r.updated_at as string).toISOString(),
  };
}

export type ListJobsFilter = {
  limit?: number;
  status?: JobStatus;
  since_ms?: number;
  include_all_states?: boolean;
};

/**
 * List Knowledge Dump jobs from nex.knowledge_dump_jobs · newest first ·
 * matches the legacy filesystem read semantics. Returns null when
 * Postgres is unreachable · caller falls back to filesystem.
 */
export async function listJobsFromPostgres(filter: ListJobsFilter = {}): Promise<KnowledgeJob[] | null> {
  const limit = Math.min(Math.max(1, filter.limit ?? 50), 500);
  const sinceMs = filter.since_ms ?? 7 * 24 * 60 * 60 * 1000;
  const sinceIso = new Date(Date.now() - sinceMs).toISOString();
  const includeAll = filter.include_all_states ?? false;
  try {
    return await withBrainRole(async (c) => {
      const params: unknown[] = [sinceIso];
      let sql = `
        SELECT job_id, source, owner, knowledge_type, target_brains,
               status, progress, completion_result, inbox_item_id,
               title, content_length, created_at, updated_at
          FROM nex.knowledge_dump_jobs
         WHERE updated_at >= $1::timestamptz
      `;
      if (filter.status) {
        params.push(filter.status);
        sql += ` AND status = $${params.length}`;
      }
      if (!includeAll) {
        sql += ` AND status NOT IN ('completed', 'failed')`;
      }
      sql += ` ORDER BY updated_at DESC`;
      params.push(limit);
      sql += ` LIMIT $${params.length}`;
      const r = await c.query(sql, params);
      return r.rows.map(rowToJob);
    });
  } catch (err) {
    console.warn("[jobs-pg-read] listJobs failed · caller should fall back to filesystem:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Read a single Knowledge Dump job by id. Returns null when Postgres
 * is unreachable (caller falls back). Returns { found: false } when
 * Postgres is reachable but no row matches (definitive not-found · no
 * fallback needed).
 */
export async function getJobFromPostgres(job_id: string): Promise<KnowledgeJob | null | { found: false }> {
  try {
    const r = await withBrainRole(async (c) => {
      return c.query(
        `SELECT job_id, source, owner, knowledge_type, target_brains,
                status, progress, completion_result, inbox_item_id,
                title, content_length, created_at, updated_at
           FROM nex.knowledge_dump_jobs
          WHERE job_id = $1`,
        [job_id],
      );
    });
    if (r === null) return null;
    if (r.rowCount === 0) return { found: false };
    return rowToJob(r.rows[0]);
  } catch (err) {
    console.warn("[jobs-pg-read] getJob failed · caller should fall back to filesystem:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Stats · counts by status. Matches the shape of fs-store.ts::jobStats().
 */
export async function jobStatsFromPostgres(): Promise<{ total: number; by_status: Record<JobStatus, number> } | null> {
  try {
    return await withBrainRole(async (c) => {
      const r = await c.query(
        `SELECT status, COUNT(*)::int AS n FROM nex.knowledge_dump_jobs GROUP BY status`,
      );
      const by_status: Record<JobStatus, number> = {
        received: 0, queued: 0, claimed: 0, processing: 0, completed: 0, failed: 0,
      };
      let total = 0;
      for (const row of r.rows) {
        const s = row.status as JobStatus;
        const n = Number(row.n);
        by_status[s] = n;
        total += n;
      }
      return { total, by_status };
    });
  } catch (err) {
    console.warn("[jobs-pg-read] jobStats failed · caller should fall back to filesystem:", err instanceof Error ? err.message : err);
    return null;
  }
}
