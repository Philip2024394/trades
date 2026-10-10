// src/lib/nex/capability-runtime/task-lifecycle.ts
//
// NEX Task Lifecycle Contract · Stage 7 · Typed view over HarvestJob
// Founder-authorised build-lane addition · 2026-09-23.
//
// WRAPS the authoritative harvest queue:
//   · nex.harvest_job table (job_id · job_type · status · lease · attempts · parent_job_id)
//   · src/lib/nex/harvest/queue.ts (enqueue · claim · heartbeat · complete · fail · dead-letter)
//   · src/lib/nex/harvest/types.ts (HarvestJob interface)
//
// UNLIKE the AgentTopology (which is code-derived because aof_agent has
// no parent column), TASK parent/child relationships ARE authoritative:
// `nex.harvest_job.parent_job_id` is a real FK column enforced by the DB.
//
// HARD RULES:
//   _TASK_LIFECYCLE_IS_READ_ONLY — no enqueue/claim/complete/fail helpers here
//   _TASK_LIFECYCLE_DOES_NOT_INVENT_STATE — every field maps to a real HarvestJob column
//   _TASK_PARENT_CHILD_IS_DB_AUTHORITATIVE — sourced from harvest_job.parent_job_id

import type { HarvestJob, JobStatus } from "../harvest/types";

// ═══════════════════════════════════════════════════════════════════════
// STATUS
// ═══════════════════════════════════════════════════════════════════════

export type TaskLifecycleStatus = JobStatus;

export const KNOWN_TASK_STATUSES: readonly TaskLifecycleStatus[] = [
  "queued",
  "claimed",
  "processing",
  "completed",
  "failed",
  "dead_letter",
] as const;

export const TERMINAL_TASK_STATUSES: readonly TaskLifecycleStatus[] = [
  "completed",
  "dead_letter",
] as const;

export function isTerminalStatus(status: TaskLifecycleStatus): boolean {
  return (TERMINAL_TASK_STATUSES as readonly string[]).includes(status);
}

// ═══════════════════════════════════════════════════════════════════════
// SNAPSHOT
// ═══════════════════════════════════════════════════════════════════════

/**
 * Read-only snapshot of one `nex.harvest_job` row.
 *
 * `parent_job_id` is DB-authoritative — it refers to the row that spawned
 * this task. `result_reference` is intentionally NOT a column of harvest_job
 * today; it maps to whichever downstream row was produced. Stage 7 does not
 * fabricate a value — we expose `result_reference` as null when the writer
 * modules have not populated a linkage.
 */
export interface TaskLifecycleSnapshot {
  readonly job_id: string;
  readonly job_type: string;
  readonly parent_job_id: string | null;
  readonly programme_id: string | null;
  readonly country_iso: string | null;
  readonly source_id: string | null;
  readonly status: TaskLifecycleStatus;
  readonly priority: number;
  readonly attempts: number;
  readonly max_attempts: number;
  readonly lease_owner: string | null;
  readonly lease_acquired_at: string | null;
  readonly lease_expires_at: string | null;
  readonly heartbeat_at: string | null;
  readonly last_error: string | null;
  readonly last_error_at: string | null;
  readonly dead_letter_reason: string | null;
  readonly dead_letter_at: string | null;
  readonly completed_at: string | null;
  readonly next_attempt_at: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly provenance_row_id: string;
  readonly provenance_store: "nex.harvest_job";
}

/**
 * Lossless adapter from an authoritative HarvestJob into the snapshot.
 * Adds `provenance_row_id` and `provenance_store` for LoggedFact wrapping.
 */
export function fromHarvestJob(row: HarvestJob): TaskLifecycleSnapshot {
  return {
    job_id: row.job_id,
    job_type: typeof row.job_type === "string" ? row.job_type : String(row.job_type),
    parent_job_id: row.parent_job_id,
    programme_id: row.programme_id,
    country_iso: row.country_iso,
    source_id: row.source_id,
    status: row.status,
    priority: row.priority,
    attempts: row.attempts,
    max_attempts: row.max_attempts,
    lease_owner: row.lease_owner,
    lease_acquired_at: row.lease_acquired_at,
    lease_expires_at: row.lease_expires_at,
    heartbeat_at: row.heartbeat_at,
    last_error: row.last_error,
    last_error_at: row.last_error_at,
    dead_letter_reason: row.dead_letter_reason,
    dead_letter_at: row.dead_letter_at,
    completed_at: row.completed_at,
    next_attempt_at: row.next_attempt_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    provenance_row_id: row.job_id,
    provenance_store: "nex.harvest_job",
  };
}

// ═══════════════════════════════════════════════════════════════════════
// RECOVERY VIEW
// ═══════════════════════════════════════════════════════════════════════

/**
 * Small computed view of the recovery-relevant fields on a task.
 * Recovery/interruption state is proven by real HarvestJob columns:
 *   · lease_expires_at < now() → task is reap-eligible
 *   · attempts < max_attempts → task will be retried
 *   · status === "dead_letter" → task requires manual intervention
 */
export interface TaskRecoveryView {
  readonly job_id: string;
  readonly status: TaskLifecycleStatus;
  readonly is_retriable: boolean;
  readonly is_dead_letter: boolean;
  readonly attempts: number;
  readonly max_attempts: number;
  readonly lease_expires_at: string | null;
  readonly last_error: string | null;
}

export function toRecoveryView(snap: TaskLifecycleSnapshot): TaskRecoveryView {
  return {
    job_id: snap.job_id,
    status: snap.status,
    is_retriable: snap.status === "failed" && snap.attempts < snap.max_attempts,
    is_dead_letter: snap.status === "dead_letter",
    attempts: snap.attempts,
    max_attempts: snap.max_attempts,
    lease_expires_at: snap.lease_expires_at,
    last_error: snap.last_error,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// DOCTRINE LOCKS (Stage 7)
// ═══════════════════════════════════════════════════════════════════════

export const _TASK_LIFECYCLE_IS_READ_ONLY =
  "no_enqueue_claim_complete_fail_helpers_writes_stay_in_harvest_queue_ts";

export const _TASK_LIFECYCLE_DOES_NOT_INVENT_STATE =
  "every_field_in_TaskLifecycleSnapshot_maps_to_a_real_HarvestJob_column";

export const _TASK_PARENT_CHILD_IS_DB_AUTHORITATIVE =
  "harvest_job_parent_job_id_column_is_the_source_of_truth_never_inferred_from_code";
