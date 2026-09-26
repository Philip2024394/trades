// src/lib/nex-native/generation-job-service.ts
//
// NEX-native · durable generation-job service (server-only).
// ----------------------------------------------------------
// Sits between the API layer (which enqueues jobs) and the engine
// workers (which lease + complete jobs). Backed by the nex_generation_job
// table (migration 011) on the authoritative NEX Supabase.
//
// Per the 2026-09-24 Scaling Doctrine:
//   · The engine does not change.
//   · This service enables horizontal worker architecture.
//   · No silent hosted-AI fallback · a failed job is a failed job.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";

export type GenerationJobStatus =
  | "queued"
  | "leased"
  | "completed"
  | "failed"
  | "expired";

export interface GenerationJobRow {
  id: NexUuid;
  correlation_id: NexUuid;
  conversation_id: NexUuid;
  requester_account_id: NexUuid | null;
  requester_side: "customer" | "business";
  priority: number;
  status: GenerationJobStatus;
  created_at: string;
  expires_at: string;
  leased_at: string | null;
  leased_by: string | null;
  lease_expires_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  result_message_id: NexUuid | null;
  result_model_id: string | null;
  result_latency_ms: number | null;
  result_attempts_used: number | null;
  result_findings: string[] | null;
}

export interface EnqueueGenerationJobInput {
  conversation_id: NexUuid;
  requester_account_id: NexUuid | null;
  requester_side: "customer" | "business";
  priority?: number;
  expires_in_seconds?: number;
  max_attempts?: number;
  correlation_id?: NexUuid;
}

export async function enqueueGenerationJob(
  input: EnqueueGenerationJobInput
): Promise<GenerationJobRow> {
  const expires_at = new Date(
    Date.now() + (input.expires_in_seconds ?? 300) * 1000
  ).toISOString();

  const insert: Record<string, unknown> = {
    conversation_id: input.conversation_id,
    requester_account_id: input.requester_account_id,
    requester_side: input.requester_side,
    priority: input.priority ?? 100,
    expires_at,
    max_attempts: input.max_attempts ?? 2,
  };
  if (input.correlation_id) insert.correlation_id = input.correlation_id;

  const { data, error } = await nexSupabaseAdmin
    .from("nex_generation_job")
    .insert(insert)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `generation-job-service.enqueue: ${error?.message ?? "no row returned"}`
    );
  }
  return data as GenerationJobRow;
}

/**
 * Atomically lease up to `batchSize` queued jobs to this worker via the
 * SECURITY DEFINER helper (nex_lease_generation_jobs). Returns the leased
 * rows. Empty array if nothing is ready.
 */
export async function leaseGenerationJobs(
  workerId: string,
  batchSize = 1,
  leaseSeconds = 90
): Promise<GenerationJobRow[]> {
  const { data, error } = await nexSupabaseAdmin.rpc(
    "nex_lease_generation_jobs",
    {
      p_worker_id: workerId,
      p_batch_size: batchSize,
      p_lease_seconds: leaseSeconds,
    }
  );
  if (error) {
    throw new Error(`generation-job-service.lease: ${error.message}`);
  }
  return (data as GenerationJobRow[]) ?? [];
}

export async function completeGenerationJob(input: {
  id: NexUuid;
  result_message_id: NexUuid;
  result_model_id: string;
  result_latency_ms: number;
  result_attempts_used: number;
  result_findings: string[];
}): Promise<void> {
  // Preserve `leased_by` on completion so operators (and acceptance
  // harnesses) can trace which worker produced which reply · essential
  // for post-hoc worker-rotation diagnosis. Only `lease_expires_at` is
  // nulled since the lease is no longer holdable · reclaim helpers skip
  // completed jobs regardless of the leased_by column.
  const { error } = await nexSupabaseAdmin
    .from("nex_generation_job")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      result_message_id: input.result_message_id,
      result_model_id: input.result_model_id,
      result_latency_ms: input.result_latency_ms,
      result_attempts_used: input.result_attempts_used,
      result_findings: input.result_findings,
      lease_expires_at: null,
    })
    .eq("id", input.id);
  if (error) throw new Error(`generation-job-service.complete: ${error.message}`);
}

/**
 * Move a leased job back to `queued` if it can be retried (attempts <
 * max_attempts), otherwise mark it `failed`. Honest failure · no fabricated
 * result.
 *
 * The transition is executed via a single atomic SQL UPDATE that decides
 * `queued` vs `failed` based on the row's own `attempts` at write time,
 * closing the read-then-write race where `nex_reclaim_expired_leases`
 * could have transitioned the same row between our SELECT and UPDATE.
 */
export async function failGenerationJob(input: {
  id: NexUuid;
  error: string;
}): Promise<{ requeued: boolean }> {
  const { data, error } = await nexSupabaseAdmin.rpc("nex_transition_generation_job_failure", {
    p_job_id: input.id,
    p_error: input.error.slice(0, 500),
  });
  if (error) {
    throw new Error(`generation-job-service.fail (atomic): ${error.message}`);
  }
  const rows = (data as Array<{ new_status: string }>) ?? [];
  const newStatus = rows[0]?.new_status ?? "failed";
  return { requeued: newStatus === "queued" };
}

/**
 * Heartbeat · extend the worker's lease on a job in progress. Called
 * from within the worker every ~30 seconds to protect long-running
 * generations from being reclaimed.
 */
export async function heartbeatGenerationJob(input: {
  id: NexUuid;
  worker_id: string;
  extend_by_seconds: number;
}): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_generation_job")
    .update({
      lease_expires_at: new Date(Date.now() + input.extend_by_seconds * 1000).toISOString(),
    })
    .eq("id", input.id)
    .eq("leased_by", input.worker_id);
  if (error) throw new Error(`generation-job-service.heartbeat: ${error.message}`);
}

/**
 * Reclaim any jobs whose worker died mid-lease. Called periodically by
 * the worker manager · any worker can safely invoke.
 */
export async function reclaimExpiredLeases(): Promise<number> {
  const { data, error } = await nexSupabaseAdmin.rpc("nex_reclaim_expired_leases", {});
  if (error) throw new Error(`generation-job-service.reclaim: ${error.message}`);
  return (data as number) ?? 0;
}

export interface QueueDepth {
  queued: number;
  leased: number;
  oldestQueuedSeconds: number;
}

export async function getQueueDepth(): Promise<QueueDepth> {
  const { data, error } = await nexSupabaseAdmin.rpc("nex_generation_queue_depth", {});
  if (error) throw new Error(`generation-job-service.queueDepth: ${error.message}`);
  const rows = (data as Array<{ status: string; count: number; oldest_seconds: number }>) ?? [];
  const q = rows.find((r) => r.status === "queued");
  const l = rows.find((r) => r.status === "leased");
  return {
    queued: Number(q?.count ?? 0),
    leased: Number(l?.count ?? 0),
    oldestQueuedSeconds: Number(q?.oldest_seconds ?? 0),
  };
}

export async function getJobById(id: NexUuid): Promise<GenerationJobRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_generation_job")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`generation-job-service.getJobById: ${error.message}`);
  return (data as GenerationJobRow | null) ?? null;
}
