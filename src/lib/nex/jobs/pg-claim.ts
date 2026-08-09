// src/lib/nex/jobs/pg-claim.ts
//
// Wave 11 remediation · closes F2 · escalated from P1 to P0 by Philip
// (2026-08-10) after live CR4a evidence proved the JSONL CAS
// approximation permits two concurrent claims of the same job_id to
// BOTH succeed.
//
// This module provides the ATOMIC exactly-one-winner claim primitive
// at the database boundary. It sits ABOVE the shadow-write layer
// (pg-shadow.ts): pg-shadow mirrors filesystem mutations to Postgres,
// this module makes the claim decision authoritative when Postgres is
// available.
//
// INVARIANT · SAFETY PROPERTY (moves from topology-dependent to intrinsic)
//
//   Given two callers concurrently invoking pgAtomicClaimIfQueued(job_id):
//     · exactly ZERO or ONE receives kind="claimed"
//     · every other caller receives kind="lost-race" or kind="not-found-in-shadow"
//     · a job cannot be processed twice via the atomic path
//
// The property is enforced by Postgres row-level exclusive locking on
// UPDATE with a status-CAS predicate: `WHERE status='queued'`. The
// second concurrent UPDATE finds status='claimed' and returns 0 rows.
//
// FALLBACK
//
// If Postgres is not configured (NEX_POSTGRES_URL unset · dev/test),
// callers fall back to the legacy JSONL CAS approximation. That path
// remains topology-dependent and is documented at fs-store.ts.

import type { KnowledgeJob, JobStatus } from "./fs-store";
// Wave 11 · Step 7 · F34 · shared canonical withBrainRole.
import { withBrainRole } from "@/lib/nex/db/with-brain-role";

export type PgClaimResult =
  | { kind: "claimed"; job: KnowledgeJob }
  | { kind: "lost-race"; observed_status: JobStatus }
  | { kind: "not-found-in-shadow" }
  | { kind: "pg-unavailable" };

function rowToKnowledgeJob(r: Record<string, unknown>): KnowledgeJob {
  return {
    job_id:            String(r.job_id),
    source:            String(r.source),
    owner:             String(r.owner),
    created_at:        (r.created_at as Date | string).toString().includes("T")
                         ? String(r.created_at)
                         : new Date(r.created_at as string | number | Date).toISOString(),
    knowledge_type:    r.knowledge_type == null ? null : String(r.knowledge_type),
    target_brains:     Array.isArray(r.target_brains) ? (r.target_brains as string[]) : [],
    status:            String(r.status) as KnowledgeJob["status"],
    progress:          Number(r.progress ?? 0),
    completion_result: (r.completion_result as KnowledgeJob["completion_result"]) ?? null,
    inbox_item_id:     r.inbox_item_id == null ? null : String(r.inbox_item_id),
    title:             r.title == null ? null : String(r.title),
    content_length:    Number(r.content_length ?? 0),
    updated_at:        (r.updated_at as Date | string).toString().includes("T")
                         ? String(r.updated_at)
                         : new Date(r.updated_at as string | number | Date).toISOString(),
  };
}

/**
 * Attempt the atomic exactly-one-winner claim at the database boundary.
 *
 * Returns:
 *   · "claimed" · we won · caller should update the JSONL to append a
 *     "claimed" snapshot so filesystem-based readers observe the state.
 *   · "lost-race" · another caller already claimed this job. We observed
 *     a non-queued status. Caller returns not_queued to its caller.
 *   · "not-found-in-shadow" · Postgres has no row for job_id. Either
 *     the shadow-write for createJob has not landed yet, or this job
 *     genuinely does not exist. Caller should fall back to the JSONL
 *     path (which will either atomic-CAS-approximate or return not_found).
 *   · "pg-unavailable" · NEX_POSTGRES_URL unset. Caller should use JSONL
 *     path exclusively.
 */
export async function pgAtomicClaimIfQueued(job_id: string): Promise<PgClaimResult> {
  const result = await withBrainRole(async (c) => {
    // Step 1 · atomic claim. UPDATE with WHERE status='queued' is the
    // exactly-one-winner primitive. Concurrent UPDATE finds status has
    // already flipped and returns 0 rows.
    const upd = await c.query(
      `UPDATE nex.knowledge_dump_jobs
         SET status = 'claimed',
             updated_at = NOW(),
             shadow_updated_at = NOW()
       WHERE job_id = $1 AND status = 'queued'
       RETURNING *`,
      [job_id],
    );
    if (upd.rowCount === 1) {
      return { kind: "claimed" as const, job: rowToKnowledgeJob(upd.rows[0]) };
    }

    // Step 2 · UPDATE returned 0 rows. Disambiguate: is it a lost race
    // (row exists with wrong status) or a missing row (shadow lag)?
    const probe = await c.query(
      `SELECT status FROM nex.knowledge_dump_jobs WHERE job_id = $1`,
      [job_id],
    );
    if (probe.rowCount === 0) {
      return { kind: "not-found-in-shadow" as const };
    }
    return {
      kind: "lost-race" as const,
      observed_status: String(probe.rows[0].status) as JobStatus,
    };
  });

  if (result === null) return { kind: "pg-unavailable" };
  return result;
}
